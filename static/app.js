const GENRE_OPTIONS = ["爱情", "科幻", "悬疑", "奇幻", "历史", "现实主义", "成长"];
const STYLE_OPTIONS = ["幽默", "张爱玲式", "雨果式", "电影感", "冷峻克制", "轻盈浪漫"];
const CHARACTER_DOSSIER_FIELDS = [
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
const STAGE_ORDER = ["开端", "发展", "高潮", "结局"];
const STAGE_META = {
  basic: { index: 0, label: "基本信息" },
  characters: { index: 1, label: "角色关系" },
  outline: { index: 2, label: "大纲生成" },
  story: { index: 3, label: "正文生成" },
};
const WORKSPACE_STORAGE_KEY = "story-generation-workspace-v3";
const STORY_GUIDE_STORAGE_KEY = "story-generation-neuro-guides-v3";
const LLM_TASK_POLL_INTERVAL_MS = 1400;
const HISTORY_LIMIT = 12;
const HISTORY_DEBOUNCE_MS = 700;
const GUIDE_TYPING_SPEED_MS = 18;
const GUIDE_VIEWPORT_MARGIN = 18;
const GUIDE_OUTLINE_AUTO_CLOSE_MS = 15000;
const GUIDE_PANEL_PRIMARY_MESSAGE = "你好！我是 Neuro，你的 AI 创作伙伴。我会在每个环节为你提供引导和建议 ✨";
const GUIDE_PANEL_PROMPT_MESSAGE = "点击页面上任何区域，让我们开始熟悉创作流程吧！";
const GUIDE_NOTES = {
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
const GRAPH = {
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

const state = {
  genre: "",
  style: "",
  currentStage: "basic",
  activeCharacterId: null,
  basicHistory: [],
  characterHistory: [],
  outlineHistory: [],
  activeChapterNumber: null,
  characters: [],
  relations: [],
  savedStoryDraft: null,
  isStorySaved: false,
  outline: null,
  generatedStory: null,
  storySelection: null,
  favoriteQuotes: [],
  sidebarProfileOpen: false,
  graphView: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  graphPan: null,
  pendingEdge: null,
  relationEditor: null,
  relationDeleteRequest: null,
  characterCreationHistory: [],
};

const LEGACY_MOCK_SYNOPSIS =
  "在被异常浮力抬起的海上大陆，私人飞行器像马车一样寻常。火山林地的年轻修机师弗林特·瓦伦丁本想守着修理铺平静度日，却被旧友塞巴斯蒂安拉去参加王国年度飞行器竞赛。赛场上，他遇见作风冷硬、身世成谜的贵族飞手西尔维斯特·格雷，又被退隐传奇技师奥利弗·费恩主动卷入训练。随着竞赛推进，四人逐渐发现这场盛会并不只是争夺荣耀，而是一场借冠军筛选继承人与清洗知情者的隐秘试炼。旧友、对手、导师与调查者在高空与阴谋中不断重组关系，最终必须决定自己究竟为自由、真相，还是权力而飞。";
const LEGACY_MOCK_WORLDVIEW_TIME =
  "近未来的浮海时代。蒸汽机械、轻量能核与古老飞行技术遗迹并存，飞行器已从贵族玩物变成大众交通工具。";
const LEGACY_MOCK_WORLDVIEW_PHYSICAL =
  "大陆被高浮力海水与灰羽火山环绕，城市像睡莲般漂浮在海面。边境常见火山林、上升乱流与浮力雾潮，王城则拥有稳定而华丽的高空航道。";
const LEGACY_MOCK_WORLDVIEW_SOCIAL =
  "浮岬王国仍维持君主制与议会共治的旧秩序，年度飞行器竞赛既是全民节庆，也是王权博弈的舞台。平民依赖私人飞行器通勤，飞手、技师与航讯记者拥有罕见的社会流动机会。";
const LEGACY_MOCK_CHARACTER_IDS = [
  "character-flint-valentine",
  "character-sylvester-gray",
  "character-oliver-fane",
  "character-sebastian-hope",
];
const LEGACY_MOCK_CHARACTER_NAMES = [
  "弗林特·瓦伦丁",
  "西尔维斯特·格雷",
  "奥利弗·费恩",
  "塞巴斯蒂安·霍普",
];
const LEGACY_MOCK_RELATION_IDS = [
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

function buildInitialWorkspaceSnapshot() {
  return {
    version: 4,
    genre: "",
    style: "",
    currentStage: "basic",
    activeCharacterId: null,
    activeChapterNumber: null,
    sidebarProfileOpen: false,
    graphView: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    basicHistory: [],
    characterHistory: [],
    outlineHistory: [],
    characters: [],
    relations: [],
    savedStoryDraft: null,
    isStorySaved: false,
    outline: null,
    generatedStory: null,
    favoriteQuotes: [],
    form: {},
  };
}

function isLegacyMockWorkspace(snapshot) {
  const characters = Array.isArray(snapshot?.characters) ? snapshot.characters : [];
  const relations = Array.isArray(snapshot?.relations) ? snapshot.relations : [];
  const form = snapshot?.form && typeof snapshot.form === "object" ? snapshot.form : {};

  return String(snapshot?.genre || "").trim() === "奇幻"
    && String(snapshot?.style || "").trim() === "幽默"
    && String(form.synopsis || "").trim() === LEGACY_MOCK_SYNOPSIS
    && String(form.worldviewTime || "").trim() === LEGACY_MOCK_WORLDVIEW_TIME
    && String(form.worldviewPhysical || "").trim() === LEGACY_MOCK_WORLDVIEW_PHYSICAL
    && String(form.worldviewSocial || "").trim() === LEGACY_MOCK_WORLDVIEW_SOCIAL
    && characters.length === LEGACY_MOCK_CHARACTER_IDS.length
    && LEGACY_MOCK_CHARACTER_IDS.every((id, index) => String(characters[index]?.id || "") === id)
    && LEGACY_MOCK_CHARACTER_NAMES.every((name, index) => String(characters[index]?.name || "").trim() === name)
    && relations.length === LEGACY_MOCK_RELATION_IDS.length
    && LEGACY_MOCK_RELATION_IDS.every((id, index) => String(relations[index]?.id || "") === id);
}

function getRequestedStageOverride() {
  try {
    const params = new URLSearchParams(window.location.search);
    const requestedStage = (params.get("stage") || "").trim();
    return Object.prototype.hasOwnProperty.call(STAGE_META, requestedStage) ? requestedStage : "";
  } catch (error) {
    console.warn("读取页面阶段参数失败：", error);
    return "";
  }
}

function clearStageOverrideFromUrl() {
  if (!window.history?.replaceState) {
    return;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("stage");
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch (error) {
    console.warn("清理页面阶段参数失败：", error);
  }
}

let nextCharacterColorIndex = 0;
let graphResizeObserver = null;
let graphRenderFrame = 0;
let favoriteToastTimer = null;
let basicHistoryTimer = null;
let characterHistoryTimer = null;
const guideOverlayState = {
  activeStage: null,
  activeNoteKey: null,
  panelMode: null,
  introPromptReady: false,
  token: 0,
  timers: [],
  notes: [],
  positionFrame: 0,
  autoHideTimer: null,
};
const FAVORITE_BUTTON_ICONS = {
  favorite: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
      <path d="M10 16.2 4.7 11.5a3.5 3.5 0 0 1 5-4.9L10 7l.3-.4a3.5 3.5 0 0 1 5 4.9L10 16.2Z"></path>
    </svg>
  `,
  unfavorite: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
      <path d="M10 15.4 5.4 11.2a3.1 3.1 0 0 1 4.4-4.4L10 7l.2-.2a3.1 3.1 0 0 1 4.4 4.4L10 15.4Z"></path>
      <path d="M5 5 15 15"></path>
    </svg>
  `,
};
const llmActivity = {
  active: false,
  runId: 0,
  panelOpen: false,
  waitTimer: null,
  autoCloseTimer: null,
  waitIndex: 0,
  waitingMessages: [],
};
const llmTaskController = {
  currentTask: null,
  pollTimer: null,
  pollInFlight: false,
};

const elements = {
  sidebar: document.querySelector("#sidebar-rail"),
  sidebarAvatarToggle: document.querySelector("#sidebar-avatar-toggle"),
  sidebarDetailPanel: document.querySelector("#sidebar-detail-panel"),
  favoriteList: document.querySelector("#favorite-list"),
  favoriteCountBadge: document.querySelector("#favorite-count-badge"),
  stageSections: Array.from(document.querySelectorAll("[data-stage-screen]")),
  stageNavButtons: Array.from(document.querySelectorAll(".stage-tab")),
  railStageButtons: Array.from(document.querySelectorAll(".rail-node[data-stage-target]")),
  goToCharacters: document.querySelector("#go-to-characters"),
  genreOptions: document.querySelector("#genre-options"),
  styleOptions: document.querySelector("#style-options"),
  customGenre: document.querySelector("#custom-genre"),
  customStyle: document.querySelector("#custom-style"),
  synopsis: document.querySelector("#synopsis"),
  totalWords: document.querySelector("#total-words"),
  chapterWords: document.querySelector("#chapter-words"),
  chapterCount: document.querySelector("#chapter-count"),
  worldviewTime: document.querySelector("#worldview-time"),
  worldviewPhysical: document.querySelector("#worldview-physical"),
  worldviewSocial: document.querySelector("#worldview-social"),
  characterList: document.querySelector("#character-list"),
  graphWrap: document.querySelector(".graph-wrap"),
  graphCanvas: document.querySelector("#graph-canvas"),
  graphSvg: document.querySelector("#graph-svg"),
  graphNodes: document.querySelector("#graph-nodes"),
  relationLabels: document.querySelector("#relation-labels"),
  relationSaveState: document.querySelector("#relation-save-state"),
  storyForm: document.querySelector("#story-form"),
  addCharacter: document.querySelector("#add-character"),
  generateOutline: document.querySelector("#generate-outline"),
  saveRelations: document.querySelector("#save-relations"),
  supplementRelations: document.querySelector("#supplement-relations"),
  outlineResult: document.querySelector("#outline-result"),
  storyResult: document.querySelector("#story-result"),
  statusBox: document.querySelector("#status-box"),
  statusPill: document.querySelector("#status-pill"),
  basicHistoryButton: document.querySelector("#basic-history"),
  exportBasic: document.querySelector("#export-basic"),
  charactersHistoryButton: document.querySelector("#characters-history"),
  exportCharacters: document.querySelector("#export-characters"),
  exportOutline: document.querySelector("#export-outline"),
  regenerateOutline: document.querySelector("#regenerate-outline"),
  generateStory: document.querySelector("#generate-story"),
  exportSettings: document.querySelector("#export-settings"),
  exportAllStory: document.querySelector("#export-all-story"),
  exportEverything: document.querySelector("#export-everything"),
  outlineFeedback: document.querySelector("#outline-feedback"),
  guideOverlay: document.querySelector("#neuro-guide-overlay"),
  relationModal: document.querySelector("#relation-modal"),
  relationModalClose: document.querySelector("#relation-modal-close"),
  relationDirection: document.querySelector("#relation-direction"),
  relationLabelInput: document.querySelector("#relation-label-input"),
  relationReverseToggle: document.querySelector("#relation-reverse-toggle"),
  reverseRelationGroup: document.querySelector("#reverse-relation-group"),
  reverseRelationLabelInput: document.querySelector("#reverse-relation-label-input"),
  relationSaveButton: document.querySelector("#relation-save-button"),
  relationDeleteModal: document.querySelector("#relation-delete-modal"),
  relationDeleteMessage: document.querySelector("#relation-delete-message"),
  relationDeleteConfirm: document.querySelector("#relation-delete-confirm"),
  relationDeleteCancel: document.querySelector("#relation-delete-cancel"),
  llmActivityPanel: document.querySelector("#llm-activity-panel"),
  neuroStageLabel: document.querySelector("#neuro-stage-label"),
  neuroDragHandle: document.querySelector("#neuro-drag-handle"),
  neuroInputRow: document.querySelector("#neuro-input-row"),
  neuroInputLabel: document.querySelector("#neuro-input-label"),
  neuroInputHint: document.querySelector("#neuro-input-hint"),
  neuroInputPlaceholder: document.querySelector("#neuro-input-placeholder"),
  llmActivityTitle: document.querySelector("#llm-activity-title"),
  llmActivityClose: document.querySelector("#llm-activity-close"),
  llmActivityToggle: document.querySelector("#llm-activity-toggle"),
  llmActivityStatus: document.querySelector("#llm-activity-status"),
  llmActivitySummary: document.querySelector("#llm-activity-summary"),
  llmActivityLog: document.querySelector("#llm-activity-log"),
  llmActivityActions: document.querySelector("#llm-activity-actions"),
  llmActivityStop: document.querySelector("#llm-activity-stop"),
  llmActivityResume: document.querySelector("#llm-activity-resume"),
  llmActivityDiscard: document.querySelector("#llm-activity-discard"),
  llmTaskPauseModal: document.querySelector("#llm-task-pause-modal"),
  llmTaskPauseClose: document.querySelector("#llm-task-pause-close"),
  llmTaskPauseMessage: document.querySelector("#llm-task-pause-message"),
  llmTaskPauseResume: document.querySelector("#llm-task-pause-resume"),
  llmTaskPauseDiscard: document.querySelector("#llm-task-pause-discard"),
  outlineHistory: document.querySelector("#outline-history"),
  outlineHistoryModal: document.querySelector("#outline-history-modal"),
  outlineHistoryClose: document.querySelector("#outline-history-close"),
  outlineHistoryList: document.querySelector("#outline-history-list"),
  basicHistoryModal: document.querySelector("#basic-history-modal"),
  basicHistoryClose: document.querySelector("#basic-history-close"),
  basicHistoryList: document.querySelector("#basic-history-list"),
  charactersHistoryModal: document.querySelector("#characters-history-modal"),
  charactersHistoryClose: document.querySelector("#characters-history-close"),
  charactersHistoryList: document.querySelector("#characters-history-list"),
  storySelectionToolbar: document.querySelector("#story-selection-toolbar"),
  storySelectionFavorite: document.querySelector("#story-selection-favorite"),
  storySelectionEdit: document.querySelector("#story-selection-edit"),
  storySelectionRegenerate: document.querySelector("#story-selection-regenerate"),
  favoriteToast: document.querySelector("#favorite-toast"),
  storyEditModal: document.querySelector("#story-edit-modal"),
  storyEditClose: document.querySelector("#story-edit-close"),
  storyEditCancel: document.querySelector("#story-edit-cancel"),
  storyEditSave: document.querySelector("#story-edit-save"),
  storyEditTextarea: document.querySelector("#story-edit-textarea"),
};

function generateId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeFavoriteQuote(item) {
  const text = String(item?.text || "").trim();
  if (!text) {
    return null;
  }

  return {
    id: item?.id || generateId("favorite"),
    storyTitle: String(item?.storyTitle || "").trim(),
    chapterNumber: Number(item?.chapterNumber) || null,
    startOffset: Number(item?.startOffset) || 0,
    endOffset: Number(item?.endOffset) || 0,
    text,
    createdAt: item?.createdAt || new Date().toISOString(),
  };
}

function createCharacter(index) {
  const colorIndex = nextCharacterColorIndex;
  nextCharacterColorIndex += 1;
  const color = getCharacterGraphColorByIndex(colorIndex);
  const position = getCharacterGraphPosition(index, Math.max(index + 1, 1));

  return {
    id: generateId("character"),
    name: "",
    gender: "",
    age: "",
    occupation: "",
    nationality: "",
    personality: "",
    inner_conflict: "",
    strengths: "",
    weaknesses: "",
    character_arc: "",
    appearance: "",
    values: "",
    speaking_style: "",
    core_motivation: "",
    graph_x: position.x,
    graph_y: position.y,
    graph_color_index: colorIndex,
    graph_color: color,
  };
}

function getCharacterGraphColorByIndex(index) {
  return GRAPH.nodeColors[index % GRAPH.nodeColors.length];
}

function getCharacterGraphColor(character, index) {
  if (character.graph_color) {
    return character.graph_color;
  }

  const colorIndex = Number.isInteger(character.graph_color_index)
    ? character.graph_color_index
    : index;
  const color = getCharacterGraphColorByIndex(colorIndex);
  character.graph_color_index = colorIndex;
  character.graph_color = color;
  return color;
}

function getCharacterGraphPosition(index, total) {
  const layout = calculateCharacterGraphLayout(total);
  return layout.positions[index] || { x: GRAPH.paddingX, y: GRAPH.paddingY };
}

function calculateCharacterGraphLayout(total) {
  if (total <= 0) {
    return { positions: [], height: GRAPH.minHeight };
  }

  const slots = orderCharacterGraphSlotsFromCenter(computeCharacterGraphSlots(total));
  const maxCol = Math.max(...slots.map((slot) => slot.col));
  const maxRow = Math.max(...slots.map((slot) => slot.row));
  const canvasWidth = elements.graphCanvas?.clientWidth || 700;
  const preferredSpacingX = GRAPH.nodeWidth + GRAPH.gapX;
  const minimumSpacingX = GRAPH.nodeWidth + GRAPH.minGapX;
  const availableSpacingX = maxCol > 0
    ? (canvasWidth - GRAPH.nodeWidth - GRAPH.paddingX * 2) / maxCol
    : preferredSpacingX;
  const spacingX = maxCol > 0
    ? Math.max(minimumSpacingX, Math.min(preferredSpacingX, availableSpacingX))
    : preferredSpacingX;
  const spacingY = getCharacterGraphRowSpacing(total, spacingX);
  const contentWidth = GRAPH.nodeWidth + maxCol * spacingX;
  const contentHeight = GRAPH.nodeHeight + maxRow * spacingY;
  const minCanvasHeight = getGraphCanvasMinimumHeight();
  const canvasHeight = Math.max(minCanvasHeight, contentHeight + GRAPH.paddingY * 2);
  const offsetX = Math.max(0, (canvasWidth - contentWidth) / 2);
  const offsetY = Math.max(GRAPH.paddingY, (canvasHeight - contentHeight) / 2);

  return {
    height: canvasHeight,
    positions: slots.map((slot) => ({
      x: offsetX + slot.col * spacingX,
      y: offsetY + slot.row * spacingY,
    })),
  };
}

function getCharacterGraphRowSpacing(total, spacingX) {
  if (total === 3) {
    return spacingX * Math.sqrt(3) / 2;
  }
  if (total === 4) {
    return spacingX;
  }
  return Math.max(GRAPH.nodeHeight + GRAPH.gapY, Math.min(spacingX * 0.72, 168));
}

function getGraphCanvasMinimumHeight() {
  if (!elements.graphCanvas) {
    return GRAPH.minHeight;
  }
  const minHeight = Number.parseFloat(window.getComputedStyle(elements.graphCanvas).minHeight);
  return Number.isFinite(minHeight) ? minHeight : GRAPH.minHeight;
}

function computeCharacterGraphSlots(total) {
  if (total <= 2) {
    return Array.from({ length: total }, (_, index) => ({ col: index, row: 0 }));
  }
  if (total === 3) {
    return [
      { col: 0.5, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ];
  }
  if (total === 4) {
    return [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ];
  }

  const rowCounts = [];
  const fullRows = Math.floor(total / 3);
  const remainder = total % 3;

  if (remainder === 0) {
    rowCounts.push(...Array(fullRows).fill(3));
  } else if (remainder === 1) {
    rowCounts.push(...Array(Math.max(0, fullRows - 1)).fill(3), 2, 2);
  } else {
    rowCounts.push(...Array(fullRows).fill(3), 2);
  }

  return rowCounts.flatMap((count, row) => {
    const offset = count === 2 ? 0.5 : count === 1 ? 1 : 0;
    return Array.from({ length: count }, (_, col) => ({ col: col + offset, row }));
  });
}

function orderCharacterGraphSlotsFromCenter(slots) {
  if (slots.length <= 1) {
    return slots;
  }

  const minCol = Math.min(...slots.map((slot) => slot.col));
  const maxCol = Math.max(...slots.map((slot) => slot.col));
  const minRow = Math.min(...slots.map((slot) => slot.row));
  const maxRow = Math.max(...slots.map((slot) => slot.row));
  const centerCol = (minCol + maxCol) / 2;
  const centerRow = (minRow + maxRow) / 2;

  return [...slots].sort((a, b) => {
    const distanceA = (a.col - centerCol) ** 2 + (a.row - centerRow) ** 2;
    const distanceB = (b.col - centerCol) ** 2 + (b.row - centerRow) ** 2;
    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }
    if (a.row !== b.row) {
      return a.row - b.row;
    }
    return a.col - b.col;
  });
}

function arrangeCharacterGraph() {
  const layout = calculateCharacterGraphLayout(state.characters.length);
  if (elements.graphCanvas) {
    const viewportHeight = elements.graphWrap?.clientHeight || 0;
    elements.graphCanvas.style.height = `${Math.max(layout.height, viewportHeight)}px`;
  }

  state.characters.forEach((character, index) => {
    const position = layout.positions[index];
    if (!position) {
      return;
    }
    character.graph_x = position.x;
    character.graph_y = position.y;
    getCharacterGraphColor(character, index);
  });
}

function queueGraphRender() {
  if (graphRenderFrame) {
    return;
  }

  graphRenderFrame = window.requestAnimationFrame(() => {
    graphRenderFrame = 0;
    renderGraph();
  });
}

function setupGraphResizeObserver() {
  if (!elements.graphWrap || typeof ResizeObserver !== "function" || graphResizeObserver) {
    return;
  }

  let lastWidth = 0;
  let lastHeight = 0;
  graphResizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }

    const width = Math.round(entry.contentRect.width);
    const height = Math.round(entry.contentRect.height);
    if (!width || !height || (width === lastWidth && height === lastHeight)) {
      return;
    }

    lastWidth = width;
    lastHeight = height;
    queueGraphRender();
  });
  graphResizeObserver.observe(elements.graphWrap);
}

function clampGraphViewport() {
  const width = elements.graphCanvas?.clientWidth || 0;
  const height = elements.graphCanvas?.clientHeight || 0;
  const scale = clamp(state.graphView.scale || 1, GRAPH.minScale, GRAPH.maxScale);
  state.graphView.scale = scale;

  if (!width || !height) {
    state.graphView.scale = 1;
    state.graphView.offsetX = 0;
    state.graphView.offsetY = 0;
    return;
  }

  const bounds = getGraphContentBounds();
  const minOffsetX = width + GRAPH.panPadding - bounds.maxX * scale;
  const maxOffsetX = GRAPH.panPadding - bounds.minX * scale;
  const minOffsetY = height + GRAPH.panPadding - bounds.maxY * scale;
  const maxOffsetY = GRAPH.panPadding - bounds.minY * scale;

  state.graphView.offsetX = clamp(
    state.graphView.offsetX,
    Math.min(minOffsetX, maxOffsetX),
    Math.max(minOffsetX, maxOffsetX),
  );
  state.graphView.offsetY = clamp(
    state.graphView.offsetY,
    Math.min(minOffsetY, maxOffsetY),
    Math.max(minOffsetY, maxOffsetY),
  );
}

function getGraphContentBounds() {
  if (!state.characters.length) {
    const width = elements.graphCanvas?.clientWidth || 0;
    const height = elements.graphCanvas?.clientHeight || 0;
    return {
      minX: 0,
      maxX: width,
      minY: 0,
      maxY: height,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  state.characters.forEach((character) => {
    minX = Math.min(minX, character.graph_x);
    minY = Math.min(minY, character.graph_y);
    maxX = Math.max(maxX, character.graph_x + GRAPH.nodeWidth);
    maxY = Math.max(maxY, character.graph_y + GRAPH.nodeHeight);
  });

  return {
    minX: minX - GRAPH.panPadding,
    maxX: maxX + GRAPH.panPadding,
    minY: minY - GRAPH.panPadding,
    maxY: maxY + GRAPH.panPadding,
  };
}

function applyGraphViewport() {
  clampGraphViewport();
  const { scale, offsetX, offsetY } = state.graphView;
  const transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

  [elements.graphSvg, elements.graphNodes, elements.relationLabels].forEach((layer) => {
    if (!layer) {
      return;
    }
    layer.style.transform = transform;
  });
}

function getGraphLocalPointFromClient(clientX, clientY) {
  const interactionSurface = elements.graphWrap || elements.graphCanvas;
  const rect = interactionSurface.getBoundingClientRect();
  const width = elements.graphCanvas.clientWidth || rect.width || 0;
  const height = elements.graphCanvas.clientHeight || rect.height || 0;
  return {
    x: clamp(clientX - rect.left, 0, width),
    y: clamp(clientY - rect.top, 0, height),
  };
}

function handleGraphWheel(event) {
  if (!elements.graphWrap || !elements.graphCanvas) {
    return;
  }

  event.preventDefault();
  const point = getGraphLocalPointFromClient(event.clientX, event.clientY);
  const previousScale = state.graphView.scale || 1;
  const nextScale = clamp(
    previousScale * Math.exp(-event.deltaY * GRAPH.wheelZoomStrength),
    GRAPH.minScale,
    GRAPH.maxScale,
  );

  if (Math.abs(nextScale - previousScale) < 0.001) {
    return;
  }

  const graphX = (point.x - state.graphView.offsetX) / previousScale;
  const graphY = (point.y - state.graphView.offsetY) / previousScale;
  state.graphView.scale = nextScale;
  state.graphView.offsetX = point.x - graphX * nextScale;
  state.graphView.offsetY = point.y - graphY * nextScale;
  applyGraphViewport();
}

function syncNeuroInputState() {
  if (
    !elements.outlineFeedback ||
    !elements.neuroInputRow ||
    !elements.neuroInputLabel ||
    !elements.neuroInputHint ||
    !elements.neuroInputPlaceholder
  ) {
    return;
  }

  const isOutlineStage = state.currentStage === "outline";
  const hasOutline = Boolean(state.outline);

  elements.neuroInputRow.classList.toggle("is-feedback-mode", isOutlineStage);
  elements.neuroInputLabel.classList.toggle("hidden", !isOutlineStage);
  elements.neuroInputHint.classList.toggle("hidden", !isOutlineStage);
  elements.outlineFeedback.classList.toggle("hidden", !isOutlineStage);
  elements.neuroInputPlaceholder.classList.toggle("hidden", isOutlineStage);

  if (!isOutlineStage) {
    elements.outlineFeedback.disabled = false;
    return;
  }

  elements.neuroInputHint.textContent = hasOutline
    ? "在这里补充修改方向，然后点击“重新生成”。"
    : "首版大纲生成后，你可以在这里填写改进意见。";
  elements.outlineFeedback.placeholder = hasOutline
    ? "如果想调整大纲，可以在这里补充方向，例如：加强情感张力、减少支线、增加悬疑误导。"
    : "生成首版大纲后，可在这里填写改进意见。";
  elements.outlineFeedback.disabled = !hasOutline;
}

function init() {
  const restoredWorkspace = loadWorkspaceSnapshot();
  const requestedStageOverride = getRequestedStageOverride();
  const restoredGeneratedContent = Boolean(restoredWorkspace?.outline || restoredWorkspace?.generatedStory);
  if (restoredWorkspace) {
    applyWorkspaceSnapshot(restoredWorkspace);
  } else {
    applyWorkspaceSnapshot(buildInitialWorkspaceSnapshot());
  }
  renderChipGroup(elements.genreOptions, GENRE_OPTIONS, "genre");
  renderChipGroup(elements.styleOptions, STYLE_OPTIONS, "style");
  bindStoryDraftInputs();
  bindStageNavigation();
  elements.totalWords.addEventListener("input", updateChapterEstimate);
  elements.chapterWords.addEventListener("input", updateChapterEstimate);
  elements.sidebarAvatarToggle?.addEventListener("click", toggleSidebarProfile);
  elements.favoriteList?.addEventListener("click", handleFavoriteListClick);
  elements.goToCharacters.addEventListener("click", () => {
    setCurrentStage("characters");
  });
  elements.addCharacter.addEventListener("click", addCharacter);
  elements.storyForm.addEventListener("submit", handleOutlineSubmit);
  elements.saveRelations.addEventListener("click", handleSaveRelations);
  elements.supplementRelations.addEventListener("click", handleAiRelationSupplement);
  elements.basicHistoryButton.addEventListener("click", openBasicHistoryModal);
  elements.exportBasic.addEventListener("click", handleBasicExport);
  elements.charactersHistoryButton.addEventListener("click", openCharactersHistoryModal);
  elements.exportCharacters.addEventListener("click", handleCharactersExport);
  elements.exportOutline.addEventListener("click", handleOutlineExport);
  elements.regenerateOutline.addEventListener("click", handleOutlineRegenerate);
  elements.generateStory.addEventListener("click", handleStoryGenerate);
  elements.exportSettings.addEventListener("click", handleExportSettings);
  elements.exportAllStory.addEventListener("click", handleExportAllStory);
  elements.exportEverything.addEventListener("click", handleExportEverything);
  elements.storyResult.addEventListener("click", handleStoryResultClick);
  elements.outlineHistory.addEventListener("click", openOutlineHistoryModal);
  elements.outlineHistoryClose.addEventListener("click", closeOutlineHistoryModal);
  elements.outlineHistoryModal.addEventListener("click", (event) => {
    if (event.target === elements.outlineHistoryModal) {
      closeOutlineHistoryModal();
    }
  });
  elements.basicHistoryClose.addEventListener("click", closeBasicHistoryModal);
  elements.basicHistoryModal.addEventListener("click", (event) => {
    if (event.target === elements.basicHistoryModal) {
      closeBasicHistoryModal();
    }
  });
  elements.charactersHistoryClose.addEventListener("click", closeCharactersHistoryModal);
  elements.charactersHistoryModal.addEventListener("click", (event) => {
    if (event.target === elements.charactersHistoryModal) {
      closeCharactersHistoryModal();
    }
  });
  elements.storySelectionFavorite.addEventListener("click", handleStorySelectionFavorite);
  elements.storySelectionEdit.addEventListener("click", openStoryEditModal);
  elements.storySelectionRegenerate.addEventListener("click", handleStorySelectionRegenerate);
  elements.storySelectionToolbar.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  elements.storyEditClose.addEventListener("click", closeStoryEditModal);
  elements.storyEditCancel.addEventListener("click", closeStoryEditModal);
  elements.storyEditSave.addEventListener("click", saveStorySelectionEdit);
  elements.storyEditModal.addEventListener("click", (event) => {
    if (event.target === elements.storyEditModal) {
      closeStoryEditModal();
    }
  });
  elements.relationModalClose.addEventListener("click", closeRelationModal);
  elements.relationSaveButton.addEventListener("click", saveRelationModal);
  elements.relationLabelInput.addEventListener("input", () => {
    if (elements.relationReverseToggle.checked && !elements.reverseRelationLabelInput.value.trim()) {
      elements.reverseRelationLabelInput.value = elements.relationLabelInput.value.trim();
    }
  });
  elements.relationReverseToggle.addEventListener("change", () => {
    elements.reverseRelationGroup.classList.toggle("hidden", !elements.relationReverseToggle.checked);
    elements.reverseRelationLabelInput.value = elements.relationReverseToggle.checked
      ? elements.reverseRelationLabelInput.value.trim() || elements.relationLabelInput.value.trim()
      : "";
  });
  elements.relationModal.addEventListener("click", (event) => {
    if (event.target === elements.relationModal) {
      closeRelationModal();
    }
  });
  elements.relationDeleteConfirm.addEventListener("click", confirmRelationDelete);
  elements.relationDeleteCancel.addEventListener("click", closeRelationDeleteModal);
  elements.llmActivityClose.addEventListener("click", closeLlmActivityPanel);
  elements.llmActivityToggle.addEventListener("click", openLlmActivityPanel);
  elements.llmActivityStop.addEventListener("click", handlePauseCurrentLlmTask);
  elements.llmActivityResume.addEventListener("click", handleResumeCurrentLlmTask);
  elements.llmActivityDiscard.addEventListener("click", handleDiscardCurrentLlmTask);
  elements.llmTaskPauseClose.addEventListener("click", closeLlmTaskPauseModal);
  elements.llmTaskPauseResume.addEventListener("click", handleResumeCurrentLlmTask);
  elements.llmTaskPauseDiscard.addEventListener("click", handleDiscardCurrentLlmTask);
  elements.relationDeleteModal.addEventListener("click", (event) => {
    if (event.target === elements.relationDeleteModal) {
      closeRelationDeleteModal();
    }
  });
  elements.llmTaskPauseModal.addEventListener("click", (event) => {
    if (event.target === elements.llmTaskPauseModal) {
      closeLlmTaskPauseModal();
    }
  });
  window.addEventListener("resize", queueGraphRender);
  window.addEventListener("resize", syncResponsiveLayout);
  window.addEventListener("resize", () => {
    positionStorySelectionToolbar();
  });
  document.addEventListener("selectionchange", handleDocumentSelectionChange);
  document.addEventListener("scroll", scheduleGuideOverlayPosition, true);
  document.addEventListener("mousedown", handleGlobalPointerDown);
  document.addEventListener("keydown", handleGlobalKeyDown);
  setupPanelInteractions();
  setupGraphInteractions();
  setupGraphResizeObserver();
  updateChapterEstimate();
  renderCharacters();
  renderGraph();
  renderOutline();
  renderStory();
  renderBasicHistory();
  renderCharactersHistory();
  renderOutlineHistory();
  renderFavorites();
  updateRelationActionState();
  updateSectionActionState();
  updateOutputActionState();
  syncLlmActivityPanelState();
  syncSidebarProfileState();
  syncStageMarkers();
  syncResponsiveLayout();
  setStatus(
    restoredGeneratedContent
      ? "已恢复上次填写内容与已生成结果，可以继续编辑、导出或生成。"
      : "填写左侧信息后，先生成故事大纲；若不满意，可以补充反馈并重生成。",
    false,
  );
  setCurrentStage(requestedStageOverride || state.currentStage || "basic", {
    scroll: Boolean(requestedStageOverride),
    keepSelection: true,
  });
  if (requestedStageOverride) {
    clearStageOverrideFromUrl();
  }
}

function bindStageNavigation() {
  [...elements.stageNavButtons, ...elements.railStageButtons].forEach((button) => {
    button.addEventListener("click", () => {
      const stage = button.dataset.stageTarget;
      if (!stage) {
        return;
      }
      setCurrentStage(stage);
    });
  });
}

function getStageSection(stage) {
  return document.querySelector(`[data-stage-screen="${stage}"]`);
}

function setCurrentStage(stage, { scroll = false, keepSelection = false, showGuide = true } = {}) {
  if (!stage) {
    return;
  }

  const previousStage = state.currentStage;
  state.currentStage = stage;
  syncStageMarkers();
  saveWorkspaceSnapshot();
  syncGuideProgressForStage(previousStage, stage);
  if (showGuide) {
    syncTutorialGuidance();
  } else {
    clearGuidePanelMode();
    stopGuideTyping();
    clearGuideOverlay();
  }

  const section = getStageSection(stage);
  if (scroll && section) {
    section.scrollTop = 0;
  }

  if (!keepSelection) {
    closeStorySelectionToolbar({ preserveSelection: false });
  }
}

function syncStageMarkers() {
  elements.stageSections.forEach((section) => {
    section.classList.toggle("is-current", section.dataset.stageScreen === state.currentStage);
  });

  [...elements.stageNavButtons, ...elements.railStageButtons].forEach((button) => {
    button.classList.toggle("is-active", button.dataset.stageTarget === state.currentStage);
  });

  const stageMeta = STAGE_META[state.currentStage];
  if (elements.neuroStageLabel && stageMeta) {
    elements.neuroStageLabel.textContent = stageMeta.label;
  }

  syncNeuroInputState();
  syncResponsiveLayout();
}

function toggleSidebarProfile() {
  state.sidebarProfileOpen = !state.sidebarProfileOpen;
  syncSidebarProfileState();
  saveWorkspaceSnapshot();
}

function syncSidebarProfileState() {
  if (!elements.sidebar || !elements.sidebarAvatarToggle || !elements.sidebarDetailPanel) {
    return;
  }

  elements.sidebar.classList.toggle("is-panel-open", state.sidebarProfileOpen);
  elements.sidebarAvatarToggle.classList.toggle("is-active", state.sidebarProfileOpen);
  elements.sidebarAvatarToggle.setAttribute("aria-expanded", state.sidebarProfileOpen ? "true" : "false");
  elements.sidebarDetailPanel.setAttribute("aria-hidden", state.sidebarProfileOpen ? "false" : "true");
  queueGuideOverlayRefresh();
}

function renderFavorites() {
  if (!elements.favoriteList || !elements.favoriteCountBadge) {
    return;
  }

  elements.favoriteCountBadge.textContent = String(state.favoriteQuotes.length);
  if (!state.favoriteQuotes.length) {
    elements.favoriteList.innerHTML = `<div class="favorite-empty">还没有收藏句子。去正文里选中喜欢的句子试试看。</div>`;
    return;
  }

  const storyGroups = groupFavoritesByStoryAndChapter(state.favoriteQuotes);
  elements.favoriteList.innerHTML = storyGroups
    .map((storyGroup) => `
      <section class="favorite-story-group">
        <div class="favorite-story-title">${escapeHtml(storyGroup.storyTitle)}</div>
        <div class="favorite-chapter-list">
          ${storyGroup.chapters
            .map((chapterGroup) => `
              <section class="favorite-chapter-group">
                <div class="favorite-chapter-header">
                  <span class="favorite-item-tag">${escapeHtml(chapterGroup.chapterLabel)}</span>
                </div>
                <div class="favorite-quote-list">
                  ${chapterGroup.items
                    .map((item) => `
                      <article class="favorite-item">
                        <div class="favorite-item-meta">
                          <div class="favorite-item-meta-main">
                            <time>${escapeHtml(formatFavoriteTime(item.createdAt))}</time>
                          </div>
                          <button
                            type="button"
                            class="favorite-remove-button"
                            data-remove-favorite="${escapeHtml(item.id)}"
                            aria-label="删除收藏"
                            title="删除收藏"
                          >
                            删除
                          </button>
                        </div>
                        <p class="favorite-item-text">“${escapeHtml(item.text)}”</p>
                      </article>
                    `)
                    .join("")}
                </div>
              </section>
            `)
            .join("")}
        </div>
      </section>
    `)
    .join("");
}

function groupFavoritesByStoryAndChapter(favorites) {
  const defaultStoryTitle = state.generatedStory?.title || state.outline?.title || "未命名作品";
  const storyMap = new Map();

  favorites.forEach((item) => {
    const storyTitle = String(item.storyTitle || defaultStoryTitle).trim() || defaultStoryTitle;
    const chapterKey = Number.isFinite(Number(item.chapterNumber))
      ? `chapter-${Number(item.chapterNumber)}`
      : "chapter-body";
    const chapterLabel = Number.isFinite(Number(item.chapterNumber))
      ? `第${Number(item.chapterNumber)}章`
      : "正文";

    if (!storyMap.has(storyTitle)) {
      storyMap.set(storyTitle, {
        storyTitle,
        chapters: new Map(),
      });
    }

    const storyGroup = storyMap.get(storyTitle);
    if (!storyGroup.chapters.has(chapterKey)) {
      storyGroup.chapters.set(chapterKey, {
        chapterLabel,
        chapterOrder: Number.isFinite(Number(item.chapterNumber)) ? Number(item.chapterNumber) : Number.MAX_SAFE_INTEGER,
        items: [],
      });
    }

    storyGroup.chapters.get(chapterKey).items.push(item);
  });

  return Array.from(storyMap.values()).map((storyGroup) => ({
    storyTitle: storyGroup.storyTitle,
    chapters: Array.from(storyGroup.chapters.values()).sort((left, right) => left.chapterOrder - right.chapterOrder),
  }));
}

function handleFavoriteListClick(event) {
  const removeButton = event.target.closest?.("[data-remove-favorite]");
  if (!removeButton) {
    return;
  }

  const favoriteId = removeButton.dataset.removeFavorite;
  if (!favoriteId) {
    return;
  }

  removeFavoriteById(favoriteId);
}

function removeFavoriteById(favoriteId, { showToast = true, toastMessage = "已删除收藏" } = {}) {
  const favoriteQuote = state.favoriteQuotes.find((item) => item.id === favoriteId);
  if (!favoriteQuote) {
    return false;
  }

  state.favoriteQuotes = state.favoriteQuotes.filter((item) => item.id !== favoriteId);
  renderFavorites();
  removeFavoriteMarkup(favoriteQuote);
  syncStorySelectionFavoriteButtonState();
  saveWorkspaceSnapshot();
  if (showToast) {
    showFavoriteToast(toastMessage);
  }
  return true;
}

function formatFavoriteTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function setupPanelInteractions() {
  setupNeuroPanelResize();
  setupRelationshipPanelResize();
}

function setupNeuroPanelResize() {
  if (!elements.neuroDragHandle || !elements.llmActivityPanel) {
    return;
  }

  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  const minWidth = 220;
  const maxWidth = 420;
  const closeThreshold = 96;

  elements.neuroDragHandle.addEventListener("mousedown", (event) => {
    if (window.innerWidth <= 960 || !llmActivity.panelOpen) {
      return;
    }

    dragging = true;
    startX = event.clientX;
    startWidth = elements.llmActivityPanel.offsetWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    elements.llmActivityPanel.style.transition = "none";
    event.preventDefault();
  });

  document.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }

    const delta = startX - event.clientX;
    const newWidth = Math.max(0, Math.min(startWidth + delta, maxWidth));

    if (newWidth < closeThreshold) {
      closeLlmActivityPanel();
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      return;
    }

    llmActivity.panelOpen = true;
    elements.llmActivityPanel.classList.add("is-open");
    elements.llmActivityPanel.style.width = `${Math.max(minWidth, newWidth)}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) {
      return;
    }

    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    elements.llmActivityPanel.style.transition = "";

    if (llmActivity.panelOpen && elements.llmActivityPanel.offsetWidth < minWidth) {
      elements.llmActivityPanel.style.width = `${minWidth}px`;
    }
  });
}

function setupRelationshipPanelResize() {
  const handle = document.querySelector("#rel-resize-handle");
  const relationArea = document.querySelector("#rel-area");
  if (!handle || !relationArea) {
    return;
  }

  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  const minWidth = 220;

  handle.addEventListener("mousedown", (event) => {
    if (window.innerWidth <= 960 || state.currentStage !== "characters") {
      return;
    }

    dragging = true;
    startX = event.clientX;
    startWidth = relationArea.offsetWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    event.preventDefault();
  });

  document.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }

    const characterStage = getStageSection("characters");
    const charEditor = document.querySelector("#scroll-1");
    const totalWidth = characterStage?.offsetWidth || 800;
    const maxWidth = Math.floor(totalWidth * 0.5);
    const delta = startX - event.clientX;
    const nextWidth = Math.max(minWidth, Math.min(startWidth + delta, maxWidth));

    relationArea.style.width = `${nextWidth}px`;
    relationArea.style.flex = "none";
    queueGraphRender();

    if (charEditor) {
      charEditor.classList.toggle("char-compact", nextWidth >= maxWidth - 4);
    }
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) {
      return;
    }

    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

function syncResponsiveLayout() {
  const isMobile = window.innerWidth <= 960;

  if (elements.llmActivityPanel) {
    if (isMobile) {
      elements.llmActivityPanel.style.width = "";
      elements.llmActivityPanel.style.transition = "";
    } else if (llmActivity.panelOpen && elements.llmActivityPanel.style.width) {
      const width = Number.parseFloat(elements.llmActivityPanel.style.width);
      if (Number.isFinite(width)) {
        elements.llmActivityPanel.style.width = `${clamp(width, 220, 420)}px`;
      }
    }
  }

  const relationArea = document.querySelector("#rel-area");
  const charEditor = document.querySelector("#scroll-1");
  const characterStage = getStageSection("characters");
  if (!relationArea || !charEditor || !characterStage) {
    return;
  }

  if (isMobile) {
    relationArea.style.width = "";
    relationArea.style.flex = "";
    charEditor.classList.remove("char-compact");
    queueGraphRender();
    scheduleGuideOverlayPosition();
    return;
  }

  if (relationArea.style.width) {
    const totalWidth = characterStage.offsetWidth || 800;
    const maxWidth = Math.floor(totalWidth * 0.5);
    const width = clamp(Number.parseFloat(relationArea.style.width) || relationArea.offsetWidth, 220, maxWidth);
    relationArea.style.width = `${width}px`;
    relationArea.style.flex = "none";
    charEditor.classList.toggle("char-compact", width >= maxWidth - 4);
    queueGraphRender();
  } else {
    charEditor.classList.remove("char-compact");
    queueGraphRender();
  }

  scheduleGuideOverlayPosition();
}

function maybeShowInitialGuide() {
  syncTutorialGuidance();
}

function maybeShowCharacterGuide() {
  syncTutorialGuidance();
}

function maybeShowStageGuide(stage = state.currentStage, previousStage = null) {
  syncGuideProgressForStage(previousStage, stage);
  syncTutorialGuidance();
}

function getDefaultGuideProgress() {
  return {
    intro_completed: false,
    basic_flow_completed: false,
    basic_info_completed: false,
    basic_worldview_completed: false,
    characters_intro_completed: false,
    characters_graph_unlocked: false,
    characters_graph_completed: false,
    characters_ai_unlocked: false,
    characters_ai_completed: false,
    outline_intro_unlocked: false,
    outline_intro_completed: false,
    outline_tools_unlocked: false,
    outline_tools_completed: false,
    story_unlocked: false,
    story_completed: false,
  };
}

function syncGuideProgressForStage(previousStage, nextStage) {
  const progress = loadSeenGuides();
  let changed = false;

  if (
    previousStage === "basic" &&
    nextStage !== "basic" &&
    progress.basic_info_completed &&
    !progress.basic_worldview_completed
  ) {
    progress.basic_worldview_completed = true;
    changed = true;
  }

  if (previousStage === "characters" && nextStage !== "characters") {
    if (!progress.characters_intro_completed) {
      progress.characters_intro_completed = true;
      changed = true;
    }
    if (progress.characters_graph_unlocked && !progress.characters_graph_completed) {
      progress.characters_graph_completed = true;
      changed = true;
    }
    if (progress.characters_ai_unlocked && !progress.characters_ai_completed) {
      progress.characters_ai_completed = true;
      changed = true;
    }
  }

  if (nextStage === "outline" && !progress.outline_intro_unlocked) {
    progress.outline_intro_unlocked = true;
    changed = true;
  }

  if (previousStage === "outline" && nextStage !== "outline") {
    if (progress.outline_tools_unlocked && !progress.outline_tools_completed) {
      progress.outline_tools_completed = true;
      changed = true;
    }
  }

  if (previousStage === "story" && nextStage !== "story" && progress.story_unlocked && !progress.story_completed) {
    progress.story_completed = true;
    changed = true;
  }

  if (changed) {
    saveSeenGuides(progress);
  }
}

function syncTutorialGuidance(force = false) {
  const progress = loadSeenGuides();
  const activeGuide = getActiveGuideState(progress);

  if (activeGuide.panel === "intro") {
    renderGuideIntroPanel(force);
  } else {
    clearGuidePanelMode();
  }

  if (activeGuide.noteKey) {
    showGuideNote(activeGuide.noteKey, { force });
    return;
  }

  clearGuideOverlay();
}

function getActiveGuideState(progress) {
  if (!progress.intro_completed) {
    return { panel: "intro", noteKey: null };
  }

  if (state.currentStage === "basic") {
    if (!progress.basic_flow_completed) {
      return { panel: null, noteKey: "basic_flow" };
    }
    if (!progress.basic_info_completed) {
      return { panel: null, noteKey: "basic_required" };
    }
    if (!progress.basic_worldview_completed) {
      return { panel: null, noteKey: "basic_worldview" };
    }
    return { panel: null, noteKey: null };
  }

  if (state.currentStage === "characters") {
    if (progress.characters_ai_unlocked && !progress.characters_ai_completed) {
      return { panel: null, noteKey: "characters_ai" };
    }
    if (progress.characters_graph_unlocked && !progress.characters_graph_completed) {
      return { panel: null, noteKey: "characters_graph" };
    }
    if (!progress.characters_intro_completed) {
      return { panel: null, noteKey: "characters_intro" };
    }
    return { panel: null, noteKey: null };
  }

  if (state.currentStage === "outline") {
    if (progress.outline_intro_unlocked && !progress.outline_intro_completed) {
      return { panel: null, noteKey: "outline_structure" };
    }
    if (progress.outline_tools_unlocked && !progress.outline_tools_completed) {
      return { panel: null, noteKey: "outline_tools" };
    }
    return { panel: null, noteKey: null };
  }

  if (state.currentStage === "story" && progress.story_unlocked && !progress.story_completed) {
    return { panel: null, noteKey: "story_editor" };
  }

  return { panel: null, noteKey: null };
}

function renderGuideIntroPanel(force = false) {
  if (guideOverlayState.panelMode === "intro" && !force) {
    return;
  }

  stopLlmActivityWaitingLoop();
  stopLlmActivityAutoClose();
  stopGuideTyping();
  llmActivity.active = false;
  llmActivity.panelOpen = true;
  guideOverlayState.panelMode = "intro";
  guideOverlayState.introPromptReady = false;

  elements.llmActivityTitle.textContent = "Neuro";
  elements.llmActivityLog.innerHTML = "";
  setLlmActivityStatus("新手引导", { busy: false });

  if (elements.llmActivitySummary) {
    elements.llmActivitySummary.textContent = `${GUIDE_PANEL_PRIMARY_MESSAGE}\n${GUIDE_PANEL_PROMPT_MESSAGE}`;
  }

  if (elements.statusBox) {
    elements.statusBox.classList.add("is-guide-highlight");
    elements.statusBox.classList.remove("is-guide-prompt-ready");
    elements.statusBox.innerHTML = "";

    const primaryLine = document.createElement("span");
    primaryLine.className = "guide-panel-text guide-panel-line guide-panel-line--primary";

    const promptLine = document.createElement("span");
    promptLine.className = "guide-panel-text guide-panel-line guide-panel-line--prompt";

    elements.statusBox.append(primaryLine, promptLine);
    typeTextIntoElement(primaryLine, GUIDE_PANEL_PRIMARY_MESSAGE, {
      onComplete: () => {
        typeTextIntoElement(promptLine, GUIDE_PANEL_PROMPT_MESSAGE, {
          onComplete: () => {
            guideOverlayState.introPromptReady = true;
            elements.statusBox?.classList.add("is-guide-prompt-ready");
          },
        });
      },
    });
  }

  syncLlmActivityPanelState();
}

function clearGuidePanelMode() {
  guideOverlayState.panelMode = null;
  guideOverlayState.introPromptReady = false;
  elements.statusBox?.classList.remove("is-guide-highlight", "is-guide-prompt-ready");
}

function clearGuideAutoHideTimer() {
  if (guideOverlayState.autoHideTimer) {
    window.clearTimeout(guideOverlayState.autoHideTimer);
    guideOverlayState.autoHideTimer = null;
  }
}

function stopGuideTyping() {
  guideOverlayState.token += 1;
  guideOverlayState.timers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  guideOverlayState.timers = [];
  guideOverlayState.introPromptReady = false;
}

function scheduleGuideTimer(callback, delay = 0) {
  const timerId = window.setTimeout(() => {
    guideOverlayState.timers = guideOverlayState.timers.filter((item) => item !== timerId);
    callback();
  }, delay);
  guideOverlayState.timers.push(timerId);
  return timerId;
}

function prefersReducedGuideMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function typeTextIntoElement(element, text, { startDelay = 0, speed = GUIDE_TYPING_SPEED_MS, onComplete = null } = {}) {
  if (!element) {
    return;
  }

  const content = Array.from(String(text || ""));
  const token = guideOverlayState.token;
  const cursor = document.createElement("span");
  cursor.className = "guide-typing-cursor";

  if (prefersReducedGuideMotion()) {
    element.textContent = content.join("");
    if (typeof onComplete === "function") {
      onComplete();
    }
    return;
  }

  element.textContent = "";
  element.appendChild(cursor);

  let index = 0;
  const writeNext = () => {
    if (token !== guideOverlayState.token) {
      return;
    }

    if (index >= content.length) {
      cursor.remove();
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }

    index += 1;
    element.textContent = content.slice(0, index).join("");
    element.appendChild(cursor);

    const previousChar = content[index - 1];
    const delay = previousChar === "\n" ? speed * 3 : speed;
    scheduleGuideTimer(writeNext, delay);
  };

  scheduleGuideTimer(writeNext, startDelay);
}

function showGuideNote(noteKey, { force = false } = {}) {
  if (!GUIDE_NOTES[noteKey]) {
    clearGuideOverlay();
    return;
  }

  if (guideOverlayState.activeNoteKey === noteKey && guideOverlayState.activeStage === state.currentStage && !force) {
    scheduleGuideOverlayPosition();
    return;
  }

  clearGuidePanelMode();
  stopGuideTyping();
  renderGuideOverlay([{ ...GUIDE_NOTES[noteKey], key: noteKey }]);
  guideOverlayState.activeStage = state.currentStage;
  guideOverlayState.activeNoteKey = noteKey;
  scheduleGuideOverlayPosition();
  queueGuideOverlayRefresh();

  if (noteKey === "outline_structure") {
    guideOverlayState.autoHideTimer = window.setTimeout(() => {
      guideOverlayState.autoHideTimer = null;
      const progress = loadSeenGuides();
      if (!progress.outline_intro_completed) {
        progress.outline_intro_completed = true;
        saveSeenGuides(progress);
      }
      syncTutorialGuidance(true);
    }, GUIDE_OUTLINE_AUTO_CLOSE_MS);
  }
}

function renderGuideOverlay(notes) {
  clearGuideOverlay();
  if (!elements.guideOverlay || !notes.length || window.innerWidth <= 960) {
    return;
  }

  elements.guideOverlay.classList.remove("hidden");
  elements.guideOverlay.setAttribute("aria-hidden", "false");
  guideOverlayState.notes = notes.map((note, index) => {
    const arrowElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrowElement.classList.add("guide-arrow");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "guide-arrow-path");

    const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
    head.setAttribute("class", "guide-arrow-head");

    arrowElement.append(path, head);

    const noteElement = document.createElement("article");
    noteElement.className = `guide-note guide-note--${note.size || "md"}`;
    noteElement.style.setProperty("--guide-note-rotation", `${note.rotation || 0}deg`);

    const body = document.createElement("p");
    body.className = "guide-note-body";

    const textElement = document.createElement("span");
    textElement.className = "guide-note-text";
    body.appendChild(textElement);
    noteElement.appendChild(body);

    elements.guideOverlay.append(arrowElement, noteElement);
    typeTextIntoElement(textElement, note.text, {
      startDelay: index === 0 ? 0 : 120 * index,
      speed: GUIDE_TYPING_SPEED_MS,
    });

    return {
      config: note,
      arrowElement,
      arrowPath: path,
      arrowHead: head,
      noteElement,
      textElement,
    };
  });
}

function clearGuideOverlay() {
  if (guideOverlayState.positionFrame) {
    window.cancelAnimationFrame(guideOverlayState.positionFrame);
    guideOverlayState.positionFrame = 0;
  }
  clearGuideAutoHideTimer();
  guideOverlayState.notes = [];
  guideOverlayState.activeStage = null;
  guideOverlayState.activeNoteKey = null;

  if (!elements.guideOverlay) {
    return;
  }

  elements.guideOverlay.innerHTML = "";
  elements.guideOverlay.classList.add("hidden");
  elements.guideOverlay.setAttribute("aria-hidden", "true");
}

function queueGuideOverlayRefresh() {
  if (!guideOverlayState.notes.length) {
    return;
  }

  [90, 200, 360].forEach((delay) => {
    scheduleGuideTimer(() => {
      scheduleGuideOverlayPosition();
    }, delay);
  });
}

function scheduleGuideOverlayPosition() {
  if (guideOverlayState.positionFrame || !guideOverlayState.notes.length) {
    return;
  }

  guideOverlayState.positionFrame = window.requestAnimationFrame(() => {
    guideOverlayState.positionFrame = 0;
    positionGuideOverlay();
  });
}

function positionGuideOverlay() {
  if (!guideOverlayState.notes.length || state.currentStage !== guideOverlayState.activeStage) {
    clearGuideOverlay();
    return;
  }

  guideOverlayState.notes.forEach((item) => {
    const target = document.querySelector(item.config.target);
    if (!target) {
      item.noteElement.style.display = "none";
      item.arrowElement.style.display = "none";
      return;
    }

    const targetRect = target.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height || targetRect.bottom < 0 || targetRect.top > window.innerHeight) {
      item.noteElement.style.display = "none";
      item.arrowElement.style.display = "none";
      return;
    }

    item.noteElement.style.display = "";
    item.arrowElement.style.display = "";

    const noteRect = item.noteElement.getBoundingClientRect();
    const position = getGuideNotePosition(targetRect, noteRect, item.config.placement || "right");
    item.noteElement.style.left = `${position.left}px`;
    item.noteElement.style.top = `${position.top}px`;

    const placedRect = {
      left: position.left,
      top: position.top,
      width: noteRect.width,
      height: noteRect.height,
      right: position.left + noteRect.width,
      bottom: position.top + noteRect.height,
    };
    drawGuideArrow(item, placedRect, targetRect);
  });
}

function getGuideNotePosition(targetRect, noteRect, placement) {
  const gap = 26;
  let left = targetRect.right + gap;
  let top = targetRect.top + (targetRect.height - noteRect.height) / 2;

  if (placement === "top-right") {
    left = targetRect.right - noteRect.width * 0.2;
    top = targetRect.top - noteRect.height - gap;
  } else if (placement === "top-left") {
    left = targetRect.left - noteRect.width * 0.8;
    top = targetRect.top - noteRect.height - gap;
  } else if (placement === "bottom-right") {
    left = targetRect.right - noteRect.width * 0.15;
    top = targetRect.bottom + gap;
  } else if (placement === "bottom-left") {
    left = targetRect.left - noteRect.width * 0.85;
    top = targetRect.bottom + gap;
  } else if (placement === "bottom") {
    left = targetRect.left + (targetRect.width - noteRect.width) / 2;
    top = targetRect.bottom + gap;
  } else if (placement === "top") {
    left = targetRect.left + (targetRect.width - noteRect.width) / 2;
    top = targetRect.top - noteRect.height - gap;
  }

  const maxLeft = Math.max(GUIDE_VIEWPORT_MARGIN, window.innerWidth - noteRect.width - GUIDE_VIEWPORT_MARGIN);
  const maxTop = Math.max(GUIDE_VIEWPORT_MARGIN, window.innerHeight - noteRect.height - GUIDE_VIEWPORT_MARGIN);
  return {
    left: clamp(left, GUIDE_VIEWPORT_MARGIN, maxLeft),
    top: clamp(top, GUIDE_VIEWPORT_MARGIN, maxTop),
  };
}

function drawGuideArrow(item, noteRect, targetRect) {
  const targetCenter = {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + targetRect.height / 2,
  };
  const noteCenter = {
    x: noteRect.left + noteRect.width / 2,
    y: noteRect.top + noteRect.height / 2,
  };
  const start = getRectConnectionPoint(noteRect, targetCenter);
  const end = getRectConnectionPoint(targetRect, noteCenter);
  const padding = 18;
  const left = Math.min(start.x, end.x) - padding;
  const top = Math.min(start.y, end.y) - padding;
  const width = Math.max(1, Math.abs(end.x - start.x) + padding * 2);
  const height = Math.max(1, Math.abs(end.y - start.y) + padding * 2);
  const localStart = { x: start.x - left, y: start.y - top };
  const localEnd = { x: end.x - left, y: end.y - top };
  const dx = localEnd.x - localStart.x;
  const dy = localEnd.y - localStart.y;

  let control1 = { x: localStart.x + dx * 0.35, y: localStart.y };
  let control2 = { x: localEnd.x - dx * 0.35, y: localEnd.y };

  if (Math.abs(dy) > Math.abs(dx)) {
    control1 = { x: localStart.x, y: localStart.y + dy * 0.35 };
    control2 = { x: localEnd.x, y: localEnd.y - dy * 0.35 };
  }

  const angle = Math.atan2(localEnd.y - control2.y, localEnd.x - control2.x);
  const headLength = 12;
  const headSpread = Math.PI / 7;
  const headPath = [
    `M ${localEnd.x} ${localEnd.y}`,
    `L ${localEnd.x - headLength * Math.cos(angle - headSpread)} ${localEnd.y - headLength * Math.sin(angle - headSpread)}`,
    `L ${localEnd.x - headLength * Math.cos(angle + headSpread)} ${localEnd.y - headLength * Math.sin(angle + headSpread)}`,
    "Z",
  ].join(" ");

  item.arrowElement.style.left = `${left}px`;
  item.arrowElement.style.top = `${top}px`;
  item.arrowElement.setAttribute("width", `${width}`);
  item.arrowElement.setAttribute("height", `${height}`);
  item.arrowElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
  item.arrowPath.setAttribute(
    "d",
    `M ${localStart.x} ${localStart.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${localEnd.x} ${localEnd.y}`,
  );
  item.arrowHead.setAttribute("d", headPath);
}

function getRectConnectionPoint(rect, towardPoint) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = towardPoint.x - centerX;
  const dy = towardPoint.y - centerY;
  const halfWidth = rect.width / 2 || 1;
  const halfHeight = rect.height / 2 || 1;

  if (!dx && !dy) {
    return { x: centerX, y: centerY };
  }

  if (Math.abs(dx) / halfWidth > Math.abs(dy) / halfHeight) {
    const ratio = halfWidth / Math.max(Math.abs(dx), 1);
    return {
      x: centerX + Math.sign(dx) * halfWidth,
      y: centerY + dy * ratio,
    };
  }

  const ratio = halfHeight / Math.max(Math.abs(dy), 1);
  return {
    x: centerX + dx * ratio,
    y: centerY + Math.sign(dy) * halfHeight,
  };
}

function isGuideBasicInfoReady() {
  const storyType = elements.customGenre.value.trim() || state.genre;
  const synopsis = elements.synopsis.value.trim();
  return Boolean(storyType && synopsis);
}

function maybeCompleteBasicInfoGuide() {
  const progress = loadSeenGuides();
  if (progress.basic_info_completed || !progress.basic_flow_completed || !isGuideBasicInfoReady()) {
    return;
  }

  progress.basic_info_completed = true;
  saveSeenGuides(progress);
  syncTutorialGuidance(true);
}

function unlockCharactersAiGuide() {
  const progress = loadSeenGuides();
  let changed = false;

  if (!progress.characters_intro_completed) {
    progress.characters_intro_completed = true;
    changed = true;
  }
  if (!progress.characters_graph_unlocked) {
    progress.characters_graph_unlocked = true;
    changed = true;
  }
  if (!progress.characters_graph_completed) {
    progress.characters_graph_completed = true;
    changed = true;
  }
  if (!progress.characters_ai_unlocked) {
    progress.characters_ai_unlocked = true;
    changed = true;
  }
  if (!changed) {
    return;
  }

  saveSeenGuides(progress);
  syncTutorialGuidance(true);
}

function unlockOutlineToolsGuide() {
  const progress = loadSeenGuides();
  if (progress.outline_tools_unlocked) {
    return;
  }

  progress.outline_tools_unlocked = true;
  saveSeenGuides(progress);
  syncTutorialGuidance(true);
}

function unlockStoryGuide() {
  const progress = loadSeenGuides();
  if (progress.story_unlocked) {
    return;
  }

  progress.story_unlocked = true;
  saveSeenGuides(progress);
  syncTutorialGuidance(true);
}

function isGuideStageSurfaceTarget(target, stage) {
  const section = getStageSection(stage);
  return Boolean(section && target instanceof Element && section.contains(target));
}

function isGuideDismissTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest("#llm-activity-panel, .modal-overlay, #story-selection-toolbar")) {
    return false;
  }

  return true;
}

function handleGuidePointerDown(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return false;
  }

  const progress = loadSeenGuides();
  let changed = false;

  if (!progress.intro_completed) {
    if (guideOverlayState.introPromptReady && isGuideStageSurfaceTarget(target, "basic")) {
      progress.intro_completed = true;
      changed = true;
    }
  } else if (state.currentStage === "basic" && !progress.basic_flow_completed) {
    if (isGuideStageSurfaceTarget(target, "basic")) {
      progress.basic_flow_completed = true;
      changed = true;
    }
  } else if (state.currentStage === "characters" && progress.characters_ai_unlocked && !progress.characters_ai_completed) {
    if (isGuideDismissTarget(target)) {
      progress.characters_ai_completed = true;
      changed = true;
    }
  } else if (state.currentStage === "characters" && progress.characters_graph_unlocked && !progress.characters_graph_completed) {
    if (isGuideDismissTarget(target)) {
      progress.characters_graph_completed = true;
      changed = true;
    }
  } else if (state.currentStage === "characters" && !progress.characters_intro_completed) {
    if (target.closest("#rel-area, #character-graph-stage, #graph-canvas, #graph-nodes, #graph-svg")) {
      progress.characters_intro_completed = true;
      progress.characters_graph_unlocked = true;
      changed = true;
    }
  } else if (state.currentStage === "outline" && progress.outline_tools_unlocked && !progress.outline_tools_completed) {
    if (isGuideDismissTarget(target)) {
      progress.outline_tools_completed = true;
      changed = true;
    }
  } else if (state.currentStage === "story" && progress.story_unlocked && !progress.story_completed) {
    if (isGuideDismissTarget(target)) {
      progress.story_completed = true;
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  saveSeenGuides(progress);
  syncTutorialGuidance(true);
  return true;
}

function loadSeenGuides() {
  try {
    const raw = window.localStorage.getItem(STORY_GUIDE_STORAGE_KEY);
    if (!raw) {
      return getDefaultGuideProgress();
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? { ...getDefaultGuideProgress(), ...parsed }
      : getDefaultGuideProgress();
  } catch (error) {
    console.warn("读取 Neuro 引导标记失败：", error);
    return getDefaultGuideProgress();
  }
}

function saveSeenGuides(guides) {
  try {
    window.localStorage.setItem(
      STORY_GUIDE_STORAGE_KEY,
      JSON.stringify({ ...getDefaultGuideProgress(), ...(guides || {}) }),
    );
  } catch (error) {
    console.warn("保存 Neuro 引导标记失败：", error);
  }
}

function loadWorkspaceSnapshot() {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    if (!isLegacyMockWorkspace(snapshot)) {
      return snapshot;
    }

    const initialWorkspace = buildInitialWorkspaceSnapshot();
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(initialWorkspace));
    } catch (persistError) {
      console.warn("清理旧 mock 工作区缓存失败：", persistError);
    }
    return initialWorkspace;
  } catch (error) {
    console.warn("读取本地工作区缓存失败：", error);
    return null;
  }
}

function saveWorkspaceSnapshot() {
  try {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(buildWorkspaceSnapshot()),
    );
  } catch (error) {
    console.warn("保存本地工作区缓存失败：", error);
  }
}

function buildWorkspaceSnapshot() {
  syncRelationNames();
  return {
    version: 4,
    genre: state.genre,
    style: state.style,
    currentStage: state.currentStage,
    activeCharacterId: state.activeCharacterId,
    activeChapterNumber: state.activeChapterNumber,
    sidebarProfileOpen: state.sidebarProfileOpen,
    graphView: {
      scale: state.graphView.scale,
      offsetX: state.graphView.offsetX,
      offsetY: state.graphView.offsetY,
    },
    basicHistory: state.basicHistory.map((entry) => ({
      ...entry,
      snapshot: entry.snapshot ? { ...entry.snapshot } : null,
    })),
    characterHistory: state.characterHistory.map((entry) => ({
      ...entry,
      snapshot: entry.snapshot
        ? {
            activeCharacterId: entry.snapshot.activeCharacterId,
            characters: Array.isArray(entry.snapshot.characters)
              ? entry.snapshot.characters.map((character) => ({
                  ...character,
                  graph_color: character.graph_color || null,
                }))
              : [],
            relations: Array.isArray(entry.snapshot.relations)
              ? entry.snapshot.relations.map((relation) => ({
                  ...relation,
                  source_anchor: cloneAnchor(relation.source_anchor),
                  target_anchor: cloneAnchor(relation.target_anchor),
                }))
              : [],
          }
        : null,
    })),
    outlineHistory: state.outlineHistory,
    characters: state.characters.map((character) => ({
      ...character,
      graph_color: character.graph_color || null,
    })),
    relations: state.relations.map((relation) => ({
      ...relation,
      source_anchor: cloneAnchor(relation.source_anchor),
      target_anchor: cloneAnchor(relation.target_anchor),
    })),
    savedStoryDraft: state.savedStoryDraft,
    isStorySaved: state.isStorySaved,
    outline: state.outline,
    generatedStory: state.generatedStory,
    favoriteQuotes: state.favoriteQuotes.map((item) => ({ ...item })),
    form: {
      customGenre: elements.customGenre.value,
      customStyle: elements.customStyle.value,
      synopsis: elements.synopsis.value,
      totalWords: elements.totalWords.value,
      chapterWords: elements.chapterWords.value,
      worldviewTime: elements.worldviewTime.value,
      worldviewPhysical: elements.worldviewPhysical.value,
      worldviewSocial: elements.worldviewSocial.value,
      outlineFeedback: elements.outlineFeedback.value,
    },
  };
}

function applyWorkspaceSnapshot(snapshot) {
  state.genre = typeof snapshot.genre === "string" && snapshot.genre.trim() ? snapshot.genre : state.genre;
  state.style = typeof snapshot.style === "string" && snapshot.style.trim() ? snapshot.style : state.style;
  state.currentStage = typeof snapshot.currentStage === "string" && snapshot.currentStage.trim()
    ? snapshot.currentStage
    : state.currentStage;
  state.activeCharacterId = typeof snapshot.activeCharacterId === "string" && snapshot.activeCharacterId.trim()
    ? snapshot.activeCharacterId
    : null;
  state.activeChapterNumber = Number.isInteger(Number(snapshot.activeChapterNumber))
    ? Number(snapshot.activeChapterNumber)
    : null;
  state.sidebarProfileOpen = Boolean(snapshot.sidebarProfileOpen);
  state.graphView = {
    scale: clamp(Number(snapshot.graphView?.scale) || 1, GRAPH.minScale, GRAPH.maxScale),
    offsetX: Number(snapshot.graphView?.offsetX) || 0,
    offsetY: Number(snapshot.graphView?.offsetY) || 0,
  };
  state.characterCreationHistory = [];
  state.basicHistory = Array.isArray(snapshot.basicHistory)
    ? snapshot.basicHistory.map((entry) => normalizeBasicHistoryEntry(entry)).filter(Boolean)
    : [];
  state.characterHistory = Array.isArray(snapshot.characterHistory)
    ? snapshot.characterHistory.map((entry) => normalizeCharacterHistoryEntry(entry)).filter(Boolean)
    : [];
  state.outlineHistory = Array.isArray(snapshot.outlineHistory)
    ? snapshot.outlineHistory.map((entry) => normalizeOutlineHistoryEntry(entry)).filter(Boolean)
    : [];

  const persistedCharacters = Array.isArray(snapshot.characters) ? snapshot.characters : [];
  state.characters = persistedCharacters.length
    ? persistedCharacters.map((character, index) => normalizePersistedCharacter(character, index, persistedCharacters.length))
    : [createCharacter(0), createCharacter(1), createCharacter(2)];
  arrangeCharacterGraph();

  nextCharacterColorIndex = state.characters.reduce((maxIndex, character, index) => {
    const candidate = Number.isInteger(character.graph_color_index) ? character.graph_color_index + 1 : index + 1;
    return Math.max(maxIndex, candidate);
  }, 0);

  applyPersistedFormValues(snapshot.form || {});
  state.relations = Array.isArray(snapshot.relations)
    ? snapshot.relations
      .map((relation) => normalizeIncomingRelation(relation, relation?.relation_source || "user"))
      .filter(Boolean)
    : [];
  state.savedStoryDraft = snapshot.savedStoryDraft && typeof snapshot.savedStoryDraft === "object"
    ? snapshot.savedStoryDraft
    : null;
  state.isStorySaved = Boolean(snapshot.isStorySaved && state.savedStoryDraft);
  state.outline = snapshot.outline && typeof snapshot.outline === "object"
    ? normalizeOutline(snapshot.outline)
    : null;
  state.generatedStory = snapshot.generatedStory && typeof snapshot.generatedStory === "object"
    ? normalizeGeneratedStory(snapshot.generatedStory, state.outline?.title || "")
    : null;
  state.favoriteQuotes = Array.isArray(snapshot.favoriteQuotes)
    ? snapshot.favoriteQuotes.map((item) => normalizeFavoriteQuote(item)).filter(Boolean)
    : [];
  if (!getCharacterById(state.activeCharacterId)) {
    state.activeCharacterId = state.characters[0]?.id || null;
  }
  if (!findGeneratedChapter(state.activeChapterNumber)) {
    state.activeChapterNumber = state.generatedStory?.chapters?.[0]?.chapter_number || null;
  }
}

function applyPersistedFormValues(form = {}) {
  elements.customGenre.value = typeof form.customGenre === "string" ? form.customGenre : "";
  elements.customStyle.value = typeof form.customStyle === "string" ? form.customStyle : "";
  elements.synopsis.value = typeof form.synopsis === "string" ? form.synopsis : "";
  elements.totalWords.value = typeof form.totalWords === "string" && form.totalWords ? form.totalWords : elements.totalWords.value;
  elements.chapterWords.value = typeof form.chapterWords === "string" ? form.chapterWords : elements.chapterWords.value;
  elements.worldviewTime.value = typeof form.worldviewTime === "string" ? form.worldviewTime : "";
  elements.worldviewPhysical.value = typeof form.worldviewPhysical === "string" ? form.worldviewPhysical : "";
  elements.worldviewSocial.value = typeof form.worldviewSocial === "string" ? form.worldviewSocial : "";
  elements.outlineFeedback.value = typeof form.outlineFeedback === "string" ? form.outlineFeedback : "";
}

function buildBasicInfoSnapshot() {
  return normalizeBasicInfoSnapshot({
    genre: state.genre,
    style: state.style,
    customGenre: elements.customGenre.value,
    customStyle: elements.customStyle.value,
    synopsis: elements.synopsis.value,
    totalWords: elements.totalWords.value,
    chapterWords: elements.chapterWords.value,
    worldviewTime: elements.worldviewTime.value,
    worldviewPhysical: elements.worldviewPhysical.value,
    worldviewSocial: elements.worldviewSocial.value,
  });
}

function normalizeBasicInfoSnapshot(snapshot = {}) {
  return {
    genre: typeof snapshot.genre === "string" ? snapshot.genre : "",
    style: typeof snapshot.style === "string" ? snapshot.style : "",
    customGenre: typeof snapshot.customGenre === "string" ? snapshot.customGenre : "",
    customStyle: typeof snapshot.customStyle === "string" ? snapshot.customStyle : "",
    synopsis: typeof snapshot.synopsis === "string" ? snapshot.synopsis : "",
    totalWords: typeof snapshot.totalWords === "string"
      ? snapshot.totalWords
      : snapshot.totalWords == null ? "" : String(snapshot.totalWords),
    chapterWords: typeof snapshot.chapterWords === "string"
      ? snapshot.chapterWords
      : snapshot.chapterWords == null ? "" : String(snapshot.chapterWords),
    worldviewTime: typeof snapshot.worldviewTime === "string" ? snapshot.worldviewTime : "",
    worldviewPhysical: typeof snapshot.worldviewPhysical === "string" ? snapshot.worldviewPhysical : "",
    worldviewSocial: typeof snapshot.worldviewSocial === "string" ? snapshot.worldviewSocial : "",
  };
}

function buildCharacterHistorySnapshot() {
  syncRelationNames();
  return {
    activeCharacterId: state.activeCharacterId,
    characters: state.characters.map((character) => ({
      ...character,
      graph_color: character.graph_color || null,
    })),
    relations: state.relations.map((relation) => ({
      ...relation,
      source_anchor: cloneAnchor(relation.source_anchor),
      target_anchor: cloneAnchor(relation.target_anchor),
    })),
  };
}

function normalizeBasicHistoryEntry(entry) {
  if (!entry || typeof entry !== "object" || !entry.snapshot) {
    return null;
  }

  return {
    id: entry.id || generateId("basic-history"),
    createdAt: entry.createdAt || new Date().toISOString(),
    type: entry.type || "基本信息版本",
    snapshot: normalizeBasicInfoSnapshot(entry.snapshot),
  };
}

function normalizeCharacterHistoryEntry(entry) {
  if (!entry || typeof entry !== "object" || !entry.snapshot) {
    return null;
  }

  const snapshot = entry.snapshot;
  const persistedCharacters = Array.isArray(snapshot.characters) ? snapshot.characters : [];
  const characters = persistedCharacters.map((character, index) =>
    normalizePersistedCharacter(character, index, Math.max(persistedCharacters.length, 1)));
  const relations = Array.isArray(snapshot.relations)
    ? snapshot.relations
      .map((relation) => {
        const label = normalizeRelationLabel(relation?.label);
        if (!relation?.source_id || !relation?.target_id || !label || relation.source_id === relation.target_id) {
          return null;
        }
        return {
          id: relation.id || generateId("relation"),
          source_id: relation.source_id,
          target_id: relation.target_id,
          label,
          source_name: relation.source_name || "",
          target_name: relation.target_name || "",
          source_anchor: cloneAnchor(relation.source_anchor),
          target_anchor: cloneAnchor(relation.target_anchor),
          bidirectional: Boolean(relation.bidirectional),
          relation_source: relation.relation_source || "user",
        };
      })
      .filter(Boolean)
    : [];

  return {
    id: entry.id || generateId("characters-history"),
    createdAt: entry.createdAt || new Date().toISOString(),
    type: entry.type || "角色关系版本",
    snapshot: {
      activeCharacterId: typeof snapshot.activeCharacterId === "string" ? snapshot.activeCharacterId : null,
      characters,
      relations,
    },
  };
}

function normalizePersistedCharacter(character, index, total) {
  const fallbackPosition = getCharacterGraphPosition(index, Math.max(total, 1));
  const colorIndex = Number.isInteger(character?.graph_color_index) ? character.graph_color_index : index;
  return {
    id: character?.id || generateId("character"),
    name: character?.name || "",
    gender: character?.gender || "",
    age: character?.age || "",
    occupation: character?.occupation || "",
    nationality: character?.nationality || "",
    personality: character?.personality || "",
    inner_conflict: character?.inner_conflict || character?.values || "",
    strengths: character?.strengths || "",
    weaknesses: character?.weaknesses || "",
    character_arc: character?.character_arc || "",
    appearance: character?.appearance || "",
    values: character?.values || "",
    speaking_style: character?.speaking_style || "",
    core_motivation: character?.core_motivation || "",
    graph_x: Number.isFinite(Number(character?.graph_x)) ? Number(character.graph_x) : fallbackPosition.x,
    graph_y: Number.isFinite(Number(character?.graph_y)) ? Number(character.graph_y) : fallbackPosition.y,
    graph_color_index: colorIndex,
    graph_color: character?.graph_color || getCharacterGraphColorByIndex(colorIndex),
  };
}

function bindStoryDraftInputs() {
  [
    elements.customGenre,
    elements.customStyle,
    elements.synopsis,
    elements.totalWords,
    elements.chapterWords,
    elements.worldviewTime,
    elements.worldviewPhysical,
    elements.worldviewSocial,
  ].forEach((control) => {
    control.addEventListener("input", () => {
      markStoryDraftDirty();
      queueBasicHistorySnapshot("编辑基本信息");
      maybeCompleteBasicInfoGuide();
    });
  });

  elements.outlineFeedback.addEventListener("input", () => {
    markStoryDraftDirty();
  });
}

function markStoryDraftDirty({ clearGeneratedContent = false } = {}) {
  state.isStorySaved = false;
  state.savedStoryDraft = null;
  if (clearGeneratedContent) {
    clearGeneratedContentState();
  }
  updateRelationActionState();
  updateOutputActionState();
  saveWorkspaceSnapshot();
}

function clearGeneratedContentState() {
  state.outline = null;
  state.generatedStory = null;
  state.activeChapterNumber = null;
  if (elements.outlineFeedback) {
    elements.outlineFeedback.value = "";
  }
}

function updateRelationActionState() {
  const relationTaskRunning = llmTaskController.currentTask?.kind === "relations_supplement"
    && llmTaskController.currentTask?.status === "running";
  if (elements.relationSaveState) {
    elements.relationSaveState.textContent = state.isStorySaved
      ? "当前梗概、角色卡和关系网已保存，AI 只会在空白关系位上继续补充。（可以试试增加空白角色卡片~）"
      : "编辑完故事梗概、角色卡和关系网后，请先点击“保存关系”，再使用 AI 补充关系。";
    elements.relationSaveState.classList.toggle("saved", state.isStorySaved);
  }
  elements.saveRelations.disabled = relationTaskRunning;
  if (elements.supplementRelations) {
    elements.supplementRelations.disabled = relationTaskRunning || !state.isStorySaved;
  }
}

function updateSectionActionState() {
  if (elements.basicHistoryButton) {
    elements.basicHistoryButton.disabled = !state.basicHistory.length;
  }
  if (elements.charactersHistoryButton) {
    elements.charactersHistoryButton.disabled = !state.characterHistory.length;
  }
}

function updateOutputActionState() {
  const outlineTaskRunning = llmTaskController.currentTask?.kind === "outline"
    && llmTaskController.currentTask?.status === "running";
  const storyTaskRunning = llmTaskController.currentTask?.kind === "story"
    && llmTaskController.currentTask?.status === "running";
  elements.regenerateOutline.disabled = outlineTaskRunning || storyTaskRunning || !state.outline;
  elements.generateStory.disabled = outlineTaskRunning || storyTaskRunning || !state.outline;
  elements.exportOutline.disabled = !state.outline;
  elements.exportSettings.disabled = !state.outline;
  elements.exportAllStory.disabled = !state.generatedStory;
  elements.exportEverything.disabled = !state.generatedStory;
  if (elements.outlineHistory) {
    elements.outlineHistory.disabled = !state.outlineHistory.length;
  }
}

function startLlmActivityRun({ title, summary, firstStepTitle, firstStepDetail = "", waitingMessages = [] }) {
  stopLlmActivityWaitingLoop();
  stopLlmActivityAutoClose();
  llmActivity.active = true;
  llmActivity.runId += 1;
  llmActivity.panelOpen = true;
  llmActivity.waitIndex = 0;
  llmActivity.waitingMessages = waitingMessages;

  elements.llmActivityTitle.textContent = title;
  setAssistantSummary(summary);
  setLlmActivityStatus("运行中", { busy: true });
  elements.llmActivityLog.innerHTML = "";
  syncLlmActivityPanelState();

  appendLlmActivityStep(firstStepTitle, firstStepDetail, "info");
}

function appendLlmActivityStep(title, detail = "", kind = "info") {
  const item = document.createElement("li");
  item.className = `llm-activity-log-item${kind === "info" ? "" : ` is-${kind}`}`;

  const dot = document.createElement("span");
  dot.className = "llm-activity-dot";
  dot.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "llm-activity-item-body";

  const header = document.createElement("div");
  header.className = "llm-activity-item-header";

  const heading = document.createElement("div");
  heading.className = "llm-activity-item-title";
  heading.textContent = title;

  const time = document.createElement("time");
  time.className = "llm-activity-item-time";
  time.textContent = formatActivityTime(new Date());

  header.append(heading, time);
  body.appendChild(header);

  if (detail) {
    const paragraph = document.createElement("p");
    paragraph.className = "llm-activity-item-detail";
    paragraph.textContent = detail;
    body.appendChild(paragraph);
  }

  item.append(dot, body);
  elements.llmActivityLog.appendChild(item);
  elements.llmActivityLog.scrollTop = elements.llmActivityLog.scrollHeight;
}

function startLlmActivityWaitingLoop(summary, waitingMessages = []) {
  if (summary) {
    setAssistantSummary(summary);
  }
  llmActivity.waitingMessages = waitingMessages;
  llmActivity.waitIndex = 0;
  stopLlmActivityWaitingLoop();

  if (!waitingMessages.length) {
    return;
  }

  const runId = llmActivity.runId;
  llmActivity.waitTimer = window.setInterval(() => {
    if (!llmActivity.active || runId !== llmActivity.runId) {
      stopLlmActivityWaitingLoop();
      return;
    }

    const message = waitingMessages[llmActivity.waitIndex % waitingMessages.length];
    llmActivity.waitIndex += 1;
    appendLlmActivityStep(message.title, message.detail, "waiting");
  }, 2400);
}

function stopLlmActivityWaitingLoop() {
  if (llmActivity.waitTimer) {
    window.clearInterval(llmActivity.waitTimer);
    llmActivity.waitTimer = null;
  }
}

function stopLlmActivityAutoClose() {
  if (llmActivity.autoCloseTimer) {
    window.clearTimeout(llmActivity.autoCloseTimer);
    llmActivity.autoCloseTimer = null;
  }
}

function scheduleLlmActivityAutoClose(delayMs = 2000) {
  stopLlmActivityAutoClose();
  llmActivity.autoCloseTimer = window.setTimeout(() => {
    llmActivity.autoCloseTimer = null;
    if (!llmActivity.active) {
      closeLlmActivityPanel();
    }
  }, delayMs);
}

function finishLlmActivityRun(message, kind = "success") {
  stopLlmActivityWaitingLoop();
  stopLlmActivityAutoClose();
  llmActivity.active = false;
  llmActivity.panelOpen = true;
  setLlmActivityStatus(
    kind === "error" ? "出错了" : kind === "stopped" ? "已停止" : "已完成",
    { busy: false },
  );
  setAssistantSummary(message);
  syncLlmActivityPanelState();
  appendLlmActivityStep(
    kind === "error" ? "本次运行中断" : kind === "stopped" ? "本次运行已放弃" : "本次运行完成",
    message,
    kind === "stopped" ? "stopped" : kind,
  );
}

function closeLlmActivityPanel() {
  llmActivity.panelOpen = false;
  if (elements.llmActivityPanel) {
    elements.llmActivityPanel.style.width = "";
    elements.llmActivityPanel.style.transition = "";
  }
  syncLlmActivityPanelState();
}

function openLlmActivityPanel() {
  stopLlmActivityAutoClose();
  llmActivity.panelOpen = true;
  syncLlmActivityPanelState();
}

function syncLlmActivityPanelState() {
  elements.llmActivityPanel.classList.toggle("is-open", llmActivity.panelOpen);
  elements.llmActivityToggle.classList.toggle("is-busy", llmActivity.active);
  elements.llmActivityToggle.classList.toggle("hidden", llmActivity.panelOpen);
  elements.llmActivityToggle.setAttribute(
    "aria-label",
    llmActivity.active ? "展开 AI 运行面板（当前正在运行）" : "展开 AI 运行面板",
  );
  elements.llmActivityToggle.title = llmActivity.active ? "展开 AI 运行面板（当前正在运行）" : "展开 AI 运行面板";
  queueGuideOverlayRefresh();
}

function setLlmActivityStatus(label, { busy = false, paused = false } = {}) {
  if (elements.llmActivityStatus) {
    elements.llmActivityStatus.textContent = label;
    elements.llmActivityStatus.classList.toggle("busy", busy);
    elements.llmActivityStatus.classList.toggle("paused", paused);
  }
  if (elements.statusPill) {
    elements.statusPill.textContent = label;
    elements.statusPill.classList.toggle("busy", busy);
    elements.statusPill.classList.toggle("paused", paused);
  }
}

function setAssistantSummary(message) {
  clearGuidePanelMode();
  stopGuideTyping();
  clearGuideOverlay();
  if (elements.llmActivitySummary) {
    elements.llmActivitySummary.textContent = message;
  }
  if (elements.statusBox) {
    elements.statusBox.textContent = message;
  }
}

function updateLlmTaskActionState() {
  const task = llmTaskController.currentTask;
  const isRunning = task?.status === "running";
  const isPaused = task?.status === "paused";
  const disableActions = Boolean(task?.actionPending);

  elements.llmActivityActions.classList.toggle("hidden", !task || (!isRunning && !isPaused));
  elements.llmActivityStop.classList.toggle("hidden", !isRunning);
  elements.llmActivityResume.classList.toggle("hidden", !isPaused);
  elements.llmActivityDiscard.classList.toggle("hidden", !isPaused);

  elements.llmActivityStop.disabled = !isRunning || disableActions;
  elements.llmActivityResume.disabled = !isPaused || disableActions;
  elements.llmActivityDiscard.disabled = !isPaused || disableActions;
  elements.llmTaskPauseResume.disabled = !isPaused || disableActions;
  elements.llmTaskPauseDiscard.disabled = !isPaused || disableActions;
}

function closeLlmTaskPauseModal() {
  elements.llmTaskPauseModal.classList.add("hidden");
  elements.llmTaskPauseModal.setAttribute("aria-hidden", "true");
}

function openLlmTaskPauseModal(message = "") {
  elements.llmTaskPauseMessage.textContent = message
    || "当前 LLM 调用已经暂停。你可以先返回编辑；若选择继续，将按暂停前的输入重新发起本次生成。";
  elements.llmTaskPauseModal.classList.remove("hidden");
  elements.llmTaskPauseModal.setAttribute("aria-hidden", "false");
}

function hasBlockingLlmTask() {
  const status = llmTaskController.currentTask?.status;
  return ["running", "paused"].includes(status);
}

function ensureNoBlockingLlmTask() {
  if (!hasBlockingLlmTask()) {
    return true;
  }

  const message = llmTaskController.currentTask?.status === "paused"
    ? "当前有一项已暂停的生成任务，请先在 AI 运行面板中继续或放弃本次生成。"
    : "当前已有生成任务正在运行，请等待完成，或先点击“停止生成”。";
  openLlmActivityPanel();
  setStatus(message, false, true);
  return false;
}

function stopLlmTaskPolling() {
  if (llmTaskController.pollTimer) {
    window.clearInterval(llmTaskController.pollTimer);
    llmTaskController.pollTimer = null;
  }
  llmTaskController.pollInFlight = false;
}

function startLlmTaskPolling() {
  stopLlmTaskPolling();
  llmTaskController.pollTimer = window.setInterval(() => {
    void pollCurrentLlmTask();
  }, LLM_TASK_POLL_INTERVAL_MS);
}

async function pollCurrentLlmTask() {
  const task = llmTaskController.currentTask;
  if (!task || task.status !== "running" || llmTaskController.pollInFlight) {
    return;
  }

  llmTaskController.pollInFlight = true;
  try {
    const response = await getJson(`/api/llm-tasks/${task.taskId}`);
    await handleCurrentLlmTaskStatus(response);
  } catch (error) {
    finalizeCurrentLlmTask();
    closeLlmTaskPauseModal();
    task.restoreUi();
    setStatus(error.message || "获取生成任务状态失败。", false, true);
    finishLlmActivityRun(error.message || "获取生成任务状态失败。", "error");
  } finally {
    llmTaskController.pollInFlight = false;
  }
}

function registerLlmTask(taskStatus, taskConfig) {
  llmTaskController.currentTask = {
    taskId: taskStatus.task_id,
    kind: taskStatus.kind,
    status: taskStatus.status,
    busyMessage: taskConfig.busyMessage,
    runningSummary: taskConfig.runningSummary,
    waitingMessages: taskConfig.waitingMessages,
    pausedSummary: taskConfig.pausedSummary,
    discardSummary: taskConfig.discardSummary,
    discardStatusMessage: taskConfig.discardStatusMessage,
    restoreUi: taskConfig.restoreUi,
    onCompleted: taskConfig.onCompleted,
    actionPending: false,
  };
  updateLlmTaskActionState();
  startLlmTaskPolling();
}

function finalizeCurrentLlmTask() {
  stopLlmTaskPolling();
  llmTaskController.currentTask = null;
  updateLlmTaskActionState();
}

async function handleCurrentLlmTaskStatus(taskStatus) {
  const task = llmTaskController.currentTask;
  if (!task || task.taskId !== taskStatus.task_id) {
    return;
  }

  if (taskStatus.status === "running") {
    task.status = "running";
    task.actionPending = false;
    updateLlmTaskActionState();
    return;
  }

  if (taskStatus.status === "paused") {
    stopLlmTaskPolling();
    task.status = "paused";
    task.actionPending = false;
    llmActivity.active = false;
    stopLlmActivityWaitingLoop();
    setLlmActivityStatus("已暂停", { paused: true });
    elements.llmActivitySummary.textContent = task.pausedSummary;
    updateLlmTaskActionState();
    syncLlmActivityPanelState();
    appendLlmActivityStep(
      "本次生成已暂停",
      "你可以先返回编辑；若继续，将按暂停前的输入重新发起本次 LLM 调用。",
      "info",
    );
    task.restoreUi();
    setPausedState("本次生成已暂停。你可以先返回编辑，之后再决定继续还是放弃。");
    openLlmTaskPauseModal(task.pausedSummary);
    return;
  }

  if (taskStatus.status === "completed") {
    const result = taskStatus.result || {};
    finalizeCurrentLlmTask();
    closeLlmTaskPauseModal();
    task.restoreUi();
    task.onCompleted(result);
    return;
  }

  if (taskStatus.status === "discarded") {
    finalizeCurrentLlmTask();
    closeLlmTaskPauseModal();
    task.restoreUi();
    setStatus(task.discardStatusMessage, false);
    finishLlmActivityRun(task.discardSummary, "stopped");
    return;
  }

  finalizeCurrentLlmTask();
  closeLlmTaskPauseModal();
  task.restoreUi();
  setStatus(taskStatus.error || "LLM 任务失败。", false, true);
  finishLlmActivityRun(taskStatus.error || "LLM 任务失败。", "error");
}

async function createManagedLlmTask(createUrl, payload, taskConfig) {
  const taskStatus = await postJson(createUrl, payload);
  registerLlmTask(taskStatus, taskConfig);
}

async function handlePauseCurrentLlmTask() {
  const task = llmTaskController.currentTask;
  if (!task || task.status !== "running" || task.actionPending) {
    return;
  }

  task.actionPending = true;
  updateLlmTaskActionState();
  appendLlmActivityStep("正在暂停本次生成", "将停止当前 LLM 调用，并保留本次任务供你稍后继续或放弃。", "waiting");

  try {
    const response = await postJson(`/api/llm-tasks/${task.taskId}/pause`, {});
    await handleCurrentLlmTaskStatus(response);
  } catch (error) {
    task.actionPending = false;
    updateLlmTaskActionState();
    setStatus(error.message || "暂停生成任务失败。", false, true);
    appendLlmActivityStep("暂停失败", error.message || "暂停生成任务失败。", "error");
  }
}

async function handleResumeCurrentLlmTask() {
  const task = llmTaskController.currentTask;
  if (!task || task.status !== "paused" || task.actionPending) {
    return;
  }

  task.actionPending = true;
  updateLlmTaskActionState();
  closeLlmTaskPauseModal();
  appendLlmActivityStep("继续本次生成", "将按暂停前的输入重新发起本次 LLM 调用。", "info");

  try {
    const response = await postJson(`/api/llm-tasks/${task.taskId}/resume`, {});
    task.status = "running";
    task.actionPending = false;
    llmActivity.active = true;
    setLlmActivityStatus("运行中", { busy: true });
    elements.llmActivitySummary.textContent = task.runningSummary;
    syncLlmActivityPanelState();
    startLlmActivityWaitingLoop(task.runningSummary, task.waitingMessages);
    setBusyState(task.busyMessage);
    updateLlmTaskActionState();
    startLlmTaskPolling();
    await handleCurrentLlmTaskStatus(response);
  } catch (error) {
    task.actionPending = false;
    updateLlmTaskActionState();
    setStatus(error.message || "继续本次生成失败。", false, true);
    appendLlmActivityStep("继续失败", error.message || "继续本次生成失败。", "error");
  }
}

async function handleDiscardCurrentLlmTask() {
  const task = llmTaskController.currentTask;
  if (!task || task.status !== "paused" || task.actionPending) {
    return;
  }

  task.actionPending = true;
  updateLlmTaskActionState();
  closeLlmTaskPauseModal();
  appendLlmActivityStep("放弃本次生成", "当前暂停任务将被丢弃，你可以返回编辑后重新发起。", "info");

  try {
    const response = await postJson(`/api/llm-tasks/${task.taskId}/discard`, {});
    await handleCurrentLlmTaskStatus(response);
  } catch (error) {
    task.actionPending = false;
    updateLlmTaskActionState();
    setStatus(error.message || "放弃本次生成失败。", false, true);
    appendLlmActivityStep("放弃失败", error.message || "放弃本次生成失败。", "error");
  }
}

function formatActivityTime(date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function buildRelationSupplementWaitingMessages() {
  return [
    {
      title: "正在比对已有关系",
      detail: "模型会优先避开你已经保存过的关系方向，不覆盖现有结果。",
    },
    {
      title: "正在推断互动张力",
      detail: "模型正在结合梗概与角色卡，寻找更有剧情推动力的关系补充点。",
    },
    {
      title: "正在生成关系 JSON",
      detail: "模型正在把补充关系整理成可回写到关系网的结构化结果。",
    },
  ];
}

function buildOutlineWaitingMessages(isRegeneration) {
  return [
    {
      title: isRegeneration ? "正在参考上一版大纲" : "正在综合人物关系",
      detail: isRegeneration
        ? "模型正在对照你给出的反馈与上一版结构，重新取舍冲突和节奏。"
        : "模型正在把梗概、角色卡和关系网折叠进故事主线。",
    },
    {
      title: "正在规划四段式结构",
      detail: "模型正在分配开端、发展、高潮、结局的篇幅与情节递进。",
    },
    {
      title: "正在生成逐章规划",
      detail: "模型正在为每一章安排摘要、关键事件和章末收束。",
    },
    {
      title: "正在整理返回格式",
      detail: "模型正在把大纲压成结构化 JSON，准备回传到页面。",
    },
  ];
}

function buildStoryWaitingMessages(chapterCount) {
  const count = Math.max(1, Number(chapterCount) || 1);
  const messages = [
    {
      title: "正在读取大纲与人物关系",
      detail: "模型正在把四段式结构、章节规划与角色关系转成正文写作上下文。",
    },
    {
      title: "正在推进前段章节",
      detail: `模型正在铺设开场与前几章的叙事节奏，预计总共处理 ${count} 章。`,
    },
  ];

  if (count >= 4) {
    messages.push({
      title: "正在推进中段章节",
      detail: "模型正在衔接人物弧光、关系变化和主要情节转折。",
    });
  }

  if (count >= 7) {
    messages.push({
      title: "正在推进后段章节",
      detail: "模型正在收束伏笔、调整高潮后的节奏与结局落点。",
    });
  }

  messages.push(
    {
      title: "正在整理章节连续性",
      detail: "模型正在检查章节之间的人物状态、事件承接和叙事连贯性。",
    },
    {
      title: "正在封装全文结果",
      detail: "模型正在把各章摘要与正文打包成最终返回结构。",
    },
  );

  return messages;
}

function renderChipGroup(container, options, key) {
  container.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip ${state[key] === option ? "active" : ""}`;
    button.textContent = option;
    button.addEventListener("click", () => {
      state[key] = option;
      renderChipGroup(container, options, key);
      markStoryDraftDirty();
      queueBasicHistorySnapshot(key === "genre" ? "切换故事类型" : "切换语言风格");
      maybeCompleteBasicInfoGuide();
    });
    container.appendChild(button);
  });
}

function updateChapterEstimate() {
  const totalWords = Number(elements.totalWords.value) || 0;
  const chapterWords = Number(elements.chapterWords.value) || 2000;
  const count = Math.max(1, Math.ceil(totalWords / (chapterWords || 1)));
  elements.chapterCount.textContent = `${count} 章`;
}

function queueBasicHistorySnapshot(type = "编辑基本信息") {
  window.clearTimeout(basicHistoryTimer);
  basicHistoryTimer = window.setTimeout(() => {
    pushBasicHistoryEntry(type);
  }, HISTORY_DEBOUNCE_MS);
}

function queueCharacterHistorySnapshot(type = "编辑角色关系") {
  window.clearTimeout(characterHistoryTimer);
  characterHistoryTimer = window.setTimeout(() => {
    pushCharacterHistoryEntry(type);
  }, HISTORY_DEBOUNCE_MS);
}

function pushBasicHistoryEntry(type = "基本信息版本", { force = false } = {}) {
  const snapshot = buildBasicInfoSnapshot();
  if (!force && isSameHistorySnapshot(state.basicHistory[0]?.snapshot, snapshot)) {
    return;
  }

  state.basicHistory = [
    {
      id: generateId("basic-history"),
      createdAt: new Date().toISOString(),
      type,
      snapshot,
    },
    ...state.basicHistory,
  ].slice(0, HISTORY_LIMIT);
  renderBasicHistory();
  updateSectionActionState();
  saveWorkspaceSnapshot();
}

function pushCharacterHistoryEntry(type = "角色关系版本", { force = false } = {}) {
  const snapshot = buildCharacterHistorySnapshot();
  if (!force && isSameHistorySnapshot(state.characterHistory[0]?.snapshot, snapshot)) {
    return;
  }

  state.characterHistory = [
    {
      id: generateId("characters-history"),
      createdAt: new Date().toISOString(),
      type,
      snapshot,
    },
    ...state.characterHistory,
  ].slice(0, HISTORY_LIMIT);
  renderCharactersHistory();
  updateSectionActionState();
  saveWorkspaceSnapshot();
}

function isSameHistorySnapshot(left, right) {
  try {
    return JSON.stringify(left || null) === JSON.stringify(right || null);
  } catch (error) {
    return false;
  }
}

function truncateText(value, maxLength = 36) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function getBasicTypeLabel(snapshot) {
  return String(snapshot?.customGenre || "").trim() || String(snapshot?.genre || "").trim() || "未设置";
}

function getBasicStyleLabel(snapshot) {
  return String(snapshot?.customStyle || "").trim() || String(snapshot?.style || "").trim() || "未设置";
}

function buildBasicHistoryPreview(snapshot) {
  return [
    `类型：${getBasicTypeLabel(snapshot)}`,
    `风格：${getBasicStyleLabel(snapshot)}`,
    `梗概：${truncateText(snapshot?.synopsis, 40) || "未填写"}`,
  ].join("｜");
}

function buildCharactersHistoryPreview(snapshot) {
  const characters = Array.isArray(snapshot?.characters) ? snapshot.characters : [];
  const relations = Array.isArray(snapshot?.relations) ? snapshot.relations : [];
  const names = characters
    .map((character) => String(character?.name || "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("、");
  return `${characters.length} 名角色｜${relations.length} 条关系${names ? `｜${names}` : ""}`;
}

function renderBasicHistory() {
  if (!elements.basicHistoryList) {
    return;
  }

  if (!state.basicHistory.length) {
    elements.basicHistoryList.innerHTML = `<div class="outline-history-entry"><p>还没有基本信息历史记录。你每次修改并停顿片刻后，这里都会自动保存一个版本。</p></div>`;
    updateSectionActionState();
    return;
  }

  elements.basicHistoryList.innerHTML = state.basicHistory
    .map((entry, index) => `
      <article class="outline-history-entry">
        <div class="outline-history-entry-header">
          <strong>${escapeHtml(entry.type || `基本信息版本 ${index + 1}`)}</strong>
          <span>${escapeHtml(formatHistoryTime(entry.createdAt))}</span>
        </div>
        <p>${escapeHtml(buildBasicHistoryPreview(entry.snapshot))}</p>
        <div class="action-row">
          <button type="button" class="ghost-button" data-basic-history-restore="${entry.id}">恢复为当前版本</button>
          <button type="button" class="ghost-button" data-basic-history-export="${entry.id}">导出这一版</button>
        </div>
      </article>
    `)
    .join("");

  elements.basicHistoryList.querySelectorAll("[data-basic-history-restore]").forEach((button) => {
    button.addEventListener("click", () => {
      restoreBasicHistoryEntry(button.dataset.basicHistoryRestore);
    });
  });
  elements.basicHistoryList.querySelectorAll("[data-basic-history-export]").forEach((button) => {
    button.addEventListener("click", () => {
      void exportBasicHistoryEntry(button.dataset.basicHistoryExport);
    });
  });

  updateSectionActionState();
}

function renderCharactersHistory() {
  if (!elements.charactersHistoryList) {
    return;
  }

  if (!state.characterHistory.length) {
    elements.charactersHistoryList.innerHTML = `<div class="outline-history-entry"><p>还没有角色关系历史记录。角色档案或关系网发生变化后，这里会自动保存一个版本。</p></div>`;
    updateSectionActionState();
    return;
  }

  elements.charactersHistoryList.innerHTML = state.characterHistory
    .map((entry, index) => `
      <article class="outline-history-entry">
        <div class="outline-history-entry-header">
          <strong>${escapeHtml(entry.type || `角色关系版本 ${index + 1}`)}</strong>
          <span>${escapeHtml(formatHistoryTime(entry.createdAt))}</span>
        </div>
        <p>${escapeHtml(buildCharactersHistoryPreview(entry.snapshot))}</p>
        <div class="action-row">
          <button type="button" class="ghost-button" data-characters-history-restore="${entry.id}">恢复为当前版本</button>
          <button type="button" class="ghost-button" data-characters-history-export="${entry.id}">导出这一版</button>
        </div>
      </article>
    `)
    .join("");

  elements.charactersHistoryList.querySelectorAll("[data-characters-history-restore]").forEach((button) => {
    button.addEventListener("click", () => {
      restoreCharacterHistoryEntry(button.dataset.charactersHistoryRestore);
    });
  });
  elements.charactersHistoryList.querySelectorAll("[data-characters-history-export]").forEach((button) => {
    button.addEventListener("click", () => {
      void exportCharacterHistoryEntry(button.dataset.charactersHistoryExport);
    });
  });

  updateSectionActionState();
}

function openBasicHistoryModal() {
  window.clearTimeout(basicHistoryTimer);
  pushBasicHistoryEntry("最近修改");
  renderBasicHistory();
  elements.basicHistoryModal.classList.remove("hidden");
  elements.basicHistoryModal.setAttribute("aria-hidden", "false");
}

function closeBasicHistoryModal() {
  elements.basicHistoryModal.classList.add("hidden");
  elements.basicHistoryModal.setAttribute("aria-hidden", "true");
}

function openCharactersHistoryModal() {
  window.clearTimeout(characterHistoryTimer);
  pushCharacterHistoryEntry("最近修改");
  renderCharactersHistory();
  elements.charactersHistoryModal.classList.remove("hidden");
  elements.charactersHistoryModal.setAttribute("aria-hidden", "false");
}

function closeCharactersHistoryModal() {
  elements.charactersHistoryModal.classList.add("hidden");
  elements.charactersHistoryModal.setAttribute("aria-hidden", "true");
}

function applyBasicInfoSnapshot(snapshot) {
  const normalized = normalizeBasicInfoSnapshot(snapshot);
  state.genre = normalized.genre;
  state.style = normalized.style;
  elements.customGenre.value = normalized.customGenre;
  elements.customStyle.value = normalized.customStyle;
  elements.synopsis.value = normalized.synopsis;
  elements.totalWords.value = normalized.totalWords || "12000";
  elements.chapterWords.value = normalized.chapterWords;
  elements.worldviewTime.value = normalized.worldviewTime;
  elements.worldviewPhysical.value = normalized.worldviewPhysical;
  elements.worldviewSocial.value = normalized.worldviewSocial;
  renderChipGroup(elements.genreOptions, GENRE_OPTIONS, "genre");
  renderChipGroup(elements.styleOptions, STYLE_OPTIONS, "style");
  updateChapterEstimate();
}

function restoreBasicHistoryEntry(entryId) {
  const entry = state.basicHistory.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  window.clearTimeout(basicHistoryTimer);
  applyBasicInfoSnapshot(entry.snapshot);
  markStoryDraftDirty({ clearGeneratedContent: true });
  renderOutline();
  renderStory();
  closeBasicHistoryModal();
  setStatus("已恢复历史基本信息版本。由于设定已变更，当前大纲和正文已清空。", false);
  setCurrentStage("basic", { showGuide: false });
}

function applyCharacterHistorySnapshot(snapshot) {
  const historySnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  const persistedCharacters = Array.isArray(historySnapshot.characters) ? historySnapshot.characters : [];
  state.characters = persistedCharacters.length
    ? persistedCharacters.map((character, index) =>
      normalizePersistedCharacter(character, index, Math.max(persistedCharacters.length, 1)))
    : [createCharacter(0), createCharacter(1), createCharacter(2)];
  arrangeCharacterGraph();
  nextCharacterColorIndex = state.characters.reduce((maxIndex, character, index) => {
    const candidate = Number.isInteger(character.graph_color_index) ? character.graph_color_index + 1 : index + 1;
    return Math.max(maxIndex, candidate);
  }, 0);
  state.activeCharacterId = typeof historySnapshot.activeCharacterId === "string"
    && state.characters.some((character) => character.id === historySnapshot.activeCharacterId)
    ? historySnapshot.activeCharacterId
    : state.characters[0]?.id || null;
  state.relations = Array.isArray(historySnapshot.relations)
    ? historySnapshot.relations
      .map((relation) => normalizeIncomingRelation(relation, relation?.relation_source || "user"))
      .filter(Boolean)
    : [];
  syncRelationNames();
  renderCharacters();
  renderGraph();
}

function restoreCharacterHistoryEntry(entryId) {
  const entry = state.characterHistory.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  window.clearTimeout(characterHistoryTimer);
  applyCharacterHistorySnapshot(entry.snapshot);
  markStoryDraftDirty({ clearGeneratedContent: true });
  renderOutline();
  renderStory();
  closeCharactersHistoryModal();
  setStatus("已恢复历史角色关系版本。由于设定已变更，当前大纲和正文已清空。", false);
  setCurrentStage("characters", { showGuide: false });
}

function renderCharacters() {
  elements.characterList.innerHTML = "";
  if (!state.characters.length) {
    return;
  }

  if (!getCharacterById(state.activeCharacterId)) {
    state.activeCharacterId = state.characters[0]?.id || null;
  }

  const tabs = document.createElement("div");
  tabs.className = "character-tabs";
  const mainRow = document.createElement("div");
  mainRow.className = "character-tab-row character-tab-row-main";
  const overflowRows = new Map();

  state.characters.forEach((character, index) => {
    const color = getCharacterGraphColor(character, index);
    const button = createCharacterTabButton(character, index, color);
    const rowIndex = Math.floor(index / 10);
    if (rowIndex === 0) {
      mainRow.appendChild(button);
      return;
    }

    if (!overflowRows.has(rowIndex)) {
      const overflowRow = document.createElement("div");
      overflowRow.className = "character-tab-row character-tab-row-overflow";
      overflowRows.set(rowIndex, overflowRow);
    }
    overflowRows.get(rowIndex).appendChild(button);
  });

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "character-tab character-tab-add";
  addButton.textContent = "+";
  addButton.style.background = "#e3f6d2";
  addButton.style.zIndex = "1";
  addButton.addEventListener("click", () => {
    elements.addCharacter.click();
  });
  mainRow.appendChild(addButton);

  const orderedOverflowRows = Array.from(overflowRows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row);
  if (orderedOverflowRows.length) {
    tabs.classList.add("has-overflow-row");
    tabs.append(...orderedOverflowRows, mainRow);
  } else {
    tabs.appendChild(mainRow);
  }

  const activeCharacter = getCharacterById(state.activeCharacterId) || state.characters[0];
  const activeIndex = state.characters.findIndex((character) => character.id === activeCharacter.id);
  const activeColor = getCharacterGraphColor(activeCharacter, activeIndex);

  const card = document.createElement("section");
  card.className = "character-dossier-card";
  card.style.borderColor = activeColor.stroke;

  const scroll = document.createElement("div");
  scroll.className = "character-dossier-scroll";

  CHARACTER_DOSSIER_FIELDS.forEach((fieldConfig) => {
    const wrapper = document.createElement("div");
    wrapper.className = `character-field ${fieldConfig.span === "full" ? "span-full" : ""}`;

    const header = document.createElement("div");
    header.className = "character-field-header";
    const labelNode = document.createElement("label");
    labelNode.textContent = fieldConfig.label;
    header.appendChild(labelNode);
    if (fieldConfig.hint) {
      const hint = document.createElement("span");
      hint.className = "character-field-hint";
      hint.textContent = `（${fieldConfig.hint}）`;
      header.appendChild(hint);
    }

    const control = document.createElement(fieldConfig.type === "textarea" ? "textarea" : "input");
    control.value = activeCharacter[fieldConfig.key] || "";
    control.placeholder = fieldConfig.label;
    if (fieldConfig.type === "textarea") {
      control.rows = fieldConfig.key === "appearance" ? 4 : 3;
    } else {
      control.type = "text";
    }

    control.addEventListener("input", (event) => {
      activeCharacter[fieldConfig.key] = event.target.value;
      syncRelationNames();
      if (fieldConfig.key === "name") {
        const activeTabLabel = elements.characterList.querySelector(`.character-tab[data-id="${activeCharacter.id}"] span`);
        if (activeTabLabel) {
          activeTabLabel.textContent = activeCharacter.name || `角色${activeIndex + 1}`;
        }
      }
      renderGraph();
      markStoryDraftDirty();
      queueCharacterHistorySnapshot(fieldConfig.key === "name" ? "编辑角色姓名" : "编辑角色档案");
    });

    wrapper.append(header, control);
    scroll.appendChild(wrapper);
  });

  card.appendChild(scroll);
  elements.characterList.append(tabs, card);
}

function createCharacterTabButton(character, index, color) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `character-tab ${state.activeCharacterId === character.id ? "is-active" : ""}`;
  button.dataset.id = character.id;
  button.style.background = color.fill;
  button.style.zIndex = state.activeCharacterId === character.id ? "6" : String(index + 1);
  button.innerHTML = `
    <span>${escapeHtml(character.name || `角色${index + 1}`)}</span>
    <span class="character-tab-remove" aria-hidden="true">&times;</span>
  `;
  button.addEventListener("click", () => {
    state.activeCharacterId = character.id;
    renderCharacters();
    saveWorkspaceSnapshot();
  });

  const removeButton = button.querySelector(".character-tab-remove");
  removeButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.characters.length <= 1) {
      return;
    }
    removeCharacter(character.id);
  });

  return button;
}

