from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from app.config import ROOT_DIR
from app.image_models import (
    AssetRecord,
    ChapterIllustrationRequest,
    CharacterTurnaroundRequest,
    TaskCreateResponse,
    TaskResponse,
    TaskResultItem,
)
from app.image_store import image_store
from app.services.image_provider import DashScopeImageProvider, ImageProviderError, save_image_bytes


provider = DashScopeImageProvider()
GENERATED_DIR = ROOT_DIR / "data" / "generated_images"


def _aspect_to_size(aspect_ratio: str) -> str:
    return {
        "1:1": "1024*1024",
        "2:3": "1024*1536",
        "3:4": "1024*1365",
        "4:3": "1365*1024",
        "9:16": "1024*1820",
        "16:9": "1820*1024",
    }.get(aspect_ratio, "1024*1365")


def _default_story_style(req: CharacterTurnaroundRequest | ChapterIllustrationRequest) -> str:
    hints: list[str] = []
    if req.era:
        hints.append(f"时代气质贴合“{req.era}”")
    if req.language_style:
        hints.append(f"整体氛围参考“{req.language_style}”")
    if req.world_setting:
        hints.append(f"场景设定遵循“{req.world_setting}”")
    hints.append("默认采用完整上色的彩色叙事插画风格")
    hints.append("避免铅笔草图、黑白线稿、设计草稿感")
    return "；".join(hints)


def _explicit_style_part(visual_style: str | None) -> str:
    if not visual_style:
        return ""
    return f"视觉风格明确指定为“{visual_style}”，并且优先服从该风格；"


def _build_character_prompt(req: CharacterTurnaroundRequest) -> str:
    story_context: list[str] = []
    if req.world_setting:
        story_context.append(f"世界观：{req.world_setting}")
    if req.era:
        story_context.append(f"时代背景：{req.era}")
    if req.language_style:
        story_context.append(f"语言风格：{req.language_style}")

    style_part = _explicit_style_part(req.visual_style) or _default_story_style(req)

    return (
        "请绘制一个标准角色设定三视图，包含正面、侧面、背面三个视角，并且三个视角必须是同一个角色。"
        f"{'；'.join(story_context)}；"
        f"角色名：{req.character_name}；"
        f"性别：{req.gender or '未提供'}；"
        f"国籍/种族：{req.ethnicity or '未提供'}；"
        f"身份职业：{req.job or '未提供'}；"
        f"年龄：{req.age or '未提供'}；"
        f"外在特征：{req.appearance or '未提供'}；"
        f"服装设定：{req.costume or '未提供'}；"
        f"性格关键词：{req.personality or '未提供'}；"
        f"{style_part}；"
        "要求：三视图位于同一画布，人物比例统一，脸部特征一致，发型一致，服装一致，鞋子一致；"
        "严格遵循用户填写的服装设定与外在特征，不要擅自新增未指定元素；"
        "画面为成品级彩色角色设定图，不要铅笔稿，不要单纯描边稿，不要黑白草图；"
        "整个画面中绝对不要出现任何文字、汉字、英文字母、数字、标题、说明、标签、水印、边框字、视角标注或排版元素；"
        "不要在画面下方或上方写“正面”“侧面”“背面”、角色名、小说名或任何说明文字。"
    )


def _character_negative_prompt(req: CharacterTurnaroundRequest) -> str:
    return (
        "text, title, typography, caption, label, watermark, calligraphy, chinese characters, english letters, "
        "digits, subtitles, annotations, front view label, side view label, back view label, "
        "inconsistent hairstyle, inconsistent clothes, inconsistent shoes, sketch, pencil drawing, monochrome"
    )


def _build_chapter_prompt(req: ChapterIllustrationRequest) -> str:
    story_context: list[str] = []
    if req.world_setting:
        story_context.append(f"世界观：{req.world_setting}")
    if req.era:
        story_context.append(f"时代背景：{req.era}")
    if req.language_style:
        story_context.append(f"语言风格：{req.language_style}")

    style_part = _explicit_style_part(req.visual_style) or _default_story_style(req)
    return (
        "请为小说章节绘制一张叙事插图。"
        f"{'；'.join(story_context)}；"
        f"章节标题：{req.chapter_title}；"
        f"关键事件：{req.key_events or '未提供'}；"
        f"章节描述：{req.prompt}；"
        f"{style_part}；"
        "要求：构图完整，人物和场景风格一致，氛围与剧情匹配；"
        "输出成品级彩色插画，不要草稿感，不要铅笔线描，不要文字标题。"
    )


