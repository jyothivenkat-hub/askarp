const { allowCors, sendJson } = require("./_utils");

module.exports = function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return sendJson(res, 200, {
    name: "Andrej Karpathy",
    description:
      "AI researcher and educator. This companion is grounded in public Karpathy materials.",
    model: process.env.ANTHROPIC_MODEL || "serverless",
    server_tts: false
  });
};
