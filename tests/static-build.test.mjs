import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

function runStaticBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/build-static.mjs"], {
      cwd: rootDir,
      env: {
        ...process.env,
        STORY_API_BASE_URL: "https://story-api.example.com/",
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon-key-for-static-build",
      },
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output || `Static build exited with ${code}`));
      }
    });
  });
}

test("static build emits every server route and injects runtime config", async () => {
  await rm(distDir, { recursive: true, force: true });
  try {
    await runStaticBuild();
    const routeFiles = [
      "index.html",
      "auth.html",
      "create.html",
      "works.html",
      "mynote.html",
      "notes.html",
      "usercenter.html",
      "static/js/app.js",
      "static/js/vendor/supabase.js",
    ];
    await Promise.all(routeFiles.map((relativePath) => access(path.join(distDir, relativePath))));

    const [landing, create, runtimeConfig] = await Promise.all([
      readFile(path.join(distDir, "index.html"), "utf8"),
      readFile(path.join(distDir, "create.html"), "utf8"),
      readFile(path.join(distDir, "runtime-config.js"), "utf8"),
    ]);
    assert.doesNotMatch(landing, /runtime-config\.js/);
    assert.match(create, /<script src="\/runtime-config\.js"><\/script>/);
    assert.match(runtimeConfig, /"apiBaseUrl":"https:\/\/story-api\.example\.com"/);
    assert.match(runtimeConfig, /"authEnabled":true/);
    assert.match(runtimeConfig, /"supabaseAnonKey":"anon-key-for-static-build"/);
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});
