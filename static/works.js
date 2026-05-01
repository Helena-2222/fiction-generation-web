import {
  DEFAULT_NEXT_PATH,
  buildAuthUrl,
  getCurrentUser,
  getUserDisplayName,
  getUserInitial,
} from "./src/auth-client.js";
import { fetchUserWorkspaceSnapshot } from "./src/cloud-workspace.js";
import { GUEST_WORKSPACE_STORAGE_KEY, WORKSPACE_STORAGE_KEY } from "./src/constants.js";
import {
  buildEmptyWorkSnapshot,
  createWork,
  deleteWork,
  duplicateWork,
  getWorkProgressLabel,
  getWorkWordCount,
  listWorks,
  renameWork,
} from "./src/work-library.js";
import { escapeHtml } from "./src/utils.js";

const BOOK_THEMES = ["bc-teal", "bc-burg", "bc-plum", "bc-slate", "bc-forest", "bc-terra", "bc-ochre", "bc-rose", "bc-navy", "bc-moss"];
const BOOKS_PER_ROW = 5;
const BOOK_SIZE_SCALE = 1.14;

const state = {
  currentUser: null,
  guestMode: false,
  works: [],
  source: "local",
  loading: false,
};

const elements = {
  navLogo: document.querySelector("#nav-logo"),
  navCreate: document.querySelector("#nav-create"),
  navWorks: document.querySelector("#nav-works"),
  navNotes: document.querySelector("#nav-notes"),
  navUserCenter: document.querySelector("#nav-usercenter"),
  title: document.querySelector("#works-title"),
  subtitle: document.querySelector("#works-subtitle"),
  message: document.querySelector("#works-message"),
  shelves: document.querySelector("#works-shelves"),
};

function getQueryFlag(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) === "true";
  } catch {
    return false;
  }
}

function getWorkOptions() {
  return {
    userId: state.currentUser?.id || "",
    guestMode: state.guestMode,
  };
}

function getCreateUrl(workId = "") {
  const params = new URLSearchParams();
  if (state.guestMode) {
    params.set("guest", "true");
  }
  if (workId) {
    params.set("workId", workId);
  } else {
    params.set("stage", "basic");
  }
  return `/create?${params.toString()}`;
}

