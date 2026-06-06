const { allowCors } = require("./_utils");

module.exports = function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(503).end();
};
