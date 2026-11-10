function fail(message) { throw Object.assign(new Error(message), { status: 400 }); }
function text(value, name, max = 120, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(`${name}: debe tener entre ${min} y ${max} caracteres`);
  return value.trim();
}
function number(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${name}: debe ser un número entre ${min} y ${max}`);
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Fecha inválida');
  return value;
}
function time(value) { if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('Hora inválida'); return value; }
function taskExtras(body) {
  const result = {};
  if (body.categoria !== undefined) result.categoria = text(body.categoria, 'Categoría', 40);
  if (body.descripcion !== undefined) result.descripcion = text(body.descripcion, 'Descripción', 1500, 0);
  if (body.fechaLimite !== undefined) result.fechaLimite = body.fechaLimite === '' ? '' : date(body.fechaLimite);
  if (body.hora !== undefined) result.hora = body.hora === '' ? '' : time(body.hora);
  if (body.etiquetas !== undefined) {
    if (!Array.isArray(body.etiquetas) || body.etiquetas.length > 10) fail('Máximo 10 etiquetas');
    result.etiquetas = [...new Set(body.etiquetas.map(t => text(t, 'Etiqueta', 30)))];
  }
  return result;
}
module.exports = { fail, text, number, date, time, taskExtras };
