/**
 * HTTP helper functions for API calls.
 */

const API_WAKE_TIMEOUT_MS = 90000;
const API_WAKE_RETRY_DELAY_MS = 1800;
const API_WAKE_NOTICE_DELAY_MS = 1200;
const API_READY_TTL_MS = 10 * 60 * 1000;

let apiReadyPromise = null;
let apiReadyAt = 0;

function getRuntimeConfig() {
  const config = globalThis.__STORY_GENERATION_CONFIG__;
  return config && typeof config === "object" ? config : {};
}

function normalizeApiBaseUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }

  try {
    const url = new URL(candidate, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function waitForDelay(delayMs) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

export function resolveApiUrl(url) {
  const candidate = String(url || "").trim();
  if (!candidate) {
    return candidate;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  const apiBaseUrl = normalizeApiBaseUrl(getRuntimeConfig().apiBaseUrl);
  if (!apiBaseUrl || !candidate.startsWith("/api/")) {
    return candidate;
  }
  return `${apiBaseUrl}${candidate}`;
}

export async function ensureApiReady({ onWaiting } = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(getRuntimeConfig().apiBaseUrl);
  if (!apiBaseUrl || Date.now() - apiReadyAt < API_READY_TTL_MS) {
    return true;
  }
  if (apiReadyPromise) {
    return apiReadyPromise;
  }

  apiReadyPromise = (async () => {
    const startedAt = Date.now();
    let waitingNotified = false;
    const notifyWaiting = () => {
      if (!waitingNotified) {
        waitingNotified = true;
        onWaiting?.();
      }
    };

    while (Date.now() - startedAt < API_WAKE_TIMEOUT_MS) {
      const waitingTimer = globalThis.setTimeout(notifyWaiting, API_WAKE_NOTICE_DELAY_MS);
      try {
        const response = await fetch(`${apiBaseUrl}/api/health`, {
          cache: "no-store",
          mode: "cors",
        });
        const health = response.ok ? await response.json().catch(() => null) : null;
        if (response.ok && health?.ok === true) {
          apiReadyAt = Date.now();
          return true;
        }
      } catch {
        // Render's free service may temporarily reject requests while waking.
      } finally {
        globalThis.clearTimeout(waitingTimer);
      }

      notifyWaiting();
      await waitForDelay(API_WAKE_RETRY_DELAY_MS);
    }

    throw new Error("AI 服务启动超时，请稍后再试。");
  })().catch((error) => {
    throw error;
  }).finally(() => {
    apiReadyPromise = null;
  });

  return apiReadyPromise;
}

export async function postJson(url, payload) {
  await ensureApiReady();
  const response = await fetch(resolveApiUrl(url), {
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

export async function getJson(url) {
  await ensureApiReady();
  const response = await fetch(resolveApiUrl(url), {
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
