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


def parse_novel_docx(file_bytes: bytes) -> dict:
    doc = Document(io.BytesIO(file_bytes))
    lines = [paragraph.text.strip() for paragraph in doc.paragraphs if paragraph.text.strip()]

    data = ImportedNovelData()
    for key, patterns in FIELD_PATTERNS.items():
        setattr(data, key, _match_first(lines, patterns))

    data.characters = _extract_characters(lines)
    data.chapters = _extract_chapters(lines)
    return data.model_dump()


def _match_first(lines: list[str], patterns: list[str]) -> str:
    for line in lines:
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1).strip()
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


def _extract_chapters(lines: list[str]) -> list[dict]:
    chapters: list[dict] = []
    current: dict[str, str] | None = None

    for line in lines:
        chapter_match = re.match(r"^(第\s*\d+\s*章)\s*[《<（(]?(.*?)[》>)）]?$", line)
        if chapter_match:
            if current:
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
        elif line.startswith("章节概概") or line.startswith("章节梗概") or line.startswith("章节概述"):
            current["prompt"] = _split_value(line)
        elif not current["prompt"] and len(line) > 12:
            current["prompt"] = line

    if current:
        chapters.append(current)

    return chapters


def _split_value(line: str) -> str:
    parts = re.split(r"[:：]", line, maxsplit=1)
    return parts[1].strip() if len(parts) > 1 else ""
