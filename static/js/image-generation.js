const API_BASE = "/api/images";

const characterData = [];
const chapterData = [];
const characterResults = new Map();
const characterTaskStates = new Map();
const chapterResults = new Map();
const chapterTaskStates = new Map();

let currentCharacterIndex = 0;
let currentChapterIndex = 0;
let characterGenerationRunning = false;
let chapterGenerationRunning = false;

function normalizeEmpty(value) {
  const text = (value ?? "").toString().trim();
  return text === "未填写" ? "" : text;
}

function currentCharacterKey() {
  return normalizeEmpty(document.getElementById("characterNameInput").value);
}

function currentChapterKey() {
  return normalizeEmpty(document.getElementById("chapterIdInput").value);
}

function collectChapterReferenceAssetIds() {
  return collectChapterCharacterConstraints()
    .map((character) => character.asset_id)
    .filter(Boolean);
}

function collectChapterCharacterConstraints() {
  const chapter = getCurrentChapter();
  if (!chapter || !characterData.length) return [];

  const sourceText = [
    normalizeEmpty(chapter.title),
    normalizeEmpty(chapter.events),
    normalizeEmpty(chapter.prompt),
  ]
    .join(" ")
    .trim();

  if (!sourceText) return [];

  const constraints = [];
  const seen = new Set();

  characterData.forEach((character) => {
    const name = normalizeEmpty(character.name);
    if (!name || !sourceText.includes(name)) return;
    const result = characterResults.get(name);
    const assetId = result?.assetId;
    const dedupeKey = assetId || name;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    constraints.push({
      name,
      gender: normalizeEmpty(character.gender),
      ethnicity: normalizeEmpty(character.ethnicity),
      age: normalizeEmpty(character.age),
      job: normalizeEmpty(character.job),
      appearance: normalizeEmpty(character.appearance),
      costume: normalizeEmpty(character.costume),
      personality: normalizeEmpty(character.personality),
      asset_id: assetId || "",
    });
  });

  return constraints;
}

function setTab(targetId) {
  document.querySelectorAll(".image-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.target === targetId);
  });
  document.querySelectorAll(".image-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === targetId);
  });
}

document.querySelectorAll(".image-tab").forEach((tab) => {
  tab.addEventListener("click", () => setTab(tab.dataset.target));
});

document.getElementById("goCharacterBtn").addEventListener("click", () => setTab("character-panel"));
document.getElementById("goChapterBtn").addEventListener("click", () => setTab("chapter-panel"));

function getCurrentCharacter() {
  return characterData[currentCharacterIndex] ?? null;
}

function getCurrentChapter() {
  return chapterData[currentChapterIndex] ?? null;
}

function renderCharacterList() {
  const list = document.getElementById("characterList");
  list.innerHTML = "";

  if (!characterData.length) {
    const li = document.createElement("li");
    li.textContent = "未导入角色数据";
    list.appendChild(li);
    return;
  }

  characterData.forEach((character, index) => {
    const li = document.createElement("li");
    li.dataset.index = String(index);
    li.classList.toggle("is-selected", index === currentCharacterIndex);
    const name = normalizeEmpty(character.name) || `角色${index + 1}`;
    const job = normalizeEmpty(character.job);
    li.textContent = job ? `${name}（${job}）` : name;
    li.addEventListener("click", () => {
      currentCharacterIndex = index;
      fillCharacter(index);
      renderCharacterList();
    });
    list.appendChild(li);
  });
}

function renderChapterList() {
  const list = document.getElementById("chapterList");
  list.innerHTML = "";

  if (!chapterData.length) {
    const li = document.createElement("li");
    li.textContent = "未导入章节数据";
    list.appendChild(li);
    return;
  }

  chapterData.forEach((chapter, index) => {
    const li = document.createElement("li");
    li.dataset.index = String(index);
    li.classList.toggle("is-selected", index === currentChapterIndex);
    li.textContent = normalizeEmpty(chapter.title) || `第${index + 1}章`;
    li.addEventListener("click", () => {
      currentChapterIndex = index;
      fillChapter(index);
      renderChapterList();
    });
    list.appendChild(li);
  });
}

