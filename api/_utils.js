const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "but",
  "can", "for", "from", "have", "into", "just", "like", "more", "not", "now",
  "one", "our", "out", "that", "the", "then", "there", "this", "was", "what",
  "when", "with", "you", "your"
]);

function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request is too large."));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, status, payload) {
  allowCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function summarize(text) {
  const compact = String(text).replace(/\s+/g, " ").trim();
  if (compact.length <= 340) return compact;
  let cutoff = compact.lastIndexOf(".", 340);
  if (cutoff < 160) cutoff = 337;
  return `${compact.slice(0, cutoff + 1).trim()}...`;
}

function topTags(title, text) {
  const words = `${title} ${text}`.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  const counts = new Map();
  words.forEach((word) => {
    if (STOP_WORDS.has(word)) return;
    counts.set(word, (counts.get(word) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function hashId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

module.exports = {
  allowCors,
  decodeEntities,
  escapeHtml,
  hashId,
  readJson,
  sendJson,
  summarize,
  topTags
};
