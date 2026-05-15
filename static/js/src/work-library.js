import { getSupabaseClient } from "./auth-client.js";

export const WORKS_TABLE = "works";
export const WORK_LIBRARY_STORAGE_KEY = "story-generation-works-v1";

const ACTIVE_STATUS = "active";
const DEFAULT_TITLE = "未命名作品";
const WORK_TIMESTAMP_TOLERANCE_MS = 1000;

function generateWorkId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `work-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeScope({ userId, guestMode } = {}) {
  if (guestMode) {
    return "guest-browser";
  }
  return String(userId || "").trim() || "anonymous-browser";
}

function getLocalLibraryKey(options = {}) {
  return `${WORK_LIBRARY_STORAGE_KEY}:${normalizeScope(options)}`;
}

function normalizeSnapshot(snapshot) {
  return snapshot && typeof snapshot === "object" ? snapshot : buildEmptyWorkSnapshot();
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim();
  return normalized || ACTIVE_STATUS;
}

function normalizeWork(work) {
  if (!work || typeof work !== "object") {
    return null;
  }

  const id = String(work.id || "").trim();
  if (!id) {
    return null;
  }

  const snapshot = normalizeSnapshot(work.snapshot || work.workspace_snapshot);
  const updatedAt = String(work.updatedAt || work.updated_at || snapshot.updatedAt || new Date().toISOString()).trim();
  const createdAt = String(work.createdAt || work.created_at || updatedAt).trim();
  const title = String(work.title || getWorkTitleFromSnapshot(snapshot) || DEFAULT_TITLE).trim() || DEFAULT_TITLE;

  return {
    id,
    userId: String(work.userId || work.user_id || "").trim(),
    title,
    genre: String(work.genre || getWorkGenreFromSnapshot(snapshot) || "").trim(),
    style: String(work.style || getWorkStyleFromSnapshot(snapshot) || "").trim(),
    status: normalizeStatus(work.status),
    snapshot,
    createdAt,
    updatedAt,
  };
}

function shouldAutofillTitle(title) {
  const normalized = String(title || "").trim();
  return !normalized || normalized === DEFAULT_TITLE;
}

function normalizeLibrary(library) {
  const works = Array.isArray(library?.works)
    ? library.works.map((work) => normalizeWork(work)).filter(Boolean)
    : [];

  works.sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""));

  return {
    activeWorkId: String(library?.activeWorkId || "").trim(),
    works,
  };
}

function readLocalLibrary(options = {}) {
  try {
    const raw = window.localStorage.getItem(getLocalLibraryKey(options));
    if (!raw) {
      return normalizeLibrary(null);
    }
    return normalizeLibrary(JSON.parse(raw));
  } catch (error) {
    console.warn("读取本地作品库失败：", error);
    return normalizeLibrary(null);
  }
}

function writeLocalLibrary(options = {}, library) {
  const normalized = normalizeLibrary(library);
  window.localStorage.setItem(getLocalLibraryKey(options), JSON.stringify(normalized));
  return normalized;
}

function upsertLocalWork(options = {}, work, { active = false } = {}) {
  const normalizedWork = normalizeWork(work);
  if (!normalizedWork) {
    return null;
  }

  const library = readLocalLibrary(options);
  const nextWorks = library.works.filter((item) => item.id !== normalizedWork.id);
  nextWorks.unshift(normalizedWork);
  const nextLibrary = writeLocalLibrary(options, {
    activeWorkId: active ? normalizedWork.id : library.activeWorkId,
    works: nextWorks,
  });
  return nextLibrary.works.find((item) => item.id === normalizedWork.id) || normalizedWork;
}

function removeLocalWork(options = {}, workId) {
  const normalizedWorkId = String(workId || "").trim();
  if (!normalizedWorkId) {
    return;
  }

  const library = readLocalLibrary(options);
  const nextWorks = library.works.filter((item) => item.id !== normalizedWorkId);
  writeLocalLibrary(options, {
    activeWorkId: library.activeWorkId === normalizedWorkId ? nextWorks[0]?.id || "" : library.activeWorkId,
    works: nextWorks,
  });
}

function buildWorkPayload({ userId, work }) {
  return {
    id: work.id,
    user_id: String(userId || "").trim(),
    title: work.title,
    genre: work.genre || null,
    style: work.style || null,
    status: work.status || ACTIVE_STATUS,
    snapshot: work.snapshot,
    created_at: work.createdAt,
    updated_at: work.updatedAt,
  };
}

function canUseCloud(options = {}) {
  return !options.guestMode && Boolean(String(options.userId || "").trim());
}

async function fetchCloudWorks(options = {}) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(WORKS_TABLE)
    .select("id, user_id, title, genre, style, status, snapshot, created_at, updated_at")
    .eq("user_id", String(options.userId || "").trim())
    .neq("status", "deleted")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const cloudWorks = Array.isArray(data) ? data.map((item) => normalizeWork(item)).filter(Boolean) : [];
  const localWorks = readLocalLibrary(options).works.filter((work) => work.status !== "deleted");
  const worksById = new Map(cloudWorks.map((work) => [work.id, work]));
  localWorks.forEach((localWork) => {
    const cloudWork = worksById.get(localWork.id);
    const localTime = Date.parse(localWork.updatedAt || "");
    const cloudTime = Date.parse(cloudWork?.updatedAt || "");
    if (!cloudWork || (Number.isFinite(localTime) && localTime > (Number.isFinite(cloudTime) ? cloudTime : 0) + WORK_TIMESTAMP_TOLERANCE_MS)) {
      worksById.set(localWork.id, localWork);
    }
  });
  const works = Array.from(worksById.values())
    .map((item) => normalizeWork(item))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""));
  writeLocalLibrary(options, {
    activeWorkId: readLocalLibrary(options).activeWorkId,
    works,
  });
  return works;
}

export function cacheWorkSnapshotLocally(options = {}, workId, snapshot) {
  const normalizedWorkId = String(workId || "").trim();
  if (!normalizedWorkId || !snapshot || typeof snapshot !== "object") {
    return null;
  }

  const existing = readLocalLibrary(options).works.find((work) => work.id === normalizedWorkId);
  if (!existing) {
    return null;
  }

  const updatedAt = String(snapshot.updatedAt || new Date().toISOString()).trim();
  const updatedWork = normalizeWork({
    ...existing,
    title: shouldAutofillTitle(existing.title)
      ? getWorkTitleFromSnapshot(snapshot)
      : existing.title,
    genre: getWorkGenreFromSnapshot(snapshot),
    style: getWorkStyleFromSnapshot(snapshot),
    snapshot: {
      ...snapshot,
      updatedAt,
    },
    updatedAt,
  });

  return upsertLocalWork(options, updatedWork, { active: true });
}

export function buildEmptyWorkSnapshot() {
  return {
    version: 5,
    updatedAt: null,
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
    llmTask: null,
    favoriteQuotes: [],
    workspaceLock: {
      locked: false,
      lockedAt: null,
      signature: "",
    },
    form: {},
  };
}

export function getWorkTitleFromSnapshot(snapshot = {}) {
  const form = snapshot?.form && typeof snapshot.form === "object" ? snapshot.form : {};
  const candidates = [
    snapshot?.generatedStory?.title,
    snapshot?.outline?.title,
    snapshot?.savedStoryDraft?.title,
    form.title,
    form.synopsis,
  ];

  const value = candidates.map((item) => String(item || "").trim()).find(Boolean);
  if (!value) {
    return DEFAULT_TITLE;
  }

  return value.replace(/\s+/g, " ").slice(0, 28).trim() || DEFAULT_TITLE;
}

export function getWorkGenreFromSnapshot(snapshot = {}) {
  const form = snapshot?.form && typeof snapshot.form === "object" ? snapshot.form : {};
  return String(form.customGenre || snapshot.genre || "").trim();
}

export function getWorkStyleFromSnapshot(snapshot = {}) {
  const form = snapshot?.form && typeof snapshot.form === "object" ? snapshot.form : {};
  return String(form.customStyle || snapshot.style || "").trim();
}

export function getWorkProgressLabel(snapshot = {}) {
  if (snapshot?.generatedStory?.chapters?.length) {
    return `正文 ${snapshot.generatedStory.chapters.length} 章`;
  }
  if (snapshot?.outline) {
    return "大纲已生成";
  }
  if (Array.isArray(snapshot?.relations) && snapshot.relations.length) {
    return "角色关系中";
  }
  if (Array.isArray(snapshot?.characters) && snapshot.characters.length) {
    return "角色设定中";
  }
  if (String(snapshot?.form?.synopsis || "").trim()) {
    return "基本信息中";
  }
  return "刚刚开始";
}

export function getWorkWordCount(snapshot = {}) {
  const chapters = Array.isArray(snapshot?.generatedStory?.chapters) ? snapshot.generatedStory.chapters : [];
  return chapters.reduce((total, chapter) => total + String(chapter?.content || "").trim().length, 0);
}

export async function listWorks(options = {}) {
  if (!canUseCloud(options)) {
    return {
      works: readLocalLibrary(options).works.filter((work) => work.status !== "deleted"),
      source: "local",
      error: null,
    };
  }

  try {
    return {
      works: await fetchCloudWorks(options),
      source: "cloud",
      error: null,
    };
  } catch (error) {
    console.warn("读取云端作品库失败，已回退到本地缓存：", error);
    return {
      works: readLocalLibrary(options).works.filter((work) => work.status !== "deleted"),
      source: "local",
      error,
    };
  }
}

export async function getWork(options = {}, workId) {
  const normalizedWorkId = String(workId || "").trim();
  if (!normalizedWorkId) {
    return null;
  }

  if (canUseCloud(options)) {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from(WORKS_TABLE)
        .select("id, user_id, title, genre, style, status, snapshot, created_at, updated_at")
        .eq("user_id", String(options.userId || "").trim())
        .eq("id", normalizedWorkId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const cloudWork = normalizeWork(data);
      if (cloudWork && cloudWork.status !== "deleted") {
        const localWork = readLocalLibrary(options).works.find(
          (work) => work.id === normalizedWorkId && work.status !== "deleted",
        );
        const localTime = Date.parse(localWork?.updatedAt || "");
        const cloudTime = Date.parse(cloudWork.updatedAt || "");
        if (
          localWork
          && Number.isFinite(localTime)
          && localTime > (Number.isFinite(cloudTime) ? cloudTime : 0) + WORK_TIMESTAMP_TOLERANCE_MS
        ) {
          return localWork;
        }
        upsertLocalWork(options, cloudWork, { active: true });
        return cloudWork;
      }
    } catch (error) {
      console.warn("读取云端作品失败，已回退到本地缓存：", error);
    }
  }

  return readLocalLibrary(options).works.find((work) => work.id === normalizedWorkId && work.status !== "deleted") || null;
}

export async function createWork(options = {}, { snapshot, title } = {}) {
  const now = new Date().toISOString();
  const normalizedSnapshot = {
    ...normalizeSnapshot(snapshot),
    updatedAt: now,
  };
  const work = normalizeWork({
    id: generateWorkId(),
    userId: options.userId,
    title: String(title || getWorkTitleFromSnapshot(normalizedSnapshot) || DEFAULT_TITLE).trim(),
    genre: getWorkGenreFromSnapshot(normalizedSnapshot),
    style: getWorkStyleFromSnapshot(normalizedSnapshot),
    status: ACTIVE_STATUS,
    snapshot: normalizedSnapshot,
    createdAt: now,
    updatedAt: now,
  });

  upsertLocalWork(options, work, { active: true });

  if (!canUseCloud(options)) {
    return work;
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(WORKS_TABLE)
    .insert(buildWorkPayload({ userId: options.userId, work }))
    .select("id, user_id, title, genre, style, status, snapshot, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  const cloudWork = normalizeWork(data) || work;
  upsertLocalWork(options, cloudWork, { active: true });
  return cloudWork;
}

export async function updateWorkSnapshot(options = {}, workId, snapshot) {
  const existing = await getWork(options, workId);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedSnapshot = {
    ...normalizeSnapshot(snapshot),
    updatedAt: String(snapshot?.updatedAt || now).trim() || now,
  };
  const updatedWork = normalizeWork({
    ...existing,
    title: shouldAutofillTitle(existing.title)
      ? getWorkTitleFromSnapshot(normalizedSnapshot)
      : existing.title,
    genre: getWorkGenreFromSnapshot(normalizedSnapshot),
    style: getWorkStyleFromSnapshot(normalizedSnapshot),
    snapshot: normalizedSnapshot,
    updatedAt: normalizedSnapshot.updatedAt,
  });

  upsertLocalWork(options, updatedWork, { active: true });

  if (!canUseCloud(options)) {
    return updatedWork;
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(WORKS_TABLE)
    .update({
      title: updatedWork.title,
      genre: updatedWork.genre || null,
      style: updatedWork.style || null,
      snapshot: updatedWork.snapshot,
      updated_at: updatedWork.updatedAt,
    })
    .eq("user_id", String(options.userId || "").trim())
    .eq("id", updatedWork.id)
    .select("id, user_id, title, genre, style, status, snapshot, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  const cloudWork = normalizeWork(data) || updatedWork;
  upsertLocalWork(options, cloudWork, { active: true });
  return cloudWork;
}

export async function renameWork(options = {}, workId, title) {
  const normalizedTitle = String(title || "").trim().slice(0, 40);
  if (!normalizedTitle) {
    return null;
  }

  const existing = await getWork(options, workId);
  if (!existing) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const updatedWork = normalizeWork({
    ...existing,
    title: normalizedTitle,
    updatedAt,
  });
  upsertLocalWork(options, updatedWork, { active: true });

  if (!canUseCloud(options)) {
    return updatedWork;
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(WORKS_TABLE)
    .update({ title: normalizedTitle, updated_at: updatedAt })
    .eq("user_id", String(options.userId || "").trim())
    .eq("id", updatedWork.id)
    .select("id, user_id, title, genre, style, status, snapshot, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  const cloudWork = normalizeWork(data) || updatedWork;
  upsertLocalWork(options, cloudWork, { active: true });
  return cloudWork;
}

export async function duplicateWork(options = {}, workId) {
  const existing = await getWork(options, workId);
  if (!existing) {
    return null;
  }

  return createWork(options, {
    snapshot: {
      ...existing.snapshot,
      llmTask: null,
      workspaceLock: {
        locked: false,
        lockedAt: null,
        signature: "",
      },
    },
    title: `${existing.title} 副本`,
  });
}

export async function deleteWork(options = {}, workId) {
  const existing = await getWork(options, workId);
  if (!existing) {
    return false;
  }

  removeLocalWork(options, workId);

  if (!canUseCloud(options)) {
    return true;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from(WORKS_TABLE)
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("user_id", String(options.userId || "").trim())
    .eq("id", String(workId || "").trim());

  if (error) {
    throw error;
  }

  return true;
}

export async function ensureSeedWork(options = {}, snapshot) {
  const current = await listWorks(options);
  if (current.works.length) {
    return current.works[0];
  }

  return createWork(options, {
    snapshot: snapshot || buildEmptyWorkSnapshot(),
    title: getWorkTitleFromSnapshot(snapshot),
  });
}
