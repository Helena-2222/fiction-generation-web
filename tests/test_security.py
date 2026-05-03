from __future__ import annotations

import unittest
from io import BytesIO
from zipfile import ZipFile

from fastapi.testclient import TestClient

from app.main import app


class SecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_public_config_does_not_expose_server_secrets(self) -> None:
        response = self.client.get("/api/public-config")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(set(payload), {"authEnabled", "supabaseUrl", "supabaseAnonKey"})
        serialized_payload = response.text.lower()
        self.assertNotIn("deepseek", serialized_payload)
        self.assertNotIn("api_key", serialized_payload)

    def test_static_route_rejects_path_traversal_attempts(self) -> None:
        traversal_paths = [
            "/static/%2e%2e/.env",
            "/static/..%2F.env",
            "/static/../.env",
        ]

        for path in traversal_paths:
            with self.subTest(path=path):
                response = self.client.get(path, follow_redirects=False)
                self.assertIn(response.status_code, {400, 404})
                self.assertNotIn("DEEPSEEK_API_KEY", response.text)
                self.assertNotIn("VITE_SUPABASE_ANON_KEY", response.text)

    def test_docx_export_sanitizes_header_injection_filename(self) -> None:
        response = self.client.post(
            "/api/export/docx",
            json={
                "filename": 'story.docx"\r\nX-Injected-Header: yes',
                "title": "Security",
                "content": "safe content",
            },
        )

        self.assertEqual(response.status_code, 200)
        disposition = response.headers["content-disposition"]
        all_headers = "\n".join(f"{key}: {value}" for key, value in response.headers.items())
        self.assertNotIn("\r", disposition)
        self.assertNotIn("\n", disposition)
        self.assertIsNone(response.headers.get("x-injected-header"))
        self.assertNotIn("\nx-injected-header:", all_headers.lower())
        self.assertIn("attachment", disposition)

    def test_docx_export_escapes_script_like_content(self) -> None:
        response = self.client.post(
            "/api/export/docx",
            json={
                "filename": "xss.docx",
                "title": "<script>alert(1)</script>",
                "content": '<script>alert("xss")</script>\nA & B',
            },
        )

        self.assertEqual(response.status_code, 200)
        with ZipFile(BytesIO(response.content)) as archive:
            document_xml = archive.read("word/document.xml").decode("utf-8")
            core_xml = archive.read("docProps/core.xml").decode("utf-8")
        self.assertNotIn("<script>", document_xml)
        self.assertNotIn("<script>", core_xml)
        self.assertIn("&lt;script&gt;", document_xml)
        self.assertIn("&lt;script&gt;", core_xml)
        self.assertIn("A &amp; B", document_xml)

    def test_invalid_methods_are_rejected(self) -> None:
        self.assertEqual(self.client.get("/api/export/docx").status_code, 405)
        self.assertEqual(self.client.put("/api/health").status_code, 405)

    def test_malformed_generation_requests_are_rejected_before_service_layer(self) -> None:
        invalid_story = {
            "story": {
                "synopsis": "",
                "total_words": -1,
                "chapter_words": 0,
                "characters": [],
                "relations": [
                    {
                        "id": "r1",
                        "source_id": "c1",
                        "target_id": "c2",
                        "label": "invalid",
                        "relation_source": "system",
                    }
                ],
            }
        }

        outline_response = self.client.post("/api/outline", json=invalid_story)
        story_response = self.client.post("/api/story", json=invalid_story)

        self.assertEqual(outline_response.status_code, 422)
        self.assertEqual(story_response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
