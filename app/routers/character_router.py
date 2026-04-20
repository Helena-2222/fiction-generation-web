from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import LlmTaskStatusResponse, RelationSupplementRequest

router = APIRouter()


@router.post("/api/relations/supplement")
async def supplement_relations(request: RelationSupplementRequest) -> dict:
    from app.dependencies import story_service
    try:
        response = await story_service.supplement_relations(request.story)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/llm-tasks/relations/supplement")
async def create_relation_supplement_task(request: RelationSupplementRequest) -> dict:
    from app.dependencies import llm_task_manager
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.create_relation_supplement_task(request)
        return response.model_dump()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