function addCharacter() {
  const character = createCharacter(state.characters.length);
  state.characters.push(character);
  state.activeCharacterId = character.id;
  state.characterCreationHistory.push(character.id);
  arrangeCharacterGraph();
  renderCharacters();
  renderGraph();
  markStoryDraftDirty();
  queueCharacterHistorySnapshot("新增角色");
}

function removeCharacter(characterId) {
  state.characters = state.characters.filter((character) => character.id !== characterId);
  state.characterCreationHistory = state.characterCreationHistory.filter((id) => id !== characterId);
  state.relations = state.relations.filter(
    (relation) => relation.source_id !== characterId && relation.target_id !== characterId,
  );
  if (state.pendingEdge?.sourceId === characterId || state.pendingEdge?.candidateTargetId === characterId) {
    state.pendingEdge = null;
  }
  if (
    state.relationEditor &&
    (state.relationEditor.sourceId === characterId || state.relationEditor.targetId === characterId)
  ) {
    closeRelationModal();
  }
  if (state.activeCharacterId === characterId) {
    state.activeCharacterId = state.characters[0]?.id || null;
  }
  arrangeCharacterGraph();
  syncRelationNames();
  renderCharacters();
  renderGraph();
  markStoryDraftDirty();
  queueCharacterHistorySnapshot("删除角色");
}

