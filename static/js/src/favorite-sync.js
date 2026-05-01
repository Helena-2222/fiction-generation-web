const FAVORITE_SYNC_CHANNEL = "story-generation-favorite-sync";
const FAVORITE_SYNC_STORAGE_KEY = "story-generation-favorite-sync-v1";

let favoriteSyncChannel = null;

function getFavoriteSyncChannel() {
  if (favoriteSyncChannel || typeof BroadcastChannel !== "function") {
    return favoriteSyncChannel;
  }

  favoriteSyncChannel = new BroadcastChannel(FAVORITE_SYNC_CHANNEL);
  return favoriteSyncChannel;
}

function buildFavoriteSyncMessage(payload = {}) {
  return {
    type: "favorite-quotes-changed",
    emittedAt: Date.now(),
    workId: String(payload.workId || "").trim(),
    userId: String(payload.userId || "").trim(),
    guestMode: Boolean(payload.guestMode),
    workTitle: String(payload.workTitle || "").trim(),
    favoriteQuotes: Array.isArray(payload.favoriteQuotes)
      ? payload.favoriteQuotes.map((item) => ({ ...item }))
      : [],
  };
}

export function notifyFavoriteQuotesChanged(payload = {}) {
  const message = buildFavoriteSyncMessage(payload);

  try {
    getFavoriteSyncChannel()?.postMessage(message);
  } catch (error) {
    console.warn("Failed to broadcast favorite sync message:", error);
  }

  try {
    const storageMessage = {
      ...message,
      favoriteQuotes: undefined,
      favoriteCount: message.favoriteQuotes.length,
    };
    window.localStorage.setItem(FAVORITE_SYNC_STORAGE_KEY, JSON.stringify(storageMessage));
  } catch (error) {
    console.warn("Failed to write favorite sync marker:", error);
  }
}

export function subscribeToFavoriteQuotesChanged(handler) {
  if (typeof handler !== "function") {
    return () => {};
  }

  const channel = getFavoriteSyncChannel();
  const handleChannelMessage = (event) => {
    handler(event?.data || {});
  };
  const handleStorageMessage = (event) => {
    if (event.key !== FAVORITE_SYNC_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      handler(JSON.parse(event.newValue));
    } catch (error) {
      console.warn("Failed to parse favorite sync marker:", error);
    }
  };

  channel?.addEventListener("message", handleChannelMessage);
  window.addEventListener("storage", handleStorageMessage);

  return () => {
    channel?.removeEventListener("message", handleChannelMessage);
    window.removeEventListener("storage", handleStorageMessage);
  };
}
