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
        self._json_max_tokens = settings.deepseek_json_max_tokens

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def chat(self, messages: List[Dict[str, str]], temperature: float = 0.8) -> str:
        completion = await self._create_completion(messages=messages, temperature=temperature)
        return self._extract_content(completion)

    async def chat_json(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        retry_instruction: str = "",
    ) -> Dict[str, Any]:
        completion = await self._create_completion(
            messages=messages,
            temperature=temperature,
            response_format={"type": "json_object"},
            max_tokens=self._json_max_tokens,
        )
        content = self._extract_content(completion)
        finish_reason = self._extract_finish_reason(completion)

        try:
            if not content.strip():
                raise ValueError("The model returned empty content.")
            return self._extract_json(content)
        except ValueError:
            if self._looks_truncated(content, finish_reason):
                retry_messages = self._build_truncation_retry_messages(messages, retry_instruction)
            else:
                retry_messages = self._build_json_repair_messages(messages, content)

        retried_completion = await self._create_completion(
            messages=retry_messages,
            temperature=min(temperature, 0.2),
            response_format={"type": "json_object"},
            max_tokens=self._json_max_tokens,
        )
        retried_content = self._extract_content(retried_completion)

        try:
            return self._extract_json(retried_content)
        except ValueError as exc:
            raise ValueError(
                f"{exc}; raw LLM output preview: {self._preview_text(retried_content)}"
            ) from exc

    async def _create_completion(
        self,
        *,
        messages: List[Dict[str, str]],
        temperature: float,
        response_format: Dict[str, str] | None = None,
        max_tokens: int | None = None,
    ) -> Dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("DeepSeek API key is missing. Set DEEPSEEK_API_KEY in .env first.")

        payload: Dict[str, Any] = {
            "model": self._model,
            "temperature": temperature,
            "messages": messages,
        }
        if response_format:
            payload["response_format"] = response_format
        if max_tokens:
            payload["max_tokens"] = max_tokens

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
            return response.json()

    @staticmethod
    def _extract_content(completion: Dict[str, Any]) -> str:
        choices = completion.get("choices") or []
        if not choices:
            raise ValueError("DeepSeek returned an empty completion response.")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if not isinstance(content, str):
            raise ValueError("DeepSeek response does not contain text content.")
        return content

    @staticmethod
    def _extract_finish_reason(completion: Dict[str, Any]) -> str:
        choices = completion.get("choices") or []
        if not choices:
            return ""
        finish_reason = choices[0].get("finish_reason")
        return finish_reason if isinstance(finish_reason, str) else ""

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
                    "Please repair only the JSON format of your previous reply and output one "
                    "complete JSON object again. Do not add markdown, explanations, comments, "
                    "or trailing commas. Keep the original fields and meaning whenever possible."
                ),
            },
        ]

    @classmethod
    def _build_truncation_retry_messages(
        cls,
        messages: List[Dict[str, str]],
        retry_instruction: str,
    ) -> List[Dict[str, str]]:
        instruction = retry_instruction.strip() or (
            "Your previous JSON appears truncated. Regenerate the full JSON object from scratch "
            "with shorter string values so it fits in one complete response. Do not omit required "
            "fields, and do not add any explanation outside the JSON object."
        )
        return [
            *messages,
            {"role": "user", "content": instruction},
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
                    raise ValueError("The JSON root returned by the model is not an object.")
                return parsed

        if last_error is None:
            raise ValueError("The model response is not valid JSON.")

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
        sanitized = cls._close_open_structures(sanitized)
        sanitized = cls._remove_trailing_commas(sanitized)
        return sanitized.strip()

    @staticmethod
    def _normalize_structural_punctuation(content: str) -> str:
        replacements = {
            "\uff5b": "{",
            "\uff5d": "}",
            "\uff3b": "[",
            "\uff3d": "]",
            "\uff1a": ":",
            "\uff0c": ",",
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
    def _close_open_structures(content: str) -> str:
        stack: List[str] = []
        in_string = False
        escaped = False

        for char in content:
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
                stack.append("}")
            elif char == "[":
                stack.append("]")
            elif char in {"}", "]"} and stack and char == stack[-1]:
                stack.pop()

        suffix: List[str] = []
        if in_string:
            suffix.append("\"")
        suffix.extend(reversed(stack))
        return f"{content}{''.join(suffix)}"

    @classmethod
    def _looks_truncated(cls, content: str, finish_reason: str) -> bool:
        if finish_reason == "length":
            return True

        stripped = cls._unwrap_code_fence(content).strip()
        if not stripped:
            return True
        if stripped.endswith("..."):
            return True

        stack: List[str] = []
        in_string = False
        escaped = False
        for char in stripped:
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
                stack.append("}")
            elif char == "[":
                stack.append("]")
            elif char in {"}", "]"} and stack and char == stack[-1]:
                stack.pop()

        return in_string or bool(stack) or not stripped.endswith("}")

    @staticmethod
    def _format_json_error(exc: json.JSONDecodeError, content: str) -> str:
        start = max(0, exc.pos - 80)
        end = min(len(content), exc.pos + 80)
        snippet = content[start:end].replace("\n", "\\n")
        return (
            f"Model JSON parsing failed: {exc.msg} "
            f"(line {exc.lineno}, column {exc.colno}, char {exc.pos}). "
            f"Nearby content: {snippet}"
        )

    @staticmethod
    def _preview_text(content: str, limit: int = 220) -> str:
        preview = re.sub(r"\s+", " ", content).strip()
        if len(preview) <= limit:
            return preview
        return f"{preview[:limit]}..."
