# AI 协同小说创作 Web

一个基于 `FastAPI + 原生 HTML/CSS/JS + DeepSeek + Supabase` 的人机协同小说创作工作台。

项目围绕“基本设定 -> 角色关系 -> 大纲规划 -> 正文创作”组织完整创作流程，支持 AI 补全、历史版本、异步生成任务、局部重写、句子收藏和 Word 导出。

## 当前功能

- 创作中心
  - 录入故事类型、梗概、语言风格、世界观与篇幅信息
  - 自动根据总字数与单章字数估算章节数
  - 本地自动保存工作区，刷新后可恢复
- 角色设定与关系网
  - 默认 3 张角色卡，可增删
  - 角色关系图支持拖拽、连线、缩放、平移
  - 支持手动编辑关系、删除关系、保存角色关系历史版本
  - 支持 AI 补充缺失的角色关系
- 大纲生成
  - 基于故事设定、角色卡与关系网生成四段式大纲
  - 支持用户反馈后重生成
  - 自动补全未命名角色姓名
  - 支持大纲历史版本恢复与导出
- 正文生成
  - 按章节串行生成正文，保证上下文连续
  - 支持暂停、继续、放弃 AI 生成任务
  - 支持选中文本局部 AI 重写
  - 支持手动编辑并区分人机修改痕迹
- 文本管理
  - 支持正文句子收藏与取消收藏
  - 收藏内容按小说和章节分组展示
- 导出
  - 支持导出基本信息、角色关系、大纲、单章正文、全书正文和全部内容
  - 导出格式为 `.docx`
- 用户与鉴权
  - 支持邮箱注册、登录、密码重置
  - 支持游客匿名进入创作页
  - 可通过 Supabase 接入账户体系

## 技术栈

- 后端：`FastAPI`、`httpx`、`uvicorn`
- 前端：原生 `HTML / CSS / JavaScript`
- 大模型：`DeepSeek`
- 鉴权与账户：`Supabase Auth`
- 导出：后端直接生成 OpenXML `.docx`

## 项目结构

```text
.
├─ app/
│  ├─ llm/
│  │  ├─ llm_client.py            # DeepSeek 客户端与 JSON 修复逻辑
│  │  ├─ llm_task_manager.py      # 大模型异步任务管理
│  │  └─ prompts/                 # 角色命名、关系补充、大纲、正文等提示词
│  ├─ models/                     # Pydantic 请求/响应模型
│  ├─ routers/                    # API 路由
│  ├─ services/story_service.py   # 核心创作服务
│  ├─ utils/docx_export.py        # Word 导出
│  ├─ config.py                   # 环境变量配置
│  ├─ dependencies.py             # 服务单例
│  └─ main.py                     # 应用入口
├─ static/
│  ├─ index.html                  # 首页
│  ├─ auth.html                   # 登录/注册页
│  ├─ create.html                 # 创作工作台
│  ├─ app.js                      # 主交互逻辑
│  ├─ landing.js                  # 首页游客进入逻辑
│  ├─ auth.js                     # 鉴权页逻辑
│  ├─ src/                        # 前端状态、API、工具函数
│  └─ styles/                     # 样式拆分
├─ docs/
│  └─ technical-logic.md          # 技术逻辑文档
├─ SUPABASE_SETUP.md              # Supabase 接入说明
├─ requirements.txt
├─ package.json
└─ README.md
```

## 快速开始

### 1. 安装依赖

Python 依赖：

```bash
pip install -r requirements.txt
```

如果你准备使用本地维护的前端依赖，可额外执行：

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
copy .env.example .env
```

`.env` 示例：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
REQUEST_TIMEOUT_SECONDS=180
DEEPSEEK_JSON_MAX_TOKENS=8192

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

说明：

- `DEEPSEEK_API_KEY` 为必填，否则无法调用模型
- `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 为可选
- 未配置 Supabase 时，登录相关能力不会完整启用

### 3. 启动服务

```bash
uvicorn app.main:app --reload
```

启动后访问：

- 首页：`http://127.0.0.1:8000/`
- 登录页：`http://127.0.0.1:8000/auth`
- 创作页：`http://127.0.0.1:8000/create`

## 创作流程

1. 在“基本信息”中填写故事类型、梗概、世界观、风格与篇幅。
2. 在“角色设定”中编辑角色卡，并在关系图中建立人物关系。
3. 需要时使用 AI 补充关系，再生成大纲。
4. 根据大纲结果继续重生成、手动调整或直接生成正文。
5. 在正文阶段进行局部重写、手动修改、句子收藏与内容导出。

## 主要接口

### 页面与配置

- `GET /` 首页
- `GET /auth` 登录页
- `GET /create` 创作页
- `GET /api/public-config` 前端公共配置
- `GET /api/health` 健康检查

### 大纲与正文

- `POST /api/outline` 直接生成或重生成大纲
- `POST /api/story` 直接生成正文
- `POST /api/story/rewrite-selection` 局部重写正文选区
- `POST /api/relations/supplement` 直接补充角色关系

### 异步 LLM 任务

- `POST /api/llm-tasks/outline` 创建大纲生成任务
- `POST /api/llm-tasks/story` 创建正文生成任务
- `POST /api/llm-tasks/relations/supplement` 创建关系补充任务
- `GET /api/llm-tasks/{task_id}` 查询任务状态
- `POST /api/llm-tasks/{task_id}/pause` 暂停任务
- `POST /api/llm-tasks/{task_id}/resume` 恢复任务
- `POST /api/llm-tasks/{task_id}/discard` 放弃任务

### 导出

- `POST /api/export/docx` 导出 Word 文档

## 关键实现说明

- 正文生成按章节串行调用模型，而不是整本一次生成，用于保证连续性。
- 大纲和正文均要求模型返回严格 JSON，后端会做自动修复与重试。
- 未命名角色会在大纲生成前自动尝试补名。
- 用户修改前置设定后，系统会清理已失效的大纲或正文，避免版本混用。
- 工作区状态会保存在本地，包含基本信息、角色关系、大纲、正文、收藏和历史记录。

## 相关文档

- Supabase 配置说明：[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- 技术逻辑文档：[docs/technical-logic.md](./docs/technical-logic.md)

## 当前边界

- 云端数据库表结构与鉴权方案已整理，但完整的工作区云同步仍在扩展中。
- 导出当前仅提供 `.docx`。
- 项目默认面向中文创作场景。