function setupGraphInteractions() {
  elements.graphCanvas.addEventListener("mousedown", preventGraphMiddleMouseScroll);
  elements.graphCanvas.addEventListener("pointerdown", handleGraphPointerDown);
  elements.graphCanvas.addEventListener("pointermove", handleGraphPointerMove);
  elements.graphWrap.addEventListener("wheel", handleGraphWheel, { passive: false });
  window.addEventListener("pointerup", handleGlobalPointerUp);
  window.addEventListener("pointercancel", handlePendingEdgeCancel);
}

function preventGraphMiddleMouseScroll(event) {
  if (event.button === 1) {
    event.preventDefault();
  }
}

function handleGraphPointerDown(event) {
  if (event.button === 1) {
    startGraphPan(event);
    return;
  }

  if (event.button !== 0) {
    return;
  }

  maybeShowCharacterGuide();

  const point = getGraphPointFromClient(event.clientX, event.clientY);
  const source = findCharacterAtGraphPoint(point.x, point.y);
  if (!source) {
    return;
  }

  event.preventDefault();
  if (typeof elements.graphCanvas.setPointerCapture === "function") {
    elements.graphCanvas.setPointerCapture(event.pointerId);
  }

  state.pendingEdge = {
    sourceId: source.id,
    pointerId: event.pointerId,
    currentPoint: point,
    candidateTargetId: null,
  };
  renderGraph();
}

