from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models import DocxExportRequest
from app.utils.docx_export import DOCX_MEDIA_TYPE, build_docx_bytes, sanitize_docx_filename

router = APIRouter()


@router.post("/api/export/docx")
async def export_docx(request: DocxExportRequest) -> Response:
    try:
        filename = sanitize_docx_filename(request.filename)
        document = build_docx_bytes(request.title, request.content)
        quoted_filename = quote(filename)
        headers = {
            "Content-Disposition": f'attachment; filename="neuro-script-export.docx"; filename*=UTF-8\'\'{quoted_filename}',
            "Cache-Control": "no-store",
        }
        return Response(content=document, media_type=DOCX_MEDIA_TYPE, headers=headers)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
