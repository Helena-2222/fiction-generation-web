"""Shared service singletons used across routers."""
import logging

logger = logging.getLogger(__name__)

from app.llm.llm_client import DeepSeekClient
from app.llm.llm_task_manager import LlmTaskManager
from app.services.story_service import StoryService
from app.services.summary_service import SummaryService
from app.services.tts_cloud_service import TtsCloudService

_client = DeepSeekClient()
story_service = StoryService(_client)
llm_task_manager = LlmTaskManager(story_service)

# Summary service (uses LLM, no torch)
summary_service = SummaryService(_client)

# EmotionTTS Cloud service (external API, no local models)
tts_cloud_service = TtsCloudService()

# Audio/TTS services — optional, require torch + transformers
audio_service = None
tts_service = None

def _init_audio_services():
    """Initialize audio and TTS services if torch is available.
    Called lazily on first API request to avoid crashing on Render."""
    global audio_service, tts_service
    if audio_service is not None:
        return
    try:
        from app.services.audio_service import AudioService
        from app.services.tts_service import TtsService
        audio_service = AudioService(
            device=None,
            music_model_name="facebook/musicgen-small",
            audio_model_name="facebook/audiogen-medium",
            model_type="musicgen",
            stable_music_model="stabilityai/stable-audio-3-small-music",
            stable_sfx_model="stabilityai/stable-audio-3-small-sfx",
        )
        tts_service = TtsService(llm_client=_client)
        logger.info("Audio/TTS services initialized")
    except ImportError as e:
        logger.warning("Audio/TTS services unavailable (missing torch/transformers): %s", e)
        audio_service = _DummyAudioService()
        tts_service = _DummyTtsService()
    except Exception as e:
        logger.error("Audio/TTS init failed: %s", e)
        audio_service = _DummyAudioService()
        tts_service = _DummyTtsService()


class _DummyAudioService:
    """Placeholder when audio models are not available (e.g. on Render)."""
    model_type = "unavailable"
    stable_music_model = ""
    stable_sfx_model = ""
    def __getattr__(self, name):
        def _unavailable(*args, **kwargs):
            raise RuntimeError(
                "Audio generation requires local GPU/CPU with torch installed. "
                "This Render instance does not have ML dependencies. "
                "Run locally or configure AUDIO_BACKEND=replicate."
            )
        if name in ("generate_background_music", "generate_sound_effects",
                     "unload_models", "set_model_type"):
            return _unavailable
        if name == "get_available_models":
            return lambda: {"model_types": [], "audio_models": []}
        if name == "get_device_info":
            return lambda: {"device": "unavailable", "backend": "none"}
        raise AttributeError(name)


class _DummyTtsService:
    """Placeholder when TTS is not available."""
    tts_url = ""
    llm = None
    def __getattr__(self, name):
        def _unavailable(*args, **kwargs):
            raise RuntimeError("TTS service requires torch. Not available on this instance.")
        if name in ("synthesize", "analyze_emotion", "check_health"):
            return _unavailable
        raise AttributeError(name)
# Try to initialize audio/TTS services on import (fails gracefully if torch missing)
_init_audio_services()