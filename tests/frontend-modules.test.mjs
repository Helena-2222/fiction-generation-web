import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("create page deduplicates hidden and pagehide workspace saves per lifecycle", async () => {
  const source = await readFile(
    new URL("../static/js/app.js", import.meta.url),
    "utf8",
  );
  const getFunctionBody = (name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} should exist`);

    const bodyStart = source.indexOf("{", start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
      if (source[index] === "{") {
        depth += 1;
      } else if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.slice(bodyStart + 1, index);
        }
      }
    }

    assert.fail(`Unable to read ${name} body`);
  };

  const visibilityBody = getFunctionBody("handleWorkspaceVisibilityChange");
  const pageHideBody = getFunctionBody("handleWorkspacePageHide");
  const lifecycleSaveBody = getFunctionBody("saveWorkspaceForHiddenLifecycle");
  const resetBody = getFunctionBody("resetWorkspaceHiddenLifecycleSave");

  assert.match(visibilityBody, /saveWorkspaceForHiddenLifecycle\(\)/);
  assert.match(visibilityBody, /resetWorkspaceHiddenLifecycleSave\(\)/);
  assert.match(pageHideBody, /saveWorkspaceForHiddenLifecycle\(\)/);
  assert.doesNotMatch(pageHideBody, /saveWorkspaceSnapshot\(/);
  assert.match(lifecycleSaveBody, /workspaceHiddenLifecycleSavedRevision === workspaceSnapshotSaveRevision/);
  assert.match(lifecycleSaveBody, /saveWorkspaceSnapshot\(\{ immediate: true \}\)/);
  assert.match(lifecycleSaveBody, /workspaceHiddenLifecycleSavedRevision = workspaceSnapshotSaveRevision/);
  assert.match(resetBody, /workspaceHiddenLifecycleSavedRevision = null/);
  assert.match(
    source,
    /window\.addEventListener\("pageshow", resetWorkspaceHiddenLifecycleSave\)/,
  );

  const createHarness = new Function(`
    let workspaceSnapshotSaveRevision = 0;
    let workspaceHiddenLifecycleSavedRevision = null;
    let saveCount = 0;
    function saveWorkspaceSnapshot() {
      saveCount += 1;
      workspaceSnapshotSaveRevision += 1;
    }
    function saveWorkspaceForHiddenLifecycle() {
      ${lifecycleSaveBody}
    }
    function resetWorkspaceHiddenLifecycleSave() {
      ${resetBody}
    }
    return {
      saveWorkspaceForHiddenLifecycle,
      resetWorkspaceHiddenLifecycleSave,
      saveWorkspaceSnapshot,
      getSaveCount: () => saveCount,
    };
  `);
  const harness = createHarness();

  assert.equal(harness.saveWorkspaceForHiddenLifecycle(), true);
  assert.equal(harness.saveWorkspaceForHiddenLifecycle(), false);
  assert.equal(harness.getSaveCount(), 1);

  harness.saveWorkspaceSnapshot();
  assert.equal(harness.saveWorkspaceForHiddenLifecycle(), true);
  assert.equal(harness.getSaveCount(), 3);

  harness.resetWorkspaceHiddenLifecycleSave();
  assert.equal(harness.saveWorkspaceForHiddenLifecycle(), true);
  assert.equal(harness.getSaveCount(), 4);
});

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

test("auth-client reuses the public config cache while loading the SDK in parallel", async () => {
  setupBrowserEnv();

  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  let resolveConfigResponse;
  let appendedScript = null;
  let appendCalls = 0;
  let createClientCalls = 0;

  class FakeScriptElement {
    constructor() {
      this.async = false;
      this.dataset = {};
      this.listeners = new Map();
      this.src = "";
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    removeEventListener(type, listener) {
      if (this.listeners.get(type) === listener) {
        this.listeners.delete(type);
      }
    }

    remove() {}

    dispatch(type) {
      this.listeners.get(type)?.();
    }
  }

  globalThis.HTMLScriptElement = FakeScriptElement;
  document.createElement = () => new FakeScriptElement();
  document.head.appendChild = (script) => {
    appendCalls += 1;
    appendedScript = script;
  };
  globalThis.fetch = (...args) => {
    fetchCalls.push(args);
    return new Promise((resolve) => {
      resolveConfigResponse = resolve;
    });
  };

  try {
    const auth = await importFresh("static/js/src/auth-client.js");
    const firstClientRequest = auth.getSupabaseClient();
    const secondClientRequest = auth.getSupabaseClient();

    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(fetchCalls[0], ["/api/public-config", { cache: "default" }]);
    assert.equal(appendCalls, 1);
    assert.equal(appendedScript?.src, "/static/js/vendor/supabase.js");

    window.supabase = {
      createClient(url, anonKey, options) {
        createClientCalls += 1;
        return { anonKey, options, url };
      },
    };
    appendedScript.dispatch("load");

    let clientResolvedBeforeConfig = false;
    firstClientRequest.then(() => {
      clientResolvedBeforeConfig = true;
    });
    await Promise.resolve();
    assert.equal(clientResolvedBeforeConfig, false);

    resolveConfigResponse({
      ok: true,
      async json() {
        return {
          authEnabled: true,
          supabaseAnonKey: "anon-key",
          supabaseUrl: "https://project.supabase.co",
        };
      },
    });

    const [firstClient, secondClient] = await Promise.all([
      firstClientRequest,
      secondClientRequest,
    ]);
    assert.equal(firstClient, secondClient);
    assert.equal(createClientCalls, 1);

    await auth.getAuthConfig();
    assert.equal(fetchCalls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("notes never falls back to a projected snapshot when deleting a favorite", async () => {
  const source = await readFile(
    new URL("../static/js/mynote.js", import.meta.url),
    "utf8",
  );
  const functionStart = source.indexOf("async function removeFavorite(");
  const functionEnd = source.indexOf("\nfunction handleFilterClick", functionStart);
  const body = source.slice(functionStart, functionEnd);

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);
  assert.match(body, /await getWork\(getWorkOptions\(\), workId\)/);
  assert.doesNotMatch(body, /\|\| listedWork/);
  assert.match(body, /if \(!work\)[\s\S]*throw new Error/);
});

test("user activity stores guest writing stats locally", async () => {
  setupBrowserEnv();
  const {
    fetchUserActivityStats,
    formatWritingDurationParts,
    getCachedUserActivityStats,
    recordUserActivity,
  } = await importFresh("static/js/src/user-activity.js");
  const options = { guestMode: true };

  assert.deepEqual(getCachedUserActivityStats(options), {
    writingTimeSeconds: 0,
    activeDays: [],
    updatedAt: null,
  });

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
  assert.equal(getCachedUserActivityStats(options).writingTimeSeconds, 100);
  assert.equal(formatWritingDurationParts(3599).value, "59");
  assert.equal(formatWritingDurationParts(3599).unit, "min");
  assert.deepEqual(formatWritingDurationParts(3600), { value: "1.0", unit: "h" });
  assert.deepEqual(formatWritingDurationParts(36000), { value: "10", unit: "h" });
});

test("user center renders cached data before independent cloud refreshes", async () => {
  const [html, source, styles] = await Promise.all([
    readFile(new URL("../static/html/usercenter.html", import.meta.url), "utf8"),
    readFile(new URL("../static/js/usercenter.js", import.meta.url), "utf8"),
    readFile(new URL("../static/css/usercenter.css", import.meta.url), "utf8"),
  ]);
  const loadStart = source.indexOf("async function loadUserData()");
  const loadEnd = source.indexOf("\nasync function bootstrapAuth()", loadStart);
  const loadBody = source.slice(loadStart, loadEnd);

  assert.notEqual(loadStart, -1);
  assert.notEqual(loadEnd, -1);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(html, /rel="modulepreload" href="\/static\/js\/src\/auth-client\.js"/);
  assert.match(html, /rel="modulepreload" href="\/static\/js\/src\/work-library\.js"/);
  assert.match(loadBody, /state\.works = listCachedWorks/);
  assert.match(loadBody, /state\.activityStats = getCachedUserActivityStats/);
  assert.ok(loadBody.indexOf("render();") < loadBody.indexOf("await Promise.allSettled"));
  assert.match(loadBody, /refreshWorks\(\)[\s\S]*refreshActivityStats\(\)/);
  assert.doesNotMatch(source, /recordUserActivity/);
  assert.match(source, /await refreshWorkSummaries/);
  assert.ok(source.indexOf("render();", source.indexOf("async function refreshWorks")) < source.indexOf("await listWorks"));
  assert.match(source, /const BOOK_THEMES = \["bc-teal", "bc-plum", "bc-slate", "bc-forest", "bc-burg", "bc-terra"\]/);
  assert.doesNotMatch(source, /book-entry-title|book-entry-sub/);
  assert.match(styles, /\.bc-teal \{ --bc: #ECCE8E; --bs: #D59B3E;/);
  assert.match(styles, /\.bc-terra \{ --bc: #BCD3E6; --bs: #A6BFDC;/);
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
