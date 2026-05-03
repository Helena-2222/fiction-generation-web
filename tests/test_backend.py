from __future__ import annotations

import unittest
from io import BytesIO
from zipfile import ZipFile

from fastapi.testclient import TestClient

from app.main import app
from app.models import CharacterCard, CharacterRelation, GeneratedChapter
from app.services.story_service import StoryService
from app.utils.docx_export import build_docx_bytes, sanitize_docx_filename


class PublicEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_endpoint_reports_ok(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})

    def test_public_config_exposes_browser_auth_flags(self) -> None:
        response = self.client.get("/api/public-config")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("authEnabled", payload)
        self.assertIn("supabaseUrl", payload)
        self.assertIn("supabaseAnonKey", payload)
        self.assertIsInstance(payload["authEnabled"], bool)

    def test_docx_export_endpoint_returns_downloadable_document(self) -> None:
        response = self.client.post(
            "/api/export/docx",
            json={
                "filename": "story:chapter?.docx",
                "title": "Unit Test Story",
                "content": "Line one\nLine <two> & line three",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["content-type"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.assertIn("attachment", response.headers["content-disposition"])
        with ZipFile(BytesIO(response.content)) as archive:
            self.assertIn("word/document.xml", archive.namelist())


class DocxExportTests(unittest.TestCase):
    def test_sanitize_docx_filename_removes_forbidden_characters(self) -> None:
        filename = sanitize_docx_filename('bad:/name*? "draft".docx')

        self.assertTrue(filename.endswith(".docx"))
        self.assertNotRegex(filename[:-5], r'[<>:"/\\|?*\x00-\x1f]')
        self.assertLessEqual(len(filename), 125)

    def test_build_docx_bytes_escapes_content_and_contains_required_parts(self) -> None:
        document = build_docx_bytes("Title & More", "A <tag>\nB & C")

        with ZipFile(BytesIO(document)) as archive:
            names = set(archive.namelist())
            self.assertTrue(
                {
                    "[Content_Types].xml",
                    "_rels/.rels",
                    "docProps/app.xml",
                    "docProps/core.xml",
                    "word/document.xml",
                }.issubset(names)
            )
            xml = archive.read("word/document.xml").decode("utf-8")
            self.assertIn("A &lt;tag&gt;", xml)
            self.assertIn("B &amp; C", xml)


class StoryServicePureLogicTests(unittest.TestCase):
    def test_chapter_targets_split_total_words_into_expected_batches(self) -> None:
        self.assertEqual(StoryService._chapter_targets(4500, 2000), [2000, 2000, 500])
        self.assertEqual(StoryService._chapter_targets(1200, 2000), [1200])

    def test_normalize_relations_filters_invalid_edges_and_fills_names(self) -> None:
        display_names = {"c1": "Alice", "c2": "Bob"}
        relations = [
            CharacterRelation(id="r1", source_id="c1", target_id="c2", label=" mentor "),
            CharacterRelation(id="r2", source_id="c1", target_id="c2", label="friend"),
            CharacterRelation(id="r3", source_id="c1", target_id="c1", label="self"),
            CharacterRelation(id="r4", source_id="missing", target_id="c2", label="unknown"),
            CharacterRelation(id="r5", source_id="c2", target_id="c1", label="   "),
        ]

        normalized = StoryService._normalize_relations(relations, display_names)

        self.assertEqual(len(normalized), 1)
        self.assertEqual(normalized[0].source_name, "Alice")
        self.assertEqual(normalized[0].target_name, "Bob")
        self.assertEqual(normalized[0].label, "friend")

    def test_extract_ai_relations_skips_duplicates_and_invalid_items(self) -> None:
        service = StoryService(client=None)  # type: ignore[arg-type]
        story = self._story_with_two_characters()
        result = {
            "relations": [
                {"source_id": "c1", "target_id": "c2", "label": "duplicate"},
                {"source_name": "Bob", "target_name": "Alice", "relation": "rival", "bidirectional": "yes"},
                {"source_id": "c1", "target_id": "c1", "label": "self"},
                {"source_name": "Unknown", "target_name": "Alice", "label": "invalid"},
                "not-a-dict",
            ]
        }

        added = service._extract_ai_relations(result, story)

        self.assertEqual(len(added), 1)
        self.assertEqual(added[0].source_id, "c2")
        self.assertEqual(added[0].target_id, "c1")
        self.assertEqual(added[0].label, "rival")
        self.assertTrue(added[0].bidirectional)
        self.assertEqual(added[0].relation_source, "ai")

    def test_generated_chapter_content_is_split_into_readable_paragraphs(self) -> None:
        long_content = "a" * 900

        normalized = StoryService._normalize_generated_chapter_content(long_content, target_words=1000)
        paragraphs = normalized.split("\n\n")

        self.assertGreaterEqual(len(paragraphs), 3)
        self.assertTrue(all(len(paragraph) <= 420 for paragraph in paragraphs))
        generated = GeneratedChapter(
            chapter_number=1,
            title="Chapter",
            summary="Summary",
            content=normalized,
        )
        self.assertEqual(StoryService._generated_chapter_quality_issues(generated, 1000), [])

    @staticmethod
    def _story_with_two_characters():
        from app.models import StoryDraftRequest

        return StoryDraftRequest(
            synopsis="A short premise",
            total_words=3000,
            chapter_words=1500,
            characters=[
                CharacterCard(id="c1", name="Alice"),
                CharacterCard(id="c2", name="Bob"),
            ],
            relations=[
                CharacterRelation(id="r1", source_id="c1", target_id="c2", label="mentor"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
