from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

from app.llm import DeepSeekClient
from app.models import (
    ActOutlineSection,
    GeneratedChapter,
    GeneratedOutline,
    OutlineGenerationRequest,
    StoryDraftRequest,
    StoryGenerationRequest,
    StoryGenerationResponse,
)


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


@lru_cache(maxsize=None)
def _load_prompt_template(filename: str) -> str:
    return (PROMPTS_DIR / filename).read_text(encoding="utf-8")


def _render_prompt(template_name: str, replacements: Dict[str, str]) -> str:
    prompt = _load_prompt_template(template_name)
    for key, value in replacements.items():
        prompt = prompt.replace(f"[[{key}]]", value)
    return prompt


class StoryService:
    def __init__(self, client: DeepSeekClient) -> None:
        self.client = client

    async def generate_outline(self, request: OutlineGenerationRequest) -> GeneratedOutline:
        story = self._normalize_story(request.story)
        outline_targets = self._chapter_targets(story.total_words, story.chapter_words or 2000)

        regeneration_block = ""
        if request.previous_outline:
            previous_outline_text = json.dumps(
                request.previous_outline.model_dump(),
                ensure_ascii=False,
                indent=2,
            )
            feedback = request.feedback or "请保留核心设定，但让结构更有文学性、人物关系更复杂、伏笔更细密。"
            regeneration_block = "\n\n".join(
                [
                    "上一版大纲：",
                    previous_outline_text,
                    "用户反馈：",
                    feedback,
                    "请据此重生成一版新的大纲。",
                ]
            )

        user_prompt = _render_prompt(
            "outline_prompt.txt",
            {
                "STORY_JSON": self._story_to_prompt_json(story, outline_targets),
                "CHAPTER_COUNT": str(len(outline_targets)),
                "CHAPTER_TARGETS": json.dumps(outline_targets, ensure_ascii=False),
                "FIRST_TARGET_WORDS": str(outline_targets[0]),
                "REGENERATION_BLOCK": regeneration_block,
            },
        )

        result = await self.client.chat_json(
            messages=[
                {
                    "role": "system",
                    "content": "You are a literary novel planner. Follow the user's prompt template exactly and output JSON only.",
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.85,
        )
        outline = GeneratedOutline.model_validate(result)
        outline.act_structure = self._normalize_act_structure(outline.act_structure, outline.chapter_count)
        return outline

    async def generate_story(self, request: StoryGenerationRequest) -> StoryGenerationResponse:
        story = self._normalize_story(request.story)
        outline = request.outline
        outline.act_structure = self._normalize_act_structure(outline.act_structure, outline.chapter_count)

        generated_chapters: List[GeneratedChapter] = []
        continuity_summaries: List[Dict[str, str]] = []
        chapter_targets = self._chapter_targets(story.total_words, story.chapter_words or 2000)
        outline_json = json.dumps(outline.model_dump(), ensure_ascii=False, indent=2)

        for chapter in outline.chapters:
            stage_context = self._get_stage_context(outline, chapter.chapter_number)
            stage_chapters = [
                {
                    "chapter_number": item.chapter_number,
                    "title": item.title,
                    "summary": item.summary,
                }
                for item in outline.chapters
                if stage_context["start_chapter"] <= item.chapter_number <= stage_context["end_chapter"]
            ]

            chapter_spec = {
                "chapter_number": chapter.chapter_number,
                "title": chapter.title,
                "target_words": chapter.target_words,
                "summary": chapter.summary,
                "key_events": chapter.key_events,
                "cliffhanger": chapter.cliffhanger,
                "stage": stage_context["stage"],
                "stage_range": stage_context["chapter_range"],
                "stage_content": stage_context["content"],
                "stage_chapters": stage_chapters,
            }

            user_prompt = _render_prompt(
                "detail_prompt.txt",
                {
                    "CHAPTER_NUMBER": str(chapter.chapter_number),
                    "STORY_JSON": self._story_to_prompt_json(story, chapter_targets),
                    "OUTLINE_JSON": outline_json,
                    "CONTINUITY_SUMMARIES": json.dumps(
                        continuity_summaries,
                        ensure_ascii=False,
                        indent=2,
                    ) if continuity_summaries else "尚无前文，请从开篇写起。",
                    "CHAPTER_SPEC": json.dumps(chapter_spec, ensure_ascii=False, indent=2),
                    "CHAPTER_TITLE_JSON": json.dumps(chapter.title, ensure_ascii=False),
                },
            )

            result = await self.client.chat_json(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a literary novelist. Follow the user's prompt template exactly and output JSON only.",
                    },
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.9,
            )

            generated = GeneratedChapter.model_validate(result)
            generated_chapters.append(generated)
            continuity_summaries.append(
                {
                    "chapter_number": str(generated.chapter_number),
                    "title": generated.title,
                    "summary": generated.summary,
                }
            )

        return StoryGenerationResponse(title=outline.title, chapters=generated_chapters)

    def _normalize_story(self, story: StoryDraftRequest) -> StoryDraftRequest:
        chapter_words = story.chapter_words or min(2000, story.total_words)
        if chapter_words <= 0:
            chapter_words = min(2000, story.total_words)
        return story.model_copy(update={"chapter_words": chapter_words})

    @staticmethod
    def _chapter_targets(total_words: int, chapter_words: int) -> List[int]:
        chapter_count = max(1, math.ceil(total_words / chapter_words))
        targets: List[int] = []
        remaining = total_words

        for _ in range(chapter_count):
            target = min(chapter_words, remaining)
            if target <= 0:
                target = chapter_words
            targets.append(target)
            remaining -= target

        return targets

    @staticmethod
    def _story_to_prompt_json(story: StoryDraftRequest, chapter_targets: List[int]) -> str:
        payload = {
            "genre": story.genre or "待模型补充",
            "synopsis": story.synopsis,
            "style": story.style or "待模型补充",
            "worldview": {
                "time": story.worldview_time or "待模型补充",
                "physical_environment": story.worldview_physical or "待模型补充",
                "social_environment": story.worldview_social or "待模型补充",
            },
            "total_words": story.total_words,
            "chapter_words": story.chapter_words,
            "chapter_targets": chapter_targets,
            "characters": [character.model_dump() for character in story.characters],
            "relations": [relation.model_dump() for relation in story.relations],
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    @staticmethod
    def _extract_range_numbers(section: ActOutlineSection) -> tuple[int, int]:
        if section.start_chapter and section.end_chapter:
            return section.start_chapter, section.end_chapter

        numbers = [int(value) for value in re.findall(r"\d+", section.chapter_range or "")]
        if len(numbers) >= 2:
            return numbers[0], numbers[1]
        if len(numbers) == 1:
            return numbers[0], numbers[0]
        return 1, 1

    def _normalize_act_structure(
        self,
        sections: List[ActOutlineSection],
        chapter_count: int,
    ) -> List[ActOutlineSection]:
        normalized: List[ActOutlineSection] = []
        defaults = ["开端", "发展", "高潮", "结局"]

        for index, section in enumerate(sections or []):
            start, end = self._extract_range_numbers(section)
            start = max(1, min(start, chapter_count))
            end = max(1, min(end, chapter_count))
            if start > end:
                start, end = end, start
            normalized.append(
                section.model_copy(
                    update={
                        "stage": section.stage or defaults[index] if index < len(defaults) else section.stage,
                        "start_chapter": start,
                        "end_chapter": end,
                        "chapter_range": f"第{start}章-第{end}章",
                    }
                )
            )

        return normalized

    def _get_stage_context(self, outline: GeneratedOutline, chapter_number: int) -> Dict[str, object]:
        for section in outline.act_structure:
            start, end = self._extract_range_numbers(section)
            if start <= chapter_number <= end:
                return {
                    "stage": section.stage,
                    "content": section.content,
                    "start_chapter": start,
                    "end_chapter": end,
                    "chapter_range": f"第{start}章-第{end}章",
                }
        return {
            "stage": "未标注环节",
            "content": "",
            "start_chapter": chapter_number,
            "end_chapter": chapter_number,
            "chapter_range": f"第{chapter_number}章-第{chapter_number}章",
        }