function handleGraphPointerMove(event) {
  if (state.graphPan?.pointerId === event.pointerId) {
    state.graphView.offsetX = state.graphPan.startOffsetX + (event.clientX - state.graphPan.startClientX);
    state.graphView.offsetY = state.graphPan.startOffsetY + (event.clientY - state.graphPan.startClientY);
    applyGraphViewport();
    return;
  }

  if (!state.pendingEdge || state.pendingEdge.pointerId !== event.pointerId) {
    return;
  }

  const point = getGraphPointFromClient(event.clientX, event.clientY);
  const hoveredTarget = findCharacterAtGraphPoint(point.x, point.y);
  state.pendingEdge.currentPoint = point;
  state.pendingEdge.candidateTargetId =
    hoveredTarget && hoveredTarget.id !== state.pendingEdge.sourceId ? hoveredTarget.id : null;
  renderGraph();
}

function handleGlobalPointerUp(event) {
  if (state.graphPan?.pointerId === event.pointerId) {
    finishGraphPan(event.pointerId);
    saveWorkspaceSnapshot();
    return;
  }

  if (!state.pendingEdge || state.pendingEdge.pointerId !== event.pointerId) {
    return;
  }

  releaseGraphPointerCapture(event.pointerId);
  const point = getGraphPointFromClient(event.clientX, event.clientY);
  const target = findCharacterAtGraphPoint(point.x, point.y);
  const sourceId = state.pendingEdge.sourceId;
  state.pendingEdge = null;
  renderGraph();

  if (target && target.id !== sourceId) {
    openRelationModal(sourceId, target.id);
  }
}

