# AI 协同小说创作 Web

一个基于 `FastAPI + 原生 HTML/CSS/JS + DeepSeek + Supabase` 的人机协同小说创作工作台。

项目围绕"基本信息 -> 角色关系 -> 大纲规划 -> 正文创作 -> 音频生成"组织完整创作流程，支持 AI 补全、历史版本、异步生成任务、局部重写、句子收藏、Word 导出和智能音频生成。

## 当前功能

### 创作中心
- 录入故事类型、梗概、语言风格、世界观与篇幅信息
- 自动根据总字数与单章字数估算章节数
- 本地自动保存工作区，刷新后可恢复

### 角色设定与关系网
- 默认 3 张角色卡，可增删
- 角色关系图支持拖拽、连线、缩放、平移
- 支持手动编辑关系、删除关系、保存角色关系历史版本
- 支持 AI 补充缺失的角色关系

### 大纲生成
- 基于故事设定、角色卡与关系网生成四段式大纲
- 支持用户反馈后重生成
- 自动补全未命名角色姓名
- 支持大纲历史版本恢复与导出

### 正文创作
- 按章节串行生成正文，保证上下文连续
- 支持暂停、继续、放弃 AI 生成任务
- 支持选中文本局部 AI 重写
- 支持手动编辑并区别人机修改痕迹

### 插图生成
- 基于小说章节内容自动提炼插图提示词
- 调用阿里云 DashScope (Wan2.7) 生成场景插图
- 支持导入 Word 文档批量生成章节插图

### 音频生成
- 智能分析章节内容，通过 DeepSeek 提炼情绪、场景和音频提示词
- 基于 Meta MusicGen 模型生成匹配的背景音乐
- 生成环境音效（风声、雨声、脚步声等场景音效）
- 音乐和音效共用同一模型实例，节省内存
- 支持 CPU 推理（float16 半精度），约 1.2GB 显存/内存
- 分析结果可视化展示：情绪标签、音乐风格标签、情绪曲线

### 文本管理
- 支持正文句子收藏与取消收藏
- 收藏内容按小说和章节分组展示

### 导出
- 支持导出基本信息、角色关系、大纲、单章正文、全书正文和全部内容
- 导出格式为 `.docx`

### 用户与鉴权
- 支持邮箱注册、登录、密码重置
- 支持游客匿名进入创作页
- 可通过 Supabase 接入账户体系

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI, httpx, uvicorn |
| 前端 | 原生 HTML / CSS / JavaScript |
| 大模型 | DeepSeek, MusicGen, Stable-Audio-3 |
| 图像生成 | 阿里云 DashScope Wan2.7 |
| 鉴权与账户 | Supabase Auth |
| 导出 | 后端直接生成 OpenXML `.docx` |
| 深度学习 | PyTorch, HuggingFace Transformers, Diffusers, Accelerate |

## 项目结构

```text
.
├── app/
│   ├── llm/
│   │   ├── llm_client.py            # DeepSeek 客户端与 JSON 修复逻辑
│   │   ├── llm_task_manager.py      # 大模型异步任务管理
│   │   └── prompts/                 # 角色命名、关系补充、大纲、正文等提示词
│   ├── models/                      # Pydantic 请求/响应模型
│   ├── routers/                     # API 路由
│   │   ├── outline_router.py        # 大纲相关
│   │   ├── story_router.py          # 正文相关
│   │   ├── character_router.py      # 角色相关
│   │   ├── task_router.py           # 异步任务
│   │   ├── export_router.py         # 导出
│   │   ├── image_router.py          # 插图生成
│   │   └── audio_router.py          # 音频生成
│   ├── services/
│   │   ├── story_service.py         # 核心创作服务
│   │   ├── summary_service.py       # 内容分析服务 
│   │   ├── audio_service.py         # 音频生成服务 
│   │   ├── image_provider.py        # 插图 API 封装
│   │   └── image_task_service.py    # 插图异步任务
│   ├── utils/
│   │   ├── docx_export.py           # Word 导出
│   │   └── docx_import.py           # Word 导入
│   ├── config.py                    # 环境变量配置
│   ├── dependencies.py              # 服务单例
│   └── main.py                      # 应用入口
├── static/
│   ├── html/
│   │   ├── index.html               # 首页
│   │   ├── auth.html                # 登录/注册
│   │   ├── create.html              # 创作工作台
│   │   ├── image-generation.html    # 插图生成
│   │   └── audio-generation.html    # 音频生成
│   ├── js/
│   │   ├── app.js                   # 主交互逻辑
│   │   ├── audio-generation.js      # 音频生成前端
│   │   └── src/                     # 前端状态、API、工具函数
│   ├── css/
│   │   └── audio-generation.css     # 音频生成样式
│   ├── audio/
│   │   ├── music/                   # 生成的背景音乐
│   │   └── effects/                 # 生成的音效
│   └── assets/                      # 图片等静态资源
├── models/                          # HuggingFace 模型缓存
├── .env.example                     # 环境变量模板
├── requirements.txt                 # Python 依赖
├── SUPABASE_SETUP.md               # Supabase 接入说明
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

> **注意**: PyTorch 建议根据你的 CUDA 版本单独安装：
> ```bash
> # CPU 版
> pip install torch --index-url https://download.pytorch.org/whl/cpu
> # CUDA 12.x
> pip install torch --index-url https://download.pytorch.org/whl/cu128
> ```

### 2. 配置环境变量

```bash
copy .env.example .env
```

`.env` 示例：

```env
# DeepSeek API
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
REQUEST_TIMEOUT_SECONDS=180
DEEPSEEK_JSON_MAX_TOKENS=8192

