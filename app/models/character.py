from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


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
