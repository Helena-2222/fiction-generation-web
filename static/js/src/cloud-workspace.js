import { getSupabaseClient } from "./auth-client.js";

const USER_WORKSPACES_TABLE = "user_workspaces";

function normalizeWorkspaceSnapshot(snapshot) {
  return snapshot && typeof snapshot === "object" ? snapshot : null;
}

export async function fetchUserWorkspaceSnapshot(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return null;
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(USER_WORKSPACES_TABLE)
    .select("workspace_snapshot, updated_at")
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const snapshot = normalizeWorkspaceSnapshot(data?.workspace_snapshot);
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    updatedAt: String(snapshot.updatedAt || data?.updated_at || "").trim() || null,
  };
}

export async function saveUserWorkspaceSnapshot(userId, snapshot) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return null;
  }

  const normalizedSnapshot = normalizeWorkspaceSnapshot(snapshot);
  if (!normalizedSnapshot) {
    return null;
  }

  const supabase = await getSupabaseClient();
  const updatedAt = String(normalizedSnapshot.updatedAt || new Date().toISOString()).trim();
  const payload = {
    user_id: normalizedUserId,
    workspace_snapshot: {
      ...normalizedSnapshot,
      updatedAt,
    },
    updated_at: updatedAt,
  };

  const { data, error } = await supabase
    .from(USER_WORKSPACES_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select("updated_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    updatedAt: String(data?.updated_at || updatedAt).trim() || updatedAt,
  };
}
