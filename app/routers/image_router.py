from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.image_models import ChapterIllustrationRequest, CharacterTurnaroundRequest, TaskCreateResponse, TaskResponse
from app.image_store import image_store
from app.services.image_docx_parser import parse_novel_docx
from app.services.image_task_service import create_chapter_task, create_character_task


router = APIRouter(prefix="/api/images", tags=["image-generation"])


@router.post("/import/docx")
async def import_docx(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="仅支持 .docx 文件")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="文件为空")

    try:
        return parse_novel_docx(data)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"解析失败: {exc}") from exc


@router.post("/characters/turnaround", response_model=TaskCreateResponse)
async def generate_character_turnaround(req: CharacterTurnaroundRequest) -> TaskCreateResponse:
    return create_character_task(req)


@router.post("/chapters/illustrations", response_model=TaskCreateResponse)
async def generate_chapter_illustrations(req: ChapterIllustrationRequest) -> TaskCreateResponse:
    return create_chapter_task(req)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str) -> TaskResponse:
    task = image_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.get("/projects/{project_id}/assets")
async def list_project_assets(project_id: str) -> dict:
    return {
        "project_id": project_id,
        "assets": image_store.list_project_assets(project_id),
    }


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str) -> dict:
    asset = image_store.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="资源不存在")
    return asset.model_dump()


@router.get("/assets/{asset_id}/download")
async def download_asset(asset_id: str) -> FileResponse:
    asset = image_store.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="资源不存在")
    file_path = Path(asset.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type="application/octet-stream",
    )
