"""
TTS (Text-to-Speech) service for novel dialogue voicing.
Integrates DeepSeek for emotion analysis and indexTTS2 for synthesis.
"""

import base64
import json
import logging
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# Default indexTTS2 server URL
INDEX_TTS2_URL = os.environ.get("INDEX_TTS2_URL", "http://127.0.0.1:9800/v1")

# Emotion vector dimensions: [高兴, 愤怒, 悲伤, 恐惧, 反感, 低落, 惊讶, 自然]
EMOTION_DIMS = ["happy", "angry", "sad", "fearful", "disgusted", "depressed", "surprised", "neutral"]

EMOTION_ANALYSIS_PROMPT = """你是一个顶级配音导演。请分析台词的情感，严格按照 JSON 格式返回。

【标准返回格式示例 - 必须完全遵守此JSON结构，保持Key的英文不变】：
{
  "primary": "喜",
  "complex": "轻快调皮",
  "intensity": "Medium"
}

【参数枚举说明】：
- primary: 基础分类 (必须且只能从以下选择其一：喜、怒、哀、惧、惊、厌、平)
- complex: 复合情绪描述 (1-8个字，如：得意自嘲、傲慢)
- intensity: 情绪张力 (必须且只能从以下选择其一：Low、Medium、High)

【映射关系】：
- 基础情绪 "喜/怒/哀/惧/惊/厌/平" 对应 emo_vector 维度索引:
  喜→0(高兴), 怒→1(愤怒), 哀→2(悲伤)/5(低落), 惧→3(恐惧), 厌→4(反感), 惊→6(惊讶), 平→7(自然)
- 强度 Low→alpha 0.3-0.5, Medium→alpha 0.5-0.7, High→alpha 0.7-1.0

【绝对警告】：
1. 你只能且必须返回纯合法的 JSON 对象！不要包裹在 ```json 等 Markdown 标记中！
2. 严禁输出任何思考过程，绝对禁止使用 <think> 标签！
3. 严禁输出任何额外的问候、解释、分析原因！"""


def primary_to_vector_index(primary: str) -> int:
    """Map primary emotion to vector dimension index."""
    mapping = {"喜": 0, "怒": 1, "哀": 2, "惧": 3, "厌": 4, "惊": 6, "平": 7}
    return mapping.get(primary, 7)


def intensity_to_alpha(intensity: str) -> float:
    """Map intensity string to alpha value."""
    mapping = {"Low": 0.4, "Medium": 0.65, "High": 0.85}
    return mapping.get(intensity, 0.65)


def build_emotion_vector(primary: str, intensity: str) -> List[float]:
    """Build an 8-dim emotion vector from primary emotion + intensity."""
    vec = [0.0] * 8
    idx = primary_to_vector_index(primary)
    alpha = intensity_to_alpha(intensity)
    vec[idx] = alpha
    # Handle sadness/depression split
    if primary == "哀" and intensity == "High":
        vec[5] = alpha * 0.5  # Also some depression
    return vec


class TtsService:
    """TTS service using DeepSeek for emotion analysis and indexTTS2 for synthesis."""

    def __init__(self, llm_client=None, index_tts2_url: str = None):
        self.llm = llm_client
        self.tts_url = index_tts2_url or INDEX_TTS2_URL

    # ------------------------------------------------------------------
    async def analyze_emotion(self, text: str) -> Dict[str, Any]:
        """Analyze text emotion via DeepSeek LLM."""
        if self.llm is None:
            raise RuntimeError("LLM client not configured for emotion analysis")

        result = await self.llm.chat_json(
            messages=[
                {"role": "system", "content": EMOTION_ANALYSIS_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0.5,
        )

        primary = result.get("primary", "平")
        intensity = result.get("intensity", "Medium")
        complex_emo = result.get("complex", "")

        return {
            "primary": primary,
            "complex": complex_emo,
            "intensity": intensity,
            "emo_vector": build_emotion_vector(primary, intensity),
            "emo_alpha": intensity_to_alpha(intensity),
        }

    # ------------------------------------------------------------------
    async def synthesize(
        self,
        text: str,
        prompt_audio_path: str,
        output_path: Optional[str] = None,
        emo_vector: Optional[List[float]] = None,
        emo_alpha: float = 1.0,
        speed: float = 1.0,
    ) -> Dict[str, Any]:
        """Synthesize speech via indexTTS2 API."""
        if not os.path.exists(prompt_audio_path):
            raise FileNotFoundError(f"Reference audio not found: {prompt_audio_path}")

        # Read and encode reference audio
        with open(prompt_audio_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")

        # Build voice payload with optional emotion
        voice = f"base64:{audio_b64}"
        if emo_vector is not None:
            voice = f"[EMO:{json.dumps(emo_vector)}|{emo_alpha}]{voice}"

        payload = {
            "model": "indexTTS2",
            "input": text,
            "voice": voice,
            "speed": speed,
            "response_format": "wav",
        }

        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                f"{self.tts_url}/audio/speech",
                json=payload,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"TTS synthesis failed (HTTP {resp.status_code}): {resp.text[:500]}"
                )

        # Save output
        if output_path is None:
            out_dir = Path("static/audio/tts")
            out_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(out_dir / f"tts_{uuid.uuid4().hex[:8]}.wav")

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(resp.content)

        logger.info("TTS synthesized: %s -> %s", text[:40], output_path)
        return {
            "audio_path": output_path,
            "text": text,
            "duration": None,  # Could be computed with soundfile
        }

    # ------------------------------------------------------------------
    async def synthesize_with_emotion(
        self,
        text: str,
        prompt_audio_path: str,
        output_path: Optional[str] = None,
        speed: float = 1.0,
    ) -> Dict[str, Any]:
        """Analyze emotion then synthesize in one call."""
        emotion = await self.analyze_emotion(text)
        result = await self.synthesize(
            text=text,
            prompt_audio_path=prompt_audio_path,
            output_path=output_path,
            emo_vector=emotion["emo_vector"],
            emo_alpha=emotion["emo_alpha"],
            speed=speed,
        )
        result["emotion"] = emotion
        return result

    # ------------------------------------------------------------------
    async def check_health(self) -> bool:
        """Check if indexTTS2 server is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(self.tts_url.replace("/v1", "/health"))
                return resp.status_code == 200
        except Exception:
            return False