function fillCharacter(index) {
  const character = characterData[index];
  if (!character) return;
  document.getElementById("characterNameInput").value = normalizeEmpty(character.name);
  document.getElementById("characterGenderInput").value = normalizeEmpty(character.gender);
  document.getElementById("characterAgeInput").value = normalizeEmpty(character.age);
  document.getElementById("characterEthnicityInput").value = normalizeEmpty(character.ethnicity);
  document.getElementById("characterJobInput").value = normalizeEmpty(character.job);
  document.getElementById("characterAppearanceInput").value = normalizeEmpty(character.appearance);
  document.getElementById("characterCostumeInput").value = normalizeEmpty(character.costume);
  document.getElementById("characterPersonalityInput").value = normalizeEmpty(character.personality);
  renderCharacterResult();
}

function fillChapter(index) {
  const chapter = chapterData[index];
  if (!chapter) return;
  document.getElementById("chapterIdInput").value = normalizeEmpty(chapter.id);
  document.getElementById("chapterTitleInput").value = normalizeEmpty(chapter.title);
  document.getElementById("chapterEventsInput").value = normalizeEmpty(chapter.events);
  document.getElementById("chapterPromptInput").value = normalizeEmpty(chapter.prompt);
  renderChapterResult();
}

function syncCurrentCharacterField(field, value) {
  const current = getCurrentCharacter();
  if (!current) return;
  current[field] = value;
  renderCharacterList();
}

[
  ["characterNameInput", "name"],
  ["characterGenderInput", "gender"],
  ["characterAgeInput", "age"],
  ["characterEthnicityInput", "ethnicity"],
  ["characterJobInput", "job"],
  ["characterAppearanceInput", "appearance"],
  ["characterCostumeInput", "costume"],
  ["characterPersonalityInput", "personality"],
].forEach(([id, field]) => {
  const input = document.getElementById(id);
  input.addEventListener("input", (event) => syncCurrentCharacterField(field, event.target.value));
});

[
  ["chapterIdInput", "id"],
  ["chapterTitleInput", "title"],
  ["chapterEventsInput", "events"],
  ["chapterPromptInput", "prompt"],
].forEach(([id, field]) => {
  const input = document.getElementById(id);
  input.addEventListener("input", (event) => {
    const current = getCurrentChapter();
    if (!current) return;
    current[field] = event.target.value;
    if (field === "title") {
      renderChapterList();
    }
  });
});

function setCharacterStatus(text, className = "") {
  const node = document.getElementById("characterTaskStatus");
  node.textContent = text;
  node.className = `result-status ${className}`.trim();
}

function setChapterStatus(text, className = "") {
  const node = document.getElementById("chapterTaskStatus");
  node.textContent = text;
  node.className = `result-status ${className}`.trim();
}

function setChapterDownloadEnabled(enabled) {
  const button = document.getElementById("downloadChapterBtn");
  button.disabled = !enabled;
}

function setChapterPreviewEnabled(enabled) {
  const button = document.getElementById("previewChapterBtn");
  button.disabled = false;
  button.classList.toggle("is-inactive", !enabled);
  button.setAttribute("aria-disabled", enabled ? "false" : "true");
}

function resetCharacterResultView() {
  const img = document.getElementById("characterResultImage");
  const placeholder = document.getElementById("characterResultPlaceholder");
  const downloadBtn = document.getElementById("downloadTurnaroundBtn");
  img.removeAttribute("src");
  img.style.display = "none";
  placeholder.style.display = "block";
  downloadBtn.href = "#";
  downloadBtn.classList.add("is-disabled");
}

function renderCharacterResult() {
  const key = currentCharacterKey();
  const result = characterResults.get(key);
  const taskState = characterTaskStates.get(key);
  if (!result) {
    resetCharacterResultView();
    setCharacterStatus(taskState?.text || "状态：待生成", taskState?.className || "");
    return;
  }

  const img = document.getElementById("characterResultImage");
  const placeholder = document.getElementById("characterResultPlaceholder");
  const downloadBtn = document.getElementById("downloadTurnaroundBtn");
  img.src = result.previewUrl;
  img.style.display = "block";
  placeholder.style.display = "none";
  downloadBtn.href = result.downloadUrl;
  downloadBtn.classList.remove("is-disabled");
  setCharacterStatus(taskState?.text || result.statusText || "状态：success", taskState?.className || "success");
}

