"""
Cloud-based audio generation using HuggingFace Inference API.
Works on Render without local GPU or tunnels.
Requires HF_TOKEN env var set on Render.
"""
from __future__ import annotations

import io
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional

import soundfile as sf
import numpy as np
from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path("static/audio/music")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Free-tier models on HuggingFace Inference API
MUSIC_MODELS = {
    "musicgen": "facebook/musicgen-small",
}

EFFECTS_MODELS = {
    "audiogen": "facebook/audiogen-medium",
}


class AudioHfService:
    """Audio generation via HuggingFace hosted inference (no local GPU needed)."""

    def __init__(self, hf_token: str | None = None):
        self.hf_token = hf_token or os.environ.get("HF_TOKEN", "")
        self.model_type = "musicgen"
        self.music_model = MUSIC_MODELS["musicgen"]
        self.effects_model = EFFECTS_MODELS["audiogen"]
        self.stable_music_model = ""
        self.stable_sfx_model = ""
        self.device = "hf-cloud"
        self._mg = None  # compat
        self._ag = None

        if not self.hf_token:
            logger.warning("HF_TOKEN not set. HuggingFace Inference API calls will fail.")
        else:
            logger.info("AudioHfService initialized (HF cloud, token=%s...)", self.hf_token[:8])

    # ── generate music ─────────────────────────────────
    async def generate_background_music(
        self, description: str, duration: float = 30.0,
        guidance_scale: float = 3.0, **kwargs
    ) -> dict:
        """Generate music via HF Inference API."""
        if not self.hf_token:
            raise RuntimeError("HF_TOKEN not configured. Set it in Render environment variables.")

        client = InferenceClient(token=self.hf_token)

        logger.info("Calling HF API: %s (prompt: %s)", self.music_model, description[:80])

        try:
            # musicgen-small on HF API returns audio bytes
            audio_bytes = client.text_to_audio(
                description,
                model=self.music_model,
            )

            # Save to file
            filename = f"hf_music_{uuid.uuid4().hex[:8]}.wav"
            filepath = OUTPUT_DIR / filename

            # Parse audio from bytes
            data, sample_rate = sf.read(io.BytesIO(audio_bytes))
            sf.write(str(filepath), data, sample_rate)

            logger.info("Music saved: %s (%.1fs, %d Hz)", filename, len(data) / sample_rate, sample_rate)

            return {
                "audio_path": str(filepath).replace("\\", "/"),
                "duration": len(data) / sample_rate,
                "sample_rate": sample_rate,
                "description": description,
            }

        except Exception as e:
            logger.error("HF API music generation failed: %s", e)
            raise RuntimeError(f"HuggingFace API error: {e}")

    # ── generate effects ────────────────────────────────
    async def generate_sound_effects(
        self, descriptions: list[str], duration: float = 5.0,
        guidance_scale: float = 3.0, **kwargs
    ) -> list[dict]:
        """Generate sound effects via HF Inference API."""
        if not self.hf_token:
            raise RuntimeError("HF_TOKEN not configured.")

        client = InferenceClient(token=self.hf_token)
        results = []

        for i, desc in enumerate(descriptions):
            try:
                logger.info("HF API effect %d/%d: %s", i + 1, len(descriptions), desc[:60])
                audio_bytes = client.text_to_audio(
                    desc,
                    model=self.effects_model,
                )

                filename = f"hf_fx_{uuid.uuid4().hex[:8]}.wav"
                filepath = OUTPUT_DIR / filename

                data, sample_rate = sf.read(io.BytesIO(audio_bytes))
                sf.write(str(filepath), data, sample_rate)

                results.append({
                    "audio_path": str(filepath).replace("\\", "/"),
                    "duration": len(data) / sample_rate,
                    "sample_rate": sample_rate,
                    "description": desc,
                })
            except Exception as e:
                logger.error("HF API effect %d failed: %s", i + 1, e)
                results.append({
                    "audio_path": "",
                    "duration": 0,
                    "sample_rate": 0,
                    "description": desc,
                    "error": str(e),
                })

        return results

    # ── model management (stubs for compat) ─────────────
    def set_model_type(self, model_type: str, model_name: str | None = None):
        if model_type == "stable-audio":
            # HF free tier doesn't support Stable Audio 3 yet
            logger.warning("Stable Audio 3 not available via HF free tier. Using MusicGen instead.")
            self.model_type = "musicgen"
        else:
            self.model_type = model_type

        if model_name and "musicgen" in model_type:
            self.music_model = model_name
            logger.info("Music model set to: %s", model_name)

    def unload_models(self):
        pass  # no local models to unload

    def get_device_info(self) -> dict:
        return {"device": "hf-cloud", "backend": "HuggingFace Inference API"}

    @staticmethod
    def get_available_models() -> dict:
        return {
            "model_types": [
                {"id": "musicgen", "name": "MusicGen (HF Cloud)", "description": "HuggingFace hosted inference"},
            ],
            "audio_models": [
                {"id": "facebook/musicgen-small", "size": "small", "recommended": True},
                {"id": "facebook/audiogen-medium", "size": "medium", "recommended": True},
            ],
        }