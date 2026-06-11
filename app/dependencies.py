"""Shared service singletons used across routers."""
import torch
from app.llm.llm_client import DeepSeekClient
from app.llm.llm_task_manager import LlmTaskManager
from app.services.story_service import StoryService
from app.services.summary_service import SummaryService
from app.services.audio_service import AudioService
from app.services.tts_service import TtsService
from app.services.tts_cloud_service import TtsCloudService

_client = DeepSeekClient()
story_service = StoryService(_client)
llm_task_manager = LlmTaskManager(story_service)

# New services for audio generation
summary_service = SummaryService(_client)
audio_service = AudioService(
    device=None,  # let _best_dev() decide (handles CC mismatch)
    music_model_name="facebook/musicgen-small",
    audio_model_name="facebook/audiogen-medium",
    model_type="musicgen",  # "musicgen" or "stable-audio"
    stable_music_model="stabilityai/stable-audio-3-small-music",
    stable_sfx_model="stabilityai/stable-audio-3-small-sfx",
)

# TTS service for novel dialogue voicing
tts_service = TtsService(llm_client=_client)

# EmotionTTS Cloud service (external API at 101.201.246.121:3000)
tts_cloud_service = TtsCloudService()
