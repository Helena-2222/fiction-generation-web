from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import LlmTaskStatusResponse

router = APIRouter()


@router.get("/api/llm-tasks/{task_id}")
async def get_llm_task(task_id: str) -> dict:
    from app.dependencies import llm_task_manager
    try:
        response: LlmTaskStatusResponse = llm_task_manager.get_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/llm-tasks/{task_id}/pause")
async def pause_llm_task(task_id: str) -> dict:
    from app.dependencies import llm_task_manager
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.pause_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/llm-tasks/{task_id}/resume")
async def resume_llm_task(task_id: str) -> dict:
    from app.dependencies import llm_task_manager
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.resume_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/llm-tasks/{task_id}/discard")
async def discard_llm_task(task_id: str) -> dict:
    from app.dependencies import llm_task_manager
    try:
        response: LlmTaskStatusResponse = await llm_task_manager.discard_task(task_id)
        return response.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
