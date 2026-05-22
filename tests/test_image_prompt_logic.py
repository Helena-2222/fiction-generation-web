from __future__ import annotations

import unittest

from app.image_models import ChapterIllustrationRequest, CharacterTurnaroundRequest, ImportedNovelData
from app.services.image_docx_parser import _rewrite_chapter_prompt
from app.services.image_task_service import _build_chapter_prompt, _build_character_prompt, _character_negative_prompt


class ImagePromptLogicTests(unittest.TestCase):
    def test_character_prompt_adds_skirt_and_leg_separation_rules_when_no_legwear_specified(self) -> None:
        request = CharacterTurnaroundRequest(
            character_name="林晚",
            gender="女",
            age="28岁",
            job="档案馆管理员",
            appearance="黑色长发，身形清瘦",
            costume="棕灰色西装外套搭配过膝半裙",
            personality="克制冷静",
            era="近未来",
            language_style="冷峻悬疑",
        )

        prompt = _build_character_prompt(request)
        negative_prompt = _character_negative_prompt(request)

        self.assertIn("裙装规则：如果角色穿裙装但未明确指定袜子或腿部覆盖物", prompt)
        self.assertIn("不要自动添加黑丝、深色连裤袜、深色长袜", prompt)
        self.assertIn("裙子必须作为独立服装单品清晰可辨", prompt)
        self.assertIn("腿部规则：用户未指定腿部服饰或裤装时", prompt)
        self.assertIn("Hard consistency rules:", prompt)
        self.assertIn("dark pantyhose", negative_prompt)
        self.assertIn("skirt merged with legwear", negative_prompt)

    def test_character_prompt_preserves_explicit_legwear_but_requires_clear_skirt_separation(self) -> None:
        request = CharacterTurnaroundRequest(
            character_name="苏蔓",
            gender="女",
            age="32岁",
            job="律师",
            appearance="短发，五官锐利",
            costume="深蓝西装外套、半裙、黑色连裤袜和皮鞋",
            personality="强势果断",
        )

        prompt = _build_character_prompt(request)
        negative_prompt = _character_negative_prompt(request)

        self.assertIn("裙子必须作为独立服装单品清晰可辨", prompt)
        self.assertIn("不能把裙子与袜子画成同一种颜色或连成一个整体色块", prompt)
        self.assertIn("腿部规则：三视图都必须使用同一种腿部覆盖方案", prompt)
        self.assertIn("same-color skirt and stockings", negative_prompt)
        self.assertNotIn("unrequested legwear", negative_prompt)

    def test_chapter_prompt_focuses_on_single_primary_moment(self) -> None:
        request = ChapterIllustrationRequest(
            novel_title="红舞鞋",
            world_setting="民国三十年代上海老弄堂",
            era="民国时期",
            language_style="悬疑压抑，电影感",
            visual_style="写实胶片质感，复古暗调",
            chapter_id="ch1",
            chapter_title="第1章｜红舞鞋",
            key_events="苍荷在弄堂检查舞女尸体 / 发现红舞鞋内刻有字母X / 苍荷前往百乐门调查 / 与伪装成舞女的X短暂交谈",
            prompt="围绕章节“第1章｜红舞鞋”，提炼最有画面感的瞬间，苍荷勘察第三具尸体，红舞鞋为线索，调查展开，适合生成小说叙事插图。",
            reference_asset_ids=["asset_1"],
        )

        prompt = _build_chapter_prompt(request)

        self.assertIn("主画面瞬间：苍荷在弄堂检查舞女尸体；", prompt)
        self.assertIn("辅助线索：发现红舞鞋内刻有字母X，苍荷前往百乐门调查；", prompt)
        self.assertIn("视觉风格明确指定为“写实胶片质感，复古暗调”", prompt)
        self.assertIn("随附的角色三视图是本次生成的人物设定依据", prompt)
        self.assertIn("不要把多个分离事件、不同地点或不同时刻拼贴进同一张图", prompt)

    def test_chapter_prompt_falls_back_to_story_style_when_visual_style_missing(self) -> None:
        request = ChapterIllustrationRequest(
            novel_title="雨城档案",
            world_setting="近未来雨城与地下档案库",
            era="近未来",
            language_style="冷峻克制，悬疑压迫感",
            visual_style="",
            chapter_id="ch2",
            chapter_title="第2章｜地下回声",
            key_events="林晚推开地下档案库铁门 / 莫响举灯照向潮湿档案架",
            prompt="章节配图应突出地下档案库初次显露时的压迫感。",
        )

        prompt = _build_chapter_prompt(request)

        self.assertIn("主画面瞬间：林晚推开地下档案库铁门；", prompt)
        self.assertIn("时代气质贴合“近未来”", prompt)
        self.assertIn("整体氛围参考“冷峻克制，悬疑压迫感”", prompt)
        self.assertNotIn("视觉风格明确指定", prompt)

    def test_docx_rewrite_builds_scene_style_prompt_instead_of_event_list(self) -> None:
        chapter = {
            "title": "第1章｜红舞鞋",
            "events": "苍荷在弄堂检查舞女尸体 / 发现红舞鞋内刻有字母X / 苍荷前往百乐门调查",
            "prompt": "苍荷勘察第三具尸体，红舞鞋是关键线索，案件带着湿冷阴影般的压迫感。",
        }
        novel_data = ImportedNovelData(
            era="民国时期",
            world_setting="上海老弄堂与舞厅",
            language_style="悬疑压抑，电影感",
        )

        rewritten = _rewrite_chapter_prompt(chapter, novel_data)

        self.assertIn("民国时期", rewritten)
        self.assertIn("上海老弄堂与舞厅", rewritten)
        self.assertIn("悬疑压抑，电影感", rewritten)
        self.assertIn("苍荷在弄堂检查舞女尸体", rewritten)
        self.assertIn("突出人物动作与神情", rewritten)
        self.assertIn("中景构图", rewritten)
        self.assertIn("景深", rewritten)
        self.assertTrue(rewritten.endswith("。"))
        self.assertNotIn("主画面聚焦：", rewritten)
        self.assertNotIn("辅助细节：", rewritten)
        self.assertNotIn("苍荷前往百乐门调查", rewritten)

    def test_docx_rewrite_omits_placeholder_fields(self) -> None:
        chapter = {
            "title": "第1章｜红舞鞋",
            "events": "苍荷在弄堂检查舞女尸体 / 发现红舞鞋内刻有字母X",
            "prompt": "苍荷勘察第三具尸体。",
        }
        novel_data = ImportedNovelData(
            era="民国时期",
            world_setting="未填写",
            language_style="电影感",
        )

        rewritten = _rewrite_chapter_prompt(chapter, novel_data)

        self.assertIn("民国时期", rewritten)
        self.assertIn("电影感", rewritten)
        self.assertNotIn("未填写", rewritten)
        self.assertNotIn("场景设定参考：", rewritten)


if __name__ == "__main__":
    unittest.main()
