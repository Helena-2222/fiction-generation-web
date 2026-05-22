from __future__ import annotations

import asyncio
import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from app.config import ROOT_DIR
from app.image_models import (
    AssetRecord,
    ChapterCharacterConstraint,
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
    return f'视觉风格明确指定为“{visual_style}”，并且优先服从该风格；'


def _character_lower_body_rule(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )
    has_long_outerwear = any(
        token in source
        for token in ("风衣", "大衣", "长外套", "trench", "coat", "overcoat", "long jacket")
    )
    has_explicit_lower_body = any(
        token in source
        for token in ("裤", "裤装", "半裙", "裙", "丝袜", "长袜", "短袜", "袜", "trousers", "pants", "skirt", "dress", "stockings", "socks")
    )

    if has_long_outerwear and not has_explicit_lower_body:
        return "若角色穿长外套但未明确写下装，默认下装被外套整体遮住，只露出自然小腿与鞋子；不要额外露出裤腿、丝袜、长袜、短袜或深色腿部覆盖物。"
    return ""


def _character_legwear_rule(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )

    if any(token in source for token in ("长裤", "西裤", "裤装", "trousers", "pants", "slacks")):
        return "腿部规则：三视图都必须使用同一种长裤方案，左右腿完全对称一致，不要在某个视角改成其他下装或不同的腿部覆盖方式；"
    if any(token in source for token in ("连裤袜", "pantyhose", "tights")):
        return "腿部规则：三视图都必须使用同一种腿部覆盖方案，左右腿完全一致，颜色、材质、长度完全一致，不要在某个视角改成其他腿部服饰；"
    if any(token in source for token in ("丝袜", "黑丝", "灰丝", "stockings", "hosiery")):
        return "腿部规则：三视图都必须使用同一种腿部覆盖方案，左右腿完全一致，颜色、材质、覆盖范围完全一致，不要在某个视角切换成其他腿部服饰或不同深浅；"
    if any(token in source for token in ("过膝袜", "及膝袜", "长袜", "thigh-high", "over-knee", "knee socks")):
        return "腿部规则：三视图都必须使用同一种长袜方案，左右腿完全一致，长度、颜色、材质完全一致，不要在某个视角改成其他腿部覆盖方式；"
    if any(token in source for token in ("短袜", "船袜", "ankle socks", "short socks")):
        return "腿部规则：三视图都必须使用同一种短袜方案，左右腿完全一致，颜色、长度、材质完全一致，不要在不同视角切换成其他腿部覆盖方式；"
    return (
        "腿部规则：用户未指定腿部服饰或裤装时，三视图必须统一使用无遮盖的自然腿部表现；"
        "正面、侧面、背面都必须是同一种自然肤色腿部效果，左右腿完全一致；"
        "不要自动添加任何袜类、深色腿部覆盖物、半透明覆盖物或其他额外腿部配饰。"
    )


def _character_legwear_negative(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )

    if any(token in source for token in ("长裤", "西裤", "裤装", "trousers", "pants", "slacks")):
        return "inconsistent trousers between views, mixed lower-garment styles, asymmetric leg covering"
    if any(token in source for token in ("连裤袜", "pantyhose", "tights")):
        return "inconsistent leg covering between views, mixed legwear styles, asymmetric leg covering"
    if any(token in source for token in ("丝袜", "黑丝", "灰丝", "stockings", "hosiery")):
        return "inconsistent leg covering between views, mixed legwear styles, asymmetric leg covering"
    if any(token in source for token in ("过膝袜", "及膝袜", "长袜", "thigh-high", "over-knee", "knee socks")):
        return "inconsistent leg covering between views, mixed legwear styles, asymmetric leg covering"
    if any(token in source for token in ("短袜", "船袜", "ankle socks", "short socks")):
        return "inconsistent leg covering between views, mixed legwear styles, asymmetric leg covering"
    return "unrequested leg accessories, dark leg covering, semi-transparent leg covering, inconsistent leg covering between views, mixed legwear styles, asymmetric leg covering"


def _character_accessory_rule(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )

    if any(token in source for token in ("礼帽", "帽子", "hat", "fedora", "beret", "cap")):
        return "配饰规则：三视图都必须使用同一顶已明确指定的帽子或头部配饰，形状、颜色、佩戴方式保持一致，不要换成别的款式；"
    return "配饰规则：如果用户没有明确写帽子、礼帽、贝雷帽、鸭舌帽、手套、围巾、眼镜、耳饰等配饰，就不要自动添加任何这类配饰，尤其不要添加任何帽子或头部装饰；"


def _character_accessory_negative(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )

    if any(token in source for token in ("礼帽", "帽子", "hat", "fedora", "beret", "cap")):
        return "inconsistent hat design, different hat between views, changed accessory design between views"
    return "hat, fedora, cap, beret, headwear, head accessory, hair accessory, gloves, scarf, glasses, earrings"


def _character_accessory_english_rule(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )

    if any(token in source for token in ("礼帽", "帽子", "hat", "fedora", "beret", "cap")):
        return "Accessory rules: use the same explicitly specified hat or head accessory in all three views. Do not change its shape, color, or wearing method."
    return "Accessory rules: no hat, no fedora, no cap, no beret, no headwear, and no head accessory unless explicitly specified by the user."


def _character_consistency_english_rule(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )
    if any(token in source for token in ("长裤", "西裤", "裤装", "trousers", "pants", "slacks")):
        legwear = "the same full-length trousers in all three views"
        forbidden = "no mixed lower-garment styles"
    elif any(token in source for token in ("连裤袜", "pantyhose", "tights")):
        legwear = "the same leg covering in all three views"
        forbidden = "no mixed legwear styles"
    elif any(token in source for token in ("丝袜", "黑丝", "灰丝", "stockings", "hosiery")):
        legwear = "the same leg covering in all three views"
        forbidden = "no mixed legwear styles"
    elif any(token in source for token in ("过膝袜", "及膝袜", "长袜", "thigh-high", "over-knee", "knee socks")):
        legwear = "the same long-sock design in all three views"
        forbidden = "no mixed legwear styles"
    elif any(token in source for token in ("短袜", "船袜", "ankle socks", "short socks")):
        legwear = "the same short-sock design in all three views"
        forbidden = "no mixed legwear styles"
    else:
        legwear = "the same uncovered natural-leg design in all three views"
        forbidden = "no extra leg accessories, no dark leg covering, no semi-transparent leg covering unless explicitly specified"

    return (
        "Hard consistency rules: the front view, side view, and back view must show exactly the same character design. "
        f"Legwear must be {legwear}. "
        "The left leg and right leg must match each other. "
        f"{forbidden}. "
        "Do not change lower-body design, leg color, skirt length, shoe type, or outfit details between views."
    )


def _character_distinctiveness_rule(req: CharacterTurnaroundRequest) -> str:
    has_costume = bool((req.costume or "").strip())
    role_bits = [part.strip() for part in (req.job, req.personality, req.age, req.ethnicity) if part and part.strip()]
    role_hint = "；".join(role_bits)

    if has_costume:
        return (
            "角色区分度规则：严格按已填写的服装设定生成，不要把该角色做成通用模板化造型；"
            "鞋型、外套剪裁、帽子/配饰、配色关系要服务于这个角色自身，不要退化成模糊、混乱、模板化的通用装束。"
        )

    if role_hint:
        return (
            f"角色区分度规则：当服装设定未写细时，请根据该角色的身份、气质与特征（{role_hint}）补足一套独特造型；"
            "要主动拉开与其他角色的轮廓、配色和鞋型差异，不要反复使用近似的模板化制服、近似鞋型或近似外套剪裁。"
        )

    return (
        "角色区分度规则：当服装设定未写细时，也要给该角色明确且独特的服装轮廓、配色和鞋型；"
        "不要默认生成雷同的模板化外套、相同鞋型或近似制服轮廓。"
    )


def _character_skirt_rule(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )

    has_skirt = any(
        token in source
        for token in ("半裙", "裙", "短裙", "长裙", "连衣裙", "skirt", "dress")
    )
    has_explicit_legwear = any(
        token in source
        for token in (
            "连裤袜",
            "丝袜",
            "黑丝",
            "灰丝",
            "长袜",
            "短袜",
            "袜",
            "pantyhose",
            "tights",
            "stockings",
            "hosiery",
            "socks",
        )
    )

    if not has_skirt:
        return ""

    if has_explicit_legwear:
        return (
            "裙装规则：如果角色穿裙装且已明确指定袜子或腿部覆盖物，裙子必须作为独立服装单品清晰可辨；"
            "裙摆颜色、材质、厚度和边缘必须与腿部覆盖物明显区分，不能把裙子与袜子画成同一种颜色或连成一个整体色块。"
        )

    return (
        "裙装规则：如果角色穿裙装但未明确指定袜子或腿部覆盖物，默认表现为自然裸腿或接近自然肤色的轻薄腿部处理；"
        "不要自动添加黑丝、深色连裤袜、深色长袜或任何会让裙子下半部分看起来像裤装的深色腿部覆盖物；"
        "裙子必须作为独立服装单品清晰可辨，裙摆颜色、材质、边缘要与腿部明显分离，不能与腿部画成同色同材质的一整块。"
    )


def _character_skirt_negative(req: CharacterTurnaroundRequest) -> str:
    source = " ".join(
        part.strip().lower()
        for part in (req.costume, req.appearance)
        if part and part.strip()
    )
    has_skirt = any(
        token in source
        for token in ("半裙", "裙", "短裙", "长裙", "连衣裙", "skirt", "dress")
    )
    has_explicit_legwear = any(
        token in source
        for token in (
            "连裤袜",
            "丝袜",
            "黑丝",
            "灰丝",
            "长袜",
            "短袜",
            "袜",
            "pantyhose",
            "tights",
            "stockings",
            "hosiery",
            "socks",
        )
    )

    if not has_skirt:
        return ""
    if has_explicit_legwear:
        return "skirt merged with legwear, same-color skirt and stockings, skirt fused into tights, skirt mistaken for trousers"
    return "dark pantyhose, black tights, dark stockings, unrequested legwear, skirt merged with legwear, same-color skirt and legs, skirt mistaken for trousers"


def _build_character_prompt(req: CharacterTurnaroundRequest) -> str:
    story_context: list[str] = []
    if req.world_setting:
        story_context.append(f"世界观：{req.world_setting}")
    if req.era:
        story_context.append(f"时代背景：{req.era}")
    if req.language_style:
        story_context.append(f"语言风格：{req.language_style}")

    style_part = _explicit_style_part(req.visual_style) or _default_story_style(req)
    distinctiveness_rule = _character_distinctiveness_rule(req)
    lower_body_rule = _character_lower_body_rule(req)
    legwear_rule = _character_legwear_rule(req)
    accessory_rule = _character_accessory_rule(req)
    accessory_english_rule = _character_accessory_english_rule(req)
    consistency_english_rule = _character_consistency_english_rule(req)
    skirt_rule = _character_skirt_rule(req)
    prompt_parts = [
        "请绘制一个标准角色设定三视图，包含正面、侧面、背面三个视角，并且三个视角必须是同一个角色。",
    ]
    if story_context:
        prompt_parts.append("；".join(story_context) + "；")
    prompt_parts.extend(
        [
            f"角色名：{req.character_name}；",
            f"性别：{req.gender or '未提供'}；",
            f"国籍/种族：{req.ethnicity or '未提供'}；",
            f"身份职业：{req.job or '未提供'}；",
            f"年龄：{req.age or '未提供'}；",
            f"外在特征：{req.appearance or '未提供'}；",
            f"服装设定：{req.costume or '未提供'}；",
            f"性格关键词：{req.personality or '未提供'}；",
            f"{style_part}；",
            f"{distinctiveness_rule}；",
        ]
    )
    if lower_body_rule:
        prompt_parts.append(f"{lower_body_rule}；")
    prompt_parts.extend(
        [
            f"{legwear_rule}；",
            f"{accessory_rule}；",
        ]
    )
    if skirt_rule:
        prompt_parts.append(f"{skirt_rule}；")
    prompt_parts.extend(
        [
            f"{accessory_english_rule} ",
            f"{consistency_english_rule} ",
            "要求：三视图位于同一画布，人物比例统一，脸部特征一致，发型一致，服装一致，鞋子一致；",
            "严格遵循用户填写的服装设定与外在特征，不要擅自新增未指定元素；",
            "画面为成品级彩色角色设定图，不要铅笔稿，不要单纯描边稿，不要黑白草图；",
            "整个画面中绝对不要出现任何文字、汉字、英文字母、数字、标题、说明、标签、水印、边框字、视角标注或排版元素；",
            "不要在画面下方或上方写“正面”“侧面”“背面”、角色名、小说名或任何说明文字。",
        ]
    )
    return "".join(prompt_parts)


def _character_negative_prompt(req: CharacterTurnaroundRequest) -> str:
    negative_parts = [
        "text, title, typography, caption, label, watermark, calligraphy, chinese characters, english letters, "
        "digits, subtitles, annotations, front view label, side view label, back view label, "
        "inconsistent hairstyle, inconsistent clothes, inconsistent shoes, sketch, pencil drawing, monochrome",
        _character_legwear_negative(req),
        _character_accessory_negative(req),
        _character_skirt_negative(req),
    ]
    return ", ".join(part for part in negative_parts if part)


def _chapter_negative_prompt(req: ChapterIllustrationRequest) -> str:
    return (
        "photorealistic, realistic photo, photography, cinematic live action, movie still, film still, "
        "real person face, celebrity face, 3d render, cgi, octane render, hyperrealistic, glossy skin, "
        "sketch, pencil drawing, line art, monochrome, collage, comic panel, split screen, "
        "multiple moments in one frame, duplicated person, inconsistent hairstyle, inconsistent clothes, "
        "inconsistent shoes, text, title, typography, caption, label, watermark, chinese characters, english letters, digits"
    )


def _build_involved_characters_part(req: ChapterIllustrationRequest) -> str:
    if not req.involved_characters:
        return ""

    fragments: list[str] = []
    for character in req.involved_characters:
        details = [f"{character.name}"]
        if character.gender:
            details.append(f"性别必须为{character.gender}")
        if character.age:
            details.append(f"年龄/状态：{character.age}")
        if character.job:
            details.append(f"身份职业：{character.job}")
        if character.appearance:
            details.append(f"外观特征：{character.appearance}")
        if character.costume:
            details.append(f"服装设定：{character.costume}")
        if character.personality:
            details.append(f"气质性格：{character.personality}")
        fragments.append("，".join(details))

    joined = "；".join(fragments)
    return (
        f"本章涉及角色如下：{joined}；"
        "以上角色设定必须被严格遵守，尤其不要画错性别，不要把女性画成男性，也不要把男性画成女性；"
    )


def _split_text_fragments(text: str) -> list[str]:
    return [
        fragment.strip(" ，,；;。.!?、/|")
        for fragment in re.split(r"[\n/|；;。!?]", text or "")
        if fragment.strip(" ，,；;。.!?、/|")
    ]


def _cleanup_prompt_source(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return ""

    prefixes = (
        "围绕章节",
        "提炼最有画面感的瞬间",
        "适合生成小说叙事插图",
        "适合生成小说插图",
    )
    for prefix in prefixes:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :].lstrip("：:，, ")

    cleaned = re.sub(r"^“[^”]+”[，,]?", "", cleaned)
    cleaned = re.sub(r"[，,]?适合生成小说(叙事)?插图。?$", "", cleaned)
    return cleaned.strip(" ，,；;。")


def _pick_primary_moment(req: ChapterIllustrationRequest) -> str:
    event_candidates = _split_text_fragments(req.key_events)
    summary_candidates = _split_text_fragments(_cleanup_prompt_source(req.prompt))
    candidates = event_candidates + summary_candidates

    if not candidates:
        return req.chapter_title.strip() or "本章最关键的叙事瞬间"

    action_markers = (
        "在",
        "检查",
        "发现",
        "对峙",
        "追逐",
        "凝视",
        "举枪",
        "奔跑",
        "推开",
        "俯身",
        "站在",
        "蹲在",
        "握着",
        "看向",
        "闯入",
        "逼近",
        "抬头",
        "回头",
    )

    def score(candidate: str) -> tuple[int, int]:
        action_score = sum(1 for marker in action_markers if marker in candidate)
        return (action_score, min(len(candidate), 28))

    return max(candidates, key=score)


def _pick_supporting_details(req: ChapterIllustrationRequest, primary_moment: str) -> list[str]:
    supporting: list[str] = []
    candidates = _split_text_fragments(req.key_events) + _split_text_fragments(_cleanup_prompt_source(req.prompt))

    for candidate in candidates:
        if candidate == primary_moment or candidate in supporting:
            continue
        supporting.append(candidate)
        if len(supporting) >= 2:
            break

    return supporting


def _build_chapter_prompt(req: ChapterIllustrationRequest) -> str:
    story_context: list[str] = []
    if req.world_setting:
        story_context.append(f"世界观：{req.world_setting}")
    if req.era:
        story_context.append(f"时代背景：{req.era}")
    if req.language_style:
        story_context.append(f"语言风格：{req.language_style}")

    style_part = _explicit_style_part(req.visual_style) or _default_story_style(req)
    chapter_summary = _cleanup_prompt_source(req.prompt) or "未提供"
    key_events = (req.key_events or "").strip() or "未提供"
    primary_moment = _pick_primary_moment(req)
    supporting_details = _pick_supporting_details(req, primary_moment)
    supporting_part = f"辅助线索：{'，'.join(supporting_details)}；" if supporting_details else ""
    involved_characters_part = _build_involved_characters_part(req)
    reference_part = (
        "随附的角色三视图是本次生成的人物设定依据，章节插图中出现的相关人物必须与参考图保持同一角色；"
        "必须沿用参考图中的脸型、五官比例、发型、发色、服装、鞋子、身材比例与整体气质，不要改成另一张脸、另一套穿搭或另一种人物造型；"
        "如果本章涉及多名角色，请分别对应各自的参考三视图与角色设定，不要把A角色的外观套到B角色身上；"
        "如果本章出现主角，请将其画成参考三视图里的同一人物，而不是只根据文字重新自由发挥；"
        if req.reference_asset_ids
        else ""
    )

    return (
        "请为小说章节绘制一张单幅叙事插图。"
        f"{'；'.join(story_context)}；"
        f"小说标题：{req.novel_title or '未提供'}；"
        f"章节标题：{req.chapter_title}；"
        f"关键事件参考：{key_events}；"
        f"章节摘要参考：{chapter_summary}；"
        f"主画面瞬间：{primary_moment}；"
        f"{supporting_part}"
        f"{involved_characters_part}"
        f"{style_part}"
        f"{reference_part}"
        "请先从章节信息中选择一个最有画面感、最适合定格成插图的决定性瞬间；"
        "不要把多个分离事件、不同地点或不同时刻拼贴进同一张图，不要做连环画式拼图；"
        "优先表现人物动作、角色关系、所处场景、情绪张力、光影关系、镜头景别与景深；"
        "如果没有填写视觉风格，就根据整部小说的时代、语言风格与整体氛围自动决定画面风格，保持与小说基调一致；"
        "如果填写了视觉风格，则在不偏离剧情氛围的前提下优先遵循该视觉风格；"
        "可以把辅助线索作为前景或背景细节融入，但主画面必须聚焦同一时空中的单一核心事件；"
        "画面应接近正式小说章节插图，而不是剧情提要海报或多事件信息图；"
        "画面必须是二维彩色小说叙事插画，保留明确的插画笔触与绘画感，不要生成真人写实、摄影照片、电影剧照或3D渲染风格；"
        "输出成品级彩色插画，不要草稿感，不要铅笔线描，不要文字标题，不要任何汉字、英文字母、数字、水印或标签。"
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
        reference_asset_ids = list(req.reference_asset_ids)
        if not reference_asset_ids:
            reference_asset_ids = [
                character.asset_id
                for character in req.involved_characters
                if character.asset_id
            ]

        reference_images: list[bytes] = []
        for asset_id in reference_asset_ids:
            reference_asset = image_store.get_asset(asset_id)
            if reference_asset:
                reference_path = Path(reference_asset.file_path)
                if reference_path.exists():
                    reference_images.append(reference_path.read_bytes())
        images = await provider.generate_images(
            prompt=prompt,
            size=_aspect_to_size(req.aspect_ratio),
            count=req.image_count,
            quality=req.quality,
            negative_prompt=_chapter_negative_prompt(req),
            reference_images=reference_images,
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
