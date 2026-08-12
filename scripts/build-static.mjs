import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "static");
const htmlDir = path.join(sourceDir, "html");
const outputDir = path.join(rootDir, "dist");

const pageRoutes = [
  ["index.html", "index.html"],
  ["auth.html", "auth.html"],
  ["create.html", "create.html"],
  ["works.html", "works.html"],
  ["mynote.html", "mynote.html"],
  ["mynote.html", "notes.html"],
  ["usercenter.html", "usercenter.html"],
];

function normalizePublicUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }

  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("STORY_API_BASE_URL must use http or https.");
  }
  return url.toString().replace(/\/$/, "");
}

function escapeJsonForJavaScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function injectRuntimeConfig(html) {
  const tag = '    <script src="/runtime-config.js"></script>\n';
  if (html.includes("/runtime-config.js")) {
    return html;
  }
  return html.replace(/\s*<\/head>/i, `\n${tag}  </head>`);
}

async function writePage(sourceName, outputName) {
  const source = await readFile(path.join(htmlDir, sourceName), "utf8");
  const target = path.join(outputDir, outputName);
  await mkdir(path.dirname(target), { recursive: true });
  const output = sourceName === "index.html" ? source : injectRuntimeConfig(source);
  await writeFile(target, output, "utf8");
}

const apiBaseUrl = normalizePublicUrl(process.env.STORY_API_BASE_URL);
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const runtimeConfig = {
  apiBaseUrl,
  authEnabled: Boolean(supabaseUrl && supabaseAnonKey),
  supabaseUrl,
  supabaseAnonKey,
};

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(sourceDir, path.join(outputDir, "static"), { recursive: true });
await rm(path.join(outputDir, "static", "html"), { recursive: true, force: true });
await Promise.all(pageRoutes.map(([source, target]) => writePage(source, target)));
await writeFile(
  path.join(outputDir, "runtime-config.js"),
  `globalThis.__STORY_GENERATION_CONFIG__ = Object.freeze(${escapeJsonForJavaScript(runtimeConfig)});\n`,
  "utf8",
);

console.log(`Static site built at ${outputDir}`);
console.log(`AI API origin: ${apiBaseUrl || "same-origin (local fallback)"}`);
