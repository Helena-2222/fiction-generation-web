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
        content = await self.chat(messages=messages, temperature=temperature)
        return self._extract_json(content)

    @staticmethod
    def _extract_json(content: str) -> Dict[str, Any]:
        stripped = content.strip()
        if stripped.startswith("```"):
            fence_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, re.DOTALL)
            if fence_match:
                stripped = fence_match.group(1).strip()

        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", stripped, re.DOTALL)
            if not match:
                raise ValueError("模型返回的内容不是合法 JSON。")
            return json.loads(match.group(0))
