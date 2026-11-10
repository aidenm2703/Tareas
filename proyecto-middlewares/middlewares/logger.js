function logger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const date = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[${date}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Math.round(ms)} ms)`);
  });
  next();
}
module.exports = logger;
