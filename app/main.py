from __future__ import annotations

import os
import mimetypes

# --- HF Mirror for mainland China ---
# Must be set BEFORE any huggingface_hub / diffusers import
if not os.environ.get('HF_ENDPOINT'):
    os.environ['HF_ENDPOINT'] = os.environ.get('HF_MIRROR', 'https://hf-mirror.com')
if not os.environ.get('HF_HUB_DISABLE_SYMLINKS_WARNING'):
    os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import outline_router, story_router, character_router, export_router, task_router, image_router, audio_router, tts_router


# ==============================================================================
# Fix MIME types for Windows
# On some Windows systems, .js / .css MIME types are not registered properly
# causing browsers to reject JavaScript files (especially with type="module")
# ==============================================================================
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/json', '.json')


BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"
HTML_DIR = STATIC_DIR / "html"
SUPABASE_BROWSER_BUNDLE = STATIC_DIR / "js" / "vendor" / "supabase.js"
GENERATED_IMAGES_DIR = BASE_DIR / "data" / "generated_images"

app = FastAPI(title="AI 协同小说创作 WEB", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
GENERATED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
TTS_CHARACTERS_DIR = BASE_DIR / "data" / "tts_characters"
TTS_CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/data/tts_characters", StaticFiles(directory=TTS_CHARACTERS_DIR), name="tts_characters")
app.mount("/generated-images", StaticFiles(directory=GENERATED_IMAGES_DIR), name="generated-images")

app.include_router(outline_router.router)
app.include_router(story_router.router)
app.include_router(character_router.router)
app.include_router(export_router.router)
app.include_router(task_router.router)
app.include_router(image_router.router)
app.include_router(audio_router.router)
app.include_router(tts_router.router)


@app.get("/")
async def landing() -> FileResponse:
    return FileResponse(HTML_DIR / "index.html")


@app.get("/auth")
async def auth_page() -> FileResponse:
    return FileResponse(HTML_DIR / "auth.html")


@app.get("/create")
async def create_page() -> FileResponse:
    return FileResponse(HTML_DIR / "create.html")


@app.get("/images")
async def images_page() -> FileResponse:
    return FileResponse(HTML_DIR / "image-generation.html")


@app.get("/tts")
async def tts_page() -> FileResponse:
    return FileResponse(HTML_DIR / "tts-generation.html")


@app.get("/audio")
async def audio_page() -> FileResponse:
    return FileResponse(HTML_DIR / "audio-generation.html")


@app.get("/works")
async def works_page() -> FileResponse:
    return FileResponse(HTML_DIR / "works.html")


@app.get("/mynote")
async def mynote_page() -> FileResponse:
    return FileResponse(HTML_DIR / "mynote.html")


@app.get("/notes")
async def notes_page() -> FileResponse:
    return FileResponse(HTML_DIR / "mynote.html")


@app.get("/usercenter")
async def usercenter_page() -> FileResponse:
    return FileResponse(HTML_DIR / "usercenter.html")


@app.get("/vendor/supabase.js")
async def supabase_browser_bundle() -> FileResponse:
    if not SUPABASE_BROWSER_BUNDLE.exists():
        raise HTTPException(status_code=404, detail="Supabase browser bundle not found")
    return FileResponse(SUPABASE_BROWSER_BUNDLE, media_type="text/javascript")


@app.get("/api/public-config")
async def public_config() -> dict:
    return {
        "authEnabled": bool(settings.supabase_url and settings.supabase_anon_key),
        "supabaseUrl": settings.supabase_url,
        "supabaseAnonKey": settings.supabase_anon_key,
    }


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}
