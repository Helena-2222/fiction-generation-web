"""Shared service singletons used across routers."""
import torch
from app.llm.llm_client import DeepSeekClient
from app.llm.llm_task_manager import LlmTaskManager
from app.services.story_service import StoryService
from app.services.summary_service import SummaryService
from app.services.audio_service import AudioService

_client = DeepSeekClient()
story_service = StoryService(_client)
llm_task_manager = LlmTaskManager(story_service)

# New services for audio generation
summary_service = SummaryService(_client)
audio_service = AudioService(
    device=None,  # let _best_dev() decide (handles CC mismatch)
    music_model_name="facebook/musicgen-small",  # Start with small model
    audio_model_name="facebook/musicgen-small"  # AudioGen not in transformers, use MusicGen
)
