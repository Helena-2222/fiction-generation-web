const CONFIG_ENDPOINT = "/api/public-config";
export const DEFAULT_NEXT_PATH = "/create?stage=basic";

let configPromise = null;
let clientPromise = null;

function resolveLocalPath(pathname) {
  const candidate = String(pathname || "").trim();
  if (!candidate) {
    return DEFAULT_NEXT_PATH;
  }

  try {
    const resolvedUrl = new URL(candidate, window.location.origin);
    if (resolvedUrl.origin !== window.location.origin) {
      return DEFAULT_NEXT_PATH;
    }
    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}` || DEFAULT_NEXT_PATH;
  } catch (error) {
    console.warn("Failed to resolve next path", error);
    return DEFAULT_NEXT_PATH;
  }
}

export function getRequestedNextPath(fallbackPath = DEFAULT_NEXT_PATH) {
  const params = new URLSearchParams(window.location.search);
  return resolveLocalPath(params.get("next") || fallbackPath);
}

export function buildAuthUrl(nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`) {
  const safeNextPath = resolveLocalPath(nextPath);
  return `/auth?next=${encodeURIComponent(safeNextPath)}`;
}

export async function getAuthConfig() {
  if (!configPromise) {
    configPromise = fetch(CONFIG_ENDPOINT, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("无法读取登录配置，请确认后端服务已经启动。");
        }
        return response.json();
      })
      .then((config) => ({
        authEnabled: Boolean(config?.authEnabled),
        supabaseUrl: String(config?.supabaseUrl || "").trim(),
        supabaseAnonKey: String(config?.supabaseAnonKey || "").trim(),
      }));
  }

  return configPromise;
}

export async function getSupabaseClient() {
  if (window.__storyGenerationSupabaseClient) {
    return window.__storyGenerationSupabaseClient;
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const config = await getAuthConfig();
      if (!config.authEnabled || !config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error("当前项目还没有配置 Supabase 登录参数，请先检查 .env 里的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。");
      }

      const createClient = window.supabase?.createClient;
      if (typeof createClient !== "function") {
        throw new Error("Supabase 浏览器 SDK 未加载，请刷新页面后重试。");
      }

      const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      window.__storyGenerationSupabaseClient = client;
      return client;
    })();
  }

  return clientPromise;
}

export async function getCurrentSession() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session ?? null;
}

export async function getCurrentUser() {
  return (await getCurrentSession())?.user ?? null;
}

export function isAnonymousUser(user) {
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  const provider = String(user?.app_metadata?.provider || "").trim();

  return user?.is_anonymous === true
    || provider === "anonymous"
    || providers.includes("anonymous");
}

export async function signInAsGuest({ nickname = "游客", options } = {}) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    return currentUser;
  }

  const supabase = await getSupabaseClient();
  const resolvedOptions = { ...(options && typeof options === "object" ? options : {}) };
  const resolvedData = resolvedOptions.data && typeof resolvedOptions.data === "object"
    ? { ...resolvedOptions.data }
    : {};

  if (!String(resolvedData.nickname || "").trim()) {
    resolvedData.nickname = nickname;
  }
  resolvedOptions.data = resolvedData;

  const { data, error } = await supabase.auth.signInAnonymously({
    options: resolvedOptions,
  });
  if (error) {
    throw error;
  }

  return data?.user ?? data?.session?.user ?? await getCurrentUser();
}

export async function requireAuth({ nextPath } = {}) {
  const user = await getCurrentUser();
  if (user) {
    return user;
  }

  window.location.replace(buildAuthUrl(nextPath || DEFAULT_NEXT_PATH));
  return null;
}

export async function subscribeToAuthChanges(handler) {
  const supabase = await getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange(handler);
  return () => {
    data?.subscription?.unsubscribe?.();
  };
}

export async function signOut() {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export function getUserDisplayName(user) {
  if (isAnonymousUser(user)) {
    const nickname = String(user?.user_metadata?.nickname || "").trim();
    return nickname || "游客";
  }

  const nickname = String(
    user?.user_metadata?.nickname
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || "",
  ).trim();
  if (nickname) {
    return nickname;
  }

  const email = String(user?.email || "").trim();
  if (email) {
    return email.split("@")[0] || "创作者";
  }

  const phone = String(user?.phone || "").trim();
  if (phone) {
    return `创作者${phone.slice(-4)}`;
  }

  return "创作者";
}

export function getUserContact(user) {
  if (isAnonymousUser(user)) {
    return "游客模式";
  }

  return String(user?.email || user?.phone || "已登录账户");
}

export function getUserInitial(user) {
  const displayName = getUserDisplayName(user);
  const [firstCharacter = "创"] = Array.from(displayName);
  return /[a-z]/i.test(firstCharacter) ? firstCharacter.toUpperCase() : firstCharacter;
}
