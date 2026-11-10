function notFound(req, res, next) {
  const error = new Error('Ruta no encontrada');
  error.status = 404;
  next(error);
}
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : err.message, status });
}
module.exports = { notFound, errorHandler };
