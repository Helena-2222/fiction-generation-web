from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import (
    LlmTaskStatusResponse,
    OutlineGenerationRequest,
    OutlineGenerationResponse,
)

router = APIRouter()


@router.post("/api/outline")
async def generate_outline(request: OutlineGenerationRequest) -> dict:
    from app.dependencies import story_service
    try:
        response: OutlineGenerationResponse = await story_service.generate_outline(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/llm-tasks/outline")
async def create_outline_task(request: OutlineGenerationRequest) -> dict:
    from app.dependencies import llm_task_manager
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.create_outline_task(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
