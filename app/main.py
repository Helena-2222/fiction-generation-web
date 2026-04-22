from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import outline_router, story_router, character_router, export_router, task_router


BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"
SUPABASE_BROWSER_BUNDLE = BASE_DIR / "node_modules" / "@supabase" / "supabase-js" / "dist" / "umd" / "supabase.js"

app = FastAPI(title="AI 协同小说创作 WEB", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(outline_router.router)
app.include_router(story_router.router)
app.include_router(character_router.router)
app.include_router(export_router.router)
app.include_router(task_router.router)


@app.get("/")
async def landing() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/auth")
async def auth_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "auth.html")


@app.get("/create")
async def create_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "create.html")


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
