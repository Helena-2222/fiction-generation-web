from __future__ import annotations

import unittest
from dataclasses import dataclass
from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    AutoNamedCharacter,
    CharacterRelation,
    GeneratedChapter,
    GeneratedOutline,
    LlmTaskStatusResponse,
    OutlineChapter,
    OutlineGenerationResponse,
    RelationSupplementResponse,
    StoryGenerationResponse,
    StorySelectionRewriteResponse,
)


def story_payload() -> dict[str, Any]:
    return {
        "genre": "科幻",
        "synopsis": "城市记忆被写入一座会呼吸的图书馆。",
        "style": "悬疑",
        "worldview_time": "近未来",
        "worldview_physical": "雨城与地下档案库",
        "worldview_social": "记忆被视为可交易资产",
        "total_words": 3000,
        "chapter_words": 1500,
        "characters": [
            {
                "id": "c1",
                "name": "林晚",
                "occupation": "档案修复师",
                "graph_x": 120,
                "graph_y": 140,
            },
            {
                "id": "c2",
                "name": "莫响",
                "occupation": "失忆调查员",
                "graph_x": 360,
                "graph_y": 160,
            },
        ],
        "relations": [
            {
                "id": "r1",
                "source_id": "c1",
                "target_id": "c2",
                "label": "搭档",
                "source_name": "林晚",
                "target_name": "莫响",
                "bidirectional": True,
                "relation_source": "user",
            }
        ],
    }


def outline_payload() -> dict[str, Any]:
    return {
        "title": "雨城档案",
        "logline": "一名修复师追查被篡改的城市记忆。",
        "summary": "林晚与莫响进入地下档案库，发现记忆交易背后的真相。",
        "inferred_details": ["记忆交易合法但高风险"],
        "act_structure": [
            {
                "stage": "开端",
                "content": "档案异常出现",
                "chapter_range": "第1章-第1章",
                "start_chapter": 1,
                "end_chapter": 1,
            },
            {
                "stage": "发展",
                "content": "两人追查线索",
                "chapter_range": "第2章-第2章",
                "start_chapter": 2,
                "end_chapter": 2,
            },
        ],
        "chapter_count": 2,
        "chapters": [
            {
                "chapter_number": 1,
                "title": "雨夜档案",
                "target_words": 1500,
                "summary": "林晚发现一份会自我改写的档案。",
                "key_events": ["档案异常", "莫响出现"],
                "cliffhanger": "档案写出她的名字",
            },
            {
                "chapter_number": 2,
                "title": "地下回声",
                "target_words": 1500,
                "summary": "二人进入地下档案库。",
                "key_events": ["进入档案库", "发现交易名单"],
                "cliffhanger": "名单上有莫响",
            },
        ],
    }


def outline_request_payload() -> dict[str, Any]:
    return {
        "story": story_payload(),
        "feedback": "",
        "previous_outline": None,
    }


def story_request_payload() -> dict[str, Any]:
    return {
        "story": story_payload(),
        "outline": outline_payload(),
    }


def task_response(task_id: str = "task-1", status: str = "running") -> LlmTaskStatusResponse:
    return LlmTaskStatusResponse(
        task_id=task_id,
        kind="outline",
        status=status,
        created_at="2026-05-03T12:00:00",
        updated_at="2026-05-03T12:00:01",
        result={"ok": True} if status == "completed" else None,
        error="",
    )


