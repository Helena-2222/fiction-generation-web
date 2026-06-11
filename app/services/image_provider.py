from __future__ import annotations

import base64
from pathlib import Path

import httpx

from app.config import settings


class ImageProviderError(RuntimeError):
    pass


class DashScopeImageProvider:
    def __init__(self) -> None:
        self.base_url = settings.image_api_base_url.rstrip("/")
        self.api_key = settings.image_api_key.strip()
        self.model = settings.image_model.strip()
        self.timeout = settings.image_api_timeout_seconds

    async def generate_images(
        self,
        *,
        prompt: str,
        size: str,
        count: int,
        quality: str,
        negative_prompt: str = "",
        reference_images: list[bytes] | None = None,
    ) -> list[bytes]:
        if not self.api_key:
            raise ImageProviderError("未配置 IMAGE_API_KEY")

        merged_prompt = prompt.strip()
        if negative_prompt.strip():
            merged_prompt = f"{merged_prompt}\n\n额外约束：避免出现以下内容：{negative_prompt.strip()}"

        content: list[dict] = []
        for image_bytes in reference_images or []:
            encoded = base64.b64encode(image_bytes).decode("utf-8")
            content.append({"image": f"data:image/png;base64,{encoded}"})
        content.append({"text": merged_prompt})

        payload = {
            "model": self.model,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": content,
                    }
                ]
            },
            "parameters": {
                "size": size,
                "n": count,
                "watermark": False,
            },
        }

        endpoint = f"{self.base_url}/services/aigc/multimodal-generation/generation"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-DashScope-Async": "disable",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(endpoint, headers=headers, json=payload)

        if response.status_code >= 400:
            raise ImageProviderError(f"第三方接口错误: {response.status_code} {response.text}")

        data = response.json()
        outputs = self._extract_output_items(data)
        if not outputs:
            raise ImageProviderError("第三方接口未返回图片数据")

        images: list[bytes] = []
        for item in outputs:
            image_bytes = await self._extract_image_bytes(item)
            images.append(image_bytes)
        return images

    def _extract_output_items(self, data: dict) -> list[dict]:
        output = data.get("output", {})
        if isinstance(output, dict):
            choices = output.get("choices")
            if isinstance(choices, list) and choices:
                extracted: list[dict] = []
                for choice in choices:
                    if not isinstance(choice, dict):
                        continue
                    message = choice.get("message")
                    if not isinstance(message, dict):
                        continue
                    content = message.get("content")
                    if not isinstance(content, list):
                        continue
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "image":
                            extracted.append(item)
                if extracted:
                    return extracted
            results = output.get("results")
            if isinstance(results, list) and results:
                return [item for item in results if isinstance(item, dict)]
        if isinstance(data.get("results"), list):
            return [item for item in data["results"] if isinstance(item, dict)]
        return []

    async def _extract_image_bytes(self, item: dict) -> bytes:
        for key in ("b64_json", "image_base64"):
            encoded = item.get(key)
            if encoded:
                return base64.b64decode(encoded)

        for key in ("image", "url", "image_url"):
            value = item.get(key)
            if isinstance(value, str) and value:
                if value.startswith("http://") or value.startswith("https://"):
                    return await self._download_bytes(value)
                try:
                    return base64.b64decode(value)
                except Exception:
                    continue

        raise ImageProviderError("第三方接口返回了结果，但未找到可用图片字段")

    async def _download_bytes(self, url: str) -> bytes:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url)
        if response.status_code >= 400:
            raise ImageProviderError(f"下载第三方图片失败: {response.status_code}")
        return response.content


def save_image_bytes(image_bytes: bytes, file_path: Path) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(image_bytes)