def create_character_task(req: CharacterTurnaroundRequest) -> TaskCreateResponse:
    task_id = f"task_{uuid4().hex[:16]}"
    now = datetime.utcnow()
    task = TaskResponse(
        task_id=task_id,
        task_type="character_turnaround",
        status="queued",
        progress=0,
        created_at=now,
        updated_at=now,
    )
    image_store.create_task(task)
    asyncio.create_task(_run_character_task(task_id, req))
    return TaskCreateResponse(task_id=task_id, status="queued")


def create_chapter_task(req: ChapterIllustrationRequest) -> TaskCreateResponse:
    task_id = f"task_{uuid4().hex[:16]}"
    now = datetime.utcnow()
    task = TaskResponse(
        task_id=task_id,
        task_type="chapter_illustration",
        status="queued",
        progress=0,
        created_at=now,
        updated_at=now,
    )
    image_store.create_task(task)
    asyncio.create_task(_run_chapter_task(task_id, req))
    return TaskCreateResponse(task_id=task_id, status="queued")


async def _run_character_task(task_id: str, req: CharacterTurnaroundRequest) -> None:
    try:
        image_store.update_task(task_id, status="running", progress=20, updated_at=datetime.utcnow())
        prompt = _build_character_prompt(req)
        images = await provider.generate_images(
            prompt=prompt,
            size=_aspect_to_size(req.aspect_ratio),
            count=1,
            quality=req.quality,
            negative_prompt=_character_negative_prompt(req),
        )
        image_store.update_task(task_id, progress=80, updated_at=datetime.utcnow())

        file_name = f"{task_id}_turnaround.png"
        file_path = GENERATED_DIR / file_name
        save_image_bytes(images[0], file_path)

        asset = AssetRecord(
            project_id=req.project_id,
            task_id=task_id,
            asset_type="character_turnaround",
            ref_id=req.character_name,
            prompt=prompt,
            file_path=str(file_path),
            file_url=f"/generated-images/{file_name}",
        )
        image_store.add_asset(asset)
        result = [TaskResultItem(asset_id=asset.asset_id, file_url=asset.file_url)]
        image_store.update_task(
            task_id,
            status="success",
            progress=100,
            result=result,
            updated_at=datetime.utcnow(),
        )
    except ImageProviderError as exc:
        image_store.update_task(
            task_id,
            status="failed",
            progress=100,
            error_message=str(exc),
            updated_at=datetime.utcnow(),
        )
    except Exception as exc:  # noqa: BLE001
        image_store.update_task(
            task_id,
            status="failed",
            progress=100,
            error_message=f"内部错误: {exc}",
            updated_at=datetime.utcnow(),
        )


async def _run_chapter_task(task_id: str, req: ChapterIllustrationRequest) -> None:
    try:
        image_store.update_task(task_id, status="running", progress=15, updated_at=datetime.utcnow())
        prompt = _build_chapter_prompt(req)
        images = await provider.generate_images(
            prompt=prompt,
            size=_aspect_to_size(req.aspect_ratio),
            count=req.image_count,
            quality=req.quality,
        )
        results: list[TaskResultItem] = []
        for index, image_bytes in enumerate(images, start=1):
            file_name = f"{task_id}_chapter_{index}.png"
            file_path = GENERATED_DIR / file_name
            save_image_bytes(image_bytes, file_path)
            asset = AssetRecord(
                project_id=req.project_id,
                task_id=task_id,
                asset_type="chapter_illustration",
                ref_id=req.chapter_id,
                prompt=prompt,
                file_path=str(file_path),
                file_url=f"/generated-images/{file_name}",
            )
            image_store.add_asset(asset)
            results.append(TaskResultItem(asset_id=asset.asset_id, file_url=asset.file_url))
            progress = min(95, 15 + int(index / max(1, len(images)) * 80))
            image_store.update_task(task_id, progress=progress, updated_at=datetime.utcnow())

        image_store.update_task(
            task_id,
            status="success",
            progress=100,
            result=results,
            updated_at=datetime.utcnow(),
        )
    except ImageProviderError as exc:
        image_store.update_task(
            task_id,
            status="failed",
            progress=100,
            error_message=str(exc),
            updated_at=datetime.utcnow(),
        )
    except Exception as exc:  # noqa: BLE001
        image_store.update_task(
            task_id,
            status="failed",
            progress=100,
            error_message=f"内部错误: {exc}",
            updated_at=datetime.utcnow(),
        )
