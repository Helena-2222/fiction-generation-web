export const GENRE_OPTIONS = ["爱情", "科幻", "悬疑", "奇幻", "历史", "现实主义", "成长"];
export const STYLE_OPTIONS = ["幽默", "张爱玲式", "雨果式", "电影感", "冷峻克制", "轻盈浪漫"];
export const CHARACTER_DOSSIER_FIELDS = [
  { key: "name", label: "姓名", type: "text", span: "half" },
  { key: "gender", label: "性别", type: "text", span: "half" },
  { key: "age", label: "年龄", type: "text", span: "half" },
  { key: "nationality", label: "国籍/种族", type: "text", span: "half" },
  { key: "occupation", label: "身份/职业", type: "text", span: "full" },
  { key: "personality", label: "性格", type: "textarea", span: "half" },
  { key: "core_motivation", label: "核心动机", type: "textarea", span: "half" },
  { key: "inner_conflict", label: "内在冲突", type: "textarea", span: "half" },
  { key: "strengths", label: "强项", type: "textarea", span: "half" },
  { key: "weaknesses", label: "弱点", type: "textarea", span: "half" },
  { key: "character_arc", label: "人物弧光", hint: "人物成长变化", type: "textarea", span: "half" },
  { key: "appearance", label: "外在特征", type: "textarea", span: "half" },
  { key: "speaking_style", label: "说话风格", type: "textarea", span: "half" },
];
export const STAGE_ORDER = ["开端", "发展", "高潮", "结局"];
export const STAGE_META = {
  basic: { index: 0, label: "基本信息" },
  characters: { index: 1, label: "角色关系" },
  outline: { index: 2, label: "大纲生成" },
  story: { index: 3, label: "正文生成" },
};
export const WORKSPACE_STORAGE_KEY = "story-generation-workspace-v3";
export const STORY_GUIDE_STORAGE_KEY = "story-generation-neuro-guides-v3";
export const LLM_TASK_POLL_INTERVAL_MS = 1400;
export const HISTORY_LIMIT = 12;
export const HISTORY_DEBOUNCE_MS = 700;
export const GUIDE_TYPING_SPEED_MS = 18;
export const GUIDE_VIEWPORT_MARGIN = 18;
export const GUIDE_OUTLINE_AUTO_CLOSE_MS = 15000;
export const GUIDE_PANEL_PRIMARY_MESSAGE = "你好！我是 Neuro，你的 AI 创作伙伴。我会在每个环节为你提供引导和建议 ✨";
export const GUIDE_PANEL_PROMPT_MESSAGE = "点击页面上任何区域，让我们开始熟悉创作流程吧！";
export const GUIDE_NOTES = {
  basic_flow: {
    id: "basic-flow",
    target: "#top-stage-tabs",
    placement: "bottom-right",
    size: "lg",
    rotation: -3,
    text:
      "创作流程分四个步骤：\n① 基本信息 — 确立故事骨架\n② 角色关系 — 塑造人物\n③ 大纲生成 — AI 构建结构\n④ 正文生成 — 完成小说",
  },
  basic_required: {
    id: "basic-required",
    target: "#field-synopsis",
    placement: "right",
    size: "md",
    rotation: 2,
    text:
      "现在先填写“基本信息”。故事类型和故事梗概是必填项，它们将直接影响 AI 生成的风格和内容质量。",
  },
  basic_worldview: {
    id: "basic-worldview",
    target: "#field-worldview",
    placement: "right",
    size: "sm",
    rotation: -2,
    text: "世界观和语言风格选填，但填得越详细，生成结果越贴合你的设想！",
  },
  characters_intro: {
    id: "characters-dossier",
    target: "#scroll-1",
    placement: "top-right",
    size: "md",
    rotation: -2,
    text: "进入角色档案环节 👤 你可以为每个角色填写详细设定，点击标签切换编辑不同角色。",
  },
  characters_graph: {
    id: "characters-graph",
    target: "#character-graph-stage",
    placement: "top-left",
    size: "md",
    rotation: 2,
    text: "编辑完档案后，可以在右侧的角色关系图中，点击角色节点并拖拽来建立角色之间的关系连线。",
  },
  characters_ai: {
    id: "characters-ai",
    target: "#supplement-relations",
    placement: "top-right",
    size: "md",
    rotation: -3,
    text:
      "填完之后，推荐试试「AI 补充」功能。AI 只会在你留白的关系位上添加建议，不会修改你已有的任何编辑 🛡️",
  },
  outline_structure: {
    id: "outline-structure",
    target: "#outline-result",
    placement: "top-right",
    size: "md",
    rotation: -2,
    text: "按照经典叙事弧线，大纲分为开端 → 发展 → 高潮 → 结局四个阶段，每个阶段都会规划对应章节。",
  },
  outline_tools: {
    id: "outline-tools",
    target: "#outline-tools-anchor",
    placement: "bottom-left",
    size: "sm",
    rotation: 2,
    text: "生成完成后，你可以点击右上角图标查看历史版本或导出大纲文件。",
  },
  story_editor: {
    id: "story-editor",
    target: "#story-result",
    placement: "top-right",
    size: "lg",
    rotation: -2,
    text:
      "正文已生成完毕！✍️ 你可以选中任意文字来进行手动编辑或让 AI 局部重写。\n蓝色文字是你手动编辑过的内容，黑色文字是 AI 生成的原文，两者一目了然。",
  },
};
export const GRAPH = {
  nodeWidth: 116,
  nodeHeight: 62,
  curveOffset: 54,
  gapX: 96,
  gapY: 72,
  paddingX: 32,
  paddingY: 40,
  minGapX: 40,
  minHeight: 440,
  minScale: 0.75,
  maxScale: 2.4,
  wheelZoomStrength: 0.0015,
  labelOffset: 30,
  panPadding: 72,
  nodeColors: [
    { fill: "#ffe27d", stroke: "#f1c94c", text: "#614b12", shadow: "rgba(241, 201, 76, 0.24)" },
    { fill: "#ff9aa1", stroke: "#ff7c85", text: "#662c33", shadow: "rgba(255, 124, 133, 0.24)" },
    { fill: "#89c8f6", stroke: "#6cb6ef", text: "#244863", shadow: "rgba(108, 182, 239, 0.24)" },
    { fill: "#c8f3b0", stroke: "#aee487", text: "#365024", shadow: "rgba(174, 228, 135, 0.24)" },
    { fill: "#f6d7a8", stroke: "#e4bb79", text: "#6b4b1c", shadow: "rgba(228, 187, 121, 0.24)" },
    { fill: "#d7c5ff", stroke: "#b9a1ef", text: "#49366d", shadow: "rgba(185, 161, 239, 0.24)" },
  ],
};

