import {
  buildAuthUrl,
  getCurrentUser,
  getUserDisplayName,
  getUserInitial,
} from "./src/auth-client.js";
import { fetchUserWorkspaceSnapshot } from "./src/cloud-workspace.js";
import { GUEST_WORKSPACE_STORAGE_KEY, WORKSPACE_STORAGE_KEY } from "./src/constants.js";
import {
  getWorkTitleFromSnapshot,
  listWorks,
  updateWorkSnapshot,
} from "./src/work-library.js";
import { escapeHtml, formatFavoriteTime, normalizeFavoriteQuote } from "./src/utils.js";

const BOOK_COLORS = ["#3A8275", "#A83850", "#6E3A8A", "#3A5E9A", "#35714A", "#AC4A2A", "#A87020", "#A03A60", "#28487A", "#527035"];

const state = {
  currentUser: null,
  guestMode: false,
  works: [],
  notes: [],
  activeFilter: "all",
};

const elements = {
  navLogo: document.querySelector("#nav-logo"),
  navCreate: document.querySelector("#nav-create"),
  navWorks: document.querySelector("#nav-works"),
  navNotes: document.querySelector("#nav-notes"),
  navUserCenter: document.querySelector("#nav-usercenter"),
  noteCount: document.querySelector("#note-count"),
  filterBar: document.querySelector("#filter-bar"),
  message: document.querySelector("#notes-message"),
  list: document.querySelector("#notes-list"),
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

function getChapterLabel(chapterNumber) {
  const number = Number(chapterNumber);
  return Number.isFinite(number) && number > 0 ? `第${number}章` : "正文";
}

function getWorkColor(workId) {
  const index = Math.max(0, state.works.findIndex((work) => work.id === workId));
  return BOOK_COLORS[index % BOOK_COLORS.length];
}

function collectNotes(works) {
  return works.flatMap((work) => {
    const favorites = Array.isArray(work.snapshot?.favoriteQuotes) ? work.snapshot.favoriteQuotes : [];
    const fallbackTitle = work.title || getWorkTitleFromSnapshot(work.snapshot);
    return favorites
      .map((item) => normalizeFavoriteQuote(item))
      .filter(Boolean)
      .map((favorite) => ({
        ...favorite,
        workId: work.id,
        workTitle: String(favorite.storyTitle || fallbackTitle || "未命名作品").trim() || "未命名作品",
        color: getWorkColor(work.id),
      }));
  }).sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""));
}

function groupNotes(notes) {
  const storyMap = new Map();

  notes.forEach((note) => {
    const storyKey = `${note.workId}:${note.workTitle}`;
    if (!storyMap.has(storyKey)) {
      storyMap.set(storyKey, {
        workId: note.workId,
        storyTitle: note.workTitle,
        color: note.color,
        chapters: new Map(),
        count: 0,
      });
    }

    const storyGroup = storyMap.get(storyKey);
    storyGroup.count += 1;
    const chapterNumber = Number(note.chapterNumber);
    const chapterKey = Number.isFinite(chapterNumber) && chapterNumber > 0 ? `chapter-${chapterNumber}` : "chapter-body";
    if (!storyGroup.chapters.has(chapterKey)) {
      storyGroup.chapters.set(chapterKey, {
        chapterLabel: getChapterLabel(chapterNumber),
        order: Number.isFinite(chapterNumber) && chapterNumber > 0 ? chapterNumber : Number.MAX_SAFE_INTEGER,
        items: [],
      });
    }
    storyGroup.chapters.get(chapterKey).items.push(note);
  });

  return Array.from(storyMap.values()).map((storyGroup) => ({
    ...storyGroup,
    chapters: Array.from(storyGroup.chapters.values()).sort((left, right) => left.order - right.order),
  }));
}

function renderFilters() {
  if (!elements.filterBar) {
    return;
  }

  const workOptions = state.works
    .map((work) => ({
      id: work.id,
      label: work.title || getWorkTitleFromSnapshot(work.snapshot),
      count: state.notes.filter((note) => note.workId === work.id).length,
      color: getWorkColor(work.id),
    }))
    .filter((item) => item.count > 0);

  const chips = [
    { id: "all", label: "全部", count: state.notes.length, color: "#6f5b45" },
    ...workOptions,
  ];

  elements.filterBar.innerHTML = chips
    .map((chip) => `
      <button type="button" class="filter-chip ${state.activeFilter === chip.id ? "active" : ""}" data-filter="${escapeHtml(chip.id)}">
        <span class="chip-dot" style="background:${escapeHtml(chip.color)}"></span>
        <span>${escapeHtml(chip.label)}</span>
        <span>${chip.count}</span>
      </button>
    `)
    .join("");
}

