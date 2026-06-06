const { allowCors, sendJson } = require("../_utils");

module.exports = function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return sendJson(res, 200, { state: "idle", message: "Browser source chunks are ready." });
};
