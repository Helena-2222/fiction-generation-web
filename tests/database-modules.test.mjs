import assert from "node:assert/strict";
import test from "node:test";

function createLocalStorage() {
  const store = new Map();
  return {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
}

function setupBrowserEnv() {
  let uuid = 0;
  const localStorage = createLocalStorage();
  globalThis.window = {
    __storyGenerationSupabaseClient: null,
    crypto: {
      randomUUID: () => `uuid-${++uuid}`,
    },
    localStorage,
    location: new URL("http://localhost/create"),
  };
  globalThis.localStorage = localStorage;
  globalThis.document = {
    createElement() {
      return {
        async: false,
        dataset: {},
        remove() {},
        addEventListener() {},
        removeEventListener() {},
      };
    },
    head: {
      appendChild() {},
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  globalThis.HTMLScriptElement = class HTMLScriptElement {};
  return { localStorage };
}

async function importFresh(relativePath) {
  const url = new URL(`../${relativePath}`, import.meta.url);
  url.searchParams.set("testRun", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function installSupabaseClient(queryFactory) {
  const queries = [];
  window.__storyGenerationSupabaseClient = {
    from(table) {
      const query = queryFactory(table);
      query.table = table;
      query.calls = [];
      const record = (method, args) => {
        query.calls.push({ method, args });
        return query;
      };
      query.select = (...args) => record("select", args);
      query.eq = (...args) => record("eq", args);
      query.neq = (...args) => record("neq", args);
      query.order = (...args) => {
        record("order", args);
        return query.orderResult ?? { data: query.data ?? null, error: query.error ?? null };
      };
      query.insert = (...args) => record("insert", args);
      query.update = (...args) => record("update", args);
      query.upsert = (...args) => record("upsert", args);
      query.single = async () => query.singleResult ?? { data: query.data ?? null, error: query.error ?? null };
      query.maybeSingle = async () => query.maybeSingleResult ?? { data: query.data ?? null, error: query.error ?? null };
      queries.push(query);
      return query;
    },
  };
  return queries;
}

test("cloud workspace reads and writes user-scoped Supabase rows", async () => {
  setupBrowserEnv();
  const queries = installSupabaseClient((table) => ({
    maybeSingleResult: {
      data: {
        workspace_snapshot: { genre: "mystery", updatedAt: "" },
        updated_at: "2026-05-03T10:00:00.000Z",
      },
      error: null,
    },
    singleResult: {
      data: { updated_at: "2026-05-03T10:30:00.000Z" },
      error: null,
    },
  }));
  const {
    fetchUserWorkspaceSnapshot,
    saveUserWorkspaceSnapshot,
  } = await importFresh("static/js/src/cloud-workspace.js");

  assert.equal(await fetchUserWorkspaceSnapshot("  "), null);
  const snapshot = await fetchUserWorkspaceSnapshot(" user-1 ");
  const saved = await saveUserWorkspaceSnapshot(" user-1 ", { genre: "sci-fi" });

  assert.deepEqual(snapshot, {
    genre: "mystery",
    updatedAt: "2026-05-03T10:00:00.000Z",
  });
  assert.equal(saved.updatedAt, "2026-05-03T10:30:00.000Z");
  assert.equal(queries[0].table, "user_workspaces");
  assert.deepEqual(queries[0].calls.find((call) => call.method === "eq").args, ["user_id", "user-1"]);
  assert.deepEqual(queries[1].calls.find((call) => call.method === "upsert").args[1], { onConflict: "user_id" });
  assert.equal(queries[1].calls.find((call) => call.method === "upsert").args[0].user_id, "user-1");
});

test("work library cloud listing filters deleted rows and keeps newer local cache", async () => {
  const { localStorage } = setupBrowserEnv();
  localStorage.setItem(
    "story-generation-works-v1:user-1",
    JSON.stringify({
      activeWorkId: "w1",
      works: [
        {
          id: "w1",
          userId: "user-1",
          title: "Local Newer",
          status: "active",
          snapshot: { form: { synopsis: "local story" }, updatedAt: "2026-05-03T10:00:00.000Z" },
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-03T10:00:00.000Z",
        },
      ],
    }),
  );
  const queries = installSupabaseClient(() => ({
    orderResult: {
      data: [
        {
          id: "w1",
          user_id: "user-1",
          title: "Cloud Older",
          genre: "",
          style: "",
          status: "active",
          snapshot: { form: { synopsis: "cloud story" }, updatedAt: "2026-05-02T10:00:00.000Z" },
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-02T10:00:00.000Z",
        },
      ],
      error: null,
    },
  }));
  const { listWorks } = await importFresh("static/js/src/work-library.js");

  const result = await listWorks({ userId: "user-1" });

  assert.equal(result.source, "cloud");
  assert.equal(result.works.length, 1);
  assert.equal(result.works[0].title, "Local Newer");
  assert.deepEqual(queries[0].calls.find((call) => call.method === "eq").args, ["user_id", "user-1"]);
  assert.deepEqual(queries[0].calls.find((call) => call.method === "neq").args, ["status", "deleted"]);
  assert.deepEqual(queries[0].calls.find((call) => call.method === "order").args, ["updated_at", { ascending: false }]);
});

test("work library create and delete use scoped Supabase writes", async () => {
  setupBrowserEnv();
  const queries = installSupabaseClient((table) => {
    if (table === "works") {
      return {
        singleResult: {
          data: {
            id: "uuid-1",
            user_id: "user-1",
            title: "Created Story",
            genre: "fantasy",
            style: "plain",
            status: "active",
            snapshot: { form: { customGenre: "fantasy", customStyle: "plain" } },
            created_at: "2026-05-03T10:00:00.000Z",
            updated_at: "2026-05-03T10:00:00.000Z",
          },
          error: null,
        },
      };
    }
    return {};
  });
  const {
    buildEmptyWorkSnapshot,
    createWork,
    deleteWork,
  } = await importFresh("static/js/src/work-library.js");

  const created = await createWork(
    { userId: "user-1" },
    {
      title: "Created Story",
      snapshot: {
        ...buildEmptyWorkSnapshot(),
        form: { customGenre: "fantasy", customStyle: "plain" },
      },
    },
  );
  const deleted = await deleteWork({ userId: "user-1" }, created.id);

  assert.equal(created.id, "uuid-1");
  assert.equal(deleted, true);
  const insertPayload = queries.find((query) => query.calls.some((call) => call.method === "insert"))
    .calls.find((call) => call.method === "insert").args[0];
  const updateQuery = queries.find((query) => query.calls.some((call) => call.method === "update"));
  assert.equal(insertPayload.user_id, "user-1");
  assert.equal(insertPayload.status, "active");
  assert.deepEqual(updateQuery.calls.find((call) => call.method === "update").args[0].status, "deleted");
  assert.deepEqual(updateQuery.calls.filter((call) => call.method === "eq")[0].args, ["user_id", "user-1"]);
  assert.deepEqual(updateQuery.calls.filter((call) => call.method === "eq")[1].args, ["id", "uuid-1"]);
});

test("work library getWork keeps newer local task snapshots over older cloud rows", async () => {
  const { localStorage } = setupBrowserEnv();
  localStorage.setItem(
    "story-generation-works-v1:user-1",
    JSON.stringify({
      activeWorkId: "w1",
      works: [
        {
          id: "w1",
          userId: "user-1",
          title: "Local Running",
          status: "active",
          snapshot: {
            form: { synopsis: "local story" },
            llmTask: {
              taskId: "task-local",
              kind: "outline",
              status: "running",
              operation: "outline_generate",
            },
            updatedAt: "2026-05-03T10:00:00.000Z",
          },
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-03T10:00:00.000Z",
        },
      ],
    }),
  );
  installSupabaseClient(() => ({
    maybeSingleResult: {
      data: {
        id: "w1",
        user_id: "user-1",
        title: "Cloud Older",
        genre: "",
        style: "",
        status: "active",
        snapshot: { form: { synopsis: "cloud story" }, updatedAt: "2026-05-02T10:00:00.000Z" },
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-02T10:00:00.000Z",
      },
      error: null,
    },
  }));
  const { getWork } = await importFresh("static/js/src/work-library.js");

  const work = await getWork({ userId: "user-1" }, "w1");

  assert.equal(work.title, "Local Running");
  assert.equal(work.snapshot.llmTask.taskId, "task-local");
});

test("user activity merges cloud rows with local cache and writes the merged stats", async () => {
  const { localStorage } = setupBrowserEnv();
  localStorage.setItem(
    "story-generation-user-activity-v1:user-1",
    JSON.stringify({
      writingTimeSeconds: 120,
      activeDays: ["2026-05-01"],
      updatedAt: "2026-05-01T12:00:00.000Z",
    }),
  );
  const queries = installSupabaseClient(() => ({
    maybeSingleResult: {
      data: {
        writing_time_seconds: 60,
        active_days: ["2026-05-02"],
        updated_at: "2026-05-02T12:00:00.000Z",
      },
      error: null,
    },
    singleResult: {
      data: {
        writing_time_seconds: 120,
        active_days: ["2026-05-01", "2026-05-02"],
        updated_at: "2026-05-03T00:00:00.000Z",
      },
      error: null,
    },
  }));
  const { fetchUserActivityStats } = await importFresh("static/js/src/user-activity.js");

  const result = await fetchUserActivityStats({ userId: "user-1" });

  assert.equal(result.source, "cloud");
  assert.equal(result.stats.writingTimeSeconds, 120);
  assert.deepEqual(result.stats.activeDays, ["2026-05-01", "2026-05-02"]);
  assert.equal(queries[0].table, "user_activity_stats");
  assert.deepEqual(queries[0].calls.find((call) => call.method === "eq").args, ["user_id", "user-1"]);
  const upsertPayload = queries[1].calls.find((call) => call.method === "upsert").args[0];
  assert.equal(upsertPayload.user_id, "user-1");
  assert.equal(upsertPayload.writing_time_seconds, 120);
  assert.deepEqual(upsertPayload.active_days, ["2026-05-01", "2026-05-02"]);
});

test("user activity falls back to local stats when Supabase table is unavailable", async () => {
  const { localStorage } = setupBrowserEnv();
  const originalWarn = console.warn;
  console.warn = () => {};
  localStorage.setItem(
    "story-generation-user-activity-v1:user-1",
    JSON.stringify({
      writingTimeSeconds: 33,
      activeDays: ["2026-05-03"],
      updatedAt: "2026-05-03T00:00:00.000Z",
    }),
  );
  installSupabaseClient(() => ({
    maybeSingleResult: {
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the user_activity_stats table in the schema cache",
      },
    },
  }));
  const { fetchUserActivityStats } = await importFresh("static/js/src/user-activity.js");

  let result;
  try {
    result = await fetchUserActivityStats({ userId: "user-1" });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(result.source, "local");
  assert.equal(result.error, null);
  assert.equal(result.cloudUnavailable, true);
  assert.equal(result.stats.writingTimeSeconds, 33);
});
