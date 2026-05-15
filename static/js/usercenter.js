import {
  buildAuthUrl,
  getCurrentUser,
  getUserContact,
  getUserDisplayName,
  getUserInitial,
  isAnonymousUser,
  signOut,
} from "./src/auth-client.js";
import { fetchUserWorkspaceSnapshot } from "./src/cloud-workspace.js";
import {
  fetchUserActivityStats,
  formatWritingDurationParts,
  recordUserActivity,
} from "./src/user-activity.js";
import { GUEST_WORKSPACE_STORAGE_KEY, WORKSPACE_STORAGE_KEY } from "./src/constants.js";
import {
  getWorkProgressLabel,
  getWorkTitleFromSnapshot,
  getWorkWordCount,
  listWorks,
} from "./src/work-library.js";
import { escapeHtml } from "./src/utils.js";

const BOOK_COLORS = ["#3A8275", "#A83850", "#6E3A8A", "#3A5E9A", "#35714A", "#AC4A2A", "#A87020", "#A03A60", "#28487A", "#527035"];

const state = {
  currentUser: null,
  guestMode: false,
  works: [],
  activityStats: null,
};

const elements = {
  navLogo: document.querySelector("#nav-logo"),
  navCreate: document.querySelector("#nav-create"),
  navWorks: document.querySelector("#nav-works"),
  navNotes: document.querySelector("#nav-notes"),
  navUserCenter: document.querySelector("#nav-usercenter"),
  message: document.querySelector("#user-message"),
  avatar: document.querySelector("#profile-avatar"),
  name: document.querySelector("#profile-name"),
  status: document.querySelector("#profile-status"),
  contact: document.querySelector("#profile-contact"),
  bio: document.querySelector("#profile-bio"),
  authAction: document.querySelector("#profile-auth-action"),
  statWorks: document.querySelector("#stat-works"),
  statWritingTime: document.querySelector("#stat-writing-time"),
  statWritingDays: document.querySelector("#stat-writing-days"),
  statWords: document.querySelector("#stat-words"),
  tabWorksCount: document.querySelector("#tab-works-count"),
  booksRow: document.querySelector("#user-books-row"),
  tabs: Array.from(document.querySelectorAll("[data-tab]")),
  panels: Array.from(document.querySelectorAll(".shelf-panel")),
  logoutButton: document.querySelector("#logout-button"),
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

function getActivityOptions() {
  return {
    userId: state.currentUser?.id || "",
    guestMode: state.guestMode || isAnonymousUser(state.currentUser),
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

function getWorkColor(index) {
  return BOOK_COLORS[index % BOOK_COLORS.length];
}

function getWorkStatusClass(work) {
  return work.snapshot?.generatedStory?.chapters?.length ? "badge-done" : "badge-ongoing";
}

function getWorkStatusText(work) {
  return work.snapshot?.generatedStory?.chapters?.length ? "正文" : "进行中";
}

function formatCompactNumber(value) {
  const number = Number(value) || 0;
  if (number >= 10000) {
    return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
  }
  return String(number);
}

function renderProfile() {
  const isGuestProfile = state.guestMode || isAnonymousUser(state.currentUser);
  const displayName = isGuestProfile ? "游客模式" : getUserDisplayName(state.currentUser);
  const initial = isGuestProfile ? "游" : getUserInitial(state.currentUser);
  const contact = isGuestProfile ? "未登录" : getUserContact(state.currentUser);

  document.body.classList.toggle("is-guest-profile", isGuestProfile);
  elements.avatar.textContent = initial;
  elements.name.textContent = displayName;
  elements.status.textContent = isGuestProfile ? "游客模式" : "创作者";
  elements.contact.textContent = contact;
  elements.bio.textContent = isGuestProfile
    ? "当前内容只保存在这个浏览器的本地缓存中，登录保存您的作品"
    : "你的作品和创作进度会跟随当前账号持续保存。";
  elements.authAction.classList.toggle("hidden", !isGuestProfile);
  elements.authAction.setAttribute("aria-hidden", isGuestProfile ? "false" : "true");
  if (isGuestProfile) {
    elements.authAction.textContent = "登录/注册";
    elements.authAction.href = buildAuthUrl("/create?stage=basic");
  } else {
    elements.authAction.removeAttribute("href");
  }

  const showLogout = !isGuestProfile && Boolean(state.currentUser);
  if (elements.logoutButton) {
    elements.logoutButton.classList.toggle("hidden", !showLogout);
    elements.logoutButton.setAttribute("aria-hidden", showLogout ? "false" : "true");
  }
}

function renderStats() {
  const words = state.works.reduce((total, work) => total + getWorkWordCount(work.snapshot), 0);
  const writingTime = formatWritingDurationParts(state.activityStats?.writingTimeSeconds || 0);
  const writingDays = Array.isArray(state.activityStats?.activeDays) ? state.activityStats.activeDays.length : 0;
  elements.statWorks.textContent = String(state.works.length);
  elements.statWritingTime.innerHTML = `${escapeHtml(writingTime.value)}<em>${escapeHtml(writingTime.unit)}</em>`;
  elements.statWritingDays.innerHTML = `${escapeHtml(String(writingDays))}<em>天</em>`;
  elements.statWords.innerHTML = `${escapeHtml(formatCompactNumber(words))}<em>字</em>`;
  elements.tabWorksCount.textContent = String(state.works.length);
}

function renderWorks() {
  if (!state.works.length) {
    elements.booksRow.innerHTML = `<div class="shelf-empty">还没有作品。回到创作台，先写下第一段灵感。</div>`;
    return;
  }

  elements.booksRow.innerHTML = state.works
    .map((work, index) => {
      const title = work.title || getWorkTitleFromSnapshot(work.snapshot);
      return `
        <a class="book-entry" href="${escapeHtml(getCreateUrl(work.id))}" style="--book-color:${escapeHtml(getWorkColor(index))}">
          <div class="book-cover-wrap">
            <div class="book-cover-fill">
              <span class="book-badge ${getWorkStatusClass(work)}">${escapeHtml(getWorkStatusText(work))}</span>
              <span class="book-cover-title">${escapeHtml(title)}</span>
            </div>
          </div>
          <span class="book-entry-title">${escapeHtml(title)}</span>
          <span class="book-entry-sub">${escapeHtml(getWorkProgressLabel(work.snapshot))}</span>
        </a>
      `;
    })
    .join("");
}

function render() {
  syncNavLinks();
  renderProfile();
  renderStats();
  renderWorks();
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
    console.warn("读取旧工作区失败：", error);
  }
  return null;
}

async function loadActivityStats() {
  try {
    await recordUserActivity(getActivityOptions(), { writingSeconds: 0 });
    return await fetchUserActivityStats(getActivityOptions());
  } catch (error) {
    console.warn("读取创作统计失败：", error);
    return {
      stats: null,
      source: "local",
      error,
    };
  }
}

async function loadUserData() {
  setMessage("");
  const [result, activityResult] = await Promise.all([
    listWorks(getWorkOptions()),
    loadActivityStats(),
  ]);
  state.works = result.works;
  state.activityStats = activityResult.stats;

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
    setMessage("云端作品库暂时不可用，当前展示本地缓存。", true);
  } else if (activityResult.error) {
    setMessage("创作统计暂时使用本地缓存，云端统计同步失败。", true);
  }

  render();
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
    setMessage("身份服务暂时不可用，无法读取用户中心。", true);
    return false;
  }

  window.location.replace(buildAuthUrl("/usercenter"));
  return false;
}

function bindTabs() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      elements.tabs.forEach((item) => item.classList.toggle("active", item === tab));
      elements.panels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `panel-${target}`);
      });
      if (target === "subscriptions" && !(state.guestMode || isAnonymousUser(state.currentUser))) {
        setMessage("订阅功能正在开发中");
      } else {
        setMessage("");
      }
    });
  });
}

function bindLogout() {
  if (!elements.logoutButton) {
    return;
  }
  elements.logoutButton.addEventListener("click", async () => {
    elements.logoutButton.disabled = true;
    try {
      await signOut();
      window.location.replace("/auth");
    } catch {
      elements.logoutButton.disabled = false;
    }
  });
}

async function init() {
  bindTabs();
  bindLogout();
  const ready = await bootstrapAuth();
  if (!ready) {
    render();
    return;
  }
  await loadUserData();
}

init().catch((error) => {
  console.error("Failed to initialize user center", error);
  setMessage(error?.message || "用户中心初始化失败，请刷新页面后重试。", true);
});