# 插图生成 (可选 — 阿里云 DashScope)
IMAGE_API_KEY=your_dashscope_api_key
IMAGE_API_BASE_URL=https://dashscope.aliyuncs.com/api/v1
IMAGE_MODEL=wan2.7-image

# Supabase 鉴权 (可选 — 用户登录/注册)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

### 3. 首次运行 — 下载音频模型

音频生成使用 Meta MusicGen 模型。首次运行时会自动从 HuggingFace 下载模型（约 2.3GB），请确保网络通畅。

```bash
uvicorn app.main:app --reload
```

### 4. 访问

启动后访问 http://127.0.0.1:8000/

| 页面 | 路径 |
|------|------|
| 首页 | `/` |
| 创作工作台 | `/create` |
| 插图生成 | `/images` |
| 音频生成 | `/audio` |
| 作品管理 | `/works` |
| 用户中心 | `/usercenter` |

## 创作流程

1. 在"基本信息"中填写故事类型、梗概、世界观、风格与篇幅
2. 在"角色设定"中编辑角色卡，并在关系图中建立人物关系
3. 需要时使用 AI 补充关系，再生成大纲
4. 根据大纲结果继续重生成、手动调整或直接生成正文
5. 在正文阶段进行局部重写、手动修改、句子收藏与内容导出
6. 在"音频生成"页面导入正文 → 分析内容 → 生成背景音乐和音效

## 音频生成功能详解

### 工作流程

```
小说章节 → DeepSeek 分析 → 提炼音频提示词 → MusicGen 生成 → WAV 输出
```

1. **导入内容**: 粘贴章节文本或导入 Word 文档
2. **分析内容**: DeepSeek 分析章节情绪、场景，生成音乐和音效提示词
3. **生成音乐**: 基于分析结果生成匹配的背景音乐（默认 30 秒）
4. **生成音效**: 生成风、雨、脚步等环境音效（默认 5 秒/个）

### 分析结果展示

分析完成后页面展示：
- **情绪标签**: 彩色圆标（peaceful / tense / sad / joyful / mysterious...）
- **音乐风格标签**: 风格、节拍、乐器分别以不同颜色展示
- **情绪曲线**: 各段落情绪强度可视化进度条
- **音效列表**: 带编号和时间标签的可编辑音效描述

### 模型说明

支持两种模型，可在前端页面顶部切换：

| 模型 | 来源 | 特点 | 推荐场景 |
|------|------|------|----------|
| **MusicGen** | Meta | 快速、轻量 (300M-3.3B)，CPU 可用 | 快速音乐/音效生成 |
| **Stable Audio 3** | Stability AI | 高质量立体声 (~1B)，需更多资源 | 高品质背景音乐 |

- **推理精度**: float16 半精度
- **MusicGen 内存**: 约 1.2GB (small) ~ 6GB (large)
- **Stable Audio 3 内存**: 约 2-4GB
- **CPU 推理**: 30 秒音乐约 3-15 分钟（视模型和 CPU）
- **GPU 推理**: CUDA 兼容时约 10-60 秒

安装 Stable Audio 3 支持:
```bash
pip install diffusers
```
首次使用会自动下载模型（约 2-4GB）。

### 已知限制

- AudioCraft 原生集成需要 Python 3.10 + xformers <0.0.23，当前使用 HF Transformers 后端
- RTX 50 系列 GPU (Blackwell) 需 PyTorch >= 2.6 + CUDA 12.8
- 首次运行需下载模型（MusicGen: ~2.3GB, Stable Audio 3: ~2-4GB），缓存于 `~/.cache/huggingface/`
- Stable Audio 3 需要 `diffusers` 库，模型较大，CPU 推理较慢

## 主要接口

### 页面与配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 首页 |
| GET | `/auth` | 登录页 |
| GET | `/create` | 创作页 |
| GET | `/audio` | 音频生成页 (NEW) |
| GET | `/images` | 插图生成页 |
| GET | `/api/public-config` | 前端公共配置 |
| GET | `/api/health` | 健康检查 |

