"""
Standalone audio generation server.
Run on your local machine to expose MusicGen/AudioGen/StableAudio3 as an HTTP API.

Usage:
    cd E:\fiction_generation\fiction-generation-web
    ..\fiction_generation\Scripts\python.exe audio_server.py --port 8001

Then expose with a tunnel:
    cloudflared tunnel --url http://localhost:8001
    # or: ngrok http 8001
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Ensure the app package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("audio-server")

app = FastAPI(title="Audio Generation Server", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Lazy-loaded service
_audio_service = None


def get_service():
    global _audio_service
    if _audio_service is None:
        from app.services.audio_service import AudioService
        _audio_service = AudioService(
            device=None,
            music_model_name="facebook/musicgen-small",
            audio_model_name="facebook/audiogen-medium",
            model_type="musicgen",
            stable_music_model="stabilityai/stable-audio-3-small-music",
            stable_sfx_model="stabilityai/stable-audio-3-small-sfx",
        )
        logger.info("AudioService initialized (device=%s)", _audio_service.device)
    return _audio_service


# ── Models ──────────────────────────────────────────────

class MusicRequest(BaseModel):
    description: str
    duration: float = 30.0
    guidance_scale: float = 3.0

class EffectsRequest(BaseModel):
    descriptions: list[str]
    duration: float = 5.0
    guidance_scale: float = 3.0

class ModelSwitchRequest(BaseModel):
    model_type: str  # "musicgen" or "stable-audio"
    model_name: str | None = None

class AudioResponse(BaseModel):
    audio_path: str
    duration: float
    sample_rate: int
    description: str | None = None

# ── Endpoints ───────────────────────────────────────────

@app.get("/health")
async def health():
    svc = get_service()
    return {
        "status": "ok",
        "device": svc.device,
        "model_type": svc.model_type,
        "music_model_loaded": svc._mg is not None and svc._mg.loaded if svc._mg else False,
        "audio_model_loaded": svc._ag is not None and svc._ag.loaded if svc._ag else False,
    }

@app.post("/switch-model")
async def switch_model(req: ModelSwitchRequest):
    svc = get_service()
    svc.set_model_type(req.model_type, req.model_name)
    return {"status": "ok", "model_type": svc.model_type}

@app.post("/generate-music", response_model=AudioResponse)
async def generate_music(req: MusicRequest):
    svc = get_service()
    try:
        result = await svc.generate_background_music(
            description=req.description,
            duration=req.duration,
            guidance_scale=req.guidance_scale,
        )
        return AudioResponse(**result)
    except Exception as e:
        logger.error("Music generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-effects", response_model=list[AudioResponse])
async def generate_effects(req: EffectsRequest):
    svc = get_service()
    try:
        results = await svc.generate_sound_effects(
            descriptions=req.descriptions,
            duration=req.duration,
            guidance_scale=req.guidance_scale,
        )
        return [AudioResponse(**r) for r in results]
    except Exception as e:
        logger.error("Effects generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audio Generation Server")
    parser.add_argument("--port", type=int, default=8001, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    args = parser.parse_args()
    logger.info("Starting audio server on %s:%s", args.host, args.port)
    uvicorn.run(app, host=args.host, port=args.port)
