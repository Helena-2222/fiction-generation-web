from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.llm_runtime import DeepSeekClient
from app.models import (
    OutlineGenerationRequest,
    OutlineGenerationResponse,
    RelationSupplementRequest,
    StoryGenerationRequest,
)
from app.services.story_service import StoryService


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

story_service = StoryService(DeepSeekClient())


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/api/outline")
async def generate_outline(request: OutlineGenerationRequest) -> dict:
    try:
        response: OutlineGenerationResponse = await story_service.generate_outline(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/relations/supplement")
async def supplement_relations(request: RelationSupplementRequest) -> dict:
    try:
        response = await story_service.supplement_relations(request.story)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/story")
async def generate_story(request: StoryGenerationRequest) -> dict:
    try:
        story = await story_service.generate_story(request)
        return story.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
