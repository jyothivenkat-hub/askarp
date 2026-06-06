const { decodeEntities, hashId, readJson, sendJson, summarize, topTags } = require("./_utils");

function stripHtml(pageHtml) {
  const body = pageHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, " ");

  const blocks = [];
  const pattern = /<(p|h1|h2|h3|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match = pattern.exec(body);
  while (match) {
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.split(/\s+/).length >= 6 && text.length >= 35) blocks.push(text);
    match = pattern.exec(body);
  }

  const seen = new Set();
  return blocks.filter((block) => {
    const key = block.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTitle(pageHtml, fallback) {
  const meta =
    pageHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    pageHtml.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
    pageHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeEntities((meta && meta[1] ? meta[1] : fallback).replace(/\s+/g, " ").trim());
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body." });
  }

  const url = String(body.url || "").trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return sendJson(res, 400, { error: "Paste a valid public article URL." });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return sendJson(res, 400, { error: "Paste a valid public article URL." });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 Askarp/1.0",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!response.ok) throw new Error(`Article request failed with ${response.status}.`);
    const pageHtml = await response.text();
    const title = extractTitle(pageHtml, parsed.hostname);
    const blocks = stripHtml(pageHtml);
    const text = blocks.join("\n\n");
    if (text.split(/\s+/).length < 120) {
      return sendJson(res, 400, { error: "Could not extract enough article text from that page." });
    }

    return sendJson(res, 200, {
      source: {
        id: `article-${hashId(url)}`,
        title,
        kind: "Article",
        year: "Fetched",
        url,
        tags: topTags(title, text),
        summary: `Article text extracted from the public page. ${summarize(text)}`,
        principles: [
          "Use the article text as grounding when answering questions about this source.",
          "Cite the original article URL when using this source."
        ],
        patterns: [
          "Break the article into compact chunks before retrieval.",
          "Prefer direct source-grounded explanations over generic persona guesses."
        ],
        codeHint: "const article = await fetch('/api/article-source', { method: 'POST' });",
        text
      },
      word_count: text.split(/\s+/).length
    });
  } catch (error) {
    return sendJson(res, 502, { error: error.message || "Article extraction failed." });
  }
};
