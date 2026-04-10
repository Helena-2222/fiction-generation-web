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
  outline: null,
  generatedStory: null,
  pendingEdge: null,
  relationEditor: null,
  relationDeleteRequest: null,
};

let nextCharacterColorIndex = 0;

const elements = {
  genreOptions: document.querySelector("#genre-options"),
  styleOptions: document.querySelector("#style-options"),
  customGenre: document.querySelector("#custom-genre"),
  customStyle: document.querySelector("#custom-style"),
  totalWords: document.querySelector("#total-words"),
  chapterWords: document.querySelector("#chapter-words"),
  chapterCount: document.querySelector("#chapter-count"),
  characterList: document.querySelector("#character-list"),
  graphCanvas: document.querySelector("#graph-canvas"),
  graphSvg: document.querySelector("#graph-svg"),
  graphNodes: document.querySelector("#graph-nodes"),
  relationLabels: document.querySelector("#relation-labels"),
  storyForm: document.querySelector("#story-form"),
  addCharacter: document.querySelector("#add-character"),
  outlineResult: document.querySelector("#outline-result"),
  storyResult: document.querySelector("#story-result"),
  statusBox: document.querySelector("#status-box"),
  statusPill: document.querySelector("#status-pill"),
  regenerateOutline: document.querySelector("#regenerate-outline"),
  generateStory: document.querySelector("#generate-story"),
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
  state.characters = [createCharacter(0), createCharacter(1), createCharacter(2)];
  arrangeCharacterGraph();
  renderChipGroup(elements.genreOptions, GENRE_OPTIONS, "genre");
  renderChipGroup(elements.styleOptions, STYLE_OPTIONS, "style");
  elements.totalWords.addEventListener("input", updateChapterEstimate);
  elements.chapterWords.addEventListener("input", updateChapterEstimate);
  elements.addCharacter.addEventListener("click", () => {
    state.characters.push(createCharacter(state.characters.length));
    arrangeCharacterGraph();
    renderCharacters();
    renderGraph();
  });
  elements.storyForm.addEventListener("submit", handleOutlineSubmit);
  elements.regenerateOutline.addEventListener("click", handleOutlineRegenerate);
  elements.generateStory.addEventListener("click", handleStoryGenerate);
  elements.relationModalClose.addEventListener("click", closeRelationModal);
  elements.relationSaveButton.addEventListener("click", saveRelationModal);
  elements.relationLabelInput.addEventListener("input", () => {
    if (elements.relationReverseToggle.checked) {
      elements.reverseRelationLabelInput.value = elements.relationLabelInput.value.trim();
    }
  });
  elements.relationReverseToggle.addEventListener("change", () => {
    elements.reverseRelationGroup.classList.add("hidden");
    elements.reverseRelationLabelInput.value = elements.relationReverseToggle.checked
      ? elements.relationLabelInput.value.trim()
      : "";
  });
  elements.relationModal.addEventListener("click", (event) => {
    if (event.target === elements.relationModal) {
      closeRelationModal();
    }
  });
  elements.relationDeleteConfirm.addEventListener("click", confirmRelationDelete);
  elements.relationDeleteCancel.addEventListener("click", closeRelationDeleteModal);
  elements.relationDeleteModal.addEventListener("click", (event) => {
    if (event.target === elements.relationDeleteModal) {
      closeRelationDeleteModal();
    }
  });
  window.addEventListener("resize", renderGraph);
  setupGraphInteractions();
  updateChapterEstimate();
  renderCharacters();
  renderGraph();
  setStatus("填写左侧信息后，先生成故事大纲；若不满意，可以补充反馈并重生成。", false);
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
  };
}

function openRelationModal(sourceId, targetId, draftAnchors = null) {
  const sourceName = getCharacterName(sourceId);
  const targetName = getCharacterName(targetId);
  const forward = state.relations.find((relation) => relation.source_id === sourceId && relation.target_id === targetId) || null;
  const reverse = state.relations.find((relation) => relation.source_id === targetId && relation.target_id === sourceId) || null;
  const hadBidirectionalReverse = isBidirectionalRelationPair(forward, reverse);

  state.relationEditor = {
    sourceId,
    targetId,
    key: makePairKey(sourceId, targetId),
    forwardSourceAnchor: cloneAnchor(draftAnchors?.forwardSourceAnchor || forward?.source_anchor),
    forwardTargetAnchor: cloneAnchor(draftAnchors?.forwardTargetAnchor || forward?.target_anchor),
    reverseSourceAnchor: cloneAnchor(draftAnchors?.reverseSourceAnchor || reverse?.source_anchor),
    reverseTargetAnchor: cloneAnchor(draftAnchors?.reverseTargetAnchor || reverse?.target_anchor),
    hadBidirectionalReverse,
  };
  elements.relationDirection.textContent = `${sourceName} → ${targetName}`;
  elements.relationLabelInput.value = forward?.label || "";
  elements.relationReverseToggle.checked = hadBidirectionalReverse;
  elements.reverseRelationGroup.classList.add("hidden");
  elements.reverseRelationLabelInput.value = hadBidirectionalReverse ? forward?.label || "" : "";
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
  const reverseLabel = wantsReverse ? forwardLabel : "";

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
      ),
    );
  } else if (state.relationEditor.hadBidirectionalReverse) {
    state.relations = state.relations.filter(
      (relation) => !isSameRelationDirection(relation, target.id, source.id),
    );
  }

  syncRelationNames();
  renderGraph();
  closeRelationModal();
  setStatus("角色关系已保存。", false);
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
    setStatus("角色关系已删除。", false);
  }
}

