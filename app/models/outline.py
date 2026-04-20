from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.story import (
    GeneratedChapter,
    StoryDraftRequest,
    StoryGenerationResponse,
    StorySelectionRewriteResponse,
)


class ActOutlineSection(BaseModel):
    stage: str
    content: str
    chapter_range: str = ""
    start_chapter: Optional[int] = Field(default=None, ge=1)
    end_chapter: Optional[int] = Field(default=None, ge=1)


class OutlineChapter(BaseModel):
    chapter_number: int
    title: str
    target_words: int
    summary: str
    key_events: List[str] = Field(default_factory=list)
    cliffhanger: str = ""


class GeneratedOutline(BaseModel):
    title: str
    logline: str
    summary: str
    inferred_details: List[str] = Field(default_factory=list)
    act_structure: List[ActOutlineSection] = Field(default_factory=list)
    chapter_count: int
    chapters: List[OutlineChapter] = Field(default_factory=list)


class AutoNamedCharacter(BaseModel):
    id: str
    name: str


class OutlineGenerationRequest(BaseModel):
    story: StoryDraftRequest
    feedback: str = ""
    previous_outline: Optional[GeneratedOutline] = None


class OutlineGenerationResponse(BaseModel):
    story: StoryDraftRequest
    outline: GeneratedOutline
    auto_named_characters: List[AutoNamedCharacter] = Field(default_factory=list)


class StoryGenerationRequest(BaseModel):
    story: StoryDraftRequest
    outline: GeneratedOutline


class StorySelectionRewriteRequest(BaseModel):
    story: StoryDraftRequest
    outline: GeneratedOutline
    chapter_number: int = Field(..., ge=1)
    chapter_title: str = ""
    chapter_summary: str = ""
    selected_text: str = Field(..., min_length=1)
    before_context: str = ""
    after_context: str = ""
    instruction: str = ""


# Re-export for consumers that import these from outline
__all__ = [
    "ActOutlineSection",
    "OutlineChapter",
    "GeneratedOutline",
    "AutoNamedCharacter",
    "OutlineGenerationRequest",
    "OutlineGenerationResponse",
    "StoryGenerationRequest",
    "StorySelectionRewriteRequest",
    "GeneratedChapter",
    "StoryGenerationResponse",
    "StorySelectionRewriteResponse",
]