function renderNotes() {
  if (!elements.list || !elements.noteCount) {
    return;
  }

  const filteredNotes = state.activeFilter === "all"
    ? state.notes
    : state.notes.filter((note) => note.workId === state.activeFilter);

  elements.noteCount.textContent = String(state.notes.length);
  renderFilters();

  if (!filteredNotes.length) {
    elements.list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M10 16.2 4.7 11.5a3.5 3.5 0 0 1 5-4.9L10 7l.3-.4a3.5 3.5 0 0 1 5 4.9L10 16.2Z"></path>
          </svg>
        </div>
        <div class="empty-title">还没有收藏句子</div>
        <div class="empty-sub">在正文里选中句子后，点击爱心即可加入这里。</div>
      </div>
    `;
    return;
  }

  elements.list.innerHTML = groupNotes(filteredNotes)
    .map((storyGroup) => `
      <section class="book-group" style="--book-color:${escapeHtml(storyGroup.color)}">
        <div class="book-group-head">
          <div class="book-group-left">
            <span class="book-swatch" aria-hidden="true"></span>
            <h2 class="book-name">${escapeHtml(storyGroup.storyTitle)}</h2>
          </div>
          <span class="book-note-count">${storyGroup.count} 条</span>
        </div>
        ${storyGroup.chapters
          .map((chapter) => `
            <section class="chapter-section">
              <div class="chapter-label">${escapeHtml(chapter.chapterLabel)}</div>
              ${chapter.items
                .map((note) => `
                  <article class="note-row" data-note-id="${escapeHtml(note.id)}" data-work-id="${escapeHtml(note.workId)}">
                    <div class="note-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M7 5H5.6C4.7 5 4 5.7 4 6.6V9c0 1.6.8 2.5 2.2 2.5H7V15h2v-4.8C9 7.7 8.3 5.8 7 5Zm8 0h-1.4c-.9 0-1.6.7-1.6 1.6V9c0 1.6.8 2.5 2.2 2.5h.8V15h2v-4.8C17 7.7 16.3 5.8 15 5Z"></path>
                      </svg>
                    </div>
                    <div class="note-text">
                      <p>${escapeHtml(note.text)}</p>
                      <div class="note-time">${escapeHtml(formatFavoriteTime(note.createdAt))}</div>
                    </div>
                    <button type="button" class="note-delete" data-delete-note="${escapeHtml(note.id)}" data-work-id="${escapeHtml(note.workId)}" aria-label="删除收藏" title="删除收藏">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                        <path d="M5 6h10M8 6V4h4v2M7 8v7M10 8v7M13 8v7M6 6l.6 11h6.8L14 6"></path>
                      </svg>
                    </button>
                  </article>
                `)
                .join("")}
            </section>
          `)
          .join("")}
      </section>
    `)
    .join("");
}

function getFavoriteMatchKey(item) {
  return [
    Number(item?.chapterNumber) || "",
    Number(item?.startOffset) || 0,
    Number(item?.endOffset) || 0,
    String(item?.text || "").trim(),
  ].join("|");
}

function stripFavoriteMarkupFromSnapshot(snapshot, favoriteId) {
  const chapters = Array.isArray(snapshot?.generatedStory?.chapters)
    ? snapshot.generatedStory.chapters
    : [];

  chapters.forEach((chapter) => {
    if (!chapter?.rendered_html) {
      return;
    }
    const scratch = document.createElement("div");
    scratch.innerHTML = chapter.rendered_html;
    let changed = false;
    Array.from(scratch.querySelectorAll("[data-favorite-id]"))
      .filter((node) => node.getAttribute("data-favorite-id") === favoriteId)
      .forEach((node) => {
        const fragment = document.createDocumentFragment();
        while (node.firstChild) {
          fragment.appendChild(node.firstChild);
        }
        node.replaceWith(fragment);
        changed = true;
      });
    if (changed) {
      chapter.rendered_html = scratch.innerHTML;
      chapter.content = scratch.innerText;
    }
  });
}

async function removeFavorite(workId, favoriteId) {
  const work = state.works.find((item) => item.id === workId);
  if (!work) {
    return;
  }

  const snapshot = {
    ...(work.snapshot || {}),
    favoriteQuotes: Array.isArray(work.snapshot?.favoriteQuotes)
      ? work.snapshot.favoriteQuotes.map((item) => ({ ...item }))
      : [],
  };
  const favorite = snapshot.favoriteQuotes.find((item) => item.id === favoriteId);
  if (!favorite) {
    return;
  }
  const matchKey = getFavoriteMatchKey(favorite);
  snapshot.favoriteQuotes = snapshot.favoriteQuotes.filter((item) => {
    if (item.id && item.id === favoriteId) {
      return false;
    }
    return getFavoriteMatchKey(item) !== matchKey;
  });
  stripFavoriteMarkupFromSnapshot(snapshot, favoriteId);
  snapshot.updatedAt = new Date().toISOString();

  if (workId === "legacy-workspace") {
    persistLegacySnapshot(snapshot);
    work.snapshot = snapshot;
  } else {
    const updated = await updateWorkSnapshot(getWorkOptions(), workId, snapshot);
    if (updated?.snapshot) {
      work.snapshot = updated.snapshot;
      work.updatedAt = updated.updatedAt;
    } else {
      work.snapshot = snapshot;
    }
  }
  state.notes = collectNotes(state.works);
  renderNotes();
}

function handleFilterClick(event) {
  const button = event.target.closest?.("[data-filter]");
  if (!button) {
    return;
  }
  state.activeFilter = button.dataset.filter || "all";
  renderNotes();
}

function handleNoteClick(event) {
  const button = event.target.closest?.("[data-delete-note]");
  if (!button) {
    return;
  }

  const workId = button.dataset.workId || "";
  const favoriteId = button.dataset.deleteNote || "";
  const row = button.closest(".note-row");
  row?.classList.add("removing");
  void removeFavorite(workId, favoriteId).then(() => {
    setMessage("已删除收藏。");
  }).catch((error) => {
    row?.classList.remove("removing");
    console.error("Failed to remove favorite", error);
    setMessage("删除收藏失败，请稍后重试。", true);
  });
}

async function readLegacySnapshot() {
  if (!state.guestMode && state.currentUser?.id) {
    const cloudSnapshot = await fetchUserWorkspaceSnapshot(state.currentUser.id).catch(() => null);
    if (cloudSnapshot) {
      return cloudSnapshot;
    }
  }

  try {
    const keys = state.guestMode
      ? [GUEST_WORKSPACE_STORAGE_KEY]
      : [`${WORKSPACE_STORAGE_KEY}:${state.currentUser?.id || ""}`, WORKSPACE_STORAGE_KEY];
    for (const key of keys.filter(Boolean)) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (error) {
    console.warn("读取旧收藏失败：", error);
  }
  return null;
}

function persistLegacySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  const key = state.guestMode
    ? GUEST_WORKSPACE_STORAGE_KEY
    : `${WORKSPACE_STORAGE_KEY}:${state.currentUser?.id || ""}`;
  if (key) {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }
}

async function loadNotes() {
  setMessage("");
  const result = await listWorks(getWorkOptions());
  state.works = result.works;

  if (!state.works.length) {
    const legacySnapshot = await readLegacySnapshot();
    if (legacySnapshot) {
      state.works = [{
        id: "legacy-workspace",
        title: getWorkTitleFromSnapshot(legacySnapshot),
        snapshot: legacySnapshot,
        updatedAt: legacySnapshot.updatedAt || new Date().toISOString(),
      }];
    }
  }

  if (result.error) {
    setMessage("云端作品库暂时不可用，当前展示本地缓存里的收藏。", true);
  }

  state.notes = collectNotes(state.works);
  if (state.activeFilter !== "all" && !state.works.some((work) => work.id === state.activeFilter)) {
    state.activeFilter = "all";
  }
  syncNavLinks();
  renderNotes();
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
    setMessage("身份服务暂时不可用，无法读取账号收藏。", true);
    return false;
  }

  window.location.replace(buildAuthUrl("/mynote"));
  return false;
}

async function init() {
  elements.filterBar?.addEventListener("click", handleFilterClick);
  elements.list?.addEventListener("click", handleNoteClick);

  const ready = await bootstrapAuth();
  if (!ready) {
    renderNotes();
    return;
  }

  await loadNotes();
}

init().catch((error) => {
  console.error("Failed to initialize notes page", error);
  setMessage(error?.message || "我的笔记初始化失败，请刷新页面后重试。", true);
});
