"""
EmotionTTS Cloud Service - wraps external indexTTS2 cloud API at 101.201.246.121:3000.
Users obtain a token from the platform and use it for cloud-based TTS synthesis.
Reference: E:\code\vscode\Python\ITProject\modules\tts_client.py
"""
import base64
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# Default cloud API base
CLOUD_API_BASE = "http://101.201.246.121:3000"


class TtsCloudService:
    """EmotionTTS Cloud synthesis service using external indexTTS2 server."""

    def __init__(self, api_token: str = None, base_url: str = None):
        self.api_token = api_token or os.environ.get("EMOTIONTTS_API_TOKEN", "")
        self.base_url = (base_url or CLOUD_API_BASE).rstrip("/")

    # ------------------------------------------------------------------
    # Token management
    # ------------------------------------------------------------------
    def set_token(self, token: str):
        """Update the API token."""
        self.api_token = token

    def has_token(self) -> bool:
        return bool(self.api_token and self.api_token.strip())

    @property
    def platform_url(self) -> str:
        return self.base_url

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_token:
            h["Authorization"] = f"Bearer {self.api_token}"
        return h

    # ------------------------------------------------------------------
    # Health / verification
    # ------------------------------------------------------------------
    async def check_health(self) -> Dict[str, Any]:
        """Check cloud API connectivity and token validity."""
        result = {"online": False, "token_valid": False, "message": ""}
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                # Try health endpoint first
                try:
                    resp = await client.get(f"{self.base_url}/health", headers=self._headers())
                    if resp.status_code == 200:
                        result["online"] = True
                except Exception:
                    pass

                # Check token via models endpoint
                if self.api_token:
                    resp = await client.get(
                        f"{self.base_url}/v1/models",
                        headers=self._headers(),
                        timeout=10
                    )
                    if resp.status_code == 200:
                        result["token_valid"] = True
                        result["message"] = "云端服务正常，令牌有效"
                    else:
                        result["message"] = f"令牌无效 (HTTP {resp.status_code})"
                else:
                    result["message"] = "未配置API令牌"
        except Exception as e:
            result["message"] = f"无法连接云端服务: {e}"
        return result

    # ------------------------------------------------------------------
    # Character / voice listing
    # ------------------------------------------------------------------
    async def fetch_cloud_characters(self) -> List[Dict[str, Any]]:
        """Fetch character list from cloud API."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{self.base_url}/api/characters",
                    headers=self._headers()
                )
                if resp.status_code != 200:
                    logger.warning(f"Cloud characters fetch: HTTP {resp.status_code}")
                    return []
                data = resp.json()
                if isinstance(data, list):
                    return data
                return []
        except Exception as e:
            logger.warning(f"Cloud characters fetch failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Synthesis
    # ------------------------------------------------------------------
    async def synthesize(
        self,
        text: str,
        character_id: str = None,
        character_name: str = None,
        voice_payload: str = None,
        emo_vector: Optional[List[float]] = None,
        emo_alpha: float = 1.0,
        speed: float = 1.0,
        output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synthesize speech via EmotionTTS cloud API.

        Three modes:
        1. character_id: Let the cloud match text to character's voice library
        2. character_name + local ref audio: Build base64 voice payload local
        3. voice_payload: Raw voice payload (base64:... or [EMO:...]base64:...)
        """
        if not self.api_token:
            raise RuntimeError("未配置 EmotionTTS API 令牌")

        headers = self._headers()

        # Build voice string
        voice = voice_payload or (character_name or "default")

        # If we have a character_id, pass it through; cloud handles matching
        if character_id:
            voice = character_id

        # Apply emotion if provided
        if emo_vector is not None and voice_payload:
            voice = f"[EMO:{json.dumps(emo_vector)}|{emo_alpha}]{voice_payload}"

        payload = {
            "model": "indexTTS2",
            "input": text,
            "voice": voice,
            "speed": speed,
            "response_format": "wav",
        }

        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self.base_url}/v1/audio/speech",
                json=payload,
                headers=headers,
            )
            if resp.status_code != 200:
                detail = resp.text[:500]
                logger.error(f"Cloud TTS failed (HTTP {resp.status_code}): {detail}")
                raise RuntimeError(f"云端合成失败 (HTTP {resp.status_code}): {detail}")

        # Save output
        if output_path is None:
            out_dir = Path("static/audio/tts")
            out_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(out_dir / f"tts_cloud_{uuid.uuid4().hex[:8]}.wav")

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(resp.content)

        logger.info("Cloud TTS synthesized: %s -> %s", text[:40], output_path)
        return {
            "audio_path": output_path,
            "text": text,
            "duration": None,
        }

    # ------------------------------------------------------------------
    # Combined: emotion analysis (via passed-in LLM client) + cloud synth
    # ------------------------------------------------------------------
    async def synthesize_with_ref_audio(
        self,
        text: str,
        ref_audio_path: str,
        emo_vector: Optional[List[float]] = None,
        emo_alpha: float = 1.0,
        speed: float = 1.0,
        output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Synthesize with a local reference audio file uploaded to cloud."""
        if not os.path.exists(ref_audio_path):
            raise FileNotFoundError(f"Reference audio not found: {ref_audio_path}")

        with open(ref_audio_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")

        voice = f"base64:{audio_b64}"
        if emo_vector is not None:
            voice = f"[EMO:{json.dumps(emo_vector)}|{emo_alpha}]{voice}"

        return await self.synthesize(
            text=text,
            voice_payload=voice,
            speed=speed,
            output_path=output_path,
        )
