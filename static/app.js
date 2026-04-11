const GENRE_OPTIONS = ["爱情", "科幻", "悬疑", "奇幻", "历史", "现实主义", "成长"];
const STYLE_OPTIONS = ["幽默", "张爱玲式", "雨果式", "电影感", "冷峻克制", "轻盈浪漫"];
const CHARACTER_FIELDS = [
  ["name", "姓名"],
  ["gender", "性别"],
  ["age", "年龄"],
  ["occupation", "职业"],
  ["nationality", "种族/国籍"],
  ["personality", "性格"],
  ["appearance", "外貌特征"],
  ["values", "价值观"],
  ["core_motivation", "核心目标/行为动机/欲望"],
];
const TEXTAREA_FIELDS = new Set(["personality", "appearance", "values", "core_motivation"]);
const STAGE_ORDER = ["开端", "发展", "高潮", "结局"];
const WORKSPACE_STORAGE_KEY = "story-generation-workspace-v1";
const LLM_TASK_POLL_INTERVAL_MS = 1400;
const GRAPH = {
  nodeWidth: 154,
  nodeHeight: 76,
  curveOffset: 54,
  gapX: 60,
  gapY: 54,
  paddingX: 32,
  paddingY: 40,
  minGapX: 24,
  minHeight: 440,
  nodeColors: [
    { fill: "#f7d9c9", stroke: "#9d3a2f", text: "#4d241f", shadow: "rgba(157, 58, 47, 0.2)" },
    { fill: "#f4e4c8", stroke: "#8c6238", text: "#4f3520", shadow: "rgba(140, 98, 56, 0.18)" },
    { fill: "#e8ead8", stroke: "#68713d", text: "#323a1f", shadow: "rgba(104, 113, 61, 0.18)" },
    { fill: "#e1ede8", stroke: "#527766", text: "#213d34", shadow: "rgba(82, 119, 102, 0.18)" },
    { fill: "#f2d7d2", stroke: "#ad5c54", text: "#5a2824", shadow: "rgba(173, 92, 84, 0.18)" },
    { fill: "#eadbc7", stroke: "#785a3c", text: "#3e2c20", shadow: "rgba(120, 90, 60, 0.18)" },
  ],
};

const state = {
  genre: "科幻",
  style: "电影感",
  characters: [],
  relations: [],
  savedStoryDraft: null,
  isStorySaved: false,
  outline: null,
  generatedStory: null,
  pendingEdge: null,
  relationEditor: null,
  relationDeleteRequest: null,
};

let nextCharacterColorIndex = 0;
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
  exportOutline: document.querySelector("#export-outline"),
  regenerateOutline: document.querySelector("#regenerate-outline"),
  generateStory: document.querySelector("#generate-story"),
  exportAllStory: document.querySelector("#export-all-story"),
  outlineFeedback: document.querySelector("#outline-feedback"),
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
};

function generateId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    appearance: "",
    values: "",
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
    elements.graphCanvas.style.height = `${layout.height}px`;
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

function init() {
  const restoredWorkspace = loadWorkspaceSnapshot();
  const restoredGeneratedContent = Boolean(restoredWorkspace?.outline || restoredWorkspace?.generatedStory);
  if (restoredWorkspace) {
    applyWorkspaceSnapshot(restoredWorkspace);
  } else {
    state.characters = [createCharacter(0), createCharacter(1), createCharacter(2)];
    arrangeCharacterGraph();
  }
  renderChipGroup(elements.genreOptions, GENRE_OPTIONS, "genre");
  renderChipGroup(elements.styleOptions, STYLE_OPTIONS, "style");
  bindStoryDraftInputs();
  elements.totalWords.addEventListener("input", updateChapterEstimate);
  elements.chapterWords.addEventListener("input", updateChapterEstimate);
  elements.addCharacter.addEventListener("click", () => {
    state.characters.push(createCharacter(state.characters.length));
    arrangeCharacterGraph();
    renderCharacters();
    renderGraph();
    markStoryDraftDirty();
  });
  elements.storyForm.addEventListener("submit", handleOutlineSubmit);
  elements.saveRelations.addEventListener("click", handleSaveRelations);
  elements.supplementRelations.addEventListener("click", handleAiRelationSupplement);
  elements.exportOutline.addEventListener("click", handleOutlineExport);
  elements.regenerateOutline.addEventListener("click", handleOutlineRegenerate);
  elements.generateStory.addEventListener("click", handleStoryGenerate);
  elements.exportAllStory.addEventListener("click", handleExportAllStory);
  elements.storyResult.addEventListener("click", handleStoryResultClick);
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
  window.addEventListener("resize", renderGraph);
  setupGraphInteractions();
  updateChapterEstimate();
  renderCharacters();
  renderGraph();
  renderOutline();
  renderStory();
  updateRelationActionState();
  updateOutputActionState();
  syncLlmActivityPanelState();
  setStatus(
    restoredGeneratedContent
      ? "已恢复上次填写内容与已生成结果，可以继续编辑、导出或生成。"
      : "填写左侧信息后，先生成故事大纲；若不满意，可以补充反馈并重生成。",
    false,
  );
}

