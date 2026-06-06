import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const sourcesFile = fs.readFileSync("data/sources.js", "utf8");
const script = fs.readFileSync("script.js", "utf8");

const context = { window: {} };
vm.runInNewContext(sourcesFile, context);

const sources = context.window.KARPATHY_COMPANION_SOURCES;

if (!html.includes('id="askForm"')) {
  throw new Error("index.html is missing the ask form");
}

if (!html.includes("data/sources.js") || !html.includes("script.js")) {
  throw new Error("index.html is missing required scripts");
}

if (!css.includes(".pet") || !css.includes("@keyframes talk-nod")) {
  throw new Error("styles.css is missing avatar styling or talking animation");
}

if (!html.includes("pixel-pet") || !html.includes("andrej-pixel-pet.png")) {
  throw new Error("index.html is missing the Andrej pixel pet");
}

if (!fs.existsSync("assets/andrej-pixel-pet.png")) {
  throw new Error("assets/andrej-pixel-pet.png is missing — run scripts/process-pixel-avatar.py");
}

if (!script.includes("composeAnswer") || !script.includes("speechSynthesis")) {
  throw new Error("script.js is missing answer composition or voice output");
}

if (
  !script.includes("/api/youtube-transcript") ||
  !script.includes("/api/article-source") ||
  !script.includes("/api/sources") ||
  !html.includes("sourceForm")
) {
  throw new Error("Persona source ingestion is not wired into the app");
}

if (!html.includes("toneLayerStatus") || !html.includes("knowledgeLayerStatus") || !html.includes("answerLayerStatus")) {
  throw new Error("Three persona layers are not visible in the app");
}

if (!Array.isArray(sources) || sources.length < 8) {
  throw new Error("source manifest should include at least 8 starter sources");
}

for (const source of sources) {
  const required = ["id", "title", "kind", "url", "tags", "summary", "principles", "patterns", "codeHint"];
  for (const key of required) {
    if (!source[key]) {
      throw new Error(`source ${source.id || "(unknown)"} is missing ${key}`);
    }
  }
}

console.log(`Smoke checks passed for ${sources.length} sources.`);