### 大纲与正文

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/outline` | 直接生成或重生成大纲 |
| POST | `/api/story` | 直接生成正文 |
| POST | `/api/story/rewrite-selection` | 局部重写正文选区 |
| POST | `/api/relations/supplement` | 直接补充角色关系 |

### 异步 LLM 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/llm-tasks/outline` | 创建大纲生成任务 |
| POST | `/api/llm-tasks/story` | 创建正文生成任务 |
| POST | `/api/llm-tasks/relations/supplement` | 创建关系补充任务 |
| GET | `/api/llm-tasks/{task_id}` | 查询任务状态 |
| POST | `/api/llm-tasks/{task_id}/pause` | 暂停任务 |
| POST | `/api/llm-tasks/{task_id}/resume` | 恢复任务 |
| POST | `/api/llm-tasks/{task_id}/discard` | 放弃任务 |

### 音频生成 (NEW)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/audio/import-docx` | 导入 Word 文档提取章节 |
| POST | `/api/audio/analyze-chapter` | 分析章节（返回提示词） |
| POST | `/api/audio/generate-chapter-audio` | 完整流程: 分析→生成音乐+音效 |
| POST | `/api/audio/generate-music` | 独立生成背景音乐 |
| POST | `/api/audio/generate-effects` | 独立生成音效列表 |
| POST | `/api/audio/generate-from-prompts` | 从提示词生成音乐和音效 |
| GET | `/api/audio/models` | 可用模型列表 |
| GET | `/api/audio/device-info` | 设备信息 |
| POST | `/api/audio/switch-model` | 切换模型 (musicgen/stable-audio) |
| POST | `/api/audio/unload-models` | 卸载模型释放内存 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/export/docx` | 导出 Word 文档 |

## 关键实现说明

- 正文生成按章节串行调用模型，而不是整本一次生成，用于保证连续性
- 大纲和正文均要求模型返回严格 JSON，后端会做自动修复与重试
- 未命名角色：在大纲生成前自动尝试补名
- 用户修改前置设定后，系统会清理已失效的大纲或正文，避免版本混用
- 游客模式下，工作区状态会保存在当前浏览器本地，包含基本信息、角色关系、大纲、正文、收藏和历史记录
- 登录用户的工作区状态会与账户绑定同步到 Supabase，并在当前浏览器保留一份本地缓存作为回退
- 音乐和音效生成共用同一 MusicGen 模型实例，避免重复加载消耗内存

## 相关文档

- Supabase 配置说明：[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- 技术逻辑文档：[docs/technical-logic.md](./docs/technical-logic.md)


### TTS 配音生成 (NEW)

基于 indexTTS2 + DeepSeek 的小说对白智能配音，支持角色自定义音色和自动情感分析。

**前提条件**: 需要本地启动 indexTTS2 服务（监听 `http://127.0.0.1:9800`），参见 [indexTTS2 项目](https://github.com/IndexTeam/IndexTTS2)。

**工作流程**:
```
章节文本 -> DeepSeek 情感分析 -> 角色音色匹配 -> indexTTS2 合成 -> WAV 输出
```

1. **角色管理**: 创建角色、上传参考音频（支持 7 种情感标签）
2. **语音合成**: 选择角色 + 输入台词 -> AI 自动分析情绪 -> 合成语音
3. **章节批量配音**: 粘贴章节文本 -> 自动检测说话者 -> 映射角色 -> 批量合成

**API 接口**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/DELETE | `/api/tts/characters` | 角色 CRUD |
| POST | `/api/tts/characters/{id}/voices` | 上传参考音频 |
| POST | `/api/tts/analyze-emotion` | 情感分析 |
| GET | `/api/tts/health` | indexTTS2 健康检查 |
| POST | `/api/tts/synthesize` | 单句合成 |
| POST | `/api/tts/synthesize-chapter` | 章节批量合成 |



### TTS 配音生成 (NEW)

基于 indexTTS2 + DeepSeek 的小说对白智能配音，支持角色自定义音色和自动情感分析。

**前提条件**: 需要本地启动 indexTTS2 服务（监听 http://127.0.0.1:9800）。

**工作流程**:
`
章节文本 -> DeepSeek 情感分析 -> 角色音色匹配 -> indexTTS2 合成 -> WAV 输出
`

1. **角色管理**: 创建角色、上传参考音频（支持 7 种情感：高兴/愤怒/悲伤/恐惧/惊讶/反感/平静）
2. **语音合成**: 选择角色 + 输入台词 -> AI 自动分析情绪 -> 合成语音
3. **章节批量配音**: 粘贴章节文本 -> 自动检测说话者 -> 映射角色 -> 批量合成

**API 接口**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/DELETE | /api/tts/characters | 角色 CRUD |
| POST | /api/tts/characters/{id}/voices | 上传参考音频 |
| POST | /api/tts/analyze-emotion | DeepSeek 情感分析 |
| GET | /api/tts/health | indexTTS2 健康检查 |
| POST | /api/tts/synthesize | 单句合成 |
| POST | /api/tts/synthesize-chapter | 章节批量合成 |

## 当前边界

- 登录用户的工作区云同步依赖 `user_workspaces` 表；如果是旧环境，请先按 `SUPABASE_SETUP.md` 补充该表
- 导出当前仅提供 `.docx`
- 项目默认面向中文创作场景
- 音效生成与音乐生成共用 MusicGen 模型，非专用 AudioGen 模型（transformers 无内置支持）
