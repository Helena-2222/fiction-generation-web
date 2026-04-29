from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel


class LlmTaskStatusResponse(BaseModel):
    task_id: str
    kind: Literal["outline", "relations_supplement", "story", "story_chapter"]
    status: Literal["running", "paused", "completed", "failed", "discarded"]
    created_at: str
    updated_at: str
    result: Optional[Dict[str, Any]] = None
    error: str = ""
