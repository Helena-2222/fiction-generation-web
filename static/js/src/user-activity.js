import { getSupabaseClient } from "./auth-client.js";

export const USER_ACTIVITY_TABLE = "user_activity_stats";
export const USER_ACTIVITY_STORAGE_KEY = "story-generation-user-activity-v1";

function normalizeScope({ userId, guestMode } = {}) {
  if (guestMode) {
    return "guest-browser";
  }
  return String(userId || "").trim() || "anonymous-browser";
}

function getLocalActivityKey(options = {}) {
  return `${USER_ACTIVITY_STORAGE_KEY}:${normalizeScope(options)}`;
}

function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniqueDays(days) {
  return Array.from(new Set(
    (Array.isArray(days) ? days : [])
      .map((day) => String(day || "").trim())
      .filter(Boolean),
  )).sort();
}

function normalizeStats(stats) {
  const activeDays = uniqueDays(stats?.activeDays || stats?.active_days);
  return {
    writingTimeSeconds: Math.max(0, Math.round(Number(stats?.writingTimeSeconds ?? stats?.writing_time_seconds) || 0)),
    activeDays,
    updatedAt: String(stats?.updatedAt || stats?.updated_at || "").trim() || null,
  };
}

function mergeStats(left, right) {
  const normalizedLeft = normalizeStats(left);
  const normalizedRight = normalizeStats(right);
  return {
    writingTimeSeconds: Math.max(normalizedLeft.writingTimeSeconds, normalizedRight.writingTimeSeconds),
    activeDays: uniqueDays([...normalizedLeft.activeDays, ...normalizedRight.activeDays]),
    updatedAt: normalizedLeft.updatedAt || normalizedRight.updatedAt,
  };
}

function addActivityDelta(stats, { writingSeconds = 0, activeDay = getTodayKey() } = {}) {
  const normalized = normalizeStats(stats);
  const seconds = Math.max(0, Math.round(Number(writingSeconds) || 0));
  return {
    writingTimeSeconds: normalized.writingTimeSeconds + seconds,
    activeDays: uniqueDays([...normalized.activeDays, activeDay]),
    updatedAt: new Date().toISOString(),
  };
}

function readLocalStats(options = {}) {
  try {
    const raw = window.localStorage.getItem(getLocalActivityKey(options));
    return normalizeStats(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn("Failed to read local user activity stats:", error);
    return normalizeStats(null);
  }
}

function writeLocalStats(options = {}, stats) {
  const normalized = normalizeStats(stats);
  window.localStorage.setItem(getLocalActivityKey(options), JSON.stringify(normalized));
  return normalized;
}

function canUseCloud(options = {}) {
  return !options.guestMode && Boolean(String(options.userId || "").trim());
}

async function fetchCloudStats(options = {}) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(USER_ACTIVITY_TABLE)
    .select("writing_time_seconds, active_days, updated_at")
    .eq("user_id", String(options.userId || "").trim())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeStats(data);
}

async function saveCloudStats(options = {}, stats) {
  const normalized = normalizeStats(stats);
  const supabase = await getSupabaseClient();
  const payload = {
    user_id: String(options.userId || "").trim(),
    writing_time_seconds: normalized.writingTimeSeconds,
    active_days: normalized.activeDays,
    updated_at: normalized.updatedAt || new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from(USER_ACTIVITY_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select("writing_time_seconds, active_days, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return normalizeStats(data);
}

export async function fetchUserActivityStats(options = {}) {
  const localStats = readLocalStats(options);
  if (!canUseCloud(options)) {
    return {
      stats: localStats,
      source: "local",
      error: null,
    };
  }

  try {
    const cloudStats = await fetchCloudStats(options);
    const mergedStats = mergeStats(cloudStats, localStats);
    const syncedStats = await saveCloudStats(options, mergedStats);
    writeLocalStats(options, syncedStats);
    return {
      stats: syncedStats,
      source: "cloud",
      error: null,
    };
  } catch (error) {
    console.warn("Failed to fetch user activity stats:", error);
    return {
      stats: localStats,
      source: "local",
      error,
    };
  }
}

export async function recordUserActivity(options = {}, { writingSeconds = 0, activeDay = getTodayKey() } = {}) {
  const localBefore = readLocalStats(options);
  const nextLocalStats = addActivityDelta(localBefore, { writingSeconds, activeDay });
  writeLocalStats(options, nextLocalStats);

  if (!canUseCloud(options)) {
    return {
      stats: nextLocalStats,
      source: "local",
      error: null,
    };
  }

  try {
    const cloudBefore = await fetchCloudStats(options);
    const baseStats = mergeStats(cloudBefore, localBefore);
    const nextCloudStats = addActivityDelta(baseStats, { writingSeconds, activeDay });
    const syncedStats = await saveCloudStats(options, nextCloudStats);
    writeLocalStats(options, syncedStats);
    return {
      stats: syncedStats,
      source: "cloud",
      error: null,
    };
  } catch (error) {
    console.warn("Failed to record user activity stats:", error);
    return {
      stats: nextLocalStats,
      source: "local",
      error,
    };
  }
}

export function formatWritingDurationParts(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  if (minutes < 60) {
    return {
      value: String(minutes),
      unit: "min",
    };
  }

  const hours = minutes / 60;
  return {
    value: hours >= 10 ? String(Math.round(hours)) : hours.toFixed(1),
    unit: "h",
  };
}
