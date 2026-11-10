function validateTask(req, res, next) {
  const body = req.body || {};
  const errores = [];
  if (body.titulo === undefined || body.titulo === null || body.titulo === '') errores.push('El titulo es obligatorio');
  else if (typeof body.titulo !== 'string') errores.push('El titulo debe ser texto');
  else if (body.titulo.trim().length < 3 || body.titulo.trim().length > 100) errores.push('El titulo debe tener entre 3 y 100 caracteres');
  if (body.prioridad !== undefined && !['baja', 'media', 'alta'].includes(body.prioridad)) errores.push('La prioridad debe ser baja, media o alta');
  if (errores.length) return res.status(400).json({ errores });
  next();
}
module.exports = validateTask;
