"""Shared service singletons used across routers."""
from app.llm.llm_client import DeepSeekClient
from app.llm.llm_task_manager import LlmTaskManager
from app.services.story_service import StoryService

_client = DeepSeekClient()
story_service = StoryService(_client)
llm_task_manager = LlmTaskManager(story_service)
