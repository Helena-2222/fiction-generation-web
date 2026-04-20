from __future__ import annotations

from pydantic import BaseModel


class DocxExportRequest(BaseModel):
    filename: str
    title: str = ""
    content: str