function getShellUrl(path) {
  const params = new URLSearchParams();
  if (state.guestMode) {
    params.set("guest", "true");
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function syncNavLinks() {
  const createUrl = getCreateUrl(state.works[0]?.id || "");
  if (elements.navLogo) {
    elements.navLogo.href = createUrl;
  }
  if (elements.navCreate) {
    elements.navCreate.href = createUrl;
  }
  if (elements.navWorks) {
    elements.navWorks.href = getShellUrl("/works");
  }
  if (elements.navNotes) {
    elements.navNotes.href = getShellUrl("/mynote");
  }
  if (elements.navUserCenter) {
    elements.navUserCenter.href = getShellUrl("/usercenter");
  }
  syncNavUserAvatar();
}

function syncNavUserAvatar() {
  const avatar = elements.navUserCenter?.querySelector(".nav-user-avatar");
  if (!avatar) {
    return;
  }

  const displayName = state.guestMode || !state.currentUser
    ? "游客模式"
    : getUserDisplayName(state.currentUser);
  const initial = state.guestMode || !state.currentUser
    ? "游"
    : getUserInitial(state.currentUser);
  avatar.textContent = initial;
  elements.navUserCenter.setAttribute("aria-label", displayName);
  elements.navUserCenter.setAttribute("title", displayName);
}

function setMessage(text, isError = false) {
  if (!elements.message) {
    return;
  }
  elements.message.textContent = text || "";
  elements.message.classList.toggle("hidden", !text);
  elements.message.classList.toggle("is-error", Boolean(isError));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function splitTitle(title) {
  const characters = Array.from(String(title || "未命名作品").trim() || "未命名作品");
  if (characters.length <= 5) {
    return escapeHtml(characters.join(""));
  }
  const firstLineLength = Math.ceil(characters.length / 2);
  return `${escapeHtml(characters.slice(0, firstLineLength).join(""))}<br>${escapeHtml(characters.slice(firstLineLength).join(""))}`;
}

function getBookSize(index) {
  const sizes = [
    { width: 130, height: 218 },
    { width: 118, height: 205 },
    { width: 138, height: 225 },
    { width: 124, height: 212 },
    { width: 132, height: 222 },
  ];
  const size = sizes[index % sizes.length];
  return {
    width: Math.round(size.width * BOOK_SIZE_SCALE),
    height: Math.round(size.height * BOOK_SIZE_SCALE),
  };
}

function renderBook(work, index) {
  const size = getBookSize(index);
  const theme = BOOK_THEMES[index % BOOK_THEMES.length];
  const tag = work.genre || work.style || "小说";
  const progress = getWorkProgressLabel(work.snapshot);
  const wordCount = getWorkWordCount(work.snapshot);
  const wordLabel = wordCount ? ` · ${wordCount} 字` : "";

  return `
    <div
      class="book ${theme}"
      style="width:${size.width}px;height:${size.height}px"
      role="button"
      tabindex="0"
      data-open-work="${escapeHtml(work.id)}"
      aria-label="打开 ${escapeHtml(work.title)}"
    >
      <div class="book-inner">
        <div class="book-spine"></div>
        <div class="book-cover">
          <span class="book-top-tag">${escapeHtml(tag)}</span>
          <div>
            <span class="book-title">${splitTitle(work.title)}</span>
            <span class="book-author">我 著</span>
          </div>
        </div>
      </div>
      <div class="book-tooltip">${escapeHtml(work.title)} · ${escapeHtml(progress)}${escapeHtml(wordLabel)}</div>
      <div class="book-actions" aria-label="${escapeHtml(work.title)} 操作">
        <button type="button" class="book-action" data-action="rename" data-work-id="${escapeHtml(work.id)}">改名</button>
        <button type="button" class="book-action" data-action="duplicate" data-work-id="${escapeHtml(work.id)}">复制</button>
        <button type="button" class="book-action" data-action="delete" data-work-id="${escapeHtml(work.id)}">删除</button>
      </div>
    </div>
  `;
}

function renderNewBookSlot() {
  return `
    <button type="button" class="book-new" data-action="new">
      <span class="book-new-icon" aria-hidden="true">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M7 2v10M2 7h10"></path>
        </svg>
      </span>
      <span class="book-new-label">新增书籍</span>
    </button>
  `;
}

function chunkBooks(works) {
  const rendered = [...works];
  const rows = [];
  while (rendered.length) {
    rows.push(rendered.splice(0, BOOKS_PER_ROW));
  }
  if (!rows.length || rows[rows.length - 1].length >= BOOKS_PER_ROW) {
    rows.push([]);
  }
  return rows;
}

function renderShelves() {
  const rows = chunkBooks(state.works);
  let newSlotRendered = false;
  elements.shelves.innerHTML = rows
    .map((row, rowIndex) => {
      const bookOffset = rowIndex * BOOKS_PER_ROW;
      const hasRoomForNewSlot = !newSlotRendered && row.length < BOOKS_PER_ROW;
      if (hasRoomForNewSlot) {
        newSlotRendered = true;
      }
      return `
        <div class="shelf-row">
          <div class="books">
            ${row.map((work, index) => renderBook(work, bookOffset + index)).join("")}
            ${hasRoomForNewSlot ? renderNewBookSlot() : ""}
            <div style="flex:1"></div>
          </div>
          <div class="shelf-plank" aria-hidden="true"></div>
        </div>
      `;
    })
    .join("");
}

function renderChrome() {
  const displayName = state.guestMode ? "游客" : getUserDisplayName(state.currentUser);
  const latest = state.works[0]?.updatedAt;

  elements.title.textContent = `${displayName} 的书架`;
  elements.subtitle.textContent = state.works.length
    ? `共 ${state.works.length} 部作品 · 上次更新于 ${formatDate(latest)}`
    : "还没有作品，先放上第一本。";
  syncNavLinks();
}

function render() {
  renderChrome();
  renderShelves();
}

async function loadLegacySnapshot() {
  try {
    if (state.guestMode) {
      const raw = window.localStorage.getItem(GUEST_WORKSPACE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }

    if (!state.currentUser?.id) {
      return null;
    }

    const cloudSnapshot = await fetchUserWorkspaceSnapshot(state.currentUser.id).catch(() => null);
    if (cloudSnapshot) {
      return cloudSnapshot;
    }

    const scopedRaw = window.localStorage.getItem(`${WORKSPACE_STORAGE_KEY}:${state.currentUser.id}`);
    if (scopedRaw) {
      return JSON.parse(scopedRaw);
    }

    const legacyRaw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return legacyRaw ? JSON.parse(legacyRaw) : null;
  } catch (error) {
    console.warn("读取旧工作区失败：", error);
    return null;
  }
}

function getWorksErrorMessage(error) {
  const detail = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
    error?.status,
  ]
    .filter((value) => value != null && String(value).trim())
    .join(" ")
    .toLowerCase();

  if (detail.includes("works") || detail.includes("schema cache") || detail.includes("relation")) {
    return "云端作品表还没准备好，当前会先使用本地作品库。请在 Supabase 执行 works 表迁移后刷新页面。";
  }
  if (detail.includes("permission") || detail.includes("policy") || detail.includes("row-level security")) {
    return "云端作品库权限暂不可用，当前会先使用本地作品库。请检查 works 表的 RLS 策略。";
  }
  return "云端作品库暂时不可用，当前会先使用本地作品库。";
}

async function loadWorks() {
  setMessage("");
  const result = await listWorks(getWorkOptions());
  state.works = result.works;
  state.source = result.source;

  if (result.error) {
    setMessage(getWorksErrorMessage(result.error), true);
  }

  if (!state.works.length) {
    const legacySnapshot = await loadLegacySnapshot();
    try {
      const seeded = await createWork(getWorkOptions(), {
        snapshot: legacySnapshot || buildEmptyWorkSnapshot(),
      });
      state.works = [seeded];
    } catch (error) {
      const refreshed = await listWorks(getWorkOptions());
      state.works = refreshed.works;
      setMessage(getWorksErrorMessage(error), true);
    }
  }

  render();
}

async function createNewWork() {
  if (state.loading) {
    return;
  }
  state.loading = true;
  setMessage("");

  try {
    const work = await createWork(getWorkOptions(), {
      snapshot: buildEmptyWorkSnapshot(),
      title: "未命名作品",
    });
    window.location.href = getCreateUrl(work.id);
  } catch (error) {
    await loadWorks();
    const fallbackWork = state.works[0];
    if (fallbackWork) {
      window.location.href = getCreateUrl(fallbackWork.id);
      return;
    }
    setMessage(getWorksErrorMessage(error), true);
  } finally {
    state.loading = false;
  }
}

async function handleRename(workId) {
  const work = state.works.find((item) => item.id === workId);
  if (!work) {
    return;
  }

  const nextTitle = window.prompt("输入新的作品名", work.title);
  if (nextTitle == null || !nextTitle.trim() || nextTitle.trim() === work.title) {
    return;
  }

  try {
    await renameWork(getWorkOptions(), workId, nextTitle);
    await loadWorks();
  } catch (error) {
    setMessage(getWorksErrorMessage(error), true);
  }
}

async function handleDuplicate(workId) {
  try {
    const work = await duplicateWork(getWorkOptions(), workId);
    if (work) {
      window.location.href = getCreateUrl(work.id);
      return;
    }
    await loadWorks();
  } catch (error) {
    setMessage(getWorksErrorMessage(error), true);
  }
}

async function handleDelete(workId) {
  const work = state.works.find((item) => item.id === workId);
  if (!work) {
    return;
  }

  if (!window.confirm(`确定删除《${work.title}》吗？`)) {
    return;
  }

  try {
    await deleteWork(getWorkOptions(), workId);
    await loadWorks();
  } catch (error) {
    setMessage(getWorksErrorMessage(error), true);
  }
}

function handleShelfClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    event.stopPropagation();
    const action = actionTarget.dataset.action;
    const workId = actionTarget.dataset.workId;
    if (action === "new") {
      void createNewWork();
    } else if (action === "rename") {
      void handleRename(workId);
    } else if (action === "duplicate") {
      void handleDuplicate(workId);
    } else if (action === "delete") {
      void handleDelete(workId);
    }
    return;
  }

  const book = event.target.closest("[data-open-work]");
  if (book) {
    window.location.href = getCreateUrl(book.dataset.openWork);
  }
}

function handleShelfKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const book = event.target.closest("[data-open-work]");
  if (!book) {
    return;
  }

  event.preventDefault();
  window.location.href = getCreateUrl(book.dataset.openWork);
}

async function bootstrapAuth() {
  state.guestMode = getQueryFlag("guest");
  syncNavLinks();
  if (state.guestMode) {
    state.currentUser = null;
    return true;
  }

  try {
    const user = await getCurrentUser();
    if (user) {
      state.currentUser = user;
      return true;
    }
  } catch (error) {
    setMessage("身份服务暂时不可用。可以从首页以游客模式进入作品管理。", true);
    return false;
  }

  window.location.replace(buildAuthUrl("/works"));
  return false;
}

async function init() {
  if (!elements.shelves) {
    throw new Error("作品管理页面结构不完整：缺少 #works-shelves 容器。");
  }

  elements.shelves.addEventListener("click", handleShelfClick);
  elements.shelves.addEventListener("keydown", handleShelfKeydown);

  const ready = await bootstrapAuth();
  if (!ready) {
    render();
    return;
  }

  await loadWorks();
}

init().catch((error) => {
  console.error("Failed to initialize works page", error);
  setMessage(error?.message || "作品管理初始化失败，请刷新页面后重试。", true);
  if (elements.navCreate) {
    elements.navCreate.href = DEFAULT_NEXT_PATH;
  }
});