function handlePendingEdgeCancel(event) {
  if (state.graphPan?.pointerId === event.pointerId) {
    finishGraphPan(event.pointerId);
    return;
  }

  if (!state.pendingEdge || state.pendingEdge.pointerId !== event.pointerId) {
    return;
  }

  releaseGraphPointerCapture(event.pointerId);
  state.pendingEdge = null;
  renderGraph();
}

function startGraphPan(event) {
  if (!elements.graphCanvas) {
    return;
  }

  event.preventDefault();
  if (typeof elements.graphCanvas.setPointerCapture === "function") {
    elements.graphCanvas.setPointerCapture(event.pointerId);
  }

  state.graphPan = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startOffsetX: state.graphView.offsetX || 0,
    startOffsetY: state.graphView.offsetY || 0,
  };
  document.body.style.userSelect = "none";
  elements.graphWrap?.classList.add("is-panning");
}

function finishGraphPan(pointerId) {
  releaseGraphPointerCapture(pointerId);
  state.graphPan = null;
  document.body.style.userSelect = "";
  elements.graphWrap?.classList.remove("is-panning");
}

function releaseGraphPointerCapture(pointerId) {
  if (
    pointerId == null ||
    typeof elements.graphCanvas.hasPointerCapture !== "function" ||
    !elements.graphCanvas.hasPointerCapture(pointerId)
  ) {
    return;
  }
  elements.graphCanvas.releasePointerCapture(pointerId);
}

function getGraphPointFromClient(clientX, clientY) {
  const localPoint = getGraphLocalPointFromClient(clientX, clientY);
  const width = elements.graphCanvas.clientWidth || 0;
  const height = elements.graphCanvas.clientHeight || 0;
  const scale = state.graphView.scale || 1;
  return {
    x: clamp((localPoint.x - state.graphView.offsetX) / scale, 0, width),
    y: clamp((localPoint.y - state.graphView.offsetY) / scale, 0, height),
  };
}

function findCharacterAtGraphPoint(x, y) {
  for (let index = state.characters.length - 1; index >= 0; index -= 1) {
    const character = state.characters[index];
    if (isPointInCharacterEllipse(character, x, y)) {
      return character;
    }
  }
  return null;
}

function isPointInCharacterEllipse(character, x, y) {
  const rx = GRAPH.nodeWidth / 2;
  const ry = GRAPH.nodeHeight / 2;
  const offsetX = x - character.graph_x - rx;
  const offsetY = y - character.graph_y - ry;
  const normalized =
    (offsetX * offsetX) / (rx * rx) +
    (offsetY * offsetY) / (ry * ry);
  return normalized <= 1;
}

function resolveAnchorPoint(character, anchor) {
  if (!anchor) {
    return getNodeCenter(character);
  }
  return {
    x: character.graph_x + clamp(anchor.x, 0, GRAPH.nodeWidth),
    y: character.graph_y + clamp(anchor.y, 0, GRAPH.nodeHeight),
  };
}

function projectPointToEllipse(character, towardX, towardY) {
  const center = getNodeCenter(character);
  const rx = GRAPH.nodeWidth / 2;
  const ry = GRAPH.nodeHeight / 2;
  const dx = towardX - center.x;
  const dy = towardY - center.y;

  if (!dx && !dy) {
    return { x: center.x + rx, y: center.y };
  }

  const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function getFallbackRelationEndpoints(sourceCharacter, targetCharacter) {
  const sourceCenter = getNodeCenter(sourceCharacter);
  const targetCenter = getNodeCenter(targetCharacter);
  return {
    start: projectPointToEllipse(sourceCharacter, targetCenter.x, targetCenter.y),
    end: projectPointToEllipse(targetCharacter, sourceCenter.x, sourceCenter.y),
  };
}

function getPendingEdgePoints() {
  const source = getCharacterById(state.pendingEdge.sourceId);
  if (!source || !state.pendingEdge.currentPoint) {
    return null;
  }

  return {
    start: getNodeCenter(source),
    end: state.pendingEdge.currentPoint,
  };
}

function getCurveControlPoint(start, end, offset) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;
  return {
    x: (start.x + end.x) / 2 + px * offset,
    y: (start.y + end.y) / 2 + py * offset,
  };
}

function buildCurveGeometryFromEndpoints(start, end, offset) {
  const control = getCurveControlPoint(start, end, offset);
  return buildCurveGeometryFromPoints(start, end, control);
}

function buildCurveGeometryFromRelation(relation, offset) {
  const sourceCharacter = getCharacterById(relation.source_id);
  const targetCharacter = getCharacterById(relation.target_id);
  if (!sourceCharacter || !targetCharacter) {
    return null;
  }

  const hasStoredAnchors = relation.source_anchor && relation.target_anchor;
  const { start, end } = hasStoredAnchors
    ? {
        start: resolveAnchorPoint(sourceCharacter, relation.source_anchor),
        end: resolveAnchorPoint(targetCharacter, relation.target_anchor),
      }
    : getFallbackRelationEndpoints(sourceCharacter, targetCharacter);
  return buildCurveGeometryFromEndpoints(start, end, offset);
}

function renderGraph() {
  arrangeCharacterGraph();
  const width = elements.graphCanvas.clientWidth || 700;
  const height = elements.graphCanvas.clientHeight || 440;
  elements.graphSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  elements.graphSvg.setAttribute("preserveAspectRatio", "none");
  elements.graphSvg.innerHTML = buildSvgDefs();
  elements.graphNodes.innerHTML = "";
  elements.relationLabels.innerHTML = "";

  getRelationGroups().forEach((group) => renderRelationGroup(group));
  if (state.pendingEdge) {
    renderPendingEdge();
  }
  state.characters.forEach((character, index) => renderCharacterNode(character, index));
  applyGraphViewport();
}

function buildSvgDefs() {
  return `
    <defs>
      <marker id="arrow-end" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="#8e4a38"></path>
      </marker>
      <marker id="arrow-start" viewBox="0 0 8 8" refX="2" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 8 0 L 0 4 L 8 8 z" fill="#8e4a38"></path>
      </marker>
    </defs>
  `;
}

function renderCharacterNode(character, index) {
  const color = getCharacterGraphColor(character, index);
  const isSource = state.pendingEdge?.sourceId === character.id;
  const isTarget = state.pendingEdge?.candidateTargetId === character.id;
  const node = document.createElement("div");
  node.className = [
    "graph-node",
    isSource ? "is-source" : "",
    isTarget ? "is-target" : "",
  ]
    .filter(Boolean)
    .join(" ");
  node.style.left = `${character.graph_x}px`;
  node.style.top = `${character.graph_y}px`;
  node.style.background = "#fffefb";
  node.style.borderColor = color.stroke;
  node.style.color = color.text;
  node.style.boxShadow = isSource || isTarget
    ? `0 16px 30px ${color.shadow}`
    : `0 10px 18px ${color.shadow}`;
  node.dataset.id = character.id;

  const name = document.createElement("div");
  name.className = "graph-node-name";
  name.textContent = character.name || `角色 ${index + 1}`;

  node.addEventListener("contextmenu", (event) => event.preventDefault());

  node.appendChild(name);
  elements.graphNodes.appendChild(node);
}

function getRelationGroups() {
  const groups = new Map();
  state.relations.forEach((relation) => {
    const key = makePairKey(relation.source_id, relation.target_id);
    if (!groups.has(key)) {
      const [aId, bId] = key.split("--");
      groups.set(key, { key, aId, bId, relations: [] });
    }
    groups.get(key).relations.push(relation);
  });

  return Array.from(groups.values()).map((group) => {
    const forward = group.relations.find((relation) => relation.source_id === group.aId && relation.target_id === group.bId) || null;
    const reverse = group.relations.find((relation) => relation.source_id === group.bId && relation.target_id === group.aId) || null;
    return {
      ...group,
      forward,
      reverse,
    };
  });
}

