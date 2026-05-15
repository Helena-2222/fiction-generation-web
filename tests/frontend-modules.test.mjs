import assert from "node:assert/strict";
import test from "node:test";

function createLocalStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
}

function setupBrowserEnv(url = "http://localhost/create?stage=basic") {
  let uuid = 0;
  const localStorage = createLocalStorage();
  const location = new URL(url);
  location.replace = (nextPath) => {
    globalThis.window.__lastReplacedLocation = nextPath;
  };

  globalThis.window = {
    __lastReplacedLocation: "",
    __storyGenerationSupabaseClient: null,
    crypto: {
      randomUUID: () => `uuid-${++uuid}`,
    },
    localStorage,
    location,
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

test("utils normalize user text, filenames, HTML and ranges", async () => {
  setupBrowserEnv();
  const {
    clamp,
    escapeHtml,
    normalizeFavoriteQuote,
    sanitizeFilename,
  } = await importFresh("static/js/src/utils.js");

  const quote = normalizeFavoriteQuote({
    text: "  keep this line  ",
    storyTitle: "Demo",
    chapterNumber: "2",
    startOffset: "5",
    endOffset: "17",
  });

  assert.equal(quote.text, "keep this line");
  assert.equal(quote.chapterNumber, 2);
  assert.equal(quote.startOffset, 5);
  assert.equal(normalizeFavoriteQuote({ text: "   " }), null);
  assert.equal(clamp(12, 1, 10), 10);
  assert.equal(clamp(-1, 0, 10), 0);

  const filename = sanitizeFilename('bad:/name*? "draft"');
  assert.doesNotMatch(filename, /[<>:"/\\|?*\u0000-\u001f]/);
  assert.ok(filename.length <= 80);

  assert.equal(
    escapeHtml("A&B<\"'\nnext"),
    "A&amp;B&lt;&quot;&#39;<br />next",
  );
});

test("auth-client keeps redirects local and signs out through Supabase", async () => {
  setupBrowserEnv("http://localhost/auth?next=https%3A%2F%2Fevil.example%2Fsteal");
  const auth = await importFresh("static/js/src/auth-client.js");

  assert.equal(auth.getRequestedNextPath(), auth.DEFAULT_NEXT_PATH);
  assert.equal(
    auth.buildAuthUrl("https://evil.example/steal"),
    `/auth?next=${encodeURIComponent(auth.DEFAULT_NEXT_PATH)}`,
  );
  assert.equal(
    auth.getPostAuthNextPath("/create?guest=true&stage=basic#draft"),
    "/create?stage=basic&guestTransfer=1#draft",
  );

  let calls = 0;
  window.__storyGenerationSupabaseClient = {
    auth: {
      async signOut() {
        calls += 1;
        return { error: null };
      },
    },
  };
  await auth.signOut();
  assert.equal(calls, 1);

  window.__storyGenerationSupabaseClient = {
    auth: {
      async signOut() {
        return { error: new Error("sign out failed") };
      },
    },
  };
  await assert.rejects(() => auth.signOut(), /sign out failed/);
});

test("user activity stores guest writing stats locally", async () => {
  setupBrowserEnv();
  const {
    fetchUserActivityStats,
    formatWritingDurationParts,
    recordUserActivity,
  } = await importFresh("static/js/src/user-activity.js");
  const options = { guestMode: true };

  const first = await recordUserActivity(options, {
    writingSeconds: 65,
    activeDay: "2026-05-03",
  });
  const second = await recordUserActivity(options, {
    writingSeconds: 35,
    activeDay: "2026-05-03",
  });
  const fetched = await fetchUserActivityStats(options);

  assert.equal(first.source, "local");
  assert.equal(second.stats.writingTimeSeconds, 100);
  assert.deepEqual(second.stats.activeDays, ["2026-05-03"]);
  assert.equal(fetched.stats.writingTimeSeconds, 100);
  assert.equal(formatWritingDurationParts(3599).value, "59");
  assert.equal(formatWritingDurationParts(3599).unit, "min");
  assert.deepEqual(formatWritingDurationParts(3600), { value: "1.0", unit: "h" });
  assert.deepEqual(formatWritingDurationParts(36000), { value: "10", unit: "h" });
});

test("work library creates, lists, renames, duplicates and deletes local works", async () => {
  setupBrowserEnv();
  const {
    buildEmptyWorkSnapshot,
    createWork,
    deleteWork,
    duplicateWork,
    getWorkTitleFromSnapshot,
    getWorkWordCount,
    listWorks,
    renameWork,
  } = await importFresh("static/js/src/work-library.js");
  const options = { guestMode: true };
  const snapshot = {
    ...buildEmptyWorkSnapshot(),
    form: {
      synopsis: "Clockwork rain over the old city",
      customGenre: "mystery",
      customStyle: "quiet",
    },
    generatedStory: {
      title: "",
      chapters: [
        { content: "alpha" },
        { content: "beta" },
      ],
    },
    llmTask: {
      taskId: "llm-task-active",
      kind: "story",
      status: "running",
      operation: "story_generate",
    },
  };

  assert.equal(getWorkTitleFromSnapshot(snapshot), "Clockwork rain over the old");
  assert.equal(getWorkWordCount(snapshot), 9);

  const created = await createWork(options, { snapshot });
  let listed = await listWorks(options);
  assert.equal(created.genre, "mystery");
  assert.equal(created.style, "quiet");
  assert.equal(listed.source, "local");
  assert.equal(listed.works.length, 1);

  const renamed = await renameWork(options, created.id, "Renamed Story");
  assert.equal(renamed.title, "Renamed Story");

  const duplicated = await duplicateWork(options, created.id);
  assert.notEqual(duplicated.id, created.id);
  assert.ok(duplicated.title.startsWith("Renamed Story"));
  assert.equal(duplicated.snapshot.workspaceLock.locked, false);
  assert.equal(duplicated.snapshot.llmTask, null);

  assert.equal(await deleteWork(options, created.id), true);
  listed = await listWorks(options);
  assert.equal(listed.works.length, 1);
  assert.equal(listed.works[0].id, duplicated.id);
});
