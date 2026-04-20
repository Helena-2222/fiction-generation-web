# AI 协同小说创作 WEB

一个基于 `FastAPI + 原生 HTML/CSS/JS` 的人机协同小说创作工作台，后端接入 DeepSeek，前端支持角色卡片与角色关系网联动。

## 功能

- 录入故事类型、梗概、语言风格、世界观、篇幅信息
- 默认 3 张角色卡片，可增删，最少保留 1 人
- 角色关系网支持：
  - 椭圆节点展示角色名
  - 拖动节点调整布局
  - 从一个角色拖线到另一个角色建立关系
  - 在线上直接填写关系文本
- 调用 DeepSeek 生成故事大纲
- 支持基于反馈重生成大纲
- 大纲确认后按章节依次生成正文
- 对用户未填写的设定，允许由 LLM 自动补完

## 运行方式

1. 安装依赖

```bash
pip install -r requirements.txt
```

2. 配置环境变量

```bash
copy .env.example .env
```

然后在 `.env` 中填写你的 `DEEPSEEK_API_KEY`。

3. 启动服务

```bash
uvicorn app.main:app --reload
```

4. 打开浏览器

访问 `http://127.0.0.1:8000`

## 接口

- `POST /api/outline` 生成或重生成故事大纲
- `POST /api/story` 根据已确认大纲生成全文
- `GET /api/health` 健康检查

## 说明

- 每章字数为空时，后端会默认按约 `2000` 字规划
- 章节数由 `总字数 / 每章字数` 自动向上取整
- 当前正文生成是按章节串行调用 LLM，以保证上下文连续

## 目录说明
前端 (static/)：
styles/tokens.css — CSS 变量（设计令牌）
styles/base.css — 全局基础样式
styles/components.css — 组件样式
styles.css — 入口文件（@import 三个文件）
src/constants.js — 所有常量（export）
src/state.js — 全局 state 对象（export）
src/utils.js — 纯工具函数（escapeHtml, clamp, generateId 等）
src/api.js — HTTP 请求函数（postJson, getJson）
app.js — 改为 ES module，顶部 import 上述模块

后端 (app/)：	
新结构	内容
llm/llm_client.py 	DeepSeek API 客户端（从 llm_runtime.py 迁移）
llm/llm_task_manager.py 	异步任务管理（从根目录迁移）
llm/prompts/  	所有 prompt 模板文件（从 app/prompts/ 迁移）
models/character.py 	CharacterCard, CharacterRelation
models/story.py 	StoryDraftRequest, 生成响应相关模型
models/outline.py	  大纲相关模型 + 故事生成请求
models/task.py	  LlmTaskStatusResponse
models/export.py	  DocxExportRequest
models/__init__.py	  向后兼容的全量重导出
utils/docx_export.py	  DOCX 导出工具（从根目录迁移）
routers/outline_router.py	  /api/outline + /api/llm-tasks/outline
routers/story_router.py 	/api/story + rewrite + task
routers/character_router.py 	/api/relations/supplement + task
routers/export_router.py  	/api/export/docx
routers/task_router.py  	/api/llm-tasks/{id} 管理操作
dependencies.py	  服务单例（story_service, llm_task_manager）
main.py 	只做路由注册