function renderRelationGroup(group) {
  getRenderableRelationItems(group).forEach((item) => renderRelationItem(item));
}

function renderPendingEdge() {
  const points = getPendingEdgePoints();
  if (!points) {
    return;
  }

  const preview = document.createElementNS("http://www.w3.org/2000/svg", "line");
  preview.setAttribute("x1", points.start.x);
  preview.setAttribute("y1", points.start.y);
  preview.setAttribute("x2", points.end.x);
  preview.setAttribute("y2", points.end.y);
  preview.setAttribute("stroke", "#9d3a2f");
  preview.setAttribute("stroke-width", "2.4");
  preview.setAttribute("stroke-dasharray", "8 6");
  preview.setAttribute("stroke-linecap", "round");
  preview.setAttribute("pointer-events", "none");
  elements.graphSvg.appendChild(preview);
}

function buildCurveGeometryFromPoints(start, end, control) {
  const t = 0.5;
  const labelX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
  const labelY = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    pathD: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    labelX,
    labelY,
    normalX: -dy / length,
    normalY: dx / length,
  };
}

function curveSign(key) {
  const value = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return value % 2 === 0 ? 1 : -1;
}

function getRenderableRelationItems(group) {
  if (shouldMergeBidirectionalGroup(group)) {
    return [createMergedRelationRenderItem(group)];
  }

  const items = [];
  if (group.forward) {
    items.push(createDirectionalRelationRenderItem(group.forward, group.reverse ? GRAPH.curveOffset : curveSign(group.key) * GRAPH.curveOffset));
  }
  if (group.reverse) {
    items.push(createDirectionalRelationRenderItem(group.reverse, group.forward ? GRAPH.curveOffset : curveSign(group.key) * GRAPH.curveOffset));
  }
  return items;
}

function shouldMergeBidirectionalGroup(group) {
  return isBidirectionalRelationPair(group.forward, group.reverse);
}

function isBidirectionalRelationPair(forward, reverse) {
  return Boolean(
    forward &&
      reverse &&
      forward.bidirectional &&
      reverse.bidirectional &&
      normalizeRelationLabel(forward.label) === normalizeRelationLabel(reverse.label),
  );
}

function normalizeRelationLabel(label) {
  return String(label || "").trim();
}

function createDirectionalRelationRenderItem(relation, offset) {
  return {
    relation,
    sourceId: relation.source_id,
    targetId: relation.target_id,
    offset,
    markerStart: false,
    markerEnd: true,
    label: getDirectionalRelationDisplayText(relation),
    labelSide: offset >= 0 ? 1 : -1,
    deleteRequest: {
      mode: "direction",
      sourceId: relation.source_id,
      targetId: relation.target_id,
      message: `确认删除 ${getDirectionalRelationDisplayText(relation)} 吗？`,
    },
  };
}

function createMergedRelationRenderItem(group) {
  const relation = group.forward || group.reverse;
  const mergedLabel = normalizeRelationLabel(relation?.label) || "未命名关系";
  return {
    relation,
    sourceId: group.forward?.source_id || relation.source_id,
    targetId: group.forward?.target_id || relation.target_id,
    offset: 0,
    markerStart: true,
    markerEnd: true,
    label: mergedLabel,
    labelSide: curveSign(group.key),
    deleteRequest: {
      mode: "pair",
      pairKey: group.key,
      message: `确认删除 ${getCharacterName(group.aId)} 与 ${getCharacterName(group.bId)} 的双向关系“${mergedLabel}”吗？`,
    },
  };
}

function renderRelationItem(item) {
  const geometry = buildCurveGeometryFromRelation(item.relation, item.offset);
  if (!geometry) {
    return;
  }

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", geometry.pathD);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#8e4a38");
  path.setAttribute("stroke-width", "2.6");
  if (item.markerStart) {
    path.setAttribute("marker-start", "url(#arrow-start)");
  }
  if (item.markerEnd) {
    path.setAttribute("marker-end", "url(#arrow-end)");
  }
  bindRelationItemEvents(path, item);
  elements.graphSvg.appendChild(path);

  const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  hitPath.setAttribute("d", geometry.pathD);
  hitPath.setAttribute("fill", "none");
  hitPath.setAttribute("stroke", "transparent");
  hitPath.setAttribute("stroke-width", "18");
  bindRelationItemEvents(hitPath, item);
  elements.graphSvg.appendChild(hitPath);

  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "relation-badge relation-badge-button";
  const labelSide = item.labelSide || 1;
  badge.style.left = `${geometry.labelX + geometry.normalX * GRAPH.labelOffset * labelSide}px`;
  badge.style.top = `${geometry.labelY + geometry.normalY * GRAPH.labelOffset * labelSide}px`;
  badge.innerHTML = `<span>${escapeHtml(item.label)}</span>`;
  bindRelationItemEvents(badge, item);
  elements.relationLabels.appendChild(badge);
}

function bindRelationItemEvents(target, item) {
  target.addEventListener("click", () => openRelationModal(item.sourceId, item.targetId));
  target.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openRelationDeleteModal(item.deleteRequest);
  });
}

function getDirectionalRelationDisplayText(relation) {
  if (!relation) {
    return "未命名关系";
  }
  const label = normalizeRelationLabel(relation.label) || "未命名关系";
  return `${getCharacterName(relation.source_id)}→${getCharacterName(relation.target_id)}: ${label}`;
}

function cloneAnchor(anchor) {
  if (!anchor) {
    return null;
  }
  return {
    x: anchor.x,
    y: anchor.y,
  };
}

function createRelationRecord(
  source,
  target,
  label,
  sourceAnchor = null,
  targetAnchor = null,
  bidirectional = false,
  relationSource = "user",
) {
  return {
    id: generateId("relation"),
    source_id: source.id,
    target_id: target.id,
    label,
    source_name: source.name || "",
    target_name: target.name || "",
    source_anchor: cloneAnchor(sourceAnchor),
    target_anchor: cloneAnchor(targetAnchor),
    bidirectional: Boolean(bidirectional),
    relation_source: relationSource,
  };
}

function openRelationModal(sourceId, targetId, draftAnchors = null) {
  const sourceName = getCharacterName(sourceId);
  const targetName = getCharacterName(targetId);
  const forward = state.relations.find((relation) => relation.source_id === sourceId && relation.target_id === targetId) || null;
  const reverse = state.relations.find((relation) => relation.source_id === targetId && relation.target_id === sourceId) || null;
  const hadReverseRelation = Boolean(reverse);

  state.relationEditor = {
    sourceId,
    targetId,
    key: makePairKey(sourceId, targetId),
    forwardSourceAnchor: cloneAnchor(draftAnchors?.forwardSourceAnchor || forward?.source_anchor),
    forwardTargetAnchor: cloneAnchor(draftAnchors?.forwardTargetAnchor || forward?.target_anchor),
    reverseSourceAnchor: cloneAnchor(draftAnchors?.reverseSourceAnchor || reverse?.source_anchor),
    reverseTargetAnchor: cloneAnchor(draftAnchors?.reverseTargetAnchor || reverse?.target_anchor),
    hadReverseRelation,
  };
  elements.relationDirection.textContent = `${sourceName} → ${targetName}`;
  elements.relationLabelInput.value = forward?.label || "";
  elements.relationReverseToggle.checked = hadReverseRelation;
  elements.reverseRelationGroup.classList.toggle("hidden", !hadReverseRelation);
  elements.reverseRelationLabelInput.value = reverse?.label || "";
  elements.relationModal.classList.remove("hidden");
  elements.relationModal.setAttribute("aria-hidden", "false");
  elements.relationLabelInput.focus();
}

function closeRelationModal() {
  state.relationEditor = null;
  elements.relationModal.classList.add("hidden");
  elements.relationModal.setAttribute("aria-hidden", "true");
  elements.relationLabelInput.value = "";
  elements.reverseRelationLabelInput.value = "";
  elements.relationReverseToggle.checked = false;
  elements.reverseRelationGroup.classList.add("hidden");
}

function saveRelationModal() {
  if (!state.relationEditor) {
    return;
  }
  const forwardLabel = elements.relationLabelInput.value.trim();
  const wantsReverse = elements.relationReverseToggle.checked;
  const reverseLabel = wantsReverse ? elements.reverseRelationLabelInput.value.trim() || forwardLabel : "";

  if (!forwardLabel) {
    setStatus("请先填写正向关系。", false, true);
    return;
  }

  const source = getCharacterById(state.relationEditor.sourceId);
  const target = getCharacterById(state.relationEditor.targetId);
  if (!source || !target) {
    closeRelationModal();
    return;
  }

  upsertDirectionalRelation(
    source.id,
    target.id,
    createRelationRecord(
      source,
      target,
      forwardLabel,
      state.relationEditor.forwardSourceAnchor,
      state.relationEditor.forwardTargetAnchor,
      wantsReverse,
      "user",
    ),
  );

  if (wantsReverse) {
    const reverseSourceAnchor =
      state.relationEditor.reverseSourceAnchor || cloneAnchor(state.relationEditor.forwardTargetAnchor);
    const reverseTargetAnchor =
      state.relationEditor.reverseTargetAnchor || cloneAnchor(state.relationEditor.forwardSourceAnchor);
    upsertDirectionalRelation(
      target.id,
      source.id,
      createRelationRecord(
        target,
        source,
        reverseLabel,
        reverseSourceAnchor,
        reverseTargetAnchor,
        true,
        "user",
      ),
    );
  } else if (state.relationEditor.hadReverseRelation) {
    state.relations = state.relations.filter(
      (relation) => !isSameRelationDirection(relation, target.id, source.id),
    );
  }

  syncRelationNames();
  renderGraph();
  closeRelationModal();
  markStoryDraftDirty();
  queueCharacterHistorySnapshot("编辑角色关系");
  setStatus("单条关系已更新，请点击“保存关系”同步整张关系网。", false);
}

function upsertDirectionalRelation(sourceId, targetId, relationRecord) {
  state.relations = state.relations.filter(
    (relation) => !isSameRelationDirection(relation, sourceId, targetId),
  );
  state.relations.push(relationRecord);
}

function openRelationDeleteModal(deleteRequest) {
  closeRelationModal();
  state.relationDeleteRequest = deleteRequest;
  elements.relationDeleteMessage.textContent = deleteRequest?.message || "确认删除这条关系吗？";
  elements.relationDeleteModal.classList.remove("hidden");
  elements.relationDeleteModal.setAttribute("aria-hidden", "false");
  elements.relationDeleteConfirm.focus();
}

function closeRelationDeleteModal() {
  state.relationDeleteRequest = null;
  elements.relationDeleteModal.classList.add("hidden");
  elements.relationDeleteModal.setAttribute("aria-hidden", "true");
  elements.relationDeleteMessage.textContent = "";
}

function confirmRelationDelete() {
  if (!state.relationDeleteRequest) {
    return;
  }

  const request = state.relationDeleteRequest;
  closeRelationDeleteModal();
  if (request.mode === "direction") {
    deleteDirectionalRelation(request.sourceId, request.targetId);
    return;
  }
  if (request.mode === "pair") {
    deleteRelationPair(request.pairKey);
  }
}

function deleteDirectionalRelation(sourceId, targetId, silent = false) {
  const before = state.relations.length;
  state.relations = state.relations.filter(
    (relation) => !isSameRelationDirection(relation, sourceId, targetId),
  );
  renderGraph();
  if (!silent && before !== state.relations.length) {
    markStoryDraftDirty();
    queueCharacterHistorySnapshot("删除角色关系");
    setStatus("角色关系已删除，请重新保存关系网。", false);
  }
}

function deleteRelationPair(pairKey, silent = false) {
  state.relations = state.relations.filter((relation) => makePairKey(relation.source_id, relation.target_id) !== pairKey);
  renderGraph();
  if (!silent) {
    markStoryDraftDirty();
    queueCharacterHistorySnapshot("删除角色关系");
    setStatus("角色关系已删除，请重新保存关系网。", false);
  }
}

function isSameRelationDirection(relation, sourceId, targetId) {
  return relation.source_id === sourceId && relation.target_id === targetId;
}

function makePairKey(aId, bId) {
  return [aId, bId].sort().join("--");
}

function getCharacterById(characterId) {
  return state.characters.find((character) => character.id === characterId) || null;
}

function getCharacterName(characterId) {
  const character = getCharacterById(characterId);
  return character?.name || "未命名角色";
}

function getNodeCenter(character) {
  return {
    x: character.graph_x + GRAPH.nodeWidth / 2,
    y: character.graph_y + GRAPH.nodeHeight / 2,
  };
}

function syncRelationNames() {
  state.relations = state.relations.map((relation) => ({
    ...relation,
    source_name: getCharacterById(relation.source_id)?.name || "",
    target_name: getCharacterById(relation.target_id)?.name || "",
    relation_source: relation.relation_source || "user",
  }));
}

function applyServerStoryDraft(story) {
  if (!story || typeof story !== "object") {
    return;
  }

  const previousCharacters = new Map(state.characters.map((character) => [character.id, character]));
  const incomingCharacters = Array.isArray(story.characters) ? story.characters : [];
  if (incomingCharacters.length) {
    state.characters = incomingCharacters.map((character, index) => {
      const previous = previousCharacters.get(character.id);
      return normalizePersistedCharacter(
        {
          ...character,
          inner_conflict: previous?.inner_conflict,
          strengths: previous?.strengths,
          weaknesses: previous?.weaknesses,
          character_arc: previous?.character_arc,
          speaking_style: previous?.speaking_style,
          graph_color_index: previous?.graph_color_index,
          graph_color: previous?.graph_color,
        },
        index,
        incomingCharacters.length,
      );
    });

    nextCharacterColorIndex = state.characters.reduce((maxIndex, character, index) => {
      const candidate = Number.isInteger(character.graph_color_index) ? character.graph_color_index + 1 : index + 1;
      return Math.max(maxIndex, candidate);
    }, 0);
    state.characterCreationHistory = [];
  }

  if (Array.isArray(story.relations)) {
    state.relations = story.relations
      .map((relation) => normalizeIncomingRelation(relation, relation?.relation_source || "user"))
      .filter(Boolean);
  }

  if (!getCharacterById(state.activeCharacterId)) {
    state.activeCharacterId = state.characters[0]?.id || null;
  }
  syncRelationNames();
  renderCharacters();
  renderGraph();
  pushCharacterHistoryEntry("同步角色设定");

  if (state.isStorySaved) {
    state.savedStoryDraft = buildStoryPayload();
  }
}

function formatAutoNamedCharacters(autoNamedCharacters) {
  return (Array.isArray(autoNamedCharacters) ? autoNamedCharacters : [])
    .map((character) => String(character?.name || "").trim())
    .filter(Boolean)
    .join("、");
}

function disableRelationTaskActions() {
  elements.saveRelations.disabled = true;
  elements.supplementRelations.disabled = true;
}

function restoreRelationTaskActions() {
  elements.saveRelations.disabled = false;
  updateRelationActionState();
}

function disableOutlineTaskActions() {
  elements.generateOutline.disabled = true;
  elements.regenerateOutline.disabled = true;
  elements.generateStory.disabled = true;
}

function restoreOutlineTaskActions() {
  elements.generateOutline.disabled = false;
  updateOutputActionState();
}

function disableStoryTaskActions() {
  elements.generateStory.disabled = true;
  elements.regenerateOutline.disabled = true;
}

function restoreStoryTaskActions() {
  updateOutputActionState();
}

function handleSaveRelations() {
  const payload = buildStoryPayload();
  const validationMessage = validateStoryContextForRelationSave(payload);
  if (validationMessage) {
    setStatus(validationMessage, false, true);
    return;
  }

  state.savedStoryDraft = payload;
  state.isStorySaved = true;
  updateRelationActionState();
  saveWorkspaceSnapshot();
  setStatus("当前梗概、角色卡和关系网已保存，可以使用 AI 补充关系。", false);
  unlockCharactersAiGuide();
}

function validateStoryContextForRelationSave(payload) {
  if (!payload.synopsis) {
    return "请先填写故事梗概后再保存关系。";
  }
  if (!(payload.total_words > 0)) {
    return "请先填写有效的小说整体篇幅后再保存关系。";
  }
  if ((payload.characters || []).length < 2) {
    return "至少需要两名角色后才能保存关系网。";
  }
  return "";
}

async function handleAiRelationSupplement() {
  if (!ensureNoBlockingLlmTask()) {
    return;
  }
  if (!state.isStorySaved || !state.savedStoryDraft) {
    setStatus("请先保存当前梗概、角色卡和关系网，再进行 AI 补充。", false, true);
    return;
  }

  startLlmActivityRun({
    title: "AI 补充角色关系",
    summary: "正在准备角色关系补充请求。",
    firstStepTitle: "接收补充关系请求",
    firstStepDetail: "将读取你已保存的梗概、角色卡与关系网，补空白关系位，不覆盖已保存关系。",
  });
  appendLlmActivityStep("检查已保存设定", "正在核对故事梗概、角色卡和当前关系网。");
  appendLlmActivityStep("整理关系补充输入", "正在提取角色节点与已有关系，避免生成重复方向关系。");
  appendLlmActivityStep("发送给模型", "已将关系补充请求提交给 LLM。");
  startLlmActivityWaitingLoop(
    "LLM 正在推断可能的角色互动关系。",
    buildRelationSupplementWaitingMessages(),
  );
  setBusyState("正在根据已保存的梗概、角色卡与关系网补充角色关系...");
  disableRelationTaskActions();

  try {
    await createManagedLlmTask("/api/llm-tasks/relations/supplement", {
      story: state.savedStoryDraft,
    }, {
      busyMessage: "正在根据已保存的梗概、角色卡与关系网补充角色关系...",
      runningSummary: "LLM 正在推断可能的角色互动关系。",
      waitingMessages: buildRelationSupplementWaitingMessages(),
      pausedSummary: "角色关系补充已暂停。你可以先回去调整梗概、角色卡或关系网；若继续，将按暂停前的输入重新补充关系。",
      discardSummary: "本次角色关系补充已放弃，你可以修改后重新发起。",
      discardStatusMessage: "本次角色关系补充已放弃。你可以继续编辑并重新发起补充。",
      restoreUi: restoreRelationTaskActions,
      onCompleted: (response) => {
        const addedRelations = Array.isArray(response.added_relations) ? response.added_relations : [];
        let mergedCount = 0;

        addedRelations.forEach((relation) => {
          if (appendAiRelation(relation)) {
            mergedCount += 1;
          }
        });

        appendLlmActivityStep("解析关系 JSON", "正在校验模型返回的关系结构与角色指向。");
        syncRelationNames();
        appendLlmActivityStep("合并到关系图", "正在把新关系写回当前关系网并更新可视化。");
        renderGraph();
        state.savedStoryDraft = buildStoryPayload();
        state.isStorySaved = true;
        updateRelationActionState();
        saveWorkspaceSnapshot();
        pushCharacterHistoryEntry(mergedCount ? "AI补充角色关系" : "同步角色关系", { force: mergedCount > 0 });
        setStatus(
          mergedCount
            ? `AI 已补充 ${mergedCount} 条新关系，并同步到当前关系网。`
            : "AI 没有补充新的关系，已保留你当前保存的关系网。",
          false,
        );
        finishLlmActivityRun(
          mergedCount
            ? `已补充 ${mergedCount} 条角色关系，并同步到关系网。`
            : "没有检测到适合新增的角色关系，当前关系网已保持不变。",
        );
      },
    });
  } catch (error) {
    setStatus(error.message || "AI 补充关系失败。", false, true);
    finishLlmActivityRun(error.message || "AI 补充关系失败。", "error");
    restoreRelationTaskActions();
  }
}

function appendAiRelation(relation) {
  const normalized = normalizeIncomingRelation(relation, "ai");
  if (!normalized) {
    return false;
  }
  if (state.relations.some((item) => isSameRelationDirection(item, normalized.source_id, normalized.target_id))) {
    return false;
  }
  state.relations.push(normalized);
  return true;
}

function normalizeIncomingRelation(relation, fallbackSource = "user") {
  const source = getCharacterById(relation?.source_id);
  const target = getCharacterById(relation?.target_id);
  const label = normalizeRelationLabel(relation?.label);
  if (!source || !target || !label || source.id === target.id) {
    return null;
  }
  return {
    id: relation.id || generateId("relation"),
    source_id: source.id,
    target_id: target.id,
    label,
    source_name: source.name || relation.source_name || "",
    target_name: target.name || relation.target_name || "",
    source_anchor: cloneAnchor(relation.source_anchor),
    target_anchor: cloneAnchor(relation.target_anchor),
    bidirectional: Boolean(relation.bidirectional),
    relation_source: relation.relation_source || fallbackSource,
  };
}

function serializeCharacter(character) {
  return {
    id: character.id,
    name: character.name || "",
    gender: character.gender || "",
    age: character.age || "",
    occupation: character.occupation || "",
    nationality: character.nationality || "",
    personality: buildCharacterCompositeField([
      ["性格", character.personality],
      ["强项", character.strengths],
      ["弱点", character.weaknesses],
      ["说话风格", character.speaking_style],
    ]),
    appearance: buildCharacterCompositeField([
      ["外在特征", character.appearance],
    ]),
    values: buildCharacterCompositeField([
      ["内在冲突", character.inner_conflict],
      ["人物弧光", character.character_arc],
      ["价值观", character.values],
    ]),
    core_motivation: buildCharacterCompositeField([
      ["核心动机", character.core_motivation],
    ]),
    graph_x: Number(character.graph_x) || 120,
    graph_y: Number(character.graph_y) || 120,
  };
}

