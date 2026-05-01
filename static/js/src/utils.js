/**
 * Pure utility functions — no state dependencies.
 */

export function generateId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeFavoriteQuote(item) {
  const text = String(item?.text || "").trim();
  if (!text) {
    return null;
  }

  return {
    id: item?.id || generateId("favorite"),
    storyTitle: String(item?.storyTitle || "").trim(),
    chapterNumber: Number(item?.chapterNumber) || null,
    startOffset: Number(item?.startOffset) || 0,
    endOffset: Number(item?.endOffset) || 0,
    text,
    createdAt: item?.createdAt || new Date().toISOString(),
  };
}

export function formatFavoriteTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatHistoryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sanitizeFilename(value) {
  return String(value || "未命名作品")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "未命名作品";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n", "<br />");
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
