from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.docx_export import DOCX_MEDIA_TYPE, build_docx_bytes, sanitize_docx_filename
from app.llm_task_manager import LlmTaskManager
from app.llm_runtime import DeepSeekClient
from app.models import (
    DocxExportRequest,
    LlmTaskStatusResponse,
    OutlineGenerationRequest,
    OutlineGenerationResponse,
    RelationSupplementRequest,
    StorySelectionRewriteRequest,
    StorySelectionRewriteResponse,
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
llm_task_manager = LlmTaskManager(story_service)


@app.get("/")
async def landing() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/create")
async def create_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "create.html")


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


@app.post("/api/story/rewrite-selection")
async def rewrite_story_selection(request: StorySelectionRewriteRequest) -> dict:
    try:
        response: StorySelectionRewriteResponse = await story_service.rewrite_story_selection(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/export/docx")
async def export_docx(request: DocxExportRequest) -> Response:
    try:
        filename = sanitize_docx_filename(request.filename)
        document = build_docx_bytes(request.title, request.content)
        quoted_filename = quote(filename)
        headers = {
            "Content-Disposition": f'attachment; filename="neuro-script-export.docx"; filename*=UTF-8\'\'{quoted_filename}',
            "Cache-Control": "no-store",
        }
        return Response(content=document, media_type=DOCX_MEDIA_TYPE, headers=headers)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/llm-tasks/outline")
async def create_outline_task(request: OutlineGenerationRequest) -> dict:
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.create_outline_task(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/llm-tasks/relations/supplement")
async def create_relation_supplement_task(request: RelationSupplementRequest) -> dict:
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.create_relation_supplement_task(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/llm-tasks/story")
async def create_story_task(request: StoryGenerationRequest) -> dict:
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.create_story_task(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/llm-tasks/{task_id}")
async def get_llm_task(task_id: str) -> dict:
    try:
        response: LlmTaskStatusResponse = llm_task_manager.get_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/llm-tasks/{task_id}/pause")
async def pause_llm_task(task_id: str) -> dict:
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.pause_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/llm-tasks/{task_id}/resume")
async def resume_llm_task(task_id: str) -> dict:
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.resume_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/llm-tasks/{task_id}/discard")
async def discard_llm_task(task_id: str) -> dict:
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.discard_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