function buildCharacterCompositeField(items) {
  return items
    .map(([label, value]) => {
      const text = String(value || "").trim();
      return text ? `${label}：${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeOutlineHistoryEntry(entry) {
  if (!entry || typeof entry !== "object" || !entry.outline) {
    return null;
  }

  return {
    id: entry.id || generateId("outline-history"),
    createdAt: entry.createdAt || new Date().toISOString(),
    type: entry.type || "大纲版本",
    outline: normalizeOutline(entry.outline),
  };
}

function serializeRelation(relation) {
  const label = normalizeRelationLabel(relation.label);
  if (!relation.source_id || !relation.target_id || !label || relation.source_id === relation.target_id) {
    return null;
  }
  return {
    id: relation.id || generateId("relation"),
    source_id: relation.source_id,
    target_id: relation.target_id,
    label,
    source_name: getCharacterById(relation.source_id)?.name || relation.source_name || "",
    target_name: getCharacterById(relation.target_id)?.name || relation.target_name || "",
    bidirectional: Boolean(relation.bidirectional),
    relation_source: relation.relation_source || "user",
  };
}

async function handleOutlineSubmit(event) {
  event.preventDefault();
  if (!ensureNoBlockingLlmTask()) {
    return;
  }
  const payload = buildStoryPayload();
  const hasUnnamedCharacters = (payload.characters || []).some((character) => !String(character?.name || "").trim());
  if (!payload.synopsis) {
    setStatus("请先填写故事梗概。", false, true);
    return;
  }

  startLlmActivityRun({
    title: "AI 生成大纲",
    summary: "正在整理故事设定并准备大纲生成请求。",
    firstStepTitle: "接收大纲生成请求",
    firstStepDetail: "将综合梗概、角色卡、角色关系网与篇幅要求生成新的故事大纲。",
  });
  appendLlmActivityStep("整理创作输入", "正在汇总梗概、世界观、角色卡与角色关系。");
  if (hasUnnamedCharacters) {
    appendLlmActivityStep("补全角色姓名", "检测到未命名角色，正在先根据关系网与设定为其命名。");
  }
  appendLlmActivityStep("构建大纲提示词", "正在生成四段式结构与逐章规划所需的提示信息。");
  appendLlmActivityStep("发送给模型", "已将大纲生成请求提交给 Neuro AI。");
  startLlmActivityWaitingLoop(
    "Neuro AI 正在规划故事结构与章节节奏。",
    buildOutlineWaitingMessages(false),
  );
  setBusyState("Neuro AI 正在生成故事大纲...");
  disableOutlineTaskActions();

  try {
    await createManagedLlmTask("/api/llm-tasks/outline", {
      story: payload,
      feedback: "",
      previous_outline: null,
    }, {
      busyMessage: "Neuro AI 正在生成故事大纲...",
      runningSummary: "Neuro AI 正在规划故事结构与章节节奏。",
      waitingMessages: buildOutlineWaitingMessages(false),
      pausedSummary: "大纲生成已暂停。你可以先回去修改设定；若继续，将按暂停前的输入重新生成本次大纲。",
      discardSummary: "本次大纲生成已放弃，你可以修改后重新发起。",
      discardStatusMessage: "本次大纲生成已放弃。你可以继续编辑后重新生成大纲。",
      restoreUi: restoreOutlineTaskActions,
      onCompleted: (response) => {
        const autoNamedCharacters = Array.isArray(response?.auto_named_characters) ? response.auto_named_characters : [];
        const outlinePayload = response?.outline || response;
        if (response?.story) {
          applyServerStoryDraft(response.story);
        }
        state.outline = normalizeOutline(outlinePayload);
        state.generatedStory = null;
        state.activeChapterNumber = null;
        pushOutlineHistoryEntry(state.outline, "首次生成");
        if (autoNamedCharacters.length) {
          appendLlmActivityStep("回写角色姓名", "已将 AI 生成的角色姓名同步到角色卡与关系网。");
        }
        appendLlmActivityStep("解析大纲 JSON", "正在校验章节结构、字数规划与返回字段。");
        appendLlmActivityStep("整理篇章范围", "正在规范化四段式结构与章节范围。");
        renderOutline();
        renderStory();
        appendLlmActivityStep("渲染页面结果", "正在把新大纲写入右侧结果区。");
        saveWorkspaceSnapshot();
        setCurrentStage("outline", { showGuide: false });
        if (autoNamedCharacters.length) {
          const namedSummary = formatAutoNamedCharacters(autoNamedCharacters);
          setStatus(
            `${namedSummary ? `已先为未命名角色补全姓名：${namedSummary}。` : "已先为未命名角色补全姓名。"}大纲已生成，可以继续重生成，或直接按当前大纲生成全文。`,
            false,
          );
          finishLlmActivityRun(
            namedSummary
              ? `已补全角色姓名：${namedSummary}，并生成故事大纲。`
              : "已补全未命名角色姓名，并生成故事大纲。",
          );
        } else {
          setStatus("大纲已生成，可以继续重生成，或直接按当前大纲生成全文。", false);
          finishLlmActivityRun("大纲已生成完成，可以继续调整或直接生成正文。");
        }
        unlockOutlineToolsGuide();
      },
    });
  } catch (error) {
    setStatus(error.message || "大纲生成失败。", false, true);
    finishLlmActivityRun(error.message || "大纲生成失败。", "error");
    restoreOutlineTaskActions();
  }
}

async function handleOutlineRegenerate() {
  if (!state.outline) {
    return;
  }
  if (!ensureNoBlockingLlmTask()) {
    return;
  }
  const payload = buildStoryPayload();
  const hasUnnamedCharacters = (payload.characters || []).some((character) => !String(character?.name || "").trim());

  startLlmActivityRun({
    title: "AI 重生成大纲",
    summary: "正在结合你的反馈重塑故事结构。",
    firstStepTitle: "接收大纲重生成请求",
    firstStepDetail: "将保留当前设定，并结合反馈重新生成一版大纲。",
  });
  appendLlmActivityStep("读取当前大纲与反馈", "正在汇总上一版大纲和你的修改方向。");
  if (hasUnnamedCharacters) {
    appendLlmActivityStep("补全角色姓名", "检测到未命名角色，正在先根据关系网与设定为其命名。");
  }
  appendLlmActivityStep("重建大纲提示词", "正在把反馈注入新的结构规划请求。");
  appendLlmActivityStep("发送给模型", "已将重生成请求提交给 Neuro AI。");
  startLlmActivityWaitingLoop(
    "Neuro AI 正在按反馈重组故事结构。",
    buildOutlineWaitingMessages(true),
  );
  setBusyState("正在根据反馈重生成大纲...");
  disableOutlineTaskActions();

  try {
    await createManagedLlmTask("/api/llm-tasks/outline", {
      story: payload,
      feedback: elements.outlineFeedback.value.trim(),
      previous_outline: state.outline,
    }, {
      busyMessage: "正在根据反馈重生成大纲...",
      runningSummary: "Neuro AI 正在按反馈重组故事结构。",
      waitingMessages: buildOutlineWaitingMessages(true),
      pausedSummary: "大纲重生成已暂停。你可以先回去修改设定或反馈；若继续，将按暂停前的输入重新生成本次大纲。",
      discardSummary: "本次大纲重生成已放弃，你可以修改后重新发起。",
      discardStatusMessage: "本次大纲重生成已放弃。你可以继续编辑后重新生成大纲。",
      restoreUi: restoreOutlineTaskActions,
      onCompleted: (response) => {
        const autoNamedCharacters = Array.isArray(response?.auto_named_characters) ? response.auto_named_characters : [];
        const outlinePayload = response?.outline || response;
        if (response?.story) {
          applyServerStoryDraft(response.story);
        }
        state.outline = normalizeOutline(outlinePayload);
        state.generatedStory = null;
        state.activeChapterNumber = null;
        pushOutlineHistoryEntry(state.outline, "重生成");
        if (autoNamedCharacters.length) {
          appendLlmActivityStep("回写角色姓名", "已将 AI 生成的角色姓名同步到角色卡与关系网。");
        }
        appendLlmActivityStep("解析重生成结果", "正在校验新的大纲 JSON 与章节规划。");
        appendLlmActivityStep("清理旧正文结果", "由于大纲已变更，旧正文会被清空以避免混用。");
        renderStory();
        appendLlmActivityStep("渲染新大纲", "正在将新的大纲内容写回页面。");
        renderOutline();
        saveWorkspaceSnapshot();
        setCurrentStage("outline", { showGuide: false });
        if (autoNamedCharacters.length) {
          const namedSummary = formatAutoNamedCharacters(autoNamedCharacters);
          setStatus(
            `${namedSummary ? `已先为未命名角色补全姓名：${namedSummary}。` : "已先为未命名角色补全姓名。"}新的大纲已经生成，可以继续调整，或开始逐章创作。`,
            false,
          );
          finishLlmActivityRun(
            namedSummary
              ? `已补全角色姓名：${namedSummary}，并完成大纲重生成。`
              : "已补全未命名角色姓名，并完成大纲重生成。",
          );
        } else {
          setStatus("新的大纲已经生成，可以继续调整，或开始逐章创作。", false);
          finishLlmActivityRun("新的大纲已经生成，可以继续调整后再生成正文。");
        }
        syncTutorialGuidance(true);
      },
    });
  } catch (error) {
    setStatus(error.message || "重生成失败。", false, true);
    finishLlmActivityRun(error.message || "重生成失败。", "error");
    restoreOutlineTaskActions();
  }
}

async function handleStoryGenerate() {
  if (!ensureNoBlockingLlmTask()) {
    return;
  }
  if (!state.outline) {
    return;
  }

  if (!saveActStructureEdits(true)) {
    return;
  }

  startLlmActivityRun({
    title: "AI 生成正文",
    summary: "正在锁定当前大纲并准备逐章创作请求。",
    firstStepTitle: "接收正文生成请求",
    firstStepDetail: "将根据当前大纲、角色关系和连续性要求生成整部正文。",
  });
  appendLlmActivityStep("锁定当前大纲", "正在读取最新四段式结构和逐章规划。");
  appendLlmActivityStep("整理正文创作输入", "正在汇总故事设定、角色关系与章节目标。");
  appendLlmActivityStep("发送给模型", "已将整部正文生成请求提交给 Neuro AI。");
  startLlmActivityWaitingLoop(
    "Neuro AI 正在逐章创作正文，这一步可能会持续一段时间。",
    buildStoryWaitingMessages(state.outline?.chapter_count || state.outline?.chapters?.length || 1),
  );
  setBusyState("正在依次生成章节正文，这一步可能需要一些时间...");
  disableStoryTaskActions();

  try {
    await createManagedLlmTask("/api/llm-tasks/story", {
      story: buildStoryPayload(),
      outline: state.outline,
    }, {
      busyMessage: "正在依次生成章节正文，这一步可能需要一些时间...",
      runningSummary: "Neuro AI 正在逐章创作正文，这一步可能会持续一段时间。",
      waitingMessages: buildStoryWaitingMessages(state.outline?.chapter_count || state.outline?.chapters?.length || 1),
      pausedSummary: "正文生成已暂停。你可以先返回调整梗概、关系或大纲；若继续，将按暂停前的输入重新生成本次正文。",
      discardSummary: "本次正文生成已放弃，你可以调整后重新发起。",
      discardStatusMessage: "本次正文生成已放弃。你可以继续编辑并重新生成正文。",
      restoreUi: restoreStoryTaskActions,
      onCompleted: (response) => {
        const storyPayload = response?.chapters ? response : response?.story || response;
        state.generatedStory = normalizeGeneratedStory(storyPayload, state.outline?.title || "");
        state.activeChapterNumber = state.generatedStory?.chapters?.[0]?.chapter_number || null;
        appendLlmActivityStep("解析正文结果", "正在校验章节列表、摘要和正文内容。");
        appendLlmActivityStep("渲染章节内容", "正在把生成结果写入正文展示区。");
        renderStory();
        saveWorkspaceSnapshot();
        setCurrentStage("story", { showGuide: false });
        setStatus("全文生成完成。你可以继续修改设定后重新走一次流程。", false);
        finishLlmActivityRun("正文已生成完成，现在可以导出单章或全部正文。");
        unlockStoryGuide();
      },
    });
  } catch (error) {
    setStatus(error.message || "正文生成失败。", false, true);
    finishLlmActivityRun(error.message || "正文生成失败。", "error");
    restoreStoryTaskActions();
  } finally {
    restoreStoryTaskActions();
  }
}

function buildStoryPayload() {
  syncRelationNames();
  const characters = state.characters.map(serializeCharacter);
  const relations = state.relations
    .map(serializeRelation)
    .filter(Boolean);

  return {
    genre: elements.customGenre.value.trim() || state.genre,
    synopsis: elements.synopsis.value.trim(),
    style: elements.customStyle.value.trim() || state.style,
    worldview_time: elements.worldviewTime.value.trim(),
    worldview_physical: elements.worldviewPhysical.value.trim(),
    worldview_social: elements.worldviewSocial.value.trim(),
    total_words: Number(elements.totalWords.value) || 0,
    chapter_words: Number(elements.chapterWords.value) || null,
    characters,
    relations,
  };
}

function normalizeOutline(outline) {
  const chapterCount = Number(outline.chapter_count || outline.chapters?.length || 1);
  const actStructure = (outline.act_structure || []).map((section, index) => {
    const [parsedStart, parsedEnd] = extractRangeNumbers(section.chapter_range);
    const start = Number(section.start_chapter || parsedStart || (index === 0 ? 1 : parsedStart || 1));
    const end = Number(section.end_chapter || parsedEnd || start || 1);
    return {
      ...section,
      stage: section.stage || STAGE_ORDER[index] || `阶段${index + 1}`,
      content: section.content || "",
      start_chapter: start,
      end_chapter: end,
      chapter_range: `第${start}章-第${end}章`,
    };
  });

  if (actStructure.length) {
    actStructure[0].start_chapter = 1;
    actStructure[0].chapter_range = `第${actStructure[0].start_chapter}章-第${actStructure[0].end_chapter}章`;
    actStructure[actStructure.length - 1].end_chapter = chapterCount;
    actStructure[actStructure.length - 1].chapter_range = `第${actStructure[actStructure.length - 1].start_chapter}章-第${actStructure[actStructure.length - 1].end_chapter}章`;
  }

  return {
    ...outline,
    chapter_count: chapterCount,
    act_structure: actStructure,
  };
}

function normalizeGeneratedStory(story, fallbackTitle = "") {
  const chapters = Array.isArray(story?.chapters)
    ? story.chapters
      .map((chapter, index) => ({
        chapter_number: Number(chapter?.chapter_number || index + 1),
        title: String(chapter?.title || `第${index + 1}章`),
        summary: String(chapter?.summary || ""),
        content: String(chapter?.content || ""),
        rendered_html: String(chapter?.rendered_html || ""),
      }))
      .filter((chapter) => chapter.content || chapter.summary || chapter.title)
    : [];

  if (!chapters.length) {
    return null;
  }

  return {
    title: String(story?.title || fallbackTitle || "未命名作品"),
    chapters,
  };
}

function extractRangeNumbers(rangeText) {
  const matches = String(rangeText || "").match(/\d+/g);
  if (!matches || !matches.length) {
    return [1, 1];
  }
  if (matches.length === 1) {
    return [Number(matches[0]), Number(matches[0])];
  }
  return [Number(matches[0]), Number(matches[1])];
}

async function handleOutlineExport() {
  if (!state.outline) {
    return;
  }
  if (!saveActStructureEdits(true)) {
    return;
  }

  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-大纲_神经元脚本.docx`,
      state.outline.title || "未命名作品",
      buildOutlineExportText(),
    );
    setStatus("大纲已导出为 Word 文档。", false);
  } catch (error) {
    setStatus(error.message || "大纲导出失败。", false, true);
  }
}

async function handleBasicExport() {
  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-基本信息_神经元脚本.docx`,
      resolveCurrentWorkTitle(),
      buildBasicInfoExportText(),
    );
    setStatus("基本信息已导出为 Word 文档。", false);
  } catch (error) {
    setStatus(error.message || "基本信息导出失败。", false, true);
  }
}

async function exportBasicHistoryEntry(entryId) {
  const entry = state.basicHistory.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-${sanitizeFilename(entry.type || "基本信息历史")}_神经元脚本.docx`,
      resolveCurrentWorkTitle(),
      buildBasicInfoExportText(entry.snapshot),
    );
    setStatus("已导出这版基本信息。", false);
  } catch (error) {
    setStatus(error.message || "基本信息历史导出失败。", false, true);
  }
}

async function handleCharactersExport() {
  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-角色关系_神经元脚本.docx`,
      resolveCurrentWorkTitle(),
      buildCharactersExportText(),
    );
    setStatus("角色关系已导出为 Word 文档。", false);
  } catch (error) {
    setStatus(error.message || "角色关系导出失败。", false, true);
  }
}

async function exportCharacterHistoryEntry(entryId) {
  const entry = state.characterHistory.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-${sanitizeFilename(entry.type || "角色关系历史")}_神经元脚本.docx`,
      resolveCurrentWorkTitle(),
      buildCharactersExportText(entry.snapshot),
    );
    setStatus("已导出这版角色关系。", false);
  } catch (error) {
    setStatus(error.message || "角色关系历史导出失败。", false, true);
  }
}

async function handleExportSettings() {
  if (!state.outline) {
    return;
  }
  if (!saveActStructureEdits(true)) {
    return;
  }

  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-导出设定_神经元脚本.docx`,
      resolveCurrentWorkTitle(),
      buildSettingsExportText(),
    );
    setStatus("三步设定已导出为 Word 文档。", false);
  } catch (error) {
    setStatus(error.message || "导出设定失败。", false, true);
  }
}

async function handleExportAllStory() {
  if (!state.generatedStory) {
    return;
  }

  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-全部正文_神经元脚本.docx`,
      state.generatedStory.title || state.outline?.title || "未命名作品",
      buildAllStoryExportText(),
    );
    setStatus("全部正文已导出为 Word 文档。", false);
  } catch (error) {
    setStatus(error.message || "正文导出失败。", false, true);
  }
}

async function handleExportEverything() {
  if (!state.generatedStory) {
    return;
  }
  if (!saveActStructureEdits(true)) {
    return;
  }

  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-导出全部_神经元脚本.docx`,
      resolveCurrentWorkTitle(),
      buildEverythingExportText(),
    );
    setStatus("全部设定和正文已导出为 Word 文档。", false);
  } catch (error) {
    setStatus(error.message || "导出全部失败。", false, true);
  }
}

function handleStoryResultClick(event) {
  const nextChapterButton = event.target.closest("[data-next-chapter]");
  if (nextChapterButton) {
    const chapterNumber = Number(nextChapterButton.dataset.nextChapter);
    if (Number.isFinite(chapterNumber)) {
      state.activeChapterNumber = chapterNumber;
      renderStory();
      scrollStoryReaderToTop();
      saveWorkspaceSnapshot();
    }
    return;
  }

  const chapterTab = event.target.closest("[data-select-chapter]");
  if (chapterTab) {
    const chapterNumber = Number(chapterTab.dataset.selectChapter);
    if (Number.isFinite(chapterNumber)) {
      state.activeChapterNumber = chapterNumber;
      renderStory();
      scrollStoryReaderToTop();
      saveWorkspaceSnapshot();
    }
    return;
  }

  const exportButton = event.target.closest("[data-export-chapter]");
  if (!exportButton) {
    return;
  }

  const chapterNumber = Number(exportButton.dataset.exportChapter);
  if (!Number.isFinite(chapterNumber)) {
    return;
  }

  void exportSingleChapter(chapterNumber);
}

async function exportSingleChapter(chapterNumber) {
  const chapter = findGeneratedChapter(chapterNumber);
  if (!chapter) {
    setStatus("未找到要导出的章节内容。", false, true);
    return;
  }

  try {
    await downloadDocxFile(
      `${buildExportBaseName()}-第${chapter.chapter_number}章-${sanitizeFilename(chapter.title)}_神经元脚本.docx`,
      `${state.generatedStory?.title || state.outline?.title || "未命名作品"} 第${chapter.chapter_number}章`,
      buildSingleChapterExportText(chapter),
    );
    setStatus(`第 ${chapter.chapter_number} 章已导出为 Word 文档。`, false);
  } catch (error) {
    setStatus(error.message || `第 ${chapter.chapter_number} 章导出失败。`, false, true);
  }
}

function findGeneratedChapter(chapterNumber) {
  return state.generatedStory?.chapters?.find(
    (chapter) => Number(chapter.chapter_number) === Number(chapterNumber),
  ) || null;
}

function buildOutlineExportText() {
  const outline = state.outline;
  if (!outline) {
    return "";
  }

  const parts = [
    `标题：${outline.title || "未命名作品"}`,
    `一句话概述：${outline.logline || "无"}`,
    `故事概述：${outline.summary || "无"}`,
    `章节数：${outline.chapter_count || outline.chapters?.length || 0}`,
    "",
    "四段式结构：",
    ...(outline.act_structure?.length
      ? outline.act_structure.map(
        (section) => `${section.stage}｜${section.chapter_range}\n${section.content || "无"}`,
      )
      : ["本轮没有返回四段式结构。"]),
    "",
    "LLM 补完信息：",
    ...(outline.inferred_details?.length ? outline.inferred_details : ["本轮没有额外补完信息。"]),
    "",
    "章节规划：",
    ...(outline.chapters?.length
      ? outline.chapters.map(
        (chapter) => [
          `第 ${chapter.chapter_number} 章｜${chapter.title}`,
          `章节梗概：${chapter.summary || "无"}`,
          `关键事件：${chapter.key_events?.length ? chapter.key_events.join(" / ") : "无"}`,
          `章末收束：${chapter.cliffhanger || "无"}`,
          `目标字数：${chapter.target_words}`,
        ].join("\n"),
      )
      : ["本轮没有章节规划。"]),
  ];

  return parts.join("\n\n").trim();
}

function buildSingleChapterExportText(chapter) {
  const title = state.generatedStory?.title || state.outline?.title || "未命名作品";
  return [
    `作品：${title}`,
    `章节：第 ${chapter.chapter_number} 章｜${chapter.title}`,
    "",
    "章节摘要：",
    chapter.summary || "无",
    "",
    "正文：",
    chapter.content || "",
  ].join("\n");
}

function buildAllStoryExportText() {
  const story = state.generatedStory;
  if (!story) {
    return "";
  }

  const chapterTexts = story.chapters.map((chapter) => buildSingleChapterExportText(chapter));
  return [
    `作品：${story.title || state.outline?.title || "未命名作品"}`,
    `章节总数：${story.chapters.length}`,
    "",
    chapterTexts.join("\n\n" + "=".repeat(24) + "\n\n"),
  ].join("\n");
}

function buildBasicInfoExportText(snapshot = buildBasicInfoSnapshot()) {
  const basic = normalizeBasicInfoSnapshot(snapshot);
  const totalWords = Number(basic.totalWords) || 0;
  const chapterWords = Number(basic.chapterWords) || 0;
  const estimatedChapterCount = totalWords > 0
    ? Math.max(1, Math.ceil(totalWords / (chapterWords || 2000)))
    : 0;

  return [
    "基本信息",
    `故事类型：${getBasicTypeLabel(basic)}`,
    `语言风格：${getBasicStyleLabel(basic)}`,
    `故事梗概：${basic.synopsis || "未填写"}`,
    `整体篇幅：${basic.totalWords || "未填写"}${basic.totalWords ? " 字" : ""}`,
    `每章目标字数：${basic.chapterWords || "未填写"}${basic.chapterWords ? " 字" : ""}`,
    `预估章节数：${estimatedChapterCount || "未计算"}`,
    "",
    "世界观：",
    `时间背景：${basic.worldviewTime || "未填写"}`,
    `物理环境：${basic.worldviewPhysical || "未填写"}`,
    `社会环境：${basic.worldviewSocial || "未填写"}`,
  ].join("\n");
}

function buildCharacterFieldLines(character, index) {
  return [
    `角色 ${index + 1}：${character.name || "未命名角色"}`,
    `姓名：${character.name || "未填写"}`,
    `性别：${character.gender || "未填写"}`,
    `年龄：${character.age || "未填写"}`,
    `国籍/种族：${character.nationality || "未填写"}`,
    `身份/职业：${character.occupation || "未填写"}`,
    `性格：${character.personality || "未填写"}`,
    `核心动机：${character.core_motivation || "未填写"}`,
    `内在冲突：${character.inner_conflict || "未填写"}`,
    `强项：${character.strengths || "未填写"}`,
    `弱点：${character.weaknesses || "未填写"}`,
    `人物弧光：${character.character_arc || "未填写"}`,
    `外在特征：${character.appearance || "未填写"}`,
    `说话风格：${character.speaking_style || "未填写"}`,
    `价值观：${character.values || "未填写"}`,
  ].join("\n");
}

function buildCharactersExportText(snapshot = buildCharacterHistorySnapshot()) {
  const historySnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  const characters = Array.isArray(historySnapshot.characters) ? historySnapshot.characters : [];
  const relations = Array.isArray(historySnapshot.relations) ? historySnapshot.relations : [];
  const characterNameMap = new Map(
    characters.map((character) => [character.id, String(character?.name || "").trim() || "未命名角色"]),
  );

  return [
    "角色关系",
    `角色数量：${characters.length}`,
    `关系数量：${relations.length}`,
    "",
    "角色档案：",
    ...(characters.length
      ? characters.map((character, index) => buildCharacterFieldLines(character, index))
      : ["还没有角色档案。"]),
    "",
    "角色关系网：",
    ...(relations.length
      ? relations.map((relation, index) => {
        const sourceName = relation.source_name || characterNameMap.get(relation.source_id) || "未命名角色";
        const targetName = relation.target_name || characterNameMap.get(relation.target_id) || "未命名角色";
        const relationSource = relation.relation_source === "ai" ? "AI补充" : "手动设定";
        return `${index + 1}. ${sourceName} → ${targetName}：${relation.label}（${relationSource}）`;
      })
      : ["还没有角色关系。"]),
  ].join("\n\n");
}

function buildSettingsExportText() {
  return [
    `作品：${resolveCurrentWorkTitle()}`,
    buildBasicInfoExportText(),
    buildCharactersExportText(),
    `大纲生成\n${buildOutlineExportText()}`,
  ].join("\n\n" + "=".repeat(24) + "\n\n");
}

function buildEverythingExportText() {
  return [
    buildSettingsExportText(),
    `正文生成\n${buildAllStoryExportText()}`,
  ].join("\n\n" + "=".repeat(24) + "\n\n");
}

function resolveCurrentWorkTitle() {
  return state.generatedStory?.title
    || state.outline?.title
    || truncateText(elements.synopsis?.value, 24)
    || "未命名作品";
}

function buildExportBaseName() {
  return sanitizeFilename(resolveCurrentWorkTitle());
}

function sanitizeFilename(value) {
  return String(value || "未命名作品")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "未命名作品";
}

async function downloadDocxFile(filename, title, content) {
  const response = await fetch("/api/export/docx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      title,
      content,
    }),
  });

  if (!response.ok) {
    let message = "导出失败。";
    try {
      const error = await response.json();
      message = error.detail || message;
    } catch (parseError) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderOutline() {
  if (!state.outline) {
    elements.outlineResult.className = "outline-result empty-state";
    elements.outlineResult.textContent = "还没有生成大纲。";
    renderOutlineHistory();
    return;
  }

  const actStructure = Array.isArray(state.outline.act_structure) ? state.outline.act_structure : [];
  const chapters = Array.isArray(state.outline.chapters) ? state.outline.chapters : [];
  const inferredDetails = Array.isArray(state.outline.inferred_details) ? state.outline.inferred_details : [];
  const lastStageIndex = actStructure.length - 1;
  const synopsisText = state.outline.summary || state.outline.logline || "暂无故事梗概。";

  const actStructureHtml = actStructure
    .map((section, index) => `
      <div class="arc-col">
        <div class="arc-title">${escapeHtml(section.stage)}</div>
        <div class="arc-range-editor">
          <span class="arc-range-prefix">第</span>
          <input
            id="stage-start-${index}"
            class="arc-range-input"
            type="number"
            min="1"
            max="${state.outline.chapter_count}"
            value="${section.start_chapter}"
            ${index === 0 ? "disabled" : ""}
          />
          <span class="arc-range-suffix">章</span>
          <span class="arc-range-divider">-</span>
          <span class="arc-range-prefix">第</span>
          <input
            id="stage-end-${index}"
            class="arc-range-input"
            type="number"
            min="1"
            max="${state.outline.chapter_count}"
            value="${section.end_chapter}"
            ${index === lastStageIndex ? "disabled" : ""}
          />
          <span class="arc-range-suffix">章</span>
        </div>
        <div class="arc-card" id="arc-${index}">
          <div class="arc-card-copy">${escapeHtml(section.content || "暂无内容概括。")}</div>
        </div>
      </div>
    `)
    .join("");

  const chapterCardsHtml = chapters
    .map((chapter) => {
      const keyEvents = Array.isArray(chapter.key_events) && chapter.key_events.length
        ? chapter.key_events.map((item) => escapeHtml(item)).join(" / ")
        : "无";
      return `
        <div class="chapter-item">
          <b class="chapter-item-title">第${chapter.chapter_number}章 《${escapeHtml(chapter.title)}》</b>
          <div class="chapter-item-line">章节梗概：${escapeHtml(chapter.summary || "暂无章节概要。")}</div>
          <div class="chapter-item-line">关键事件：${keyEvents}</div>
          <div class="chapter-item-line">章末收束：${escapeHtml(chapter.cliffhanger || "无")}</div>
          <div class="chapter-item-line">目标字数：${chapter.target_words || "未设置"}</div>
        </div>
      `;
    })
    .join("");

  elements.outlineResult.className = "outline-result";
  elements.outlineResult.innerHTML = `
    <div class="outline-board">
      <div class="outline-hero-card">
        <div class="outline-title-row">
          <div class="outline-title-card">
            <strong>标题</strong>
            <span>${escapeHtml(state.outline.title || "未命名作品")}</span>
          </div>
          <div class="outline-title-card outline-count-card">
            <strong>章节总数</strong>
            <span>${state.outline.chapter_count} 章</span>
          </div>
        </div>
        <div class="synopsis-display">${escapeHtml(synopsisText)}</div>
        <div class="outline-ai-card">
          <strong>AI 补完信息</strong>
          <span>${inferredDetails.length ? inferredDetails.map((item) => escapeHtml(item)).join("；") : "本轮没有额外补完信息。"}</span>
        </div>
      </div>

      <div class="arc-section">
        <div class="arc-header">
          <button type="button" id="save-stage-ranges" class="ghost-button">保存篇章范围</button>
        </div>
        <div class="arc-tracks">${actStructureHtml}</div>
      </div>

      <div class="chapter-section">
        <div class="chapter-label">章节规划</div>
        ${chapterCardsHtml}
      </div>
    </div>
  `;

  const saveButton = document.querySelector("#save-stage-ranges");
  if (saveButton) {
    saveButton.addEventListener("click", () => saveActStructureEdits(false));
  }
  syncNeuroInputState();
  renderOutlineHistory();
}

function pushOutlineHistoryEntry(outline, type = "大纲版本") {
  const normalized = normalizeOutline(outline);
  state.outlineHistory = [
    {
      id: generateId("outline-history"),
      createdAt: new Date().toISOString(),
      type,
      outline: normalized,
    },
    ...state.outlineHistory,
  ].slice(0, 12);
  renderOutlineHistory();
}

function renderOutlineHistory() {
  if (!elements.outlineHistoryList) {
    return;
  }

  if (!state.outlineHistory.length) {
    elements.outlineHistoryList.innerHTML = `<div class="outline-history-entry"><p>还没有历史记录。每次生成或重生成大纲后，这里都会留下一个版本。</p></div>`;
    updateOutputActionState();
    return;
  }

  elements.outlineHistoryList.innerHTML = state.outlineHistory
    .map((entry, index) => `
      <article class="outline-history-entry">
        <div class="outline-history-entry-header">
          <strong>${escapeHtml(entry.type || `大纲版本 ${index + 1}`)}</strong>
          <span>${escapeHtml(formatHistoryTime(entry.createdAt))}</span>
        </div>
        <p>${escapeHtml(entry.outline?.title || "未命名作品")}｜${escapeHtml(entry.outline?.logline || "无一句话概述")}</p>
        <div class="action-row">
          <button type="button" class="ghost-button" data-outline-history-restore="${entry.id}">恢复为当前版本</button>
        </div>
      </article>
    `)
    .join("");

  elements.outlineHistoryList.querySelectorAll("[data-outline-history-restore]").forEach((button) => {
    button.addEventListener("click", () => {
      restoreOutlineHistoryEntry(button.dataset.outlineHistoryRestore);
    });
  });

  updateOutputActionState();
}

function openOutlineHistoryModal() {
  renderOutlineHistory();
  elements.outlineHistoryModal.classList.remove("hidden");
  elements.outlineHistoryModal.setAttribute("aria-hidden", "false");
}

function closeOutlineHistoryModal() {
  elements.outlineHistoryModal.classList.add("hidden");
  elements.outlineHistoryModal.setAttribute("aria-hidden", "true");
}

function restoreOutlineHistoryEntry(entryId) {
  const entry = state.outlineHistory.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  state.outline = normalizeOutline(entry.outline);
  state.generatedStory = null;
  state.activeChapterNumber = null;
  renderOutline();
  renderStory();
  closeOutlineHistoryModal();
  updateOutputActionState();
  saveWorkspaceSnapshot();
  setStatus("已恢复历史大纲版本。由于大纲发生变化，旧正文已清空。", false);
  setCurrentStage("outline");
}

function formatHistoryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function saveActStructureEdits(silentSuccess = false) {
  if (!state.outline || !state.outline.act_structure?.length) {
    return true;
  }

  const totalChapters = state.outline.chapter_count;
  const updated = state.outline.act_structure.map((section, index) => {
    const startInput = document.querySelector(`#stage-start-${index}`);
    const endInput = document.querySelector(`#stage-end-${index}`);
    const startValue = index === 0 ? 1 : Number(startInput?.value);
    const endValue = index === state.outline.act_structure.length - 1 ? totalChapters : Number(endInput?.value);
    return {
      ...section,
      start_chapter: startValue,
      end_chapter: endValue,
      chapter_range: `第${startValue}章-第${endValue}章`,
    };
  });

  for (let index = 0; index < updated.length; index += 1) {
    const current = updated[index];
    if (!Number.isInteger(current.start_chapter) || !Number.isInteger(current.end_chapter)) {
      setStatus("请把四段式的起止章都填写为整数。", false, true);
      return false;
    }
    if (current.start_chapter < 1 || current.end_chapter < 1 || current.start_chapter > totalChapters || current.end_chapter > totalChapters) {
      setStatus(`第 ${index + 1} 段的章数必须落在 1 到 ${totalChapters} 之间。`, false, true);
      return false;
    }
    if (current.start_chapter > current.end_chapter) {
      setStatus(`第 ${index + 1} 段的起始章不能大于结束章。`, false, true);
      return false;
    }
    if (index < updated.length - 1 && current.end_chapter > updated[index + 1].start_chapter) {
      setStatus(`第 ${index + 1} 段的结束章不能超过下一段的起始章。`, false, true);
      return false;
    }
  }

  updated[0].start_chapter = 1;
  updated[0].chapter_range = `第${updated[0].start_chapter}章-第${updated[0].end_chapter}章`;
  updated[updated.length - 1].end_chapter = totalChapters;
  updated[updated.length - 1].chapter_range = `第${updated[updated.length - 1].start_chapter}章-第${updated[updated.length - 1].end_chapter}章`;

  state.outline = {
    ...state.outline,
    act_structure: updated,
  };

  renderOutline();
  saveWorkspaceSnapshot();
  updateOutputActionState();
  if (!silentSuccess) {
    setStatus("四段式篇章范围已保存，后续正文会按这个分段布局。", false);
  }
  return true;
}

