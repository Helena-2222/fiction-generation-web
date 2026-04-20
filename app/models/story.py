from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.character import CharacterCard, CharacterRelation


class StoryDraftRequest(BaseModel):
    genre: str = ""
    synopsis: str = Field(..., min_length=1)
    style: str = ""
    worldview_time: str = ""
    worldview_physical: str = ""
    worldview_social: str = ""
    total_words: int = Field(..., gt=0)
    chapter_words: Optional[int] = Field(default=None, gt=0)
    characters: List[CharacterCard] = Field(default_factory=list)
    relations: List[CharacterRelation] = Field(default_factory=list)


class RelationSupplementRequest(BaseModel):
    story: StoryDraftRequest


class RelationSupplementResponse(BaseModel):
    added_relations: List[CharacterRelation] = Field(default_factory=list)


class GeneratedChapter(BaseModel):
    chapter_number: int
    title: str
    summary: str
    content: str


class StoryGenerationResponse(BaseModel):
    title: str
    chapters: List[GeneratedChapter]


class StorySelectionRewriteResponse(BaseModel):
    rewritten_text: str
