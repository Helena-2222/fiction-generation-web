"""
API routes for TTS (Text-to-Speech) novel dialogue voicing.
"""

import json
import logging
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

# Character data directory
CHARACTERS_DIR = Path(__file__).resolve().parents[2] / "data" / "tts_characters"
CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)

# Output directory
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "static" / "audio" / "tts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# Models
# ============================================================

class CharacterVoiceCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class AnalyzeEmotionRequest(BaseModel):
    text: str


class SynthesizeRequest(BaseModel):
    text: str
    character_id: str
    emotion: Optional[str] = None  # "happy/angry/sad/fearful/surprised/disgusted/neutral" or "auto" for LLM
    speed: float = 1.0


class SynthesizeChapterRequest(BaseModel):
    chapter_text: str
    character_map: dict  # {"Speaker Name": "character_id", ...}
    auto_emotion: bool = True


# ============================================================
# Character Voice Management
# ============================================================

def _get_char_dir(char_id: str) -> Path:
    return CHARACTERS_DIR / char_id


def _get_library_path(char_id: str) -> Path:
    return _get_char_dir(char_id) / "library.json"


def _load_library(char_id: str) -> dict:
    path = _get_library_path(char_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Character '{char_id}' not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_library(char_id: str, data: dict):
    path = _get_library_path(char_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/characters")
async def list_characters():
    """List all character voice profiles."""
    chars = []
    if CHARACTERS_DIR.exists():
        for d in sorted(CHARACTERS_DIR.iterdir()):
            if d.is_dir():
                lib = d / "library.json"
                if lib.exists():
                    with open(lib, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    chars.append({
                        "id": d.name,
                        "name": data.get("char_name", d.name),
                        "description": data.get("description", ""),
                        "voice_count": len(data.get("items", [])),
                    })
    return {"characters": chars}


@router.post("/characters")
async def create_character(req: CharacterVoiceCreate):
    """Create a new character voice profile."""
    char_id = f"char_{uuid.uuid4().hex[:8]}"
    data = {
        "char_name": req.name,
        "description": req.description or "",
        "items": [],
    }
    _save_library(char_id, data)
    return {"id": char_id, "name": req.name}


@router.delete("/characters/{char_id}")
async def delete_character(char_id: str):
    """Delete a character voice profile and its data."""
    char_dir = _get_char_dir(char_id)
    if not char_dir.exists():
        raise HTTPException(status_code=404, detail="Character not found")
    shutil.rmtree(char_dir)
    return {"status": "deleted"}


@router.get("/characters/{char_id}")
async def get_character(char_id: str):
    """Get character voice profile details."""
    data = _load_library(char_id)
    return {
        "id": char_id,
        "name": data.get("char_name", ""),
        "description": data.get("description", ""),
        "voices": data.get("items", []),
    }


@router.post("/characters/{char_id}/voices")
async def upload_voice(
    char_id: str,
    file: UploadFile = File(...),
    emotion: str = Form(...),  # "happy/angry/sad/fearful/surprised/disgusted/neutral"
    text: str = Form(""),
):
    """Upload a reference audio for a character's emotion."""
    if not file.filename or not file.filename.endswith((".wav", ".mp3")):
        raise HTTPException(status_code=400, detail="Only .wav/.mp3 files supported")

    data = _load_library(char_id)
    char_dir = _get_char_dir(char_id)

    # Save audio file
    ext = os.path.splitext(file.filename)[1]
    audio_name = f"{emotion}_{uuid.uuid4().hex[:6]}{ext}"
    audio_path = char_dir / audio_name
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    audio_path.write_bytes(content)

    # Update library
    item = {
        "id": len(data["items"]),
        "emotion": emotion,
        "text": text or f"{emotion} emotion reference audio",
        "filename": audio_name,
        "is_api_safe": True,
    }
    data["items"].append(item)
    _save_library(char_id, data)

    return {
        "id": item["id"],
        "emotion": emotion,
        "filename": audio_name,
        "url": f"/data/tts_characters/{char_id}/{audio_name}",
    }


@router.delete("/characters/{char_id}/voices/{voice_id}")
async def delete_voice(char_id: str, voice_id: int):
    """Delete a reference voice from a character."""
    data = _load_library(char_id)
    items = data.get("items", [])
    item = next((i for i in items if i.get("id") == voice_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Voice not found")

    # Delete audio file
    audio_path = _get_char_dir(char_id) / item["filename"]
    if audio_path.exists():
        audio_path.unlink()

    # Remove from library
    data["items"] = [i for i in items if i.get("id") != voice_id]
    _save_library(char_id, data)
    return {"status": "deleted"}


# ============================================================
# TTS Pipeline
# ============================================================

@router.post("/analyze-emotion")
async def analyze_emotion(req: AnalyzeEmotionRequest):
    """Analyze text emotion via DeepSeek LLM."""
    from app.dependencies import tts_service

    try:
        result = await tts_service.analyze_emotion(req.text)
        return {"status": "success", "emotion": result}
    except Exception as e:
        logger.error(f"Emotion analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def tts_health():
    """Check if indexTTS2 server is reachable."""
    from app.dependencies import tts_service

    healthy = await tts_service.check_health()
    return {
        "index_tts2_available": healthy,
        "tts_url": tts_service.tts_url,
    }


@router.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    """Synthesize speech for a text line with a character voice."""
    from app.dependencies import tts_service

    # Load character library to find matching voice
    data = _load_library(req.character_id)
    items = data.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Character has no voice samples")

    # Determine emotion
    if req.emotion and req.emotion != "auto":
        # Use specified emotion
        emo_vector = None
        emo_alpha = 1.0
        match = next((i for i in items if i.get("emotion") == req.emotion), items[0])
    else:
        # Auto-analyze emotion via LLM
        try:
            emotion = await tts_service.analyze_emotion(req.text)
            emo_vector = emotion["emo_vector"]
            emo_alpha = emotion["emo_alpha"]
        except Exception as e:
            logger.warning(f"Emotion analysis failed, using neutral: {e}")
            emotion = {"primary": "neutral", "emo_vector": [0.0]*8, "emo_alpha": 0.5}
            emo_vector = emotion["emo_vector"]
            emo_alpha = emotion["emo_alpha"]

        target_emo = emotion.get("primary", "neutral")
        match = next((i for i in items if i.get("emotion") == target_emo), items[0])

    # Build reference audio path
    ref_path = _get_char_dir(req.character_id) / match["filename"]
    if not ref_path.exists():
        raise HTTPException(status_code=404, detail="Reference audio file missing")

    # Synthesize
    out_name = f"tts_{uuid.uuid4().hex[:8]}.wav"
    out_path = str(OUTPUT_DIR / out_name)

    result = await tts_service.synthesize(
        text=req.text,
        prompt_audio_path=str(ref_path),
        output_path=out_path,
        emo_vector=emo_vector,
        emo_alpha=emo_alpha,
        speed=req.speed,
    )

    return {
        "audio_path": result["audio_path"],
        "audio_url": f"/static/audio/tts/{out_name}",
        "text": req.text,
        "character": data.get("char_name", req.character_id),
        "emotion": emotion if req.emotion == "auto" or not req.emotion else {"primary": req.emotion},
    }


@router.post("/synthesize-chapter")
async def synthesize_chapter(req: SynthesizeChapterRequest):
    """Synthesize a full chapter: split text, identify speakers, generate speech."""
    from app.dependencies import tts_service

    # Split text into dialogue lines
    lines = []
    # Match patterns like "Speaker: dialogue" or "Speaker锛歞ialogue"
    pattern = re.compile(r"([A-Za-z\u4e00-\u9fff\w]+)[\uff1a:](.+)")
    for match in pattern.finditer(req.chapter_text):
        speaker = match.group(1).strip()
        dialogue = match.group(2).strip()
        lines.append({"speaker": speaker, "text": dialogue})

    if not lines:
        # Fallback: treat as plain text per sentence
        sentences = re.split(r"[\u3002\uff01\uff1f!?\n]+", req.chapter_text)
        lines = [{"speaker": "narrator", "text": s.strip()} for s in sentences if s.strip()]

    results = []
    for line in lines:
        char_id = req.character_map.get(line["speaker"])
        if not char_id:
            logger.warning("No character mapping for speaker: %s", line["speaker"])
            continue

        try:
            data = _load_library(char_id)
            items = data.get("items", [])
            if not items:
                continue

            # Auto-analyze emotion
            emotion = {"primary": "neutral", "emo_vector": [0.0]*8, "emo_alpha": 0.5}
            if req.auto_emotion:
                try:
                    emotion = await tts_service.analyze_emotion(line["text"])
                except Exception:
                    pass

            match = next(
                (i for i in items if i.get("emotion") == emotion.get("primary", "neutral")),
                items[0]
            )
            ref_path = _get_char_dir(char_id) / match["filename"]

            out_name = f"tts_{uuid.uuid4().hex[:8]}.wav"
            out_path = str(OUTPUT_DIR / out_name)

            await tts_service.synthesize(
                text=line["text"],
                prompt_audio_path=str(ref_path),
                output_path=out_path,
                emo_vector=emotion["emo_vector"],
                emo_alpha=emotion["emo_alpha"],
            )
            results.append({
                "speaker": line["speaker"],
                "text": line["text"],
                "audio_url": f"/static/audio/tts/{out_name}",
                "emotion": emotion.get("primary", "neutral"),
            })
        except Exception as e:
            logger.error("Synthesis failed for %s: %s", line["speaker"], e)
            results.append({
                "speaker": line["speaker"],
                "text": line["text"],
                "error": str(e),
            })

    return {
        "total": len(lines),
        "succeeded": sum(1 for r in results if "audio_url" in r),
        "failed": sum(1 for r in results if "error" in r),
        "results": results,
    }

# ============================================================
# Cloud TTS (EmotionTTS external API)
# ============================================================

class CloudTokenSet(BaseModel):
    token: str


class CloudSynthesizeRequest(BaseModel):
    text: str
    character_id: Optional[str] = None
    character_name: Optional[str] = None
    ref_audio_filename: Optional[str] = None  # local file in character dir
    emo_vector: Optional[List[float]] = None
    emo_alpha: float = 1.0
    speed: float = 1.0
    auto_emotion: bool = False  # if True, analyze text via DeepSeek first


@router.get("/cloud/health")
async def cloud_health():
    """Check EmotionTTS cloud API status and token validity."""
    from app.dependencies import tts_cloud_service
    result = await tts_cloud_service.check_health()
    return result


@router.post("/cloud/token")
async def cloud_set_token(req: CloudTokenSet):
    """Save EmotionTTS cloud API token."""
    from app.dependencies import tts_cloud_service
    tts_cloud_service.set_token(req.token)
    # Quick validation
    result = await tts_cloud_service.check_health()
    return {
        "status": "saved",
        "token_valid": result.get("token_valid", False),
        "message": result.get("message", ""),
    }


@router.get("/cloud/token")
async def cloud_get_token():
    """Get current token status (masked)."""
    from app.dependencies import tts_cloud_service
    has = tts_cloud_service.has_token()
    token = tts_cloud_service.api_token
    masked = ""
    if token:
        masked = token[:8] + "****" + token[-4:] if len(token) > 12 else "****"
    return {
        "has_token": has,
        "masked": masked,
        "platform_url": tts_cloud_service.platform_url,
    }


@router.get("/cloud/characters")
async def cloud_list_characters():
    """Fetch character list from EmotionTTS cloud."""
    from app.dependencies import tts_cloud_service
    if not tts_cloud_service.has_token():
        raise HTTPException(status_code=400, detail="请先配置云端 API 令牌")
    chars = await tts_cloud_service.fetch_cloud_characters()
    return {"characters": chars}


@router.post("/cloud/synthesize")
async def cloud_synthesize(req: CloudSynthesizeRequest):
    """
    Synthesize via EmotionTTS cloud API.
    Supports local character library reference audio.
    """
    from app.dependencies import tts_cloud_service, tts_service as local_tts

    if not tts_cloud_service.has_token():
        raise HTTPException(status_code=400, detail="请先配置云端 API 令牌")

    emo_vector = req.emo_vector
    emo_alpha = req.emo_alpha

    # Auto emotion analysis
    if req.auto_emotion and local_tts.llm:
        try:
            emotion = await local_tts.analyze_emotion(req.text)
            emo_vector = emotion["emo_vector"]
            emo_alpha = emotion["emo_alpha"]
        except Exception as e:
            logger.warning(f"Auto emotion failed: {e}")

    # Determine voice source
    ref_audio_path = None
    char_name = req.character_name

    # If character_id + ref_audio_filename given, use local file
    if req.character_id and req.ref_audio_filename:
        char_dir = _get_char_dir(req.character_id)
        ref_audio_path = str(char_dir / req.ref_audio_filename)

    # If character_id given but no filename, try to match from library
    if req.character_id and not ref_audio_path:
        try:
            lib = _load_library(req.character_id)
            items = lib.get("items", [])
            char_name = lib.get("char_name", req.character_name or "")
            if items:
                ref_audio_path = str(_get_char_dir(req.character_id) / items[0]["filename"])
        except HTTPException:
            pass

    # Synthesize
    out_name = f"tts_cloud_{uuid.uuid4().hex[:8]}.wav"
    out_path = str(OUTPUT_DIR / out_name)

    if ref_audio_path and os.path.exists(ref_audio_path):
        result = await tts_cloud_service.synthesize_with_ref_audio(
            text=req.text,
            ref_audio_path=ref_audio_path,
            emo_vector=emo_vector,
            emo_alpha=emo_alpha,
            speed=req.speed,
            output_path=out_path,
        )
    else:
        result = await tts_cloud_service.synthesize(
            text=req.text,
            character_id=req.character_id,
            character_name=char_name,
            emo_vector=emo_vector,
            emo_alpha=emo_alpha,
            speed=req.speed,
            output_path=out_path,
        )

    return {
        "audio_path": result["audio_path"],
        "audio_url": f"/static/audio/tts/{out_name}",
        "text": req.text,
        "character": char_name or req.character_id or "default",
        "emo_vector": emo_vector,
        "emo_alpha": emo_alpha,
    }
