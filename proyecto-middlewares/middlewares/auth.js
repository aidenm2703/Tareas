// Credenciales públicas de demostración requeridas por la práctica; no usar en producción.
const users = [
  { token: 'abc123', nombre: 'Ana', rol: 'admin', usuario: 'ana', password: 'Ana123!' },
  { token: 'xyz789', nombre: 'Luis', rol: 'user', usuario: 'luis', password: 'Luis123!' }
];
function publicUser(user) {
  return { nombre: user.nombre, rol: user.rol, usuario: user.usuario };
}
function auth(req, res, next) {
  const header = req.get('Authorization');
  if (!header) return res.status(401).json({ error: 'Token no proporcionado' });
  const match = /^Bearer ([^\s]+)$/.exec(header);
  const user = match && users.find(u => u.token === match[1]);
  if (!user) return res.status(401).json({ error: 'Token inválido' });
  req.user = publicUser(user);
  next();
}
function authorize(rol) {
  return (req, res, next) => {
    if (!req.user || req.user.rol !== rol) return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    next();
  };
}
module.exports = { auth, authorize, users, publicUser };
