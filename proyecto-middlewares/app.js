const express = require('express');
const path = require('node:path');
const logger = require('./middlewares/logger');
const { auth, authorize } = require('./middlewares/auth');
const validateTask = require('./middlewares/validateTask');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const createStore = require('./store');

function httpError(message, status = 404) { return Object.assign(new Error(message), { status }); }
function createApp(options = {}) {
  const app = express();
  const store = options.store || createStore();
  app.use(logger); // 1. Siempre primero.
  app.use(express.json({ limit: '64kb' })); // 2. Leer req.body.
  if (options.rateLimiter) app.use('/api', options.rateLimiter);
  app.get('/api/tasks', (req, res) => res.json(store.state.tasks));
  app.get('/api/tasks/:id', (req, res, next) => {
    const task = store.state.tasks.find(t => t.id === Number(req.params.id));
    if (!task) return next(httpError('Tarea no encontrada'));
    res.json(task);
  });
  app.post('/api/tasks', auth, validateTask, (req, res, next) => {
    try {
      const fields = require('./validation').taskExtras(req.body);
      const task = store.transaction(s => {
        const task = { id: s.nextId++, titulo: req.body.titulo.trim(), prioridad: req.body.prioridad || 'media', ...fields, completada: false, creada: new Date().toISOString(), creadaPor: req.user.usuario };
        s.tasks.push(task); return task;
      });
      res.status(201).json(task);
    } catch (error) { next(error); }
  });
  app.delete('/api/tasks/:id', auth, authorize('admin'), (req, res, next) => {
    try {
      const index = store.state.tasks.findIndex(t => t.id === Number(req.params.id));
      if (index < 0) return next(httpError('Tarea no encontrada'));
      store.transaction(s => s.tasks.splice(index, 1));
      res.json({ mensaje: 'Tarea eliminada' });
    } catch (error) { next(error); }
  });
  // Las extensiones se registran aquí, antes del 404 y del manejador de errores.
  if (options.extensions) options.extensions(app, store);
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(notFound); // 3. Rutas inexistentes.
  app.use(errorHandler); // 4. Siempre al final.
  return app;
}
if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp({ extensions: require('./extras'), rateLimiter: require('./middlewares/rateLimit')() }).listen(port, '127.0.0.1', () => console.log(`Vital disponible en http://localhost:${port}`));
}
module.exports = { createApp, httpError };