function loadWorkspaceSnapshot() {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const snapshot = JSON.parse(raw);
    return snapshot && typeof snapshot === "object" ? snapshot : null;
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
    version: 2,
    genre: state.genre,
    style: state.style,
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
    appearance: character?.appearance || "",
    values: character?.values || "",
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
    elements.outlineFeedback,
  ].forEach((control) => {
    control.addEventListener("input", () => {
      markStoryDraftDirty();
    });
  });
}

function markStoryDraftDirty() {
  state.isStorySaved = false;
  state.savedStoryDraft = null;
  updateRelationActionState();
  saveWorkspaceSnapshot();
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

function updateOutputActionState() {
  const outlineTaskRunning = llmTaskController.currentTask?.kind === "outline"
    && llmTaskController.currentTask?.status === "running";
  elements.regenerateOutline.disabled = outlineTaskRunning || !state.outline;
  elements.generateStory.disabled = outlineTaskRunning || !state.outline;
  elements.exportOutline.disabled = !state.outline;
  elements.exportAllStory.disabled = !state.generatedStory;
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
  elements.llmActivitySummary.textContent = summary;
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
    elements.llmActivitySummary.textContent = summary;
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
  llmActivity.active = false;
  setLlmActivityStatus(
    kind === "error" ? "出错了" : kind === "stopped" ? "已停止" : "已完成",
    { busy: false },
  );
  elements.llmActivitySummary.textContent = message;
  syncLlmActivityPanelState();
  appendLlmActivityStep(
    kind === "error" ? "本次运行中断" : kind === "stopped" ? "本次运行已放弃" : "本次运行完成",
    message,
    kind === "stopped" ? "stopped" : kind,
  );
  if (kind === "success") {
    scheduleLlmActivityAutoClose();
  } else {
    stopLlmActivityAutoClose();
  }
}

function closeLlmActivityPanel() {
  llmActivity.panelOpen = false;
  syncLlmActivityPanelState();
}

function openLlmActivityPanel() {
  stopLlmActivityAutoClose();
  llmActivity.panelOpen = true;
  syncLlmActivityPanelState();
}

function syncLlmActivityPanelState() {
  const hasActivityHistory = elements.llmActivityLog.children.length > 0;
  elements.llmActivityPanel.classList.toggle("is-open", llmActivity.panelOpen);
  elements.llmActivityToggle.classList.toggle(
    "is-visible",
    !llmActivity.panelOpen && (llmActivity.active || hasActivityHistory),
  );
  elements.llmActivityToggle.classList.toggle("is-busy", llmActivity.active);
  elements.llmActivityToggle.setAttribute(
    "aria-label",
    llmActivity.active ? "展开 AI 运行面板（当前正在运行）" : "展开 AI 运行面板",
  );
  elements.llmActivityToggle.title = llmActivity.active ? "展开 AI 运行面板（当前正在运行）" : "展开 AI 运行面板";
}

function setLlmActivityStatus(label, { busy = false, paused = false } = {}) {
  elements.llmActivityStatus.textContent = label;
  elements.llmActivityStatus.classList.toggle("busy", busy);
  elements.llmActivityStatus.classList.toggle("paused", paused);
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
    ? "当前有一项已暂停的 LLM 任务，请先在 AI 运行面板中继续或放弃本次生成。"
    : "当前已有 LLM 任务正在运行，请等待完成，或先点击“停止生成”。";
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
    setStatus(error.message || "获取 LLM 任务状态失败。", false, true);
    finishLlmActivityRun(error.message || "获取 LLM 任务状态失败。", "error");
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
    setStatus(error.message || "暂停 LLM 任务失败。", false, true);
    appendLlmActivityStep("暂停失败", error.message || "暂停 LLM 任务失败。", "error");
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

function renderCharacters() {
  elements.characterList.innerHTML = "";
  state.characters.forEach((character, index) => {
    const card = document.createElement("section");
    card.className = "character-card";

    const header = document.createElement("div");
    header.className = "character-card-header";

    const headerMeta = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = `Character ${index + 1}`;
    const title = document.createElement("h3");
    title.textContent = character.name || `角色 ${index + 1}`;
    headerMeta.append(kicker, title);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "tiny-button";
    removeButton.textContent = "删除角色";
    removeButton.disabled = state.characters.length <= 1;
    removeButton.addEventListener("click", () => removeCharacter(character.id));

    header.append(headerMeta, removeButton);

    const grid = document.createElement("div");
    grid.className = "character-card-grid";

    CHARACTER_FIELDS.forEach(([field, label]) => {
      const wrapper = document.createElement("div");
      wrapper.className = "field-group";
      const control = document.createElement(TEXTAREA_FIELDS.has(field) ? "textarea" : "input");
      const labelNode = document.createElement("label");
      labelNode.textContent = label;

      control.value = character[field] || "";
      control.placeholder = label;
      if (TEXTAREA_FIELDS.has(field)) {
        control.rows = 3;
      } else {
        control.type = "text";
      }

      control.addEventListener("input", (event) => {
        character[field] = event.target.value;
        if (field === "name") {
          title.textContent = character.name || `角色 ${index + 1}`;
        }
        syncRelationNames();
        renderGraph();
        markStoryDraftDirty();
      });

      wrapper.append(labelNode, control);
      grid.appendChild(wrapper);
    });

    card.append(header, grid);
    elements.characterList.appendChild(card);
  });
}

function removeCharacter(characterId) {
  state.characters = state.characters.filter((character) => character.id !== characterId);
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
  arrangeCharacterGraph();
  syncRelationNames();
  renderCharacters();
  renderGraph();
  markStoryDraftDirty();
}

function setupGraphInteractions() {
  elements.graphCanvas.addEventListener("pointerdown", handleGraphPointerDown);
  elements.graphCanvas.addEventListener("pointermove", handleGraphPointerMove);
  window.addEventListener("pointerup", handleGlobalPointerUp);
  window.addEventListener("pointercancel", handlePendingEdgeCancel);
}

function handleGraphPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

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
  if (!state.pendingEdge || state.pendingEdge.pointerId !== event.pointerId) {
    return;
  }

  releaseGraphPointerCapture(event.pointerId);
  state.pendingEdge = null;
  renderGraph();
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
  const rect = elements.graphCanvas.getBoundingClientRect();
  const width = elements.graphCanvas.clientWidth || rect.width || 0;
  const height = elements.graphCanvas.clientHeight || rect.height || 0;
  return {
    x: clamp(clientX - rect.left, 0, width),
    y: clamp(clientY - rect.top, 0, height),
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
  elements.graphSvg.innerHTML = buildSvgDefs();
  elements.graphNodes.innerHTML = "";
  elements.relationLabels.innerHTML = "";

  getRelationGroups().forEach((group) => renderRelationGroup(group));
  if (state.pendingEdge) {
    renderPendingEdge();
  }
  state.characters.forEach((character, index) => renderCharacterNode(character, index));
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
  node.style.background = `radial-gradient(circle at 30% 30%, #fffdf9, ${color.fill} 82%)`;
  node.style.borderColor = color.stroke;
  node.style.color = color.text;
  if (isSource || isTarget) {
    node.style.boxShadow = `0 16px 30px ${color.shadow}`;
  }
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
  return {
    pathD: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    labelX,
    labelY,
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
  badge.style.left = `${geometry.labelX}px`;
  badge.style.top = `${geometry.labelY}px`;
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
    setStatus("角色关系已删除，请重新保存关系网。", false);
  }
}

function deleteRelationPair(pairKey, silent = false) {
  state.relations = state.relations.filter((relation) => makePairKey(relation.source_id, relation.target_id) !== pairKey);
  renderGraph();
  if (!silent) {
    markStoryDraftDirty();
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
  }

  if (Array.isArray(story.relations)) {
    state.relations = story.relations
      .map((relation) => normalizeIncomingRelation(relation, relation?.relation_source || "user"))
      .filter(Boolean);
  }

  syncRelationNames();
  renderCharacters();
  renderGraph();

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
    personality: character.personality || "",
    appearance: character.appearance || "",
    values: character.values || "",
    core_motivation: character.core_motivation || "",
    graph_x: Number(character.graph_x) || 120,
    graph_y: Number(character.graph_y) || 120,
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
  setBusyState("正在让 DeepSeek 生成故事大纲...");
  disableOutlineTaskActions();

  try {
    await createManagedLlmTask("/api/llm-tasks/outline", {
      story: payload,
      feedback: "",
      previous_outline: null,
    }, {
      busyMessage: "正在让 DeepSeek 生成故事大纲...",
      runningSummary: "LLM 正在规划故事结构与章节节奏。",
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
        if (autoNamedCharacters.length) {
          appendLlmActivityStep("回写角色姓名", "已将 AI 生成的角色姓名同步到角色卡与关系网。");
        }
        appendLlmActivityStep("解析大纲 JSON", "正在校验章节结构、字数规划与返回字段。");
        appendLlmActivityStep("整理篇章范围", "正在规范化四段式结构与章节范围。");
        renderOutline();
        renderStory();
        appendLlmActivityStep("渲染页面结果", "正在把新大纲写入右侧结果区。");
        saveWorkspaceSnapshot();
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
      runningSummary: "LLM 正在按反馈重组故事结构。",
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
        if (autoNamedCharacters.length) {
          appendLlmActivityStep("回写角色姓名", "已将 AI 生成的角色姓名同步到角色卡与关系网。");
        }
        appendLlmActivityStep("解析重生成结果", "正在校验新的大纲 JSON 与章节规划。");
        appendLlmActivityStep("清理旧正文结果", "由于大纲已变更，旧正文会被清空以避免混用。");
        renderStory();
        appendLlmActivityStep("渲染新大纲", "正在将新的大纲内容写回页面。");
        renderOutline();
        saveWorkspaceSnapshot();
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
  elements.generateStory.disabled = true;
  elements.regenerateOutline.disabled = true;

  try {
    const story = await postJson("/api/story", {
      story: buildStoryPayload(),
      outline: state.outline,
    });
    state.generatedStory = normalizeGeneratedStory(story, state.outline?.title || "");
    appendLlmActivityStep("解析正文结果", "正在校验章节列表、摘要和正文内容。");
    appendLlmActivityStep("渲染章节内容", "正在把生成结果写入正文展示区。");
    renderStory();
    saveWorkspaceSnapshot();
    setStatus("全文生成完成。你可以继续修改设定后重新走一次流程。", false);
    finishLlmActivityRun("正文已生成完成，现在可以导出单章或全部正文。");
  } catch (error) {
    setStatus(error.message || "正文生成失败。", false, true);
    finishLlmActivityRun(error.message || "正文生成失败。", "error");
  } finally {
    updateOutputActionState();
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

function handleStoryResultClick(event) {
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
          `目标字数：${chapter.target_words}`,
          `概要：${chapter.summary || "无"}`,
          `关键事件：${chapter.key_events?.length ? chapter.key_events.join(" / ") : "无"}`,
          `章末收束：${chapter.cliffhanger || "无"}`,
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

function buildExportBaseName() {
  return sanitizeFilename(state.generatedStory?.title || state.outline?.title || "未命名作品");
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
    return;
  }

  const lastStageIndex = state.outline.act_structure.length - 1;
  const actStructureHtml = (state.outline.act_structure || [])
    .map(
      (section, index) => `
        <li class="stage-editor-card">
          <div><strong>${escapeHtml(section.stage)}</strong></div>
          <div>内容简介：${escapeHtml(section.content)}</div>
          <div class="stage-range-editor">
            <label>
              起始章
              <input id="stage-start-${index}" type="number" min="1" max="${state.outline.chapter_count}" value="${section.start_chapter}" ${index === 0 ? "disabled" : ""} />
            </label>
            <label>
              结束章
              <input id="stage-end-${index}" type="number" min="1" max="${state.outline.chapter_count}" value="${section.end_chapter}" ${index === lastStageIndex ? "disabled" : ""} />
            </label>
          </div>
          <div>当前范围：第${section.start_chapter}章-第${section.end_chapter}章</div>
        </li>
      `,
    )
    .join("");

  elements.outlineResult.className = "outline-result";
  elements.outlineResult.innerHTML = `
    <article class="outline-card">
      <div class="outline-meta">
        <div><strong>标题：</strong>${escapeHtml(state.outline.title)}</div>
        <div><strong>一句话概述：</strong>${escapeHtml(state.outline.logline)}</div>
        <div><strong>故事概述：</strong>${escapeHtml(state.outline.summary)}</div>
        <div><strong>章节数：</strong>${state.outline.chapter_count}</div>
      </div>
      <div class="action-row">
        <strong>四段式结构</strong>
        <button type="button" id="save-stage-ranges" class="ghost-button">保存篇章范围</button>
      </div>
      <p class="micro-tip">第一段起始章固定为 1；结局段结束章固定为总篇章数；某一段的结束章不能超过下一段的起始章。</p>
      <ol class="chapter-plan-list">
        ${actStructureHtml || "<li>本轮大纲未返回四段式结构。</li>"}
      </ol>
      <div>
        <strong>LLM 补完信息</strong>
        <ul class="inferred-list">
          ${
            state.outline.inferred_details.length
              ? state.outline.inferred_details.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
              : "<li>本轮没有额外补完信息。</li>"
          }
        </ul>
      </div>
      <div>
        <strong>章节规划</strong>
        <ol class="chapter-plan-list">
          ${state.outline.chapters
            .map(
              (chapter) => `
                <li>
                  <strong>第 ${chapter.chapter_number} 章｜${escapeHtml(chapter.title)}</strong>
                  <div>目标字数：${chapter.target_words}</div>
                  <div>概要：${escapeHtml(chapter.summary)}</div>
                  <div>关键事件：${chapter.key_events.map(escapeHtml).join(" / ")}</div>
                  <div>章末收束：${escapeHtml(chapter.cliffhanger || "无")}</div>
                </li>`,
            )
            .join("")}
        </ol>
      </div>
    </article>
  `;

  const saveButton = document.querySelector("#save-stage-ranges");
  if (saveButton) {
    saveButton.addEventListener("click", () => saveActStructureEdits(false));
  }
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
  if (!state.generatedStory) {
    elements.storyResult.className = "story-result empty-state";
    elements.storyResult.textContent = "大纲确认后，这里会依次展示每个篇章的正文。";
    return;
  }

  elements.storyResult.className = "story-result";
  elements.storyResult.innerHTML = state.generatedStory.chapters
    .map(
      (chapter, index) => `
        <details class="chapter-card" ${index === 0 ? "open" : ""}>
          <summary>第 ${chapter.chapter_number} 章｜${escapeHtml(chapter.title)}</summary>
          <div class="chapter-card-toolbar">
            <button type="button" class="ghost-button" data-export-chapter="${chapter.chapter_number}">导出本章</button>
          </div>
          <p><strong>章节摘要：</strong>${escapeHtml(chapter.summary)}</p>
          <div class="chapter-content">${escapeHtml(chapter.content)}</div>
        </details>
      `,
    )
    .join("");
}

function setBusyState(message) {
  elements.statusPill.textContent = "处理中";
  elements.statusPill.classList.add("busy");
  elements.statusPill.classList.remove("paused");
  elements.statusBox.textContent = message;
}

function setPausedState(message) {
  elements.statusPill.textContent = "已暂停";
  elements.statusPill.classList.remove("busy");
  elements.statusPill.classList.add("paused");
  elements.statusBox.textContent = message;
}

function setStatus(message, keepBusy = false, isError = false) {
  elements.statusPill.textContent = isError ? "出错了" : keepBusy ? "处理中" : "就绪";
  elements.statusPill.classList.toggle("busy", keepBusy);
  elements.statusPill.classList.remove("paused");
  elements.statusBox.textContent = message;
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
