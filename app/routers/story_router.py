from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import (
    LlmTaskStatusResponse,
    StoryGenerationRequest,
    StorySelectionRewriteRequest,
    StorySelectionRewriteResponse,
)

router = APIRouter()


@router.post("/api/story")
async def generate_story(request: StoryGenerationRequest) -> dict:
    from app.dependencies import story_service
    try:
        story = await story_service.generate_story(request)
        return story.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/story/rewrite-selection")
async def rewrite_story_selection(request: StorySelectionRewriteRequest) -> dict:
    from app.dependencies import story_service
    try:
        response: StorySelectionRewriteResponse = await story_service.rewrite_story_selection(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/llm-tasks/story")
async def create_story_task(request: StoryGenerationRequest) -> dict:
    from app.dependencies import llm_task_manager
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.create_story_task(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
