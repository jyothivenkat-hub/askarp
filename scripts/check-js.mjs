import { spawnSync } from "node:child_process";

const files = [
  "api/_utils.js",
  "api/article-source.js",
  "api/chat.js",
  "api/persona.js",
  "api/reset.js",
  "api/tts.js",
  "api/youtube-transcript.js",
  "api/sources/index.js",
  "api/sources/status.js",
  "script.js"
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Checked ${files.length} JavaScript files.`);
