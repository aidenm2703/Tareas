// Ventana fija de un minuto por req.ip. Sin dependencias externas.
function rateLimit({ limit = 10, windowMs = 60000, now = Date.now } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [ip, entry] of clients) if (entry.until <= time) clients.delete(ip);
    let entry = clients.get(req.ip);
    if (!entry) { entry = { count: 0, until: time + windowMs }; clients.set(req.ip, entry); }
    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count - 1)));
    if (++entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.until - time) / 1000)));
      return res.status(429).json({ error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.', status: 429 });
    }
    next();
  };
}
module.exports = rateLimit;
