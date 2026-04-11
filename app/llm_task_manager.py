from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Literal
from uuid import uuid4

from app.models import (
    LlmTaskStatusResponse,
    OutlineGenerationRequest,
    RelationSupplementRequest,
)
from app.services.story_service import StoryService


TaskKind = Literal["outline", "relations_supplement"]
TaskStatus = Literal["running", "paused", "completed", "failed", "discarded"]


@dataclass
class ManagedLlmTask:
    task_id: str
    kind: TaskKind
    payload: Dict[str, Any]
    created_at: str
    updated_at: str
    status: TaskStatus = "running"
    result: Dict[str, Any] | None = None
    error: str = ""
    worker: asyncio.Task[None] | None = field(default=None, repr=False)


class LlmTaskManager:
    def __init__(self, story_service: StoryService) -> None:
        self._story_service = story_service
        self._tasks: Dict[str, ManagedLlmTask] = {}

    async def create_outline_task(
        self,
        request: OutlineGenerationRequest,
    ) -> LlmTaskStatusResponse:
        return self._create_task("outline", request.model_dump())

    async def create_relation_supplement_task(
        self,
        request: RelationSupplementRequest,
    ) -> LlmTaskStatusResponse:
        return self._create_task("relations_supplement", request.model_dump())

    def get_task(self, task_id: str) -> LlmTaskStatusResponse:
        task = self._require_task(task_id)
        return self._to_response(task)

    async def pause_task(self, task_id: str) -> LlmTaskStatusResponse:
        task = self._require_task(task_id)
        if task.status != "running":
            return self._to_response(task)

        task.status = "paused"
        task.updated_at = self._now()
        task.error = ""
        await self._cancel_worker(task)
        return self._to_response(task)

    async def resume_task(self, task_id: str) -> LlmTaskStatusResponse:
        task = self._require_task(task_id)
        if task.status == "running":
            return self._to_response(task)
        if task.status != "paused":
            raise ValueError("当前任务不处于已暂停状态，无法继续。")

        task.status = "running"
        task.updated_at = self._now()
        task.result = None
        task.error = ""
        self._start_worker(task)
        return self._to_response(task)

    async def discard_task(self, task_id: str) -> LlmTaskStatusResponse:
        task = self._require_task(task_id)
        task.status = "discarded"
        task.updated_at = self._now()
        task.result = None
        task.error = ""
        await self._cancel_worker(task)
        return self._to_response(task)

    def _create_task(self, kind: TaskKind, payload: Dict[str, Any]) -> LlmTaskStatusResponse:
        now = self._now()
        task = ManagedLlmTask(
            task_id=f"llm-task-{uuid4()}",
            kind=kind,
            payload=payload,
            created_at=now,
            updated_at=now,
        )
        self._tasks[task.task_id] = task
        self._start_worker(task)
        return self._to_response(task)

    def _start_worker(self, task: ManagedLlmTask) -> None:
        task.worker = asyncio.create_task(self._run_task(task))

    async def _run_task(self, task: ManagedLlmTask) -> None:
        try:
            if task.kind == "outline":
                request = OutlineGenerationRequest.model_validate(task.payload)
                result = await self._story_service.generate_outline(request)
            else:
                request = RelationSupplementRequest.model_validate(task.payload)
                result = await self._story_service.supplement_relations(request.story)
        except asyncio.CancelledError:
            task.updated_at = self._now()
            task.worker = None
            return
        except Exception as exc:  # noqa: BLE001
            if task.status not in {"paused", "discarded"}:
                task.status = "failed"
                task.error = str(exc)
                task.result = None
                task.updated_at = self._now()
            task.worker = None
            return

        if task.status == "running":
            task.status = "completed"
            task.result = result.model_dump()
            task.error = ""
            task.updated_at = self._now()

        task.worker = None

    async def _cancel_worker(self, task: ManagedLlmTask) -> None:
        worker = task.worker
        if worker and not worker.done():
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass

    def _require_task(self, task_id: str) -> ManagedLlmTask:
        task = self._tasks.get(task_id)
        if task is None:
            raise KeyError("未找到对应的 LLM 任务。")
        return task

    @staticmethod
    def _to_response(task: ManagedLlmTask) -> LlmTaskStatusResponse:
        return LlmTaskStatusResponse(
            task_id=task.task_id,
            kind=task.kind,
            status=task.status,
            created_at=task.created_at,
            updated_at=task.updated_at,
            result=task.result,
            error=task.error,
        )

    @staticmethod
    def _now() -> str:
        return datetime.now().isoformat(timespec="seconds")
