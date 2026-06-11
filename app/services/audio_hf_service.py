"""
Cloud-based audio generation using HuggingFace Inference API.
No local GPU, no tunnels, no system libs. Just HF_TOKEN.
"""
from __future__ import annotations

import io
import logging
import os
import uuid
import wave
from pathlib import Path
from typing import Optional

import numpy as np
import httpx

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path("static/audio/music")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HF_API = "https://api-inference.huggingface.co/models"


class AudioHfService:
    """Audio generation via HuggingFace hosted inference API."""

    def __init__(self, hf_token: str | None = None):
        self.hf_token = hf_token or os.environ.get("HF_TOKEN", "")
        self.model_type = "musicgen"
        self.music_model = "facebook/musicgen-small"
        self.effects_model = "facebook/audiogen-medium"
        self.stable_music_model = ""
        self.stable_sfx_model = ""
        self.mmn = self.music_model
        self.device = "hf-cloud"
        self._mg = None
        self._ag = None

        if not self.hf_token:
            logger.error("HF_TOKEN not set!")
        else:
            logger.info("AudioHfService ready (token=%s..., music=%s)", self.hf_token[:8], self.music_model)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.hf_token}"}

    async def _call_hf(self, model: str, prompt: str, timeout: int = 120) -> bytes:
        url = f"{HF_API}/{model}"
        logger.info("HF API: %s", model)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=self._headers(), json={"inputs": prompt})
        if resp.status_code == 503:
            import asyncio
            logger.info("Model cold-start, waiting 30s...")
            await asyncio.sleep(30)
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, headers=self._headers(), json={"inputs": prompt})
        if resp.status_code != 200:
            raise RuntimeError(f"HF API error {resp.status_code}: {resp.text[:300]}")
        return resp.content

    def _save_wav(self, audio_data: bytes, sample_rate: int = 32000) -> tuple:
        filename = f"hf_{uuid.uuid4().hex[:8]}.wav"
        filepath = OUTPUT_DIR / filename
        samples = np.frombuffer(audio_data, dtype=np.float32)
        samples = np.clip(samples, -1.0, 1.0)
        int_data = (samples * 32767).astype(np.int16)
        with wave.open(str(filepath), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(int_data.tobytes())
        dur = len(samples) / sample_rate
        logger.info("Saved: %s (%.1fs)", filename, dur)
        return str(filepath).replace("\\", "/"), dur, sample_rate

    async def generate_background_music(self, description: str, duration: float = 30.0, guidance_scale: float = 3.0, **kwargs) -> dict:
        if not self.hf_token:
            raise RuntimeError("HF_TOKEN not set. Add it in Render Environment variables.")
        logger.info("Music: %s", description[:80])
        audio_bytes = await self._call_hf(self.music_model, description)
        path, dur, sr = self._save_wav(audio_bytes)
        return {"audio_path": path, "duration": dur, "sample_rate": sr, "description": description}

    async def generate_sound_effects(self, descriptions: list[str], duration: float = 5.0, guidance_scale: float = 3.0, **kwargs) -> list[dict]:
        if not self.hf_token:
            raise RuntimeError("HF_TOKEN not set.")
        results = []
        for i, desc in enumerate(descriptions):
            try:
                logger.info("Effect %d/%d: %s", i+1, len(descriptions), desc[:60])
                audio_bytes = await self._call_hf(self.effects_model, desc)
                path, dur, sr = self._save_wav(audio_bytes)
                results.append({"audio_path": path, "duration": dur, "sample_rate": sr, "description": desc})
            except Exception as e:
                logger.error("Effect %d failed: %s", i+1, e)
                results.append({"audio_path": "", "duration": 0, "sample_rate": 0, "description": desc, "error": str(e)})
        return results

    def set_model_type(self, model_type: str, model_name: str | None = None):
        self.model_type = "musicgen" if model_type == "stable-audio" else model_type
        if model_name and "musicgen" in model_type:
            self.music_model = model_name
            self.mmn = model_name

    def unload_models(self): pass

    def get_device_info(self) -> dict:
        return {"device": "hf-cloud", "backend": "HuggingFace Inference API", "music_model": self.music_model}

    @staticmethod
    def get_available_models() -> dict:
        return {
            "model_types": [{"id": "musicgen", "name": "MusicGen (HF Cloud)", "description": "HuggingFace hosted"}],
            "audio_models": [
                {"id": "facebook/musicgen-small", "size": "small", "recommended": True},
                {"id": "facebook/audiogen-medium", "size": "medium", "recommended": True},
            ],
        }