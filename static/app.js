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

const state = {
  genre: "科幻",
  style: "电影感",
  characters: [],
  relations: [],
  outline: null,
  generatedStory: null,
  pendingEdge: null,
  draggingNode: null,
};

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
};

function generateId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createCharacter(index) {
  const angle = (index / 3) * Math.PI * 2;
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
    graph_x: 240 + Math.cos(angle) * 120,
    graph_y: 180 + Math.sin(angle) * 90,
  };
}

function init() {
  state.characters = [createCharacter(0), createCharacter(1), createCharacter(2)];
  renderChipGroup(elements.genreOptions, GENRE_OPTIONS, "genre");
  renderChipGroup(elements.styleOptions, STYLE_OPTIONS, "style");
  elements.totalWords.addEventListener("input", updateChapterEstimate);
  elements.chapterWords.addEventListener("input", updateChapterEstimate);
  elements.addCharacter.addEventListener("click", () => {
    state.characters.push(createCharacter(state.characters.length));
    renderCharacters();
    renderGraph();
  });
  elements.storyForm.addEventListener("submit", handleOutlineSubmit);
  elements.regenerateOutline.addEventListener("click", handleOutlineRegenerate);
  elements.generateStory.addEventListener("click", handleStoryGenerate);
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
  const count = Math.max(1, Math.ceil(totalWords / chapterWords || 1));
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
  syncRelationNames();
  renderCharacters();
  renderGraph();
}

function setupGraphInteractions() {
  elements.graphCanvas.addEventListener("pointermove", (event) => {
    const rect = elements.graphCanvas.getBoundingClientRect();
    if (state.draggingNode) {
      const character = state.characters.find((item) => item.id === state.draggingNode.id);
      if (!character) {
        return;
      }
      character.graph_x = clamp(event.clientX - rect.left - 77, 0, rect.width - 154);
      character.graph_y = clamp(event.clientY - rect.top - 38, 0, rect.height - 76);
      renderGraph();
      return;
    }

    if (state.pendingEdge) {
      state.pendingEdge.currentX = event.clientX - rect.left;
      state.pendingEdge.currentY = event.clientY - rect.top;
      renderGraph();
    }
  });

  window.addEventListener("pointerup", () => {
    state.draggingNode = null;
    if (state.pendingEdge) {
      state.pendingEdge = null;
      renderGraph();
    }
  });
}

function renderGraph() {
  const width = elements.graphCanvas.clientWidth || 700;
  const height = elements.graphCanvas.clientHeight || 440;
  elements.graphSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  elements.graphSvg.innerHTML = "";
  elements.graphNodes.innerHTML = "";
  elements.relationLabels.innerHTML = "";

  state.relations.forEach((relation) => {
    const source = state.characters.find((character) => character.id === relation.source_id);
    const target = state.characters.find((character) => character.id === relation.target_id);
    if (!source || !target) {
      return;
    }

    const x1 = source.graph_x + 77;
    const y1 = source.graph_y + 38;
    const x2 = target.graph_x + 77;
    const y2 = target.graph_y + 38;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#8e4a38");
    line.setAttribute("stroke-width", "2.4");
    line.setAttribute("stroke-linecap", "round");
    elements.graphSvg.appendChild(line);

    const badge = document.createElement("div");
    badge.className = "relation-badge";
    badge.style.left = `${(x1 + x2) / 2}px`;
    badge.style.top = `${(y1 + y2) / 2}px`;

    const input = document.createElement("input");
    input.type = "text";
    input.value = relation.label || "";
    input.setAttribute("list", "relation-presets");
    input.placeholder = `${source.name || "角色"} 与 ${target.name || "角色"}`;
    input.addEventListener("input", (event) => {
      relation.label = event.target.value;
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "tiny-button";
    removeButton.textContent = "删";
    removeButton.addEventListener("click", () => {
      state.relations = state.relations.filter((item) => item.id !== relation.id);
      renderGraph();
    });

    badge.append(input, removeButton);
    elements.relationLabels.appendChild(badge);
  });

  if (state.pendingEdge) {
    const preview = document.createElementNS("http://www.w3.org/2000/svg", "line");
    preview.setAttribute("x1", state.pendingEdge.startX);
    preview.setAttribute("y1", state.pendingEdge.startY);
    preview.setAttribute("x2", state.pendingEdge.currentX);
    preview.setAttribute("y2", state.pendingEdge.currentY);
    preview.setAttribute("stroke", "#9d3a2f");
    preview.setAttribute("stroke-width", "2");
    preview.setAttribute("stroke-dasharray", "8 6");
    elements.graphSvg.appendChild(preview);
  }

  state.characters.forEach((character, index) => {
    const node = document.createElement("div");
    node.className = `graph-node ${state.draggingNode?.id === character.id ? "dragging" : ""}`;
    node.style.left = `${clamp(character.graph_x, 0, width - 154)}px`;
    node.style.top = `${clamp(character.graph_y, 0, height - 76)}px`;
    node.dataset.id = character.id;

    const name = document.createElement("div");
    name.className = "graph-node-name";
    name.textContent = character.name || `角色 ${index + 1}`;

    const anchor = document.createElement("div");
    anchor.className = "graph-anchor";
    anchor.title = "拖到其他角色上建立关系";
    anchor.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      const rect = elements.graphCanvas.getBoundingClientRect();
      state.pendingEdge = {
        sourceId: character.id,
        startX: character.graph_x + 154,
        startY: character.graph_y + 38,
        currentX: event.clientX - rect.left,
        currentY: event.clientY - rect.top,
      };
      renderGraph();
    });

    node.addEventListener("pointerdown", (event) => {
      if (event.target === anchor) {
        return;
      }
      state.draggingNode = { id: character.id };
      node.setPointerCapture(event.pointerId);
    });

    node.addEventListener("pointerup", () => {
      if (state.pendingEdge && state.pendingEdge.sourceId !== character.id) {
        createOrFocusRelation(state.pendingEdge.sourceId, character.id);
        state.pendingEdge = null;
      }
      state.draggingNode = null;
      renderGraph();
    });

    node.append(name, anchor);
    elements.graphNodes.appendChild(node);
  });
}

function createOrFocusRelation(sourceId, targetId) {
  const relationKey = [sourceId, targetId].sort().join("--");
  const existing = state.relations.find((relation) => {
    const currentKey = [relation.source_id, relation.target_id].sort().join("--");
    return currentKey === relationKey;
  });
  if (existing) {
    renderGraph();
    return;
  }

  const source = state.characters.find((character) => character.id === sourceId);
  const target = state.characters.find((character) => character.id === targetId);
  if (!source || !target) {
    return;
  }

  state.relations.push({
    id: generateId("relation"),
    source_id: sourceId,
    target_id: targetId,
    label: "",
    source_name: source.name || "",
    target_name: target.name || "",
  });
  renderGraph();
}

function syncRelationNames() {
  state.relations = state.relations.map((relation) => {
    const source = state.characters.find((character) => character.id === relation.source_id);
    const target = state.characters.find((character) => character.id === relation.target_id);
    return {
      ...relation,
      source_name: source?.name || "",
      target_name: target?.name || "",
    };
  });
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
    relations: state.relations,
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

  if (actStructure.length > 0) {
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
