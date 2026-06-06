const { allowCors, readJson, sendJson } = require("../_utils");

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
  }

  return sendJson(res, 200, {
    ok: true,
    url: body.url || "",
    rebuild: "skipped",
    note: "This Vercel deployment stores extracted sources in the browser; persistent indexing runs in the local backend."
  });
};