class FakeStoryService:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail

    def _maybe_fail(self) -> None:
        if self.fail:
            raise RuntimeError("mock service failed")

    async def generate_outline(self, request) -> OutlineGenerationResponse:
        self._maybe_fail()
        return OutlineGenerationResponse(
            story=request.story,
            outline=GeneratedOutline.model_validate(outline_payload()),
            auto_named_characters=[AutoNamedCharacter(id="c2", name="莫响")],
        )

    async def generate_story(self, request) -> StoryGenerationResponse:
        self._maybe_fail()
        return StoryGenerationResponse(
            title=request.outline.title,
            chapters=[
                GeneratedChapter(
                    chapter_number=1,
                    title="雨夜档案",
                    summary="档案异常出现。",
                    content="林晚翻开档案。\n\n字迹开始改写。",
                )
            ],
        )

    async def regenerate_story_chapter(self, request) -> GeneratedChapter:
        self._maybe_fail()
        return GeneratedChapter(
            chapter_number=request.chapter_number,
            title="重写后的章节",
            summary="当前章节被重新生成。",
            content="新的章节内容。\n\n新的悬念出现。",
        )

    async def rewrite_story_selection(self, request) -> StorySelectionRewriteResponse:
        self._maybe_fail()
        return StorySelectionRewriteResponse(
            rewritten_text=f"改写：{request.selected_text.strip()}",
        )

    async def supplement_relations(self, story) -> RelationSupplementResponse:
        self._maybe_fail()
        return RelationSupplementResponse(
            added_relations=[
                CharacterRelation(
                    id="relation-ai-c2-c1",
                    source_id="c2",
                    target_id="c1",
                    label="隐瞒真相",
                    source_name="莫响",
                    target_name="林晚",
                    relation_source="ai",
                )
            ]
        )


@dataclass
class FakeTaskManager:
    fail_missing: bool = False
    fail_conflict: bool = False

    async def create_outline_task(self, request) -> LlmTaskStatusResponse:
        return task_response("outline-task")

    async def create_story_task(self, request) -> LlmTaskStatusResponse:
        response = task_response("story-task")
        response.kind = "story"
        return response

    async def create_story_chapter_task(self, request) -> LlmTaskStatusResponse:
        response = task_response("chapter-task")
        response.kind = "story_chapter"
        return response

    async def create_relation_supplement_task(self, request) -> LlmTaskStatusResponse:
        response = task_response("relation-task")
        response.kind = "relations_supplement"
        return response

    def get_task(self, task_id: str) -> LlmTaskStatusResponse:
        if self.fail_missing:
            raise KeyError(task_id)
        return task_response(task_id, status="completed")

    async def pause_task(self, task_id: str) -> LlmTaskStatusResponse:
        if self.fail_missing:
            raise KeyError(task_id)
        return task_response(task_id, status="paused")

    async def resume_task(self, task_id: str) -> LlmTaskStatusResponse:
        if self.fail_missing:
            raise KeyError(task_id)
        if self.fail_conflict:
            raise ValueError("task cannot resume")
        return task_response(task_id, status="running")

    async def discard_task(self, task_id: str) -> LlmTaskStatusResponse:
        if self.fail_missing:
            raise KeyError(task_id)
        return task_response(task_id, status="discarded")


class ApiInterfaceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_outline_interface_returns_expected_contract(self) -> None:
        with patch("app.dependencies.story_service", FakeStoryService()):
            response = self.client.post("/api/outline", json=outline_request_payload())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["outline"]["title"], "雨城档案")
        self.assertEqual(payload["outline"]["chapter_count"], 2)
        self.assertEqual(payload["auto_named_characters"][0]["name"], "莫响")

    def test_story_generation_interface_returns_chapters(self) -> None:
        with patch("app.dependencies.story_service", FakeStoryService()):
            response = self.client.post("/api/story", json=story_request_payload())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["title"], "雨城档案")
        self.assertEqual(payload["chapters"][0]["chapter_number"], 1)
        self.assertIn("字迹开始改写", payload["chapters"][0]["content"])

    def test_story_chapter_regeneration_interface_returns_single_chapter(self) -> None:
        request = {
            **story_request_payload(),
            "chapter_number": 2,
            "feedback": "加强悬疑感",
            "current_chapters": [],
        }
        with patch("app.dependencies.story_service", FakeStoryService()):
            response = self.client.post("/api/story/regenerate-chapter", json=request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chapter_number"], 2)
        self.assertEqual(response.json()["title"], "重写后的章节")

    def test_rewrite_selection_interface_returns_rewritten_text(self) -> None:
        request = {
            **story_request_payload(),
            "chapter_number": 1,
            "chapter_title": "雨夜档案",
            "chapter_summary": "档案异常出现。",
            "selected_text": "林晚翻开档案",
            "before_context": "",
            "after_context": "",
            "instruction": "更有画面感",
        }
        with patch("app.dependencies.story_service", FakeStoryService()):
            response = self.client.post("/api/story/rewrite-selection", json=request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rewritten_text"], "改写：林晚翻开档案")

    def test_relation_supplement_interface_returns_added_relations(self) -> None:
        with patch("app.dependencies.story_service", FakeStoryService()):
            response = self.client.post(
                "/api/relations/supplement",
                json={"story": story_payload()},
            )

        self.assertEqual(response.status_code, 200)
        relation = response.json()["added_relations"][0]
        self.assertEqual(relation["source_id"], "c2")
        self.assertEqual(relation["relation_source"], "ai")

    def test_generation_interfaces_convert_service_errors_to_500(self) -> None:
        with patch("app.dependencies.story_service", FakeStoryService(fail=True)):
            response = self.client.post("/api/story", json=story_request_payload())

        self.assertEqual(response.status_code, 500)
        self.assertIn("mock service failed", response.json()["detail"])

    def test_request_validation_rejects_missing_or_invalid_body(self) -> None:
        outline_response = self.client.post("/api/outline", json={})
        rewrite_response = self.client.post(
            "/api/story/rewrite-selection",
            json={
                **story_request_payload(),
                "chapter_number": 1,
                "selected_text": "",
            },
        )
        export_response = self.client.post("/api/export/docx", json={"filename": "x.docx"})

        self.assertEqual(outline_response.status_code, 422)
        self.assertEqual(rewrite_response.status_code, 422)
        self.assertEqual(export_response.status_code, 422)

    def test_create_llm_task_interfaces_return_task_status(self) -> None:
        with patch("app.dependencies.llm_task_manager", FakeTaskManager()):
            outline_response = self.client.post("/api/llm-tasks/outline", json=outline_request_payload())
            story_response = self.client.post("/api/llm-tasks/story", json=story_request_payload())
            chapter_response = self.client.post(
                "/api/llm-tasks/story/chapter",
                json={**story_request_payload(), "chapter_number": 1},
            )
            relation_response = self.client.post(
                "/api/llm-tasks/relations/supplement",
                json={"story": story_payload()},
            )

        self.assertEqual(outline_response.status_code, 200)
        self.assertEqual(outline_response.json()["task_id"], "outline-task")
        self.assertEqual(story_response.json()["kind"], "story")
        self.assertEqual(chapter_response.json()["kind"], "story_chapter")
        self.assertEqual(relation_response.json()["kind"], "relations_supplement")

    def test_llm_task_lifecycle_interfaces_return_statuses(self) -> None:
        with patch("app.dependencies.llm_task_manager", FakeTaskManager()):
            get_response = self.client.get("/api/llm-tasks/task-123")
            pause_response = self.client.post("/api/llm-tasks/task-123/pause")
            resume_response = self.client.post("/api/llm-tasks/task-123/resume")
            discard_response = self.client.post("/api/llm-tasks/task-123/discard")

        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.json()["status"], "completed")
        self.assertEqual(pause_response.json()["status"], "paused")
        self.assertEqual(resume_response.json()["status"], "running")
        self.assertEqual(discard_response.json()["status"], "discarded")

    def test_llm_task_lifecycle_interfaces_return_404_and_409(self) -> None:
        with patch("app.dependencies.llm_task_manager", FakeTaskManager(fail_missing=True)):
            missing_response = self.client.get("/api/llm-tasks/missing-task")
        with patch("app.dependencies.llm_task_manager", FakeTaskManager(fail_conflict=True)):
            conflict_response = self.client.post("/api/llm-tasks/task-123/resume")

        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(conflict_response.status_code, 409)
        self.assertIn("task cannot resume", conflict_response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
