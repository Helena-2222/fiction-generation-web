"""
HTTP client for remote audio generation server.
Used on Render to proxy audio requests to a local machine running audio_server.py.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class AudioApiClient:
    """Calls a remote audio_server.py instance over HTTP."""

    def __init__(self, base_url: str, timeout: float = 600):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._pending_model_type = None
        self._pending_model_name = None
        logger.info("AudioApiClient: %s", self.base_url)

    async def _post(self, path: str, json: dict) -> dict | list:
        # Send pending model switch first
        if self._pending_model_type:
            pt, pn = self._pending_model_type, self._pending_model_name
            self._pending_model_type = None
            self._pending_model_name = None
            await self._post("/switch-model", {"model_type": pt, "model_name": pn})
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{path}", json=json)
            resp.raise_for_status()
            return resp.json()

    @property
    def device(self) -> str:
        return "remote"

    @property
    def model_type(self) -> str:
        return "remote"

    async def switch_model(self, model_type: str, model_name: str | None = None):
        await self._post("/switch-model", {"model_type": model_type, "model_name": model_name})

    async def generate_background_music(
        self, description: str, duration: float = 30.0,
        guidance_scale: float = 3.0, **kwargs
    ) -> dict:
        return await self._post("/generate-music", {
            "description": description,
            "duration": duration,
            "guidance_scale": guidance_scale,
        })

    async def generate_sound_effects(
        self, descriptions: list[str], duration: float = 5.0,
        guidance_scale: float = 3.0, **kwargs
    ) -> list[dict]:
        return await self._post("/generate-effects", {
            "descriptions": descriptions,
            "duration": duration,
            "guidance_scale": guidance_scale,
        })

    def set_model_type(self, model_type: str, model_name: str | None = None):
        """Note: switch_model is async, so this queues it via the next API call."""
        self._pending_model_type = model_type
        self._pending_model_name = model_name

    def unload_models(self):
        pass

    def get_device_info(self) -> dict:
        return {"device": "remote", "backend": "AudioApiClient", "base_url": self.base_url}

    @staticmethod
    def get_available_models() -> dict:
        return {
            "model_types": [
                {"id": "musicgen", "name": "MusicGen (Meta)", "description": "via local server"},
                {"id": "stable-audio", "name": "Stable Audio 3", "description": "via local server"},
            ],
            "audio_models": [],
        }
    @property
    def stable_music_model(self) -> str:
        return "stabilityai/stable-audio-3-small-music"
    @property
    def stable_sfx_model(self) -> str:
        return "stabilityai/stable-audio-3-small-sfx"
    @property
    def mmn(self) -> str:
        return ""