function renderChapterResultLegacy() {
  const grid = document.getElementById("chapterResultGrid");
  const key = currentChapterKey();
  const result = chapterResults.get(key);
  const taskState = chapterTaskStates.get(key);
  grid.innerHTML = "";

  if (!result || !result.images.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "chapter-placeholder";
    placeholder.textContent = "当前章节配图会显示在这里";
    grid.appendChild(placeholder);
    setChapterDownloadEnabled(false);
    setChapterPreviewEnabled(false);
    setChapterStatus(taskState?.text || "状态：待生成", taskState?.className || "");
    return;
  }

  result.images.forEach((image) => {
    const card = document.createElement("div");
    card.className = "chapter-image-card";

    const tools = document.createElement("div");
    tools.className = "chapter-image-tools";

    const download = document.createElement("a");
    download.className = "icon-button";
    download.href = image.downloadUrl;
    download.textContent = "⤓";
    download.title = "下载本图";

    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "icon-button";
    preview.textContent = "⤢";
    preview.title = "放大查看";
    preview.addEventListener("click", () => openPreview(image.previewUrl));

    tools.append(download, preview);

    const img = document.createElement("img");
    img.src = image.previewUrl;
    img.alt = "章节配图";

    card.append(tools, img);
    grid.appendChild(card);
  });

  setChapterDownloadEnabled(true);
  setChapterPreviewEnabled(true);
  setChapterStatus(taskState?.text || result.statusText || "状态：success", taskState?.className || "success");
}

function mapImportedCharacters(list) {
  characterData.length = 0;
  list.forEach((item) => {
    characterData.push({
      name: normalizeEmpty(item.name),
      gender: normalizeEmpty(item.gender),
      age: normalizeEmpty(item.age),
      ethnicity: normalizeEmpty(item.ethnicity),
      job: normalizeEmpty(item.job),
      appearance: normalizeEmpty(item.appearance),
      costume: normalizeEmpty(item.costume),
      personality: normalizeEmpty(item.personality),
    });
  });
  currentCharacterIndex = 0;
  renderCharacterList();
  fillCharacter(0);
}

function mapImportedChapters(list) {
  chapterData.length = 0;
  list.forEach((item, index) => {
    chapterData.push({
      id: normalizeEmpty(item.id) || `ch${index + 1}`,
      title: normalizeEmpty(item.title) || `第${index + 1}章`,
      events: normalizeEmpty(item.events),
      prompt: normalizeEmpty(item.prompt),
    });
  });
  currentChapterIndex = 0;
  renderChapterList();
  fillChapter(0);
}

async function importFromDocx() {
  const status = document.getElementById("importDocxStatus");
  const input = document.getElementById("docxFileInput");
  const file = input.files?.[0];
  if (!file) {
    status.textContent = "请先选择 .docx 文件";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  status.textContent = "正在解析 Word...";

  const response = await fetch(`${API_BASE}/import/docx`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail);
  }

  const data = await response.json();
  document.getElementById("novelTitleInput").value = normalizeEmpty(data.novel_title);
  document.getElementById("worldSettingInput").value = normalizeEmpty(data.world_setting);
  document.getElementById("eraInput").value = normalizeEmpty(data.era);
  document.getElementById("languageStyleInput").value = normalizeEmpty(data.language_style);

  if (Array.isArray(data.characters) && data.characters.length) {
    mapImportedCharacters(data.characters);
  } else {
    characterData.length = 0;
    renderCharacterList();
    resetCharacterResultView();
    setCharacterStatus("状态：待生成");
  }

  if (Array.isArray(data.chapters) && data.chapters.length) {
    mapImportedChapters(data.chapters);
  } else {
    chapterData.length = 0;
    renderChapterList();
    renderChapterResult();
  }

  status.textContent = "导入成功：已自动填充小说、角色和章节信息";
}

async function pollTask(taskId, statusSetter, stateMap, stateKey) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`查询任务失败：${response.status}`);
    }
    const data = await response.json();

    if (data.status === "queued" || data.status === "running") {
      const className = "running";
      const text = `状态：${data.status} (${data.progress}%)`;
      stateMap.set(stateKey, { text, className });
      statusSetter(text, className);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    return data;
  }

  throw new Error("轮询超时，请稍后重试");
}

