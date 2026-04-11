from __future__ import annotations

import json
import re
from typing import Any, Dict, List

import httpx

from app.config import settings


class DeepSeekClient:
    def __init__(self) -> None:
        self._base_url = settings.deepseek_base_url.rstrip("/")
        self._api_key = settings.deepseek_api_key
        self._model = settings.deepseek_model
        self._timeout = settings.request_timeout_seconds

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def chat(self, messages: List[Dict[str, str]], temperature: float = 0.8) -> str:
        if not self.is_configured:
            raise RuntimeError("未配置 DeepSeek API Key，请先在 .env 中设置 DEEPSEEK_API_KEY。")

        payload = {
            "model": self._model,
            "temperature": temperature,
            "messages": messages,
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        return data["choices"][0]["message"]["content"]

    async def chat_json(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> Dict[str, Any]:
        last_error: ValueError | None = None
        last_content = ""
        current_messages = messages
        current_temperature = temperature

        for attempt in range(2):
            last_content = await self.chat(messages=current_messages, temperature=current_temperature)
            try:
                return self._extract_json(last_content)
            except ValueError as exc:
                last_error = exc
                if attempt == 0:
                    current_messages = self._build_json_repair_messages(messages, last_content)
                    current_temperature = min(temperature, 0.2)
                    continue
                break

        if last_error is not None:
            raise ValueError(
                f"{last_error}；LLM 原始输出摘录：{self._preview_text(last_content)}"
            ) from last_error
        raise ValueError("LLM 未返回可解析的 JSON。")

    @classmethod
    def _build_json_repair_messages(
        cls,
        messages: List[Dict[str, str]],
        content: str,
    ) -> List[Dict[str, str]]:
        return [
            *messages,
            {"role": "assistant", "content": content},
            {
                "role": "user",
                "content": (
                    "请只修复你上一条回复的格式，并重新输出一个严格合法的 JSON 对象。"
                    "要求：只能输出一个 JSON 对象；必须可被 Python json.loads 直接解析；"
                    "不要使用 Markdown 代码块、注释、额外说明；不要出现尾随逗号；"
                    "字符串中的英文双引号必须转义，或改写成不含未转义双引号的表达；"
                    "尽量保持原有字段和语义不变。"
                ),
            },
        ]

    @classmethod
    def _extract_json(cls, content: str) -> Dict[str, Any]:
        stripped = cls._unwrap_code_fence(content)
        candidates: List[str] = []

        for candidate in (stripped, cls._extract_balanced_json_object(stripped)):
            if candidate and candidate not in candidates:
                candidates.append(candidate)

        last_error: json.JSONDecodeError | None = None
        for candidate in candidates:
            for variant in cls._build_parse_variants(candidate):
                try:
                    parsed = json.loads(variant)
                except json.JSONDecodeError as exc:
                    last_error = exc
                    continue

                if not isinstance(parsed, dict):
                    raise ValueError("模型返回的 JSON 根节点不是对象。")
                return parsed

        if last_error is None:
            raise ValueError("模型返回的内容不是合法 JSON。")

        raise ValueError(
            cls._format_json_error(last_error, candidates[-1] if candidates else stripped)
        ) from last_error

    @staticmethod
    def _unwrap_code_fence(content: str) -> str:
        stripped = content.strip()
        if stripped.startswith("```"):
            fence_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, re.DOTALL)
            if fence_match:
                return fence_match.group(1).strip()
        return stripped

    @staticmethod
    def _extract_balanced_json_object(content: str) -> str:
        start = content.find("{")
        if start < 0:
            return ""

        depth = 0
        in_string = False
        escaped = False

        for index in range(start, len(content)):
            char = content[index]
            if in_string:
                if escaped:
                    escaped = False
                    continue
                if char == "\\":
                    escaped = True
                    continue
                if char == "\"":
                    in_string = False
                continue

            if char == "\"":
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return content[start:index + 1]

        return content[start:].strip()

    @classmethod
    def _build_parse_variants(cls, content: str) -> List[str]:
        variants: List[str] = []
        for candidate in (content, cls._sanitize_json_like_text(content)):
            if candidate and candidate not in variants:
                variants.append(candidate)
        return variants

    @classmethod
    def _sanitize_json_like_text(cls, content: str) -> str:
        sanitized = content.replace("\ufeff", "").replace("\u00a0", " ").replace("\u3000", " ")
        sanitized = sanitized.replace("\u201c", "\"").replace("\u201d", "\"")
        sanitized = sanitized.replace("\u2018", "'").replace("\u2019", "'")
        sanitized = cls._normalize_structural_punctuation(sanitized)
        sanitized = cls._escape_problematic_chars_in_strings(sanitized)
        sanitized = cls._remove_trailing_commas(sanitized)
        return sanitized.strip()

    @staticmethod
    def _normalize_structural_punctuation(content: str) -> str:
        replacements = {
            "｛": "{",
            "｝": "}",
            "［": "[",
            "］": "]",
            "：": ":",
            "，": ",",
        }
        result: List[str] = []
        in_string = False
        escaped = False

        for char in content:
            if in_string:
                result.append(char)
                if escaped:
                    escaped = False
                    continue
                if char == "\\":
                    escaped = True
                elif char == "\"":
                    in_string = False
                continue

            normalized = replacements.get(char, char)
            result.append(normalized)
            if normalized == "\"":
                in_string = True

        return "".join(result)

    @staticmethod
    def _escape_problematic_chars_in_strings(content: str) -> str:
        result: List[str] = []
        in_string = False
        escaped = False
        length = len(content)

        for index, char in enumerate(content):
            if in_string:
                if escaped:
                    result.append(char)
                    escaped = False
                    continue

                if char == "\\":
                    result.append(char)
                    escaped = True
                    continue

                if char == "\"":
                    next_significant = ""
                    for look_ahead in range(index + 1, length):
                        probe = content[look_ahead]
                        if probe in {" ", "\n", "\r", "\t"}:
                            continue
                        next_significant = probe
                        break

                    if next_significant in {":", ",", "}", "]", ""}:
                        in_string = False
                        result.append(char)
                    else:
                        result.append("\\\"")
                    continue

                if char == "\n":
                    result.append("\\n")
                    continue
                if char == "\r":
                    result.append("\\r")
                    continue
                if char == "\t":
                    result.append("\\t")
                    continue
                if ord(char) < 32:
                    result.append(" ")
                    continue

                result.append(char)
                continue

            if char == "\"":
                in_string = True
            result.append(char)

        return "".join(result)

    @staticmethod
    def _remove_trailing_commas(content: str) -> str:
        result: List[str] = []
        in_string = False
        escaped = False
        index = 0
        length = len(content)

        while index < length:
            char = content[index]
            if in_string:
                result.append(char)
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == "\"":
                    in_string = False
                index += 1
                continue

            if char == "\"":
                in_string = True
                result.append(char)
                index += 1
                continue

            if char == ",":
                next_significant = ""
                for look_ahead in range(index + 1, length):
                    probe = content[look_ahead]
                    if probe in {" ", "\n", "\r", "\t"}:
                        continue
                    next_significant = probe
                    break

                if next_significant in {"}", "]"}:
                    index += 1
                    continue

            result.append(char)
            index += 1

        return "".join(result)

    @staticmethod
    def _format_json_error(exc: json.JSONDecodeError, content: str) -> str:
        start = max(0, exc.pos - 80)
        end = min(len(content), exc.pos + 80)
        snippet = content[start:end].replace("\n", "\\n")
        return (
            f"模型返回的 JSON 解析失败：{exc.msg} "
            f"(line {exc.lineno}, column {exc.colno}, char {exc.pos})。"
            f" 附近内容：{snippet}"
        )

    @staticmethod
    def _preview_text(content: str, limit: int = 220) -> str:
        preview = re.sub(r"\s+", " ", content).strip()
        if len(preview) <= limit:
            return preview
        return f"{preview[:limit]}..."
