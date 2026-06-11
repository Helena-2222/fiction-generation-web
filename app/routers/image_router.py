from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app.image_models import (
    AssetExportRequest,
    ChapterIllustrationRequest,
    CharacterTurnaroundRequest,
    FullAssetsExportRequest,
    TaskCreateResponse,
    TaskResponse,
)
from app.image_store import image_store
from app.services.image_docx_parser import parse_novel_docx
from app.services.image_task_service import create_chapter_task, create_character_task
from app.utils.docx_export import build_docx_bytes, sanitize_docx_filename


router = APIRouter(prefix="/api/images", tags=["image-generation"])


def sanitize_zip_filename(filename: str, default_stem: str) -> str:
    candidate = Path(str(filename or "").strip()).stem
    candidate = candidate.strip() or default_stem
    safe_docx = sanitize_docx_filename(candidate)
    return f"{Path(safe_docx).stem}.zip"


def build_zip_download_headers(filename: str) -> dict[str, str]:
    quoted_filename = quote(filename)
    return {
        "Content-Disposition": f'attachment; filename="export.zip"; filename*=UTF-8\'\'{quoted_filename}',
        "Cache-Control": "no-store",
    }


def build_assets_archive(asset_ids: list[str]) -> bytes:
    if not asset_ids:
        raise HTTPException(status_code=400, detail="No exportable assets were selected")

    seen: set[str] = set()
    buffer = BytesIO()

    with ZipFile(buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        for asset_id in asset_ids:
            if not asset_id or asset_id in seen:
                continue
            seen.add(asset_id)

            asset = image_store.get_asset(asset_id)
            if not asset:
                raise HTTPException(status_code=404, detail=f"Asset not found: {asset_id}")

            file_path = Path(asset.file_path)
            if not file_path.exists():
                raise HTTPException(status_code=404, detail=f"File not found for asset: {asset_id}")

            archive_path = f"{asset.asset_type}/{file_path.name}"
            archive.write(file_path, arcname=archive_path)

    if not seen:
        raise HTTPException(status_code=400, detail="No generated assets are available for export")

    return buffer.getvalue()


def build_project_summary(request: FullAssetsExportRequest) -> str:
    lines: list[str] = [
        f"小说标题：{request.novel_title or '未命名小说'}",
        f"世界观：{request.world_setting or '未提供'}",
        f"时代背景：{request.era or '未提供'}",
        f"语言风格：{request.language_style or '未提供'}",
        f"视觉风格：{request.visual_style or '未提供'}",
        f"画幅比例：{request.aspect_ratio or '未提供'}",
        f"生成质量：{request.quality or '未提供'}",
        "",
        "角色设定",
    ]

    if request.characters:
        for index, character in enumerate(request.characters, start=1):
            lines.extend(
                [
                    f"{index}. {character.name or f'角色{index}'}",
                    f"性别：{character.gender or '未提供'}",
                    f"年龄：{character.age or '未提供'}",
                    f"国籍/种族：{character.ethnicity or '未提供'}",
                    f"身份职业：{character.job or '未提供'}",
                    f"外在特征：{character.appearance or '未提供'}",
                    f"服装设定：{character.costume or '未提供'}",
                    f"性格关键词：{character.personality or '未提供'}",
                    "",
                ]
            )
    else:
        lines.extend(["暂无角色设定", ""])

    lines.append("章节配图信息")
    if request.chapters:
        for index, chapter in enumerate(request.chapters, start=1):
            lines.extend(
                [
                    f"{index}. {chapter.title or chapter.id or f'章节{index}'}",
                    f"章节编号：{chapter.id or '未提供'}",
                    f"关键事件：{chapter.events or '未提供'}",
                    f"章节提示词：{chapter.prompt or '未提供'}",
                    "",
                ]
            )
    else:
        lines.append("暂无章节配图信息")

    return "\n".join(lines).strip()


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


@router.post("/exports/characters")
async def export_all_characters(request: AssetExportRequest) -> Response:
    archive = build_assets_archive(request.asset_ids)
    filename = sanitize_zip_filename(request.filename, "character-assets")
    return Response(
        content=archive,
        media_type="application/zip",
        headers=build_zip_download_headers(filename),
    )


@router.post("/exports/chapters")
async def export_all_chapters(request: AssetExportRequest) -> Response:
    archive = build_assets_archive(request.asset_ids)
    filename = sanitize_zip_filename(request.filename, "chapter-assets")
    return Response(
        content=archive,
        media_type="application/zip",
        headers=build_zip_download_headers(filename),
    )


@router.post("/exports/all")
async def export_all_assets(request: FullAssetsExportRequest) -> Response:
    asset_ids: list[str] = []
    asset_ids.extend([character.asset_id for character in request.characters if character.asset_id])
    for chapter in request.chapters:
        asset_ids.extend(chapter.asset_ids)

    summary_doc = build_docx_bytes(
        request.novel_title or "项目素材说明文档",
        build_project_summary(request),
    )

    seen: set[str] = set()
    buffer = BytesIO()
    with ZipFile(buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        for asset_id in asset_ids:
            if not asset_id or asset_id in seen:
                continue
            seen.add(asset_id)
            asset = image_store.get_asset(asset_id)
            if not asset:
                raise HTTPException(status_code=404, detail=f"Asset not found: {asset_id}")
            file_path = Path(asset.file_path)
            if not file_path.exists():
                raise HTTPException(status_code=404, detail=f"File not found for asset: {asset_id}")
            archive.write(file_path, arcname=f"{asset.asset_type}/{file_path.name}")

        archive.writestr("说明文档.docx", summary_doc)

    filename = sanitize_zip_filename(request.filename, "all-assets")
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers=build_zip_download_headers(filename),
    )
