const { allowCors, readJson, sendJson } = require("./_utils");

function sse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, {
      error: "ANTHROPIC_API_KEY is not configured for this deployment."
    });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body." });
  }

  const message = String(body.message || body.query || "").trim();
  if (!message) return sendJson(res, 400, { error: "Message is required." });

  const system = [
    "You are Askarp, a Karpathy-inspired AI tutor grounded in public Andrej Karpathy materials.",
    "Do not claim to be Andrej Karpathy. Do not clone his identity or voice.",
    "Explain clearly from first principles. Synthesize ideas naturally.",
    "Do not expose retrieval internals such as fact ids, chunks, passages, or source text.",
    "Keep normal answers compact unless the user explicitly asks for a deep dive."
  ].join("\n");

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 800),
        temperature: 0.6,
        system,
        messages: [{ role: "user", content: message }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      sse(res, { type: "error", message: `Model request failed: ${errorText.slice(0, 240)}` });
      return res.end();
    }

    const payload = await response.json();
    const text = (payload.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    sse(res, { type: "delta", text });
    sse(res, { type: "sources", sources: [], abstained: false });
    sse(res, { type: "done" });
    return res.end();
  } catch (error) {
    sse(res, { type: "error", message: error.message || "Chat failed." });
    return res.end();
  }
};