// Legacy mock data for workspace migration
export const LEGACY_MOCK_SYNOPSIS =
  "在被异常浮力抬起的海上大陆，私人飞行器像马车一样寻常。火山林地的年轻修机师弗林特·瓦伦丁本想守着修理铺平静度日，却被旧友塞巴斯蒂安拉去参加王国年度飞行器竞赛。赛场上，他遇见作风冷硬、身世成谜的贵族飞手西尔维斯特·格雷，又被退隐传奇技师奥利弗·费恩主动卷入训练。随着竞赛推进，四人逐渐发现这场盛会并不只是争夺荣耀，而是一场借冠军筛选继承人与清洗知情者的隐秘试炼。旧友、对手、导师与调查者在高空与阴谋中不断重组关系，最终必须决定自己究竟为自由、真相，还是权力而飞。";
export const LEGACY_MOCK_WORLDVIEW_TIME =
  "近未来的浮海时代。蒸汽机械、轻量能核与古老飞行技术遗迹并存，飞行器已从贵族玩物变成大众交通工具。";
export const LEGACY_MOCK_WORLDVIEW_PHYSICAL =
  "大陆被高浮力海水与灰羽火山环绕，城市像睡莲般漂浮在海面。边境常见火山林、上升乱流与浮力雾潮，王城则拥有稳定而华丽的高空航道。";
export const LEGACY_MOCK_WORLDVIEW_SOCIAL =
  "浮岬王国仍维持君主制与议会共治的旧秩序，年度飞行器竞赛既是全民节庆，也是王权博弈的舞台。平民依赖私人飞行器通勤，飞手、技师与航讯记者拥有罕见的社会流动机会。";
export const LEGACY_MOCK_CHARACTER_IDS = [
  "character-flint-valentine",
  "character-sylvester-gray",
  "character-oliver-fane",
  "character-sebastian-hope",
];
export const LEGACY_MOCK_CHARACTER_NAMES = [
  "弗林特·瓦伦丁",
  "西尔维斯特·格雷",
  "奥利弗·费恩",
  "塞巴斯蒂安·霍普",
];
export const LEGACY_MOCK_RELATION_IDS = [
  "relation-flint-sebastian-old-friends",
  "relation-sebastian-flint-old-friends",
  "relation-flint-sylvester-rivals",
  "relation-sylvester-flint-rivals",
  "relation-sylvester-oliver-surface",
  "relation-oliver-sylvester-guarded",
  "relation-flint-oliver-allies",
  "relation-oliver-flint-mentor",
  "relation-sebastian-oliver-friends",
];
