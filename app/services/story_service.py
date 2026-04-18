from __future__ import annotations

import json
import math
import re
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.llm_runtime import DeepSeekClient
from app.models import (
    ActOutlineSection,
    AutoNamedCharacter,
    CharacterCard,
    CharacterRelation,
    GeneratedChapter,
    GeneratedOutline,
    OutlineGenerationRequest,
    OutlineGenerationResponse,
    RelationSupplementResponse,
    StoryDraftRequest,
    StorySelectionRewriteRequest,
    StorySelectionRewriteResponse,
    StoryGenerationRequest,
    StoryGenerationResponse,
)


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"
DEBUG_RELATIONS_PATH = Path(__file__).resolve().parents[2] / "test" / "test.txt"


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

    async def generate_outline(self, request: OutlineGenerationRequest) -> OutlineGenerationResponse:
        story = self._normalize_story(request.story)
        story, auto_named_characters = await self._assign_names_to_unnamed_characters(story)
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
                "STORY_JSON": self._build_compact_story_prompt_json(
                    story,
                    outline_targets,
                    include_relation_ids=False,
                ),
                "STORY_STYLE_GUIDANCE": self._build_story_style_guidance(story),
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
                    "content": (
                        "You are a literary novel planner. Follow the user's prompt template "
                        "exactly and return one strict JSON object only, parsable by Python "
                        "json.loads, with no markdown or extra text."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.75,
            retry_instruction=self._outline_truncation_retry_instruction(),
        )
        outline = GeneratedOutline.model_validate(result)
        outline.act_structure = self._normalize_act_structure(outline.act_structure, outline.chapter_count)
        return OutlineGenerationResponse(
            story=story,
            outline=outline,
            auto_named_characters=auto_named_characters,
        )

    async def supplement_relations(self, story: StoryDraftRequest) -> RelationSupplementResponse:
        story = self._normalize_story(story)
        if len(story.characters) < 2:
            raise ValueError("至少需要两名角色后，AI 才能补充角色关系。")

        chapter_targets = self._chapter_targets(story.total_words, story.chapter_words or 2000)
        user_prompt = _render_prompt(
            "relation_supplement_prompt.txt",
            {
                "STORY_JSON": self._build_compact_story_prompt_json(
                    story,
                    chapter_targets,
                    include_relation_ids=True,
                ),
                "STORY_STYLE_GUIDANCE": self._build_story_style_guidance(story),
            },
        )

        result = await self.client.chat_json(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You expand a story character graph. Follow the user's prompt template "
                        "exactly and return one strict JSON object only, parsable by Python "
                        "json.loads, with no markdown or extra text."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.55,
        )

        added_relations = self._extract_ai_relations(result, story)
        self._write_relation_debug_dump(story.relations, added_relations)
        return RelationSupplementResponse(added_relations=added_relations)

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
                    "STORY_JSON": self._build_compact_story_prompt_json(
                        story,
                        chapter_targets,
                        include_relation_ids=False,
                    ),
                    "STORY_STYLE_GUIDANCE": self._build_story_style_guidance(story),
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
                        "content": (
                            "You are a literary novelist. Follow the user's prompt template "
                            "exactly and return one strict JSON object only, parsable by Python "
                            "json.loads, with no markdown or extra text."
                        ),
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

    async def rewrite_story_selection(
        self,
        request: StorySelectionRewriteRequest,
    ) -> StorySelectionRewriteResponse:
        story = self._normalize_story(request.story)
        outline = request.outline
        outline.act_structure = self._normalize_act_structure(outline.act_structure, outline.chapter_count)

        chapter_context = {
            "chapter_number": request.chapter_number,
            "chapter_title": request.chapter_title,
            "chapter_summary": request.chapter_summary,
        }
        user_prompt = "\n\n".join(
            [
                "你需要局部重写一段小说正文，只返回重写后的文本本身，不要解释、不要加引号、不要加标题。",
                f"故事风格指导：\n{self._build_story_style_guidance(story)}",
                f"故事设定 JSON：\n{self._build_compact_story_prompt_json(story, self._chapter_targets(story.total_words, story.chapter_words or 2000), include_relation_ids=False)}",
                f"大纲 JSON：\n{json.dumps(outline.model_dump(), ensure_ascii=False, indent=2)}",
                f"当前章节信息：\n{json.dumps(chapter_context, ensure_ascii=False, indent=2)}",
                f"选中的原文：\n{request.selected_text}",
                f"选中片段前文（可为空）：\n{request.before_context or '无'}",
                f"选中片段后文（可为空）：\n{request.after_context or '无'}",
                f"额外要求：\n{request.instruction or '保持原章节语气、人物状态和叙事事实，只重写选中片段。'}",
                "请确保：",
                "1. 不要改动未选中的剧情事实。",
                "2. 语气、视角、时态、人物称谓与上下文一致。",
                "3. 输出长度与原文大致相当，可略微润色但不要无限扩写。",
            ]
        )

        rewritten_text = await self.client.chat(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You rewrite a selected span of a Chinese novel chapter. Return only the rewritten "
                        "replacement text, with no markdown, no quotation marks, no preface, and no explanation."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.75,
        )
        cleaned = rewritten_text.strip()
        if not cleaned:
            raise ValueError("模型没有返回可用的局部重写内容。")

        return StorySelectionRewriteResponse(rewritten_text=cleaned)

    def _normalize_story(self, story: StoryDraftRequest) -> StoryDraftRequest:
        chapter_words = story.chapter_words or min(2000, story.total_words)
        if chapter_words <= 0:
            chapter_words = min(2000, story.total_words)
        normalized_characters = self._normalize_characters(story.characters)
        display_names = self._character_display_names(normalized_characters)
        normalized_relations = self._normalize_relations(story.relations, display_names)
        return story.model_copy(
            update={
                "chapter_words": chapter_words,
                "characters": normalized_characters,
                "relations": normalized_relations,
            }
        )

    async def _assign_names_to_unnamed_characters(
        self,
        story: StoryDraftRequest,
    ) -> tuple[StoryDraftRequest, List[AutoNamedCharacter]]:
        if not story.characters:
            return story, []

        working_story = story
        auto_named_characters: List[AutoNamedCharacter] = []
        used_name_keys = {
            self._character_name_key(character.name)
            for character in working_story.characters
            if self._clean_character_name(character.name)
        }

        for character in working_story.characters:
            if self._clean_character_name(character.name):
                continue

            generated_name = await self._generate_name_for_character(
                working_story,
                character.id,
                used_name_keys,
            )
            working_story = self._update_character_name(
                working_story,
                character.id,
                generated_name,
            )
            auto_named_characters.append(
                AutoNamedCharacter(id=character.id, name=generated_name)
            )
            used_name_keys.add(self._character_name_key(generated_name))

        return working_story, auto_named_characters

    async def _generate_name_for_character(
        self,
        story: StoryDraftRequest,
        target_character_id: str,
        used_name_keys: set[str],
    ) -> str:
        user_prompt = _render_prompt(
            "character_name_prompt.txt",
            {
                "TARGET_CHARACTER_ID": json.dumps(target_character_id, ensure_ascii=False),
                "NAMING_CONTEXT_JSON": self._build_character_naming_context_json(
                    story,
                    target_character_id,
                ),
                "STORY_STYLE_GUIDANCE": self._build_story_style_guidance(story),
            },
        )
        messages = [
            {
                "role": "system",
                "content": (
                    "You name one story character at a time. Output exactly one character "
                    "name only, with no explanation, markdown, JSON, numbering, or quotes."
                ),
            },
            {"role": "user", "content": user_prompt},
        ]

        for _ in range(3):
            raw_name = await self.client.chat(messages=messages, temperature=0.8)
            candidate = self._sanitize_generated_character_name(raw_name)
            validation_error = self._validate_generated_character_name(
                candidate,
                used_name_keys,
            )
            if not validation_error:
                return candidate

            messages.extend(
                [
                    {"role": "assistant", "content": raw_name},
                    {
                        "role": "user",
                        "content": (
                            f"你刚才输出的内容不符合要求：{validation_error}。"
                            "请重新输出一个不重复、符合语境的角色姓名，仍然只输出名字。"
                        ),
                    },
                ]
            )

        raise ValueError("AI 未能为未命名角色生成合规姓名，请先手动填写角色姓名后再生成大纲。")

    def _build_character_naming_context_json(
        self,
        story: StoryDraftRequest,
        target_character_id: str,
    ) -> str:
        target_character = next(
            (character for character in story.characters if character.id == target_character_id),
            None,
        )
        if target_character is None:
            raise ValueError("待命名角色不存在，无法继续生成大纲。")

        reference_names = self._character_reference_names(story.characters)
        payload = {
            "genre": story.genre or "to be inferred",
            "synopsis": story.synopsis,
            "style": story.style or "to be inferred",
            "worldview": {
                "time": story.worldview_time or "to be inferred",
                "physical_environment": story.worldview_physical or "to be inferred",
                "social_environment": story.worldview_social or "to be inferred",
            },
            "existing_names": [
                self._clean_character_name(character.name)
                for character in story.characters
                if character.id != target_character_id and self._clean_character_name(character.name)
            ],
            "target_character": self._serialize_character_for_naming_prompt(
                target_character,
                target_character_id,
                reference_names,
            ),
            "target_relations": self._serialize_target_relations_for_naming_prompt(
                story.relations,
                reference_names,
                target_character_id,
            ),
            "all_characters": self._serialize_characters_for_naming_prompt(
                story.characters,
                target_character_id,
                reference_names,
            ),
            "all_relations": self._serialize_compact_relations_for_prompt(
                story.relations,
                reference_names,
                include_relation_ids=True,
            ),
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    def _build_story_style_guidance(self, story: StoryDraftRequest) -> str:
        genre = re.sub(r"\s+", " ", str(story.genre or "")).strip()
        style = re.sub(r"\s+", " ", str(story.style or "")).strip()
        return _render_prompt(
            "story_style_guidance_prompt.txt",
            {
                "STORY_GENRE": genre or "待模型推断",
                "STORY_STYLE": style or "待模型推断",
            },
        )

    @staticmethod
    def _update_character_name(
        story: StoryDraftRequest,
        target_character_id: str,
        name: str,
    ) -> StoryDraftRequest:
        cleaned_name = StoryService._clean_character_name(name)
        if not cleaned_name:
            return story

        updated_characters = [
            character.model_copy(update={"name": cleaned_name})
            if character.id == target_character_id
            else character
            for character in story.characters
        ]
        display_names = StoryService._character_display_names(updated_characters)
        updated_relations = StoryService._normalize_relations(story.relations, display_names)
        return story.model_copy(
            update={
                "characters": updated_characters,
                "relations": updated_relations,
            }
        )

    @staticmethod
    def _normalize_characters(characters: List[CharacterCard]) -> List[CharacterCard]:
        normalized: List[CharacterCard] = []
        for character in characters:
            normalized.append(
                character.model_copy(
                    update={
                        "name": StoryService._clean_character_name(character.name),
                        "gender": re.sub(r"\s+", " ", character.gender).strip(),
                        "age": re.sub(r"\s+", " ", character.age).strip(),
                        "occupation": re.sub(r"\s+", " ", character.occupation).strip(),
                        "nationality": re.sub(r"\s+", " ", character.nationality).strip(),
                        "personality": character.personality.strip(),
                        "appearance": character.appearance.strip(),
                        "values": character.values.strip(),
                        "core_motivation": character.core_motivation.strip(),
                    }
                )
            )
        return normalized

    @staticmethod
    def _clean_character_name(name: str) -> str:
        return re.sub(r"\s+", " ", str(name or "")).strip()

    @classmethod
    def _character_name_key(cls, name: str) -> str:
        return re.sub(r"\s+", "", cls._clean_character_name(name)).casefold()

    @staticmethod
    def _character_reference_names(characters: List[CharacterCard]) -> Dict[str, str]:
        reference_names: Dict[str, str] = {}
        unnamed_index = 1

        for character in characters:
            cleaned_name = StoryService._clean_character_name(character.name)
            if cleaned_name:
                reference_names[character.id] = cleaned_name
                continue
            reference_names[character.id] = f"待命名角色{unnamed_index}"
            unnamed_index += 1

        return reference_names

    @staticmethod
    def _character_optional_prompt_fields(character: CharacterCard) -> Dict[str, str]:
        optional_fields = {
            "gender": character.gender,
            "age": character.age,
            "occupation": character.occupation,
            "nationality": character.nationality,
            "personality": character.personality,
            "appearance": character.appearance,
            "values": character.values,
            "core_motivation": character.core_motivation,
        }
        serialized: Dict[str, str] = {}

        for key, value in optional_fields.items():
            cleaned = re.sub(r"\s+", " ", str(value or "")).strip()
            if cleaned:
                serialized[key] = cleaned

        return serialized

    @classmethod
    def _serialize_character_for_naming_prompt(
        cls,
        character: CharacterCard,
        target_character_id: str,
        reference_names: Dict[str, str],
    ) -> Dict[str, Any]:
        item: Dict[str, Any] = {
            "id": character.id,
            "name": reference_names.get(character.id, ""),
            "needs_naming": character.id == target_character_id,
        }
        item.update(cls._character_optional_prompt_fields(character))
        return item

    @classmethod
    def _serialize_characters_for_naming_prompt(
        cls,
        characters: List[CharacterCard],
        target_character_id: str,
        reference_names: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        return [
            cls._serialize_character_for_naming_prompt(
                character,
                target_character_id,
                reference_names,
            )
            for character in characters
        ]

    @staticmethod
    def _serialize_target_relations_for_naming_prompt(
        relations: List[CharacterRelation],
        reference_names: Dict[str, str],
        target_character_id: str,
    ) -> List[Dict[str, Any]]:
        serialized: List[Dict[str, Any]] = []

        for relation in relations:
            if target_character_id not in {relation.source_id, relation.target_id}:
                continue

            source_name = re.sub(
                r"\s+",
                " ",
                reference_names.get(relation.source_id, relation.source_name or ""),
            ).strip()
            target_name = re.sub(
                r"\s+",
                " ",
                reference_names.get(relation.target_id, relation.target_name or ""),
            ).strip()
            label = re.sub(r"\s+", " ", relation.label).strip()
            if not source_name or not target_name or not label:
                continue

            other_character_id = (
                relation.target_id if relation.source_id == target_character_id else relation.source_id
            )
            serialized.append(
                {
                    "direction": "outgoing" if relation.source_id == target_character_id else "incoming",
                    "source_name": source_name,
                    "target_name": target_name,
                    "other_character_id": other_character_id,
                    "other_character_name": reference_names.get(other_character_id, ""),
                    "label": label,
                    "bidirectional": bool(relation.bidirectional),
                    "relation_source": relation.relation_source,
                }
            )

        return serialized

    @classmethod
    def _sanitize_generated_character_name(cls, content: str) -> str:
        stripped = content.strip()
        if stripped.startswith("```"):
            fence_match = re.search(r"```(?:\w+)?\s*(.*?)```", stripped, re.DOTALL)
            if fence_match:
                stripped = fence_match.group(1).strip()

        lines = [line.strip() for line in stripped.splitlines() if line.strip()]
        if lines:
            stripped = lines[0]

        stripped = re.sub(r"^(?:[-*]|\d+[.)、])\s*", "", stripped)
        stripped = re.sub(r"^(?:名字|姓名|角色名|name)\s*[:：]\s*", "", stripped, flags=re.IGNORECASE)
        stripped = stripped.strip().strip("\"'“”‘’`")
        stripped = re.split(r"[，。,；;：:（(【\[]", stripped, maxsplit=1)[0].strip()
        return cls._clean_character_name(stripped)

    @classmethod
    def _validate_generated_character_name(
        cls,
        candidate: str,
        used_name_keys: set[str],
    ) -> str:
        if not candidate:
            return "没有输出有效名字"
        if len(candidate) > 24:
            return "输出不像一个简洁自然的人名"
        if any(marker in candidate for marker in ("{", "}", "[", "]", "、", "/", "|")):
            return "输出包含结构化内容或多个候选"
        if re.fullmatch(r"(未命名角色|角色\d+|人物\d+|待命名角色\d*)", candidate):
            return "输出仍是占位名"
        if cls._character_name_key(candidate) in used_name_keys:
            return "与已有角色重名"
        return ""

    @staticmethod
    def _character_display_names(characters: List[CharacterCard]) -> Dict[str, str]:
        return {
            character.id: character.name or f"角色{index + 1}"
            for index, character in enumerate(characters)
        }

    @staticmethod
    def _normalize_relations(
        relations: List[CharacterRelation],
        display_names: Dict[str, str],
    ) -> List[CharacterRelation]:
        relation_map: Dict[tuple[str, str], CharacterRelation] = {}

        for relation in relations:
            source_id = relation.source_id.strip()
            target_id = relation.target_id.strip()
            label = re.sub(r"\s+", " ", relation.label).strip()
            if not source_id or not target_id or not label or source_id == target_id:
                continue
            if source_id not in display_names or target_id not in display_names:
                continue
            relation_map[(source_id, target_id)] = relation.model_copy(
                update={
                    "source_id": source_id,
                    "target_id": target_id,
                    "label": label,
                    "source_name": display_names.get(source_id, relation.source_name or source_id),
                    "target_name": display_names.get(target_id, relation.target_name or target_id),
                    "bidirectional": bool(relation.bidirectional),
                }
            )

        return list(relation_map.values())

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
        display_names = StoryService._character_display_names(story.characters)
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
            "characters": [
                {
                    **character.model_dump(),
                    "display_name": display_names.get(character.id, character.name or "未命名角色"),
                }
                for character in story.characters
            ],
            "relations": [relation.model_dump() for relation in story.relations],
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    @staticmethod
    def _build_story_prompt_json(
        story: StoryDraftRequest,
        chapter_targets: List[int],
        *,
        include_relation_ids: bool,
    ) -> str:
        display_names = StoryService._character_display_names(story.characters)
        payload = {
            "genre": story.genre or "待模型补全",
            "synopsis": story.synopsis,
            "style": story.style or "待模型补全",
            "worldview": {
                "time": story.worldview_time or "待模型补全",
                "physical_environment": story.worldview_physical or "待模型补全",
                "social_environment": story.worldview_social or "待模型补全",
            },
            "total_words": story.total_words,
            "chapter_words": story.chapter_words,
            "chapter_targets": chapter_targets,
            "characters": [
                {
                    **character.model_dump(),
                    "display_name": display_names.get(character.id, character.name or "未命名角色"),
                }
                for character in story.characters
            ],
            "relations": StoryService._serialize_relations_for_prompt(
                story.relations,
                display_names,
                include_relation_ids=include_relation_ids,
            ),
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    @staticmethod
    def _serialize_relations_for_prompt(
        relations: List[CharacterRelation],
        display_names: Dict[str, str],
        *,
        include_relation_ids: bool,
    ) -> List[Dict[str, Any]]:
        serialized: List[Dict[str, Any]] = []

        for relation in relations:
            source_name = re.sub(
                r"\s+",
                " ",
                display_names.get(relation.source_id, relation.source_name or ""),
            ).strip()
            target_name = re.sub(
                r"\s+",
                " ",
                display_names.get(relation.target_id, relation.target_name or ""),
            ).strip()
            label = re.sub(r"\s+", " ", relation.label).strip()
            if not source_name or not target_name or not label:
                continue

            item: Dict[str, Any] = {
                "source_name": source_name,
                "target_name": target_name,
                "label": label,
                "bidirectional": bool(relation.bidirectional),
                "relation_source": relation.relation_source,
            }
            if include_relation_ids:
                item["source_id"] = relation.source_id
                item["target_id"] = relation.target_id

            serialized.append(item)

        return serialized

    @staticmethod
    def _build_compact_story_prompt_json(
        story: StoryDraftRequest,
        chapter_targets: List[int],
        *,
        include_relation_ids: bool,
    ) -> str:
        display_names = StoryService._character_display_names(story.characters)
        payload = {
            "genre": story.genre or "to be inferred",
            "synopsis": story.synopsis,
            "style": story.style or "to be inferred",
            "worldview": {
                "time": story.worldview_time or "to be inferred",
                "physical_environment": story.worldview_physical or "to be inferred",
                "social_environment": story.worldview_social or "to be inferred",
            },
            "total_words": story.total_words,
            "chapter_words": story.chapter_words,
            "chapter_targets": chapter_targets,
            "characters": StoryService._serialize_characters_for_prompt(
                story.characters,
                display_names,
            ),
            "relations": StoryService._serialize_compact_relations_for_prompt(
                story.relations,
                display_names,
                include_relation_ids=include_relation_ids,
            ),
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    @staticmethod
    def _serialize_characters_for_prompt(
        characters: List[CharacterCard],
        display_names: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        serialized: List[Dict[str, Any]] = []

        for character in characters:
            item: Dict[str, Any] = {
                "id": character.id,
                "name": display_names.get(character.id, character.name or "Unnamed character"),
            }
            item.update(StoryService._character_optional_prompt_fields(character))
            serialized.append(item)

        return serialized

    @staticmethod
    def _serialize_compact_relations_for_prompt(
        relations: List[CharacterRelation],
        display_names: Dict[str, str],
        *,
        include_relation_ids: bool,
    ) -> List[Dict[str, Any]]:
        serialized: List[Dict[str, Any]] = []
        relation_keys = {
            (
                relation.source_id,
                relation.target_id,
                re.sub(r"\s+", " ", relation.label).strip(),
                bool(relation.bidirectional),
            )
            for relation in relations
        }
        compacted_bidirectional_pairs: set[tuple[str, str, str]] = set()

        for relation in relations:
            source_name = re.sub(
                r"\s+",
                " ",
                display_names.get(relation.source_id, relation.source_name or ""),
            ).strip()
            target_name = re.sub(
                r"\s+",
                " ",
                display_names.get(relation.target_id, relation.target_name or ""),
            ).strip()
            label = re.sub(r"\s+", " ", relation.label).strip()
            if not source_name or not target_name or not label:
                continue

            if not include_relation_ids and relation.bidirectional:
                reverse_key = (relation.target_id, relation.source_id, label, True)
                pair_key = tuple(sorted((relation.source_id, relation.target_id))) + (label,)
                if reverse_key in relation_keys:
                    if pair_key in compacted_bidirectional_pairs:
                        continue
                    compacted_bidirectional_pairs.add(pair_key)

            item: Dict[str, Any] = {
                "source_name": source_name,
                "target_name": target_name,
                "label": label,
                "bidirectional": bool(relation.bidirectional),
                "relation_source": relation.relation_source,
            }
            if include_relation_ids:
                item["source_id"] = relation.source_id
                item["target_id"] = relation.target_id

            serialized.append(item)

        return serialized

    @staticmethod
    def _outline_truncation_retry_instruction() -> str:
        return (
            "Your previous outline JSON appears too long or truncated. Regenerate the full outline "
            "JSON from scratch and keep it much more concise while preserving the same structure. "
            "Keep all required fields, keep every chapter entry, keep the overall summary under "
            "220 Chinese characters, keep each act_structure content under 70 Chinese characters, "
            "keep each chapter summary under 90 Chinese characters, keep each key_events item short, "
            "keep each cliffhanger under 24 Chinese characters, and output one complete JSON object only."
        )

    def _extract_ai_relations(
        self,
        result: Dict[str, Any],
        story: StoryDraftRequest,
    ) -> List[CharacterRelation]:
        raw_relations = result.get("relations", result.get("added_relations", []))
        if not isinstance(raw_relations, list):
            raise ValueError("AI 返回的角色关系格式不正确。")

        display_names = self._character_display_names(story.characters)
        character_by_id = {character.id: character for character in story.characters}
        character_ids_by_name: Dict[str, str] = {}
        for character in story.characters:
            name = display_names.get(character.id, "").strip()
            if name and name not in character_ids_by_name:
                character_ids_by_name[name] = character.id

        existing_keys = {(relation.source_id, relation.target_id) for relation in story.relations}
        added_relations: List[CharacterRelation] = []

        for item in raw_relations:
            relation = self._build_ai_relation(
                item,
                character_by_id=character_by_id,
                character_ids_by_name=character_ids_by_name,
                display_names=display_names,
            )
            if not relation:
                continue

            key = (relation.source_id, relation.target_id)
            if key in existing_keys:
                continue

            existing_keys.add(key)
            added_relations.append(relation)

        return added_relations

    @staticmethod
    def _build_ai_relation(
        item: Any,
        *,
        character_by_id: Dict[str, CharacterCard],
        character_ids_by_name: Dict[str, str],
        display_names: Dict[str, str],
    ) -> Optional[CharacterRelation]:
        if not isinstance(item, dict):
            return None

        source_id = StoryService._resolve_character_id(
            item,
            id_keys=("source_id", "source"),
            name_keys=("source_name", "source_character", "from_name", "from"),
            character_ids_by_name=character_ids_by_name,
        )
        target_id = StoryService._resolve_character_id(
            item,
            id_keys=("target_id", "target"),
            name_keys=("target_name", "target_character", "to_name", "to"),
            character_ids_by_name=character_ids_by_name,
        )
        label = StoryService._first_non_empty_text(
            item,
            ("label", "relation", "relationship", "relation_label", "name"),
        )

        if not source_id or not target_id or not label or source_id == target_id:
            return None
        if source_id not in character_by_id or target_id not in character_by_id:
            return None

        return CharacterRelation(
            id=f"relation-ai-{source_id}-{target_id}",
            source_id=source_id,
            target_id=target_id,
            label=label,
            source_name=display_names.get(source_id, source_id),
            target_name=display_names.get(target_id, target_id),
            bidirectional=StoryService._coerce_bool(
                item.get("bidirectional", item.get("is_bidirectional", False))
            ),
            relation_source="ai",
        )

    @staticmethod
    def _resolve_character_id(
        item: Dict[str, Any],
        *,
        id_keys: tuple[str, ...],
        name_keys: tuple[str, ...],
        character_ids_by_name: Dict[str, str],
    ) -> str:
        direct_id = StoryService._first_non_empty_text(item, id_keys)
        if direct_id:
            return direct_id

        character_name = StoryService._first_non_empty_text(item, name_keys)
        return character_ids_by_name.get(character_name, "")

    @staticmethod
    def _first_non_empty_text(item: Dict[str, Any], keys: tuple[str, ...]) -> str:
        for key in keys:
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @staticmethod
    def _coerce_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"true", "1", "yes", "y"}
        if isinstance(value, (int, float)):
            return bool(value)
        return False

    def _write_relation_debug_dump(
        self,
        existing_relations: List[CharacterRelation],
        added_relations: List[CharacterRelation],
    ) -> None:
        all_relations = [*existing_relations, *added_relations]
        debug_payload = {
            "trigger": "ai_supplement_relations",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "counts": {
                "all_relations": len(all_relations),
                "user_relations": sum(1 for relation in all_relations if relation.relation_source == "user"),
                "ai_relations": sum(1 for relation in all_relations if relation.relation_source == "ai"),
                "latest_ai_added_relations": len(added_relations),
            },
            "user_relations": [
                relation.model_dump()
                for relation in all_relations
                if relation.relation_source == "user"
            ],
            "ai_relations": [
                relation.model_dump()
                for relation in all_relations
                if relation.relation_source == "ai"
            ],
            "latest_ai_added_relations": [relation.model_dump() for relation in added_relations],
            "all_relations": [relation.model_dump() for relation in all_relations],
        }

        DEBUG_RELATIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
        DEBUG_RELATIONS_PATH.write_text(
            json.dumps(debug_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

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
