"""
API routes for audio generation.
Provides endpoints for generating music and sound effects for novel chapters.
"""

import logging
import tempfile
import os
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, UploadFile, File
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audio", tags=["audio"])

# Import endpoint for docx files
@router.post("/import-docx")
async def import_docx(file: UploadFile = File(...)):
    """
    Import a Word document and extract text content.
    """
    from app.utils.docx_import import extract_chapters_from_docx
    
    # Check file extension
    if not file.filename.endswith('.docx'):
        raise HTTPException(status_code=400, detail="只支持 .docx 格式的文件")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Extract content
            result = extract_chapters_from_docx(tmp_path)
            
            return {
                "title": result["title"],
                "chapters": result["chapters"],
                "chapter_count": result["chapter_count"],
                "message": "导入成功"
            }
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
    
    except Exception as exc:
        logger.error(f"Error importing docx: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

# Request/Response Models

class ChapterAudioRequest(BaseModel):
    """Request model for generating audio for a chapter."""
    chapter_number: int
    chapter_title: str
    chapter_content: str
    story_context: Optional[Dict[str, Any]] = None
    music_duration: float = 30.0
    generate_effects: bool = True

class AudioPromptRequest(BaseModel):
    """Request model for generating audio from prompts."""
    music_prompt: Optional[str] = None
    effect_prompts: Optional[List[str]] = None
    music_duration: float = 30.0
    effect_duration: float = 5.0

class MusicGenerationRequest(BaseModel):
    """Request model for generating background music."""
    description: str
    duration: float = 30.0
    guidance_scale: float = 3.0

class EffectGenerationRequest(BaseModel):
    """Request model for generating sound effects."""
    descriptions: List[str]
    duration: float = 5.0
    guidance_scale: float = 3.0

class AudioResponse(BaseModel):
    """Response model for audio generation."""
    audio_path: str
    duration: float
    sample_rate: int
    description: Optional[str] = None

class ChapterAudioResponse(BaseModel):
    """Response model for chapter audio generation."""
    chapter_number: int
    summary: Dict[str, Any]
    music: Optional[AudioResponse] = None
    effects: Optional[List[AudioResponse]] = None

# API Endpoints

@router.post("/generate-chapter-audio", response_model=ChapterAudioResponse)
async def generate_chapter_audio(request: ChapterAudioRequest):
    """
    Generate audio (music + optional sound effects) for a novel chapter.
    
    Workflow:
    1. Analyze chapter content using LLM
    2. Extract audio generation hints
    3. Generate background music based on hints
    4. Generate sound effects (if requested)
    """
    from app.dependencies import summary_service, audio_service
    
    try:
        logger.info(f"Starting audio generation for chapter {request.chapter_number}: {request.chapter_title}")
        
        # Step 1: Analyze chapter content
        logger.info("Step 1: Analyzing chapter content...")
        summary = await summary_service.analyze_chapter_for_audio(
            chapter_content=request.chapter_content,
            chapter_title=request.chapter_title,
            story_context=request.story_context
        )
        logger.info(f"Chapter analysis completed: {summary.get('mood', 'unknown')} mood")
        
        # Step 2: Generate audio prompts from analysis
        logger.info("Step 2: Generating audio prompts...")
        audio_prompts = await summary_service.generate_audio_prompts(
            summary.get("audio_hints", {})
        )
        
        music_prompt = audio_prompts.get("music_prompt", "Gentle background music")
        effect_prompts = audio_prompts.get("effect_prompts", [])
        
        logger.info(f"Music prompt: {music_prompt[:50]}...")
        logger.info(f"Effect prompts: {len(effect_prompts)} effects")
        
        # Step 3: Generate background music
        logger.info("Step 3: Generating background music...")
        music_result = None
        try:
            music_result = await audio_service.generate_background_music(
                description=music_prompt,
                duration=request.music_duration
            )
            logger.info(f"Music generated: {music_result['audio_path']}")
        except Exception as e:
            logger.error(f"Failed to generate music: {e}")
            # Continue without music
        
        # Step 4: Generate sound effects (optional)
        logger.info("Step 4: Generating sound effects...")
        effects_result = []
        if request.generate_effects and effect_prompts:
            try:
                effects_result = await audio_service.generate_sound_effects(
                    descriptions=effect_prompts,
                    duration=request.music_duration / len(effect_prompts) if effect_prompts else 5.0
                )
                logger.info(f"Generated {len(effects_result)} sound effects")
            except Exception as e:
                logger.error(f"Failed to generate effects: {e}")
                # Continue without effects
        
        # Build response
        response = ChapterAudioResponse(
            chapter_number=request.chapter_number,
            summary=summary,
            music=music_result,
            effects=effects_result
        )
        
        logger.info(f"Audio generation completed for chapter {request.chapter_number}")
        return response
        
    except Exception as exc:
        logger.error(f"Error generating chapter audio: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/generate-music", response_model=AudioResponse)
async def generate_music(request: MusicGenerationRequest):
    """
    Generate background music from a text description.
    """
    from app.dependencies import audio_service
    
    try:
        logger.info(f"Generating music: {request.description[:50]}...")
        
        result = await audio_service.generate_background_music(
            description=request.description,
            duration=request.duration,
            guidance_scale=request.guidance_scale
        )
        
        logger.info(f"Music generated: {result['audio_path']}")
        return AudioResponse(**result)
        
    except Exception as exc:
        logger.error(f"Error generating music: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/generate-effects", response_model=List[AudioResponse])
async def generate_effects(request: EffectGenerationRequest):
    """
    Generate sound effects from text descriptions.
    """
    from app.dependencies import audio_service
    
    try:
        logger.info(f"Generating {len(request.descriptions)} sound effects...")
        
        results = await audio_service.generate_sound_effects(
            descriptions=request.descriptions,
            duration=request.duration,
            guidance_scale=request.guidance_scale
        )
        
        logger.info(f"Generated {len(results)} sound effects")
        return [AudioResponse(**r) for r in results]
        
    except Exception as exc:
        logger.error(f"Error generating effects: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/generate-from-prompts")
async def generate_from_prompts(request: AudioPromptRequest):
    """
    Generate both music and effects from provided prompts.
    """
    from app.dependencies import audio_service
    
    try:
        results = {"music": None, "effects": []}
        
        # Generate music if prompt provided
        if request.music_prompt:
            logger.info(f"Generating music from prompt: {request.music_prompt[:50]}...")
            results["music"] = await audio_service.generate_background_music(
                description=request.music_prompt,
                duration=request.music_duration
            )
        
        # Generate effects if prompts provided
        if request.effect_prompts:
            logger.info(f"Generating {len(request.effect_prompts)} effects...")
            results["effects"] = await audio_service.generate_sound_effects(
                descriptions=request.effect_prompts,
                duration=request.effect_duration
            )
        
        return results
        
    except Exception as exc:
        logger.error(f"Error generating from prompts: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/analyze-chapter")
async def analyze_chapter(request: ChapterAudioRequest):
    """
    Analyze a chapter and return audio hints (without generating audio).
    """
    from app.dependencies import summary_service
    
    try:
        logger.info(f"Analyzing chapter: {request.chapter_title}")
        
        summary = await summary_service.analyze_chapter_for_audio(
            chapter_content=request.chapter_content,
            chapter_title=request.chapter_title,
            story_context=request.story_context
        )
        
        # Also generate audio prompts
        audio_prompts = await summary_service.generate_audio_prompts(
            summary.get("audio_hints", {})
        )
        
        return {
            "summary": summary,
            "audio_prompts": audio_prompts
        }
        
    except Exception as exc:
        logger.error(f"Error analyzing chapter: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/models")
async def get_available_models():
    """
    Get available audio generation models and current configuration.
    """
    from app.dependencies import audio_service
    models = audio_service.get_available_models()
    models["current_model_type"] = audio_service.model_type
    models["current_music_model"] = audio_service.mmn
    return models

class ModelSwitchRequest(BaseModel):
    model_name: Optional[str] = None  # specific model ID
    """Request model for switching audio generation model."""
    model_type: str  # "musicgen" or "stable-audio"

@router.post("/switch-model")
async def switch_model(request: ModelSwitchRequest):
    """
    Switch the active audio generation model.
    Unloads current model and loads the selected one on next generation.
    """
    from app.dependencies import audio_service

    try:
        audio_service.set_model_type(request.model_type, request.model_name)
        return {
            "status": "ok",
            "model_type": audio_service.model_type,
            "music_model": audio_service.stable_music_model,
            "sfx_model": audio_service.stable_sfx_model,
            "message": f"Switched to {request.model_type}. Model will load on next generation.",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.post("/unload-models")
async def unload_models():
    """
    Unload models from GPU to free memory.
    """
    from app.dependencies import audio_service
    
    try:
        audio_service.unload_models()
        return {"status": "Models unloaded successfully"}
    except Exception as exc:
        logger.error(f"Error unloading models: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# --- HF Token for gated models ---

class HfTokenRequest(BaseModel):
    token: str

@router.post("/hf-token")
async def set_hf_token(request: HfTokenRequest):
    """Save HuggingFace token for downloading gated models (Stable Audio 3)."""
    from app.services.audio_service import _set_hf_token, _get_hf_token
    _set_hf_token(request.token)
    current = _get_hf_token()
    return {"status": "ok", "token_set": bool(current), "message": "HF Token 已保存"}

@router.get("/hf-token")
async def get_hf_token_status():
    """Check if HF token is configured."""
    from app.services.audio_service import _get_hf_token
    token = _get_hf_token()
    return {"token_set": bool(token), "token_preview": (token[:6] + "..." + token[-4:]) if token and len(token) > 10 else None}

@router.get("/device-info")
async def get_device_info():
    """
    Get information about the current audio generation device.
    """
    from app.dependencies import audio_service
    
    try:
        return audio_service.get_device_info()
    except Exception as exc:
        logger.error(f"Error getting device info: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