function renderStory() {
  const staticStoryTitle = document.querySelector(".prose-title-bar-static .prose-title");
  const staticStorySubtitle = document.querySelector(".prose-title-bar-static .prose-chapter-sub");

  if (!state.generatedStory) {
    elements.storyResult.className = "story-result empty-state";
    elements.storyResult.textContent = "大纲确认后，这里会依次展示每个篇章的正文。";
    if (staticStoryTitle) {
      staticStoryTitle.textContent = "正文生成";
    }
    if (staticStorySubtitle) {
      staticStorySubtitle.textContent = "大纲确认后，可继续润色、局部重写与导出。";
    }
    closeStorySelectionToolbar({ preserveSelection: false });
    return;
  }

  if (!findGeneratedChapter(state.activeChapterNumber)) {
    state.activeChapterNumber = state.generatedStory.chapters[0]?.chapter_number || null;
  }

  const activeChapter = findGeneratedChapter(state.activeChapterNumber) || state.generatedStory.chapters[0];
  const activeChapterIndex = state.generatedStory.chapters.findIndex(
    (chapter) => Number(chapter.chapter_number) === Number(activeChapter.chapter_number),
  );
  const nextChapter = state.generatedStory.chapters[activeChapterIndex + 1] || null;
  if (staticStoryTitle) {
    staticStoryTitle.textContent = `《${state.generatedStory.title || state.outline?.title || "未命名作品"}》`;
  }
  if (staticStorySubtitle) {
    staticStorySubtitle.textContent = `第${activeChapter.chapter_number}章 · ${activeChapter.title}`;
  }

  elements.storyResult.className = "story-result";
  elements.storyResult.innerHTML = `
    <div class="story-reader-shell">
      <div class="story-topbar">
        <div class="story-chapter-tabs">
          ${state.generatedStory.chapters
            .map((chapter) => `
              <button
                type="button"
                class="story-chapter-tab ${chapter.chapter_number === activeChapter.chapter_number ? "is-active" : ""}"
                data-select-chapter="${chapter.chapter_number}"
              >
                第${chapter.chapter_number}章
              </button>
            `)
            .join("")}
        </div>
      </div>

      <div class="prose-scroll-area">
        <article class="chapter-block story-chapter-card">
          <div class="chapter-block-header story-chapter-header">
            <div>
              <div class="chapter-label-en">Chapter ${activeChapter.chapter_number}</div>
              <div class="chapter-block-title">第${activeChapter.chapter_number}章 · ${escapeHtml(activeChapter.title)}</div>
            </div>
            <button type="button" class="btn-export" data-export-chapter="${activeChapter.chapter_number}">导出本章</button>
          </div>
          <div
            class="chapter-content prose-content"
            data-chapter-editor="${activeChapter.chapter_number}"
            data-chapter-number="${activeChapter.chapter_number}"
          >
            ${activeChapter.rendered_html || buildChapterContentHtml(activeChapter.content)}
          </div>
        </article>
        ${nextChapter ? `
          <button type="button" class="btn-primary chapter-next-floating" data-next-chapter="${nextChapter.chapter_number}">
            下一章
          </button>
        ` : ""}
      </div>
    </div>
  `;
  closeStorySelectionToolbar({ preserveSelection: false });
}

function scrollStoryReaderToTop() {
  window.requestAnimationFrame(() => {
    [
      document.querySelector("#stage-story .prose-main"),
      document.querySelector("#stage-story .prose-scroll-area"),
    ]
      .filter(Boolean)
      .forEach((container) => {
        if (typeof container.scrollTo === "function") {
          container.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        container.scrollTop = 0;
      });
  });
}

function buildChapterContentHtml(content) {
  const normalized = String(content || "").trim();
  if (!normalized) {
    return "<p>暂无正文。</p>";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/<br \/>/g, "<br />")}</p>`)
    .join("");
}

function handleDocumentSelectionChange() {
  if (elements.storyEditModal && !elements.storyEditModal.classList.contains("hidden")) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    closeStorySelectionToolbar({ preserveSelection: false });
    return;
  }

  const range = selection.getRangeAt(0);
  const editor = getChapterEditorFromNode(range.commonAncestorContainer);
  if (!editor || !editor.closest("#stage-story")) {
    closeStorySelectionToolbar({ preserveSelection: false });
    return;
  }

  const rawText = selection.toString();
  const text = rawText.trim();
  if (!text) {
    closeStorySelectionToolbar({ preserveSelection: false });
    return;
  }

  const offsets = getTextOffsetsWithin(editor, range);
  const rect = range.getBoundingClientRect();
  state.storySelection = {
    chapterNumber: Number(editor.dataset.chapterNumber),
    rawText,
    text,
    range: range.cloneRange(),
    startOffset: offsets.start,
    endOffset: offsets.end,
    rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
  };
  positionStorySelectionToolbar();
}

function getChapterEditorFromNode(node) {
  if (!node) {
    return null;
  }
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return element?.closest?.("[data-chapter-editor]") || null;
}

function getTextOffsetsWithin(root, range) {
  const startRange = document.createRange();
  startRange.selectNodeContents(root);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = document.createRange();
  endRange.selectNodeContents(root);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
}

function positionStorySelectionToolbar() {
  if (!state.storySelection || !elements.storySelectionToolbar) {
    closeStorySelectionToolbar({ preserveSelection: false });
    return;
  }

  const liveRects = Array.from(state.storySelection.range?.getClientRects?.() || []).filter(
    (rect) => rect && (rect.width || rect.height),
  );
  const anchorRect = liveRects[liveRects.length - 1] || state.storySelection.rect;
  if (!anchorRect) {
    closeStorySelectionToolbar({ preserveSelection: false });
    return;
  }

  syncStorySelectionFavoriteButtonState();
  elements.storySelectionToolbar.classList.remove("hidden");
  elements.storySelectionToolbar.setAttribute("aria-hidden", "false");
  const toolbarWidth = elements.storySelectionToolbar.offsetWidth || 196;
  const toolbarHeight = elements.storySelectionToolbar.offsetHeight || 38;
  const top = clamp(
    anchorRect.bottom + 10,
    12,
    window.innerHeight - toolbarHeight - 12,
  );
  const left = clamp(
    anchorRect.right - toolbarWidth,
    12,
    window.innerWidth - toolbarWidth - 12,
  );

  elements.storySelectionToolbar.style.top = `${top}px`;
  elements.storySelectionToolbar.style.left = `${left}px`;
}

function handleStorySelectionFavorite() {
  if (!state.storySelection?.range) {
    return;
  }

  const favoriteQuote = createFavoriteQuoteFromSelection(state.storySelection);
  const existingFavorite = state.favoriteQuotes.find((item) => isSameFavoriteQuote(item, favoriteQuote));
  if (!existingFavorite) {
    state.favoriteQuotes.unshift(favoriteQuote);
    renderFavorites();
    applyStorySelectionReplacement(
      state.storySelection.rawText || state.storySelection.text,
      "story-fragment-favorite",
      { favoriteId: favoriteQuote.id },
    );
    showFavoriteToast("已收藏句子，可在左侧‘我的收藏’中查看");
  } else {
    removeFavoriteById(existingFavorite.id, { showToast: false });
    closeStorySelectionToolbar({ preserveSelection: false });
    showFavoriteToast("已取消收藏");
  }
}

function createFavoriteQuoteFromSelection(selection) {
  return {
    id: generateId("favorite"),
    storyTitle: state.generatedStory?.title || state.outline?.title || "未命名作品",
    chapterNumber: Number(selection.chapterNumber) || null,
    startOffset: Number(selection.startOffset) || 0,
    endOffset: Number(selection.endOffset) || 0,
    text: String(selection.text || "").trim(),
    createdAt: new Date().toISOString(),
  };
}

function isSameFavoriteQuote(left, right) {
  return Number(left?.chapterNumber) === Number(right?.chapterNumber)
    && Number(left?.startOffset) === Number(right?.startOffset)
    && Number(left?.endOffset) === Number(right?.endOffset)
    && String(left?.text || "") === String(right?.text || "");
}

function findFavoriteForSelection(selection = state.storySelection) {
  if (!selection) {
    return null;
  }
  const candidate = createFavoriteQuoteFromSelection(selection);
  return state.favoriteQuotes.find((item) => isSameFavoriteQuote(item, candidate)) || null;
}

function syncStorySelectionFavoriteButtonState() {
  if (!elements.storySelectionFavorite) {
    return;
  }

  const existingFavorite = findFavoriteForSelection();
  const isFavorited = Boolean(existingFavorite);
  elements.storySelectionFavorite.classList.toggle("is-favorited", isFavorited);
  elements.storySelectionFavorite.setAttribute("aria-label", isFavorited ? "取消收藏" : "喜欢");
  elements.storySelectionFavorite.setAttribute("title", isFavorited ? "取消收藏" : "喜欢");
  elements.storySelectionFavorite.innerHTML = isFavorited
    ? FAVORITE_BUTTON_ICONS.unfavorite
    : FAVORITE_BUTTON_ICONS.favorite;
}

function showFavoriteToast(message) {
  if (!elements.favoriteToast) {
    return;
  }

  window.clearTimeout(favoriteToastTimer);
  elements.favoriteToast.textContent = message;
  elements.favoriteToast.classList.remove("hidden");
  elements.favoriteToast.classList.add("is-visible");
  elements.favoriteToast.setAttribute("aria-hidden", "false");
  favoriteToastTimer = window.setTimeout(() => {
    elements.favoriteToast.classList.remove("is-visible");
    elements.favoriteToast.classList.add("hidden");
    elements.favoriteToast.setAttribute("aria-hidden", "true");
  }, 2200);
}

function removeFavoriteMarkup(favoriteQuote) {
  const chapterNumber = Number(favoriteQuote?.chapterNumber);
  if (!Number.isFinite(chapterNumber)) {
    return false;
  }

  const chapter = findGeneratedChapter(chapterNumber);
  if (!chapter) {
    return false;
  }

  const editor = elements.storyResult?.querySelector?.(`[data-chapter-editor="${chapterNumber}"]`);
  if (editor && unwrapFavoriteNodes(editor, favoriteQuote.id)) {
    syncChapterContentFromDom(chapterNumber);
    return true;
  }

  const scratch = document.createElement("div");
  scratch.innerHTML = chapter.rendered_html || buildChapterContentHtml(chapter.content);
  if (!unwrapFavoriteNodes(scratch, favoriteQuote.id)) {
    return false;
  }

  chapter.rendered_html = scratch.innerHTML;
  chapter.content = normalizeEditorText(scratch.innerText);
  return true;
}

function unwrapFavoriteNodes(root, favoriteId) {
  if (!root || !favoriteId) {
    return false;
  }

  const favoriteNodes = Array.from(root.querySelectorAll(`[data-favorite-id="${favoriteId}"]`));
  if (!favoriteNodes.length) {
    return false;
  }

  favoriteNodes.forEach((favoriteNode) => {
    const fragment = document.createDocumentFragment();
    while (favoriteNode.firstChild) {
      fragment.appendChild(favoriteNode.firstChild);
    }
    favoriteNode.replaceWith(fragment);
  });

  return true;
}

function closeStorySelectionToolbar({ preserveSelection = true } = {}) {
  if (!elements.storySelectionToolbar) {
    return;
  }
  elements.storySelectionToolbar.classList.add("hidden");
  elements.storySelectionToolbar.setAttribute("aria-hidden", "true");
  if (!preserveSelection) {
    state.storySelection = null;
  }
}

function handleGlobalPointerDown(event) {
  handleGuidePointerDown(event);
  if (elements.storySelectionToolbar?.contains(event.target)) {
    return;
  }
  if (event.target.closest?.("#story-edit-modal")) {
    return;
  }
  if (!event.target.closest?.("[data-chapter-editor]")) {
    closeStorySelectionToolbar({ preserveSelection: false });
  }
}

function handleGlobalKeyDown(event) {
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    String(event.key || "").toLowerCase() === "z" &&
    state.currentStage === "characters" &&
    !isEditableTarget(event.target)
  ) {
    if (undoLastCreatedCharacter()) {
      event.preventDefault();
    }
    return;
  }

  if (event.key !== "Escape") {
    return;
  }

  closeStorySelectionToolbar({ preserveSelection: false });
  closeStoryEditModal();
  closeBasicHistoryModal();
  closeCharactersHistoryModal();
  closeOutlineHistoryModal();
}

function isEditableTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, [contenteditable='true'], [contenteditable='']"));
}

function undoLastCreatedCharacter() {
  while (state.characterCreationHistory.length) {
    const characterId = state.characterCreationHistory.pop();
    if (!getCharacterById(characterId)) {
      continue;
    }
    removeCharacter(characterId);
    setStatus("已撤销刚刚新建的角色。", false);
    return true;
  }
  return false;
}

function openStoryEditModal() {
  if (!state.storySelection?.text) {
    return;
  }

  elements.storyEditTextarea.value = state.storySelection.text;
  elements.storyEditModal.classList.remove("hidden");
  elements.storyEditModal.setAttribute("aria-hidden", "false");
  closeStorySelectionToolbar({ preserveSelection: true });
  elements.storyEditTextarea.focus();
}

function closeStoryEditModal() {
  if (!elements.storyEditModal) {
    return;
  }
  elements.storyEditModal.classList.add("hidden");
  elements.storyEditModal.setAttribute("aria-hidden", "true");
  if (state.storySelection) {
    positionStorySelectionToolbar();
  }
}

function saveStorySelectionEdit() {
  const replacement = elements.storyEditTextarea.value.trim();
  if (!replacement || !state.storySelection) {
    return;
  }

  applyStorySelectionReplacement(replacement, "story-fragment-user");
  closeStoryEditModal();
  setStatus("已保存这段人工修改，颜色已与 AI 生成内容区分开。", false);
}

async function handleStorySelectionRegenerate() {
  if (!state.storySelection || !state.outline || !state.generatedStory) {
    return;
  }
  if (!ensureNoBlockingLlmTask()) {
    return;
  }

  const chapter = findGeneratedChapter(state.storySelection.chapterNumber);
  if (!chapter) {
    return;
  }

  syncChapterContentFromDom(chapter.chapter_number);
  const fullText = chapter.content || "";
  const beforeContext = fullText.slice(Math.max(0, state.storySelection.startOffset - 260), state.storySelection.startOffset);
  const afterContext = fullText.slice(state.storySelection.endOffset, state.storySelection.endOffset + 260);

  startLlmActivityRun({
    title: "Neuro 局部重写",
    summary: "正在读取你选中的正文片段与上下文。",
    firstStepTitle: "接收片段重写请求",
    firstStepDetail: "将保持当前章节语气、节奏和人物状态，只重写你选中的部分。",
  });
  appendLlmActivityStep("定位选中片段", "正在提取选中内容、前后文和对应章节摘要。");
  appendLlmActivityStep("整理章节上下文", "正在锁定当前章节标题、摘要与整部作品风格。");
  appendLlmActivityStep("发送给模型", "已将局部重写请求提交给 Neuro AI。");
  setBusyState("Neuro 正在局部重写你选中的正文片段...");

  try {
    const response = await postJson("/api/story/rewrite-selection", {
      story: buildStoryPayload(),
      outline: state.outline,
      chapter_number: chapter.chapter_number,
      chapter_title: chapter.title,
      chapter_summary: chapter.summary,
      selected_text: state.storySelection.text,
      before_context: beforeContext,
      after_context: afterContext,
      instruction: "请保持行文风格统一，适度增强表达张力，但不要改动未选中的剧情事实。",
    });
    applyStorySelectionReplacement(response.rewritten_text || state.storySelection.text, "story-fragment-ai");
    appendLlmActivityStep("回写局部结果", "新片段已替换到正文中，并保留视觉区分。");
    finishLlmActivityRun("选中的片段已经重写完成。");
    setStatus("局部重写完成，新的片段已写回当前章节。", false);
  } catch (error) {
    setStatus(error.message || "局部重写失败。", false, true);
    finishLlmActivityRun(error.message || "局部重写失败。", "error");
  }
}

function applyStorySelectionReplacement(text, fragmentClass, { favoriteId = "" } = {}) {
  if (!state.storySelection?.range) {
    return;
  }

  const range = state.storySelection.range.cloneRange();
  range.deleteContents();

  const fragment = document.createElement("span");
  fragment.className = `${fragmentClass} story-fragment-highlight`;
  if (favoriteId) {
    fragment.dataset.favoriteId = favoriteId;
  }
  String(text || "")
    .split("\n")
    .forEach((line, index, lines) => {
      fragment.appendChild(document.createTextNode(line));
      if (index < lines.length - 1) {
        fragment.appendChild(document.createElement("br"));
      }
    });

  range.insertNode(fragment);
  const chapterNumber = state.storySelection.chapterNumber;
  state.storySelection = null;
  syncChapterContentFromDom(chapterNumber);
  closeStorySelectionToolbar({ preserveSelection: false });
  saveWorkspaceSnapshot();

  window.setTimeout(() => {
    fragment.classList.remove("story-fragment-highlight");
  }, 1500);
}

function syncChapterContentFromDom(chapterNumber) {
  const chapter = findGeneratedChapter(chapterNumber);
  const editor = elements.storyResult.querySelector(`[data-chapter-editor="${chapterNumber}"]`);
  if (!chapter || !editor) {
    return;
  }

  chapter.rendered_html = editor.innerHTML;
  chapter.content = normalizeEditorText(editor.innerText);
}

function normalizeEditorText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function setBusyState(message) {
  setLlmActivityStatus("处理中", { busy: true });
  setAssistantSummary(message);
  if (!llmActivity.panelOpen) {
    llmActivity.panelOpen = true;
    syncLlmActivityPanelState();
  }
}

function setPausedState(message) {
  setLlmActivityStatus("已暂停", { paused: true });
  setAssistantSummary(message);
  if (!llmActivity.panelOpen) {
    llmActivity.panelOpen = true;
    syncLlmActivityPanelState();
  }
}

function setStatus(message, keepBusy = false, isError = false) {
  setLlmActivityStatus(isError ? "出错了" : keepBusy ? "处理中" : "就绪", { busy: keepBusy, paused: false });
  setAssistantSummary(message);
  if ((isError || keepBusy) && !llmActivity.panelOpen) {
    llmActivity.panelOpen = true;
    syncLlmActivityPanelState();
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "请求失败。";
    try {
      const error = await response.json();
      message = error.detail || message;
    } catch (parseError) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

async function getJson(url) {
  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    let message = "请求失败。";
    try {
      const error = await response.json();
      message = error.detail || message;
    } catch (parseError) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n", "<br />");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

init();
