"""Shared service singletons used across routers."""
import torch
from app.llm.llm_client import DeepSeekClient
from app.llm.llm_task_manager import LlmTaskManager
from app.services.story_service import StoryService
from app.services.summary_service import SummaryService
from app.services.audio_service import AudioService
from app.services.tts_service import TtsService

_client = DeepSeekClient()
story_service = StoryService(_client)
llm_task_manager = LlmTaskManager(story_service)

# New services for audio generation
summary_service = SummaryService(_client)
audio_service = AudioService(
    device=None,  # let _best_dev() decide (handles CC mismatch)
    music_model_name="facebook/musicgen-small",
    audio_model_name="facebook/musicgen-small",
    model_type="musicgen",  # "musicgen" or "stable-audio"
)

# TTS service for novel dialogue voicing
tts_service = TtsService(llm_client=_client)
