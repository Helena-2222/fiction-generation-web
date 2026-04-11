from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class CharacterCard(BaseModel):
    id: str
    name: str = ""
    gender: str = ""
    age: str = ""
    occupation: str = ""
    nationality: str = ""
    personality: str = ""
    appearance: str = ""
    values: str = ""
    core_motivation: str = ""
    graph_x: float = 120
    graph_y: float = 120


class CharacterRelation(BaseModel):
    id: str
    source_id: str
    target_id: str
    label: str = ""
    source_name: str = ""
    target_name: str = ""
    bidirectional: bool = False
    relation_source: Literal["user", "ai"] = "user"


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


class OutlineGenerationRequest(BaseModel):
    story: StoryDraftRequest
    feedback: str = ""
    previous_outline: Optional[GeneratedOutline] = None


class RelationSupplementRequest(BaseModel):
    story: StoryDraftRequest


class RelationSupplementResponse(BaseModel):
    added_relations: List[CharacterRelation] = Field(default_factory=list)


class GeneratedChapter(BaseModel):
    chapter_number: int
    title: str
    summary: str
    content: str


class StoryGenerationRequest(BaseModel):
    story: StoryDraftRequest
    outline: GeneratedOutline


class StoryGenerationResponse(BaseModel):
    title: str
    chapters: List[GeneratedChapter]
