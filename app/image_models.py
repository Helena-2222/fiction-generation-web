from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


TaskStatus = Literal["queued", "running", "success", "failed", "canceled"]


class CharacterTurnaroundRequest(BaseModel):
    project_id: str = "novel_demo_001"
    novel_title: str = ""
    world_setting: str = ""
    era: str = ""
    language_style: str = ""
    character_name: str
    gender: str = ""
    ethnicity: str = ""
    age: str = ""
    job: str = ""
    appearance: str = ""
    costume: str = ""
    personality: str = ""
    visual_style: str = ""
    aspect_ratio: str = "3:4"
    quality: Literal["fast", "standard", "fine"] = "standard"


class ChapterCharacterConstraint(BaseModel):
    name: str
    gender: str = ""
    ethnicity: str = ""
    age: str = ""
    job: str = ""
    appearance: str = ""
    costume: str = ""
    personality: str = ""
    asset_id: str = ""


class ChapterIllustrationRequest(BaseModel):
    project_id: str = "novel_demo_001"
    novel_title: str = ""
    world_setting: str = ""
    era: str = ""
    language_style: str = ""
    visual_style: str = ""
    chapter_id: str
    chapter_title: str
    key_events: str = ""
    prompt: str
    reference_asset_ids: list[str] = Field(default_factory=list)
    involved_characters: list[ChapterCharacterConstraint] = Field(default_factory=list)
    aspect_ratio: str = "3:4"
    quality: Literal["fast", "standard", "fine"] = "standard"
    image_count: int = Field(default=1, ge=1, le=4)


class TaskCreateResponse(BaseModel):
    task_id: str
    status: TaskStatus


class TaskResultItem(BaseModel):
    asset_id: str
    file_url: str


class TaskResponse(BaseModel):
    task_id: str
    task_type: str
    status: TaskStatus
    progress: int = 0
    error_message: str | None = None
    result: list[TaskResultItem] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AssetRecord(BaseModel):
    asset_id: str = Field(default_factory=lambda: f"asset_{uuid4().hex[:12]}")
    project_id: str
    task_id: str
    asset_type: str
    ref_id: str
    prompt: str
    file_path: str
    file_url: str


class ImportedChapter(BaseModel):
    id: str
    title: str
    events: str = ""
    prompt: str = ""


class ImportedCharacter(BaseModel):
    name: str
    gender: str = ""
    ethnicity: str = ""
    age: str = ""
    job: str = ""
    appearance: str = ""
    costume: str = ""
    personality: str = ""


class ImportedNovelData(BaseModel):
    novel_title: str = ""
    world_setting: str = ""
    era: str = ""
    language_style: str = ""
    characters: list[ImportedCharacter] = Field(default_factory=list)
    chapters: list[ImportedChapter] = Field(default_factory=list)


class AssetExportRequest(BaseModel):
    filename: str
    asset_ids: list[str] = Field(default_factory=list)


class ExportCharacterItem(BaseModel):
    name: str
    gender: str = ""
    ethnicity: str = ""
    age: str = ""
    job: str = ""
    appearance: str = ""
    costume: str = ""
    personality: str = ""
    asset_id: str = ""


class ExportChapterItem(BaseModel):
    id: str
    title: str = ""
    events: str = ""
    prompt: str = ""
    asset_ids: list[str] = Field(default_factory=list)


class FullAssetsExportRequest(BaseModel):
    filename: str
    project_id: str = "novel_demo_001"
    novel_title: str = ""
    world_setting: str = ""
    era: str = ""
    language_style: str = ""
    visual_style: str = ""
    aspect_ratio: str = ""
    quality: str = ""
    characters: list[ExportCharacterItem] = Field(default_factory=list)
    chapters: list[ExportChapterItem] = Field(default_factory=list)
