from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routers import outline_router, story_router, character_router, export_router, task_router


BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"

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


@app.get("/create")
async def create_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "create.html")


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}
