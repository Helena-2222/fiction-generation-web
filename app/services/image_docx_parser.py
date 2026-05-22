from __future__ import annotations

import io
import re

from docx import Document

from app.image_models import ImportedNovelData


FIELD_PATTERNS = {
    "novel_title": [r"标题[:：]\s*(.+)"],
    "world_setting": [r"世界观[:：]\s*(.+)", r"社会环境[:：]\s*(.+)"],
    "era": [r"时间背景[:：]\s*(.+)", r"时代背景[:：]\s*(.+)"],
    "language_style": [r"语言风格[:：]\s*(.+)"],
}

EMPTY_SENTINELS = {
    "",
    "未填写",
    "未提供",
    "无",
    "暂无",
    "暂无设定",
    "待补充",
    "无具体设定",
}


def parse_novel_docx(file_bytes: bytes) -> dict:
    doc = Document(io.BytesIO(file_bytes))
    lines = [paragraph.text.strip() for paragraph in doc.paragraphs if paragraph.text.strip()]

    data = ImportedNovelData()
    for key, patterns in FIELD_PATTERNS.items():
        setattr(data, key, _match_first(lines, patterns))

    data.characters = _extract_characters(lines)
    data.chapters = _extract_chapters(lines, data)
    return data.model_dump()


def _match_first(lines: list[str], patterns: list[str]) -> str:
    for line in lines:
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return _normalize_text(match.group(1))
    return ""


def _extract_characters(lines: list[str]) -> list[dict]:
    characters: list[dict] = []
    current: dict[str, str] | None = None
    chapter_started = False

    for line in lines:
        if re.match(r"^第\s*\d+\s*章", line):
            chapter_started = True
            break

        if line.startswith("姓名：") or line.startswith("姓名:") or line.startswith("角色名：") or line.startswith("角色名:"):
            if current and current.get("name"):
                characters.append(current)
            current = {
                "name": _split_value(line),
                "gender": "",
                "ethnicity": "",
                "age": "",
                "job": "",
                "appearance": "",
                "costume": "",
                "personality": "",
            }
            continue

        if current is None:
            continue

        if line.startswith("性别"):
            current["gender"] = _split_value(line)
        elif line.startswith("国籍/种族"):
            current["ethnicity"] = _split_value(line)
        elif line.startswith("年龄"):
            current["age"] = _split_value(line)
        elif line.startswith("身份/职业") or line.startswith("身份职业"):
            current["job"] = _split_value(line)
        elif line.startswith("外在特征"):
            current["appearance"] = _split_value(line)
        elif line.startswith("服装设定"):
            current["costume"] = _split_value(line)
        elif line.startswith("性格"):
            current["personality"] = _split_value(line)

    if not chapter_started and current and current.get("name"):
        characters.append(current)
    elif current and current.get("name") and current not in characters:
        characters.append(current)

    return characters


def _extract_chapters(lines: list[str], novel_data: ImportedNovelData) -> list[dict]:
    chapters: list[dict] = []
    current: dict[str, str] | None = None

    for line in lines:
        if re.match(r"^第\s*\d+\s*章", line):
            if current:
                current["prompt"] = _rewrite_chapter_prompt(current, novel_data)
                chapters.append(current)
            current = {
                "id": f"ch{len(chapters) + 1}",
                "title": line,
                "events": "",
                "prompt": "",
            }
            continue

        if current is None:
            continue

        if line.startswith("关键事件"):
            current["events"] = _split_value(line)
        elif line.startswith("章节概述") or line.startswith("章节梗概") or line.startswith("章节概要"):
            current["prompt"] = _clean_chapter_prompt(_split_value(line))
        elif not current["prompt"] and len(line) > 12:
            current["prompt"] = _clean_chapter_prompt(line)

    if current:
        current["prompt"] = _rewrite_chapter_prompt(current, novel_data)
        chapters.append(current)

    return chapters


def _split_value(line: str) -> str:
    parts = re.split(r"[:：]", line, maxsplit=1)
    return _normalize_text(parts[1]) if len(parts) > 1 else ""


def _normalize_text(text: str) -> str:
    value = text.strip()
    return "" if value in EMPTY_SENTINELS else value


def _clean_chapter_prompt(text: str) -> str:
    cleaned = _normalize_text(text)
    if not cleaned:
        return ""

    cleaned = re.sub(r"^\s*时间跨度[^。；;]*?[，,]?\s*节奏[^。；;]*[。；;]?\s*", "", cleaned)
    cleaned = re.sub(r"^\s*时间跨度[^。；;]*[。；;]\s*", "", cleaned)
    cleaned = re.sub(r"^\s*节奏[^。；;]*[。；;]\s*", "", cleaned)
    return cleaned.strip()


def _split_fragments(text: str) -> list[str]:
    return [
        fragment.strip(" ，,；;。.!?、/|")
        for fragment in re.split(r"[\n/|；;。!?]", text or "")
        if fragment.strip(" ，,；;。.!?、/|")
    ]


def _pick_primary_moment(events: str, summary: str, chapter_title: str) -> str:
    candidates = _split_fragments(events) + _split_fragments(summary)
    if not candidates:
        return chapter_title.strip() or "本章最关键的叙事瞬间"

    action_markers = (
        "在",
        "检查",
        "发现",
        "对峙",
        "追逐",
        "凝视",
        "举枪",
        "奔跑",
        "推开",
        "俯身",
        "站在",
        "蹲在",
        "握着",
        "看向",
        "闯入",
        "逼近",
        "回头",
    )

    def score(candidate: str) -> tuple[int, int]:
        action_score = sum(1 for marker in action_markers if marker in candidate)
        return (action_score, min(len(candidate), 28))

    return max(candidates, key=score)


def _pick_supporting_details(events: str, summary: str, primary_moment: str) -> list[str]:
    supporting: list[str] = []
    for candidate in _split_fragments(events) + _split_fragments(summary):
        if candidate == primary_moment or candidate in supporting:
            continue
        supporting.append(candidate)
        if len(supporting) >= 2:
            break
    return supporting


def _build_single_scene_prompt(
    primary_moment: str,
    era: str,
    world_setting: str,
    language_style: str,
) -> str:
    parts: list[str] = []

    if era:
        parts.append(era)
    if world_setting:
        parts.append(world_setting)
    if language_style:
        parts.append(language_style)

    parts.append(primary_moment)
    parts.append("突出人物动作与神情")

    if "电影" in language_style and not any("光影" in part for part in parts):
        parts.append("电影级光影")
    if "悬疑" in language_style and not any("氛围" in part for part in parts):
        parts.append("悬疑氛围")

    parts.extend(
        [
            "中景构图",
            "景深",
            "小说叙事插图",
            "细节细腻",
        ]
    )

    return "，".join(part for part in parts if part).strip("，") + "。"


def _rewrite_chapter_prompt(chapter: dict[str, str], novel_data: ImportedNovelData) -> str:
    summary = _clean_chapter_prompt(chapter.get("prompt", ""))
    events = (chapter.get("events") or "").strip()
    title = chapter.get("title", "").strip()
    era = _normalize_text(novel_data.era)
    world_setting = _normalize_text(novel_data.world_setting)
    language_style = _normalize_text(novel_data.language_style)

    primary_moment = _pick_primary_moment(events, summary, title)
    return _build_single_scene_prompt(primary_moment, era, world_setting, language_style)