async function submitCharacterTurnaround() {
  const payload = {
    project_id: "novel_demo_001",
    novel_title: document.getElementById("novelTitleInput").value.trim(),
    world_setting: document.getElementById("worldSettingInput").value.trim(),
    era: document.getElementById("eraInput").value.trim(),
    language_style: document.getElementById("languageStyleInput").value.trim(),
    visual_style: document.getElementById("visualStyleInput").value.trim(),
    aspect_ratio: document.getElementById("aspectRatioInput").value,
    quality: document.getElementById("qualityInput").value,
    character_name: document.getElementById("characterNameInput").value.trim(),
    gender: document.getElementById("characterGenderInput").value.trim(),
    age: document.getElementById("characterAgeInput").value.trim(),
    ethnicity: document.getElementById("characterEthnicityInput").value.trim(),
    job: document.getElementById("characterJobInput").value.trim(),
    appearance: document.getElementById("characterAppearanceInput").value.trim(),
    costume: document.getElementById("characterCostumeInput").value.trim(),
    personality: document.getElementById("characterPersonalityInput").value.trim(),
  };

  const response = await fetch(`${API_BASE}/characters/turnaround`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function runCharacterGeneration() {
  if (!characterData.length) {
    setCharacterStatus("状态：请先导入 Word 并填充角色数据");
    return;
  }
  if (characterGenerationRunning) return;

  characterGenerationRunning = true;
  document.getElementById("generateTurnaroundBtn").disabled = true;
  document.getElementById("regenerateTurnaroundBtn").disabled = true;

  const key = currentCharacterKey();
  try {
    const created = await submitCharacterTurnaround();
    const queuedText = `状态：queued (${created.task_id})`;
    characterTaskStates.set(key, { text: queuedText, className: "running" });
    setCharacterStatus(queuedText, "running");

    const finalData = await pollTask(created.task_id, setCharacterStatus, characterTaskStates, key);
    if (finalData.status !== "success") {
      throw new Error(finalData.error_message || "生成失败");
    }
    const item = finalData.result?.[0];
    if (!item?.file_url) {
      throw new Error("任务成功但未返回图片地址");
    }

    characterResults.set(key, {
      assetId: item.asset_id || "",
      previewUrl: item.file_url,
      downloadUrl: item.asset_id ? `${API_BASE}/assets/${item.asset_id}/download` : item.file_url,
      statusText: "状态：success",
    });
    characterTaskStates.set(key, { text: "状态：success", className: "success" });
    renderCharacterResult();
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    characterTaskStates.set(key, { text: `状态：failed（${message}）`, className: "" });
    setCharacterStatus(`状态：failed（${message}）`);
  } finally {
    characterGenerationRunning = false;
    document.getElementById("generateTurnaroundBtn").disabled = false;
    document.getElementById("regenerateTurnaroundBtn").disabled = false;
  }
}

async function submitChapterGeneration() {
  const involvedCharacters = collectChapterCharacterConstraints();
  const payload = {
    project_id: "novel_demo_001",
    novel_title: document.getElementById("novelTitleInput").value.trim(),
    world_setting: document.getElementById("worldSettingInput").value.trim(),
    era: document.getElementById("eraInput").value.trim(),
    language_style: document.getElementById("languageStyleInput").value.trim(),
    visual_style: document.getElementById("visualStyleInput").value.trim(),
    chapter_id: document.getElementById("chapterIdInput").value.trim(),
    chapter_title: document.getElementById("chapterTitleInput").value.trim(),
    key_events: document.getElementById("chapterEventsInput").value.trim(),
    prompt: document.getElementById("chapterPromptInput").value.trim(),
    reference_asset_ids: involvedCharacters.map((character) => character.asset_id).filter(Boolean),
    involved_characters: involvedCharacters,
    image_count: 1,
    aspect_ratio: document.getElementById("aspectRatioInput").value,
    quality: document.getElementById("qualityInput").value,
  };
  const response = await fetch(`${API_BASE}/chapters/illustrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function runChapterGeneration() {
  if (!chapterData.length) {
    setChapterStatus("状态：请先导入章节数据");
    return;
  }
  if (chapterGenerationRunning) return;

  chapterGenerationRunning = true;
  document.getElementById("generateChapterBtn").disabled = true;
  document.getElementById("regenerateChapterBtn").disabled = true;

  const key = currentChapterKey();
  try {
    const created = await submitChapterGeneration();
    const queuedText = `状态：queued (${created.task_id})`;
    chapterTaskStates.set(key, { text: queuedText, className: "running" });
    setChapterStatus(queuedText, "running");

    const finalData = await pollTask(created.task_id, setChapterStatus, chapterTaskStates, key);
    if (finalData.status !== "success") {
      throw new Error(finalData.error_message || "生成失败");
    }

    const images = (finalData.result || []).map((item) => ({
      previewUrl: item.file_url,
      downloadUrl: item.asset_id ? `${API_BASE}/assets/${item.asset_id}/download` : item.file_url,
    }));
    chapterResults.set(key, {
      images,
      statusText: "状态：success",
    });
    chapterTaskStates.set(key, { text: "状态：success", className: "success" });
    renderChapterResult();
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    chapterTaskStates.set(key, { text: `状态：failed（${message}）`, className: "" });
    setChapterStatus(`状态：failed（${message}）`);
  } finally {
    chapterGenerationRunning = false;
    document.getElementById("generateChapterBtn").disabled = false;
    document.getElementById("regenerateChapterBtn").disabled = false;
  }
}

function openPreview(src) {
  const modal = document.getElementById("imagePreviewModal");
  const image = document.getElementById("previewImage");
  image.src = src;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closePreview() {
  const modal = document.getElementById("imagePreviewModal");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

document.getElementById("previewTurnaroundBtn").addEventListener("click", () => {
  const src = document.getElementById("characterResultImage").getAttribute("src");
  if (src) openPreview(src);
});
document.getElementById("closePreviewBtn").addEventListener("click", closePreview);
document.getElementById("imagePreviewModal").addEventListener("click", (event) => {
  if (event.target.id === "imagePreviewModal") closePreview();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePreview();
});

document.getElementById("importDocxBtn").addEventListener("click", async () => {
  try {
    await importFromDocx();
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败";
    document.getElementById("importDocxStatus").textContent = `导入失败：${message}`;
  }
});

document.getElementById("generateTurnaroundBtn").addEventListener("click", runCharacterGeneration);
document.getElementById("regenerateTurnaroundBtn").addEventListener("click", runCharacterGeneration);
document.getElementById("generateChapterBtn").addEventListener("click", runChapterGeneration);
document.getElementById("regenerateChapterBtn").addEventListener("click", runChapterGeneration);
document.getElementById("downloadChapterBtn").addEventListener("click", () => {
  const key = currentChapterKey();
  const result = chapterResults.get(key);
  if (!result?.images?.length) return;
  result.images.forEach((image, index) => {
    setTimeout(() => {
      const anchor = document.createElement("a");
      anchor.href = image.downloadUrl;
      anchor.click();
    }, index * 250);
  });
});
document.getElementById("previewChapterBtn").addEventListener("click", () => {
  const key = currentChapterKey();
  const result = chapterResults.get(key);
  const firstImage = result?.images?.[0];
  if (!firstImage?.previewUrl) return;
  openPreview(firstImage.previewUrl);
});

function renderChapterResult() {
  const grid = document.getElementById("chapterResultGrid");
  const key = currentChapterKey();
  const result = chapterResults.get(key);
  const taskState = chapterTaskStates.get(key);

  grid.innerHTML = "";
  grid.classList.toggle("has-multiple", Boolean(result?.images?.length > 1));

  if (!result || !result.images.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "chapter-placeholder";
    placeholder.textContent = "当前章节配图会显示在这里";
    grid.appendChild(placeholder);
    setChapterDownloadEnabled(false);
    setChapterPreviewEnabled(false);
    setChapterStatus(taskState?.text || "状态：待生成", taskState?.className || "");
    return;
  }

  result.images.forEach((image) => {
    const card = document.createElement("div");
    card.className = "chapter-image-card";

    const img = document.createElement("img");
    img.src = image.previewUrl;
    img.alt = "章节配图";
    img.loading = "lazy";
    img.addEventListener("click", () => openPreview(image.previewUrl));

    card.appendChild(img);
    grid.appendChild(card);
  });

  setChapterDownloadEnabled(true);
  setChapterPreviewEnabled(true);
  setChapterStatus(taskState?.text || result.statusText || "状态：success", taskState?.className || "success");
}

renderCharacterList();
renderChapterList();
resetCharacterResultView();
setChapterDownloadEnabled(false);
setChapterPreviewEnabled(false);
renderChapterResult();