function deleteRelationPair(pairKey, silent = false) {
  state.relations = state.relations.filter((relation) => makePairKey(relation.source_id, relation.target_id) !== pairKey);
  renderGraph();
  if (!silent) {
    setStatus("角色关系已删除。", false);
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
  }));
}

async function handleOutlineSubmit(event) {
  event.preventDefault();
  const payload = buildStoryPayload();
  if (!payload.synopsis) {
    setStatus("请先填写故事梗概。", false, true);
    return;
  }

  setBusyState("正在让 DeepSeek 生成故事大纲...");
  elements.regenerateOutline.disabled = true;
  elements.generateStory.disabled = true;

  try {
    const outline = await postJson("/api/outline", {
      story: payload,
      feedback: "",
      previous_outline: null,
    });
    state.outline = normalizeOutline(outline);
    state.generatedStory = null;
    renderOutline();
    renderStory();
    elements.regenerateOutline.disabled = false;
    elements.generateStory.disabled = false;
    setStatus("大纲已生成，可以继续重生成，或直接按当前大纲生成全文。", false);
  } catch (error) {
    setStatus(error.message || "大纲生成失败。", false, true);
  }
}

async function handleOutlineRegenerate() {
  if (!state.outline) {
    return;
  }

  setBusyState("正在根据反馈重生成大纲...");
  elements.regenerateOutline.disabled = true;
  elements.generateStory.disabled = true;

  try {
    const outline = await postJson("/api/outline", {
      story: buildStoryPayload(),
      feedback: elements.outlineFeedback.value.trim(),
      previous_outline: state.outline,
    });
    state.outline = normalizeOutline(outline);
    renderOutline();
    elements.regenerateOutline.disabled = false;
    elements.generateStory.disabled = false;
    setStatus("新的大纲已经生成，可以继续调整，或开始逐章创作。", false);
  } catch (error) {
    setStatus(error.message || "重生成失败。", false, true);
  }
}

async function handleStoryGenerate() {
  if (!state.outline) {
    return;
  }

  if (!saveActStructureEdits(true)) {
    return;
  }

  setBusyState("正在依次生成章节正文，这一步可能需要一些时间...");
  elements.generateStory.disabled = true;
  elements.regenerateOutline.disabled = true;

  try {
    const story = await postJson("/api/story", {
      story: buildStoryPayload(),
      outline: state.outline,
    });
    state.generatedStory = story;
    renderStory();
    elements.generateStory.disabled = false;
    elements.regenerateOutline.disabled = false;
    setStatus("全文生成完成。你可以继续修改设定后重新走一次流程。", false);
  } catch (error) {
    setStatus(error.message || "正文生成失败。", false, true);
  }
}

function buildStoryPayload() {
  syncRelationNames();
  return {
    genre: elements.customGenre.value.trim() || state.genre,
    synopsis: document.querySelector("#synopsis").value.trim(),
    style: elements.customStyle.value.trim() || state.style,
    worldview_time: document.querySelector("#worldview-time").value.trim(),
    worldview_physical: document.querySelector("#worldview-physical").value.trim(),
    worldview_social: document.querySelector("#worldview-social").value.trim(),
    total_words: Number(elements.totalWords.value) || 0,
    chapter_words: Number(elements.chapterWords.value) || null,
    characters: state.characters,
    relations: state.relations.map((relation) => ({
      id: relation.id,
      source_id: relation.source_id,
      target_id: relation.target_id,
      label: relation.label,
      source_name: relation.source_name || "",
      target_name: relation.target_name || "",
    })),
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
        <div><strong>一句话卖点：</strong>${escapeHtml(state.outline.logline)}</div>
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
  elements.statusBox.textContent = message;
}

function setStatus(message, keepBusy = false, isError = false) {
  elements.statusPill.textContent = isError ? "出错了" : keepBusy ? "处理中" : "就绪";
  elements.statusPill.classList.toggle("busy", keepBusy);
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
