const express = require('express');
const { auth, users, publicUser } = require('./middlewares/auth');
const validateTask = require('./middlewares/validateTask');
const v = require('./validation');
const d = require('./domain');
const { recommend } = require('./gemini');
function extras(app, store) {
  const route = handler => (req, res, next) => Promise.resolve().then(() => handler(req, res)).catch(next);
  const mutate = (req, fn) => store.transaction(s => fn(s, d.person(s, req.user.usuario)));
  const payload = req => {
    const p = d.person(store.state, req.user.usuario);
    return { user: req.user, tasks: store.state.tasks, person: p, summary: d.summary(store.state, p), reminders: d.reminders(store.state, p), geminiConfigured: Boolean(process.env.GEMINI_API_KEY) };
  };
  app.post('/api/login', route((req, res) => {
    const user = users.find(u => u.usuario === req.body?.usuario?.toLowerCase?.() && u.password === req.body?.password);
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    store.transaction(s => d.person(s, user.usuario));
    res.json({ token: user.token, user: publicUser(user) });
  }));
  app.get('/api/state', auth, route((req, res) => res.json(payload(req))));
  app.patch('/api/tasks/:id', auth, (req, res, next) => {
    const task = store.state.tasks.find(t => t.id === Number(req.params.id));
    if (!task) return next(Object.assign(new Error('Tarea no encontrada'), { status: 404 }));
    req.body = { ...req.body, titulo: req.body?.titulo ?? task.titulo, prioridad: req.body?.prioridad ?? task.prioridad };
    validateTask(req, res, next);
  }, route((req, res) => {
    const fields = v.taskExtras(req.body);
    if (req.body.completada !== undefined && typeof req.body.completada !== 'boolean') v.fail('completada debe ser un booleano');
    mutate(req, (s, p) => {
      const task = s.tasks.find(t => t.id === Number(req.params.id));
      Object.assign(task, fields, { titulo: req.body.titulo.trim(), prioridad: req.body.prioridad });
      if (req.body.completada !== undefined) {
        task.completada = req.body.completada;
        if (task.completada) {
          task.completadaEn = new Date().toISOString();
          // Una tarea otorga XP una sola vez, aunque se reabra o se cambie de cuenta.
          if (!task.recompensada) { task.recompensada = req.user.usuario; d.award(p, `task:${task.id}`, 25); }
        } else task.completadaEn = null;
      }
    });
    res.json(payload(req));
  }));
  app.put('/api/profile', auth, route((req, res) => {
    const b = req.body || {};
    const profile = { objetivos: v.text(b.objetivos, 'Objetivos', 1000), rutina: v.text(b.rutina, 'Rutina', 1000), inicio: v.time(b.inicio), fin: v.time(b.fin), actividad: v.text(b.actividad, 'Actividad', 40), peso: v.number(b.peso, 'Peso', 20, 400), metaPeso: v.number(b.metaPeso, 'Meta de peso', 20, 400), habitos: v.text(b.habitos, 'Hábitos', 1000, 0), metaAgua: v.number(b.metaAgua, 'Meta de agua (ml)', 250, 6000), metaEjercicio: v.number(b.metaEjercicio, 'Meta semanal de minutos', 10, 1200), metaPesajes: v.number(b.metaPesajes, 'Pesajes semanales', 1, 7), consentimientoIA: b.consentimientoIA === true };
    if (profile.fin <= profile.inicio) v.fail('La hora final debe ser posterior a la inicial');
    mutate(req, (s, p) => { p.profile = profile; if (!p.weights.length) p.weights.push({ id: d.randomUUID(), fecha: d.day(), peso: profile.peso }); });
    res.json(payload(req));
  }));
  app.post('/api/health/:type', auth, route((req, res) => {
    const b = req.body || {}, fecha = v.date(b.fecha || d.day());
    if (fecha > d.day()) v.fail('Los registros de salud no pueden estar en el futuro');
    if (!['water', 'exercise', 'weights'].includes(req.params.type)) throw Object.assign(new Error('Ruta no encontrada'), { status: 404 });
    mutate(req, (s, p) => {
      if (!p.profile) v.fail('Completa primero el perfil');
      const entry = { id: d.randomUUID(), fecha };
      if (req.params.type === 'water') {
        entry.ml = v.number(b.ml, 'Cantidad (ml)', 50, 2000);
        p.water.push(entry);
        if (p.water.filter(w => w.fecha === fecha).reduce((sum, w) => sum + w.ml, 0) >= p.profile.metaAgua) d.award(p, `water:${fecha}`, 15, fecha);
      } else if (req.params.type === 'exercise') {
        entry.tipo = v.text(b.tipo, 'Tipo de actividad', 60); entry.duracion = v.number(b.duracion, 'Duración', 1, 600);
        if (b.calorias !== undefined && b.calorias !== null) entry.calorias = v.number(b.calorias, 'Calorías', 0, 10000);
        p.exercise.push(entry); d.award(p, `exercise:${fecha}`, 15, fecha);
      } else {
        entry.peso = v.number(b.peso, 'Peso', 20, 400);
        const existing = p.weights.find(w => w.fecha === fecha);
        if (existing) existing.peso = entry.peso; else p.weights.push(entry);
        p.weights.sort((a, b) => a.fecha.localeCompare(b.fecha));
        d.award(p, `weight:${fecha}`, 5, fecha);
      }
    });
    res.status(201).json(payload(req));
  }));
  app.post('/api/events', auth, route((req, res) => {
    const b = req.body || {};
    const event = { id: d.randomUUID(), titulo: v.text(b.titulo, 'Título', 100, 3), fecha: v.date(b.fecha), hora: v.time(b.hora), tipo: v.text(b.tipo, 'Tipo', 40), duracion: v.number(b.duracion || 30, 'Duración', 1, 600) };
    mutate(req, (s, p) => p.events.push(event)); res.status(201).json(payload(req));
  }));
  app.patch('/api/events/:id', auth, route((req, res) => {
    mutate(req, (s, p) => {
      const event = p.events.find(e => e.id === req.params.id);
      if (!event) throw Object.assign(new Error('Evento no encontrado'), { status: 404 });
      Object.assign(event, { titulo: v.text(req.body.titulo, 'Título', 100, 3), fecha: v.date(req.body.fecha), hora: v.time(req.body.hora), tipo: v.text(req.body.tipo, 'Tipo', 40), duracion: v.number(req.body.duracion, 'Duración', 1, 600) });
    }); res.json(payload(req));
  }));
  app.post('/api/recurring', auth, route((req, res) => {
    const b = req.body || {};
    if (!Array.isArray(b.dias) || !b.dias.length || b.dias.some(n => !Number.isInteger(n) || n < 0 || n > 6)) v.fail('Elige al menos un día de la semana');
    if (!['agua', 'ejercicio', 'peso'].includes(b.tipo)) v.fail('Tipo de recordatorio inválido');
    const r = { id: d.randomUUID(), titulo: v.text(b.titulo, 'Título', 100), tipo: b.tipo, hora: v.time(b.hora), dias: [...new Set(b.dias)], desde: d.day() };
    mutate(req, (s, p) => p.recurring.push(r)); res.status(201).json(payload(req));
  }));
  app.delete('/api/recurring/:id', auth, route((req, res) => {
    mutate(req, (s, p) => { p.recurring = p.recurring.filter(r => r.id !== req.params.id); }); res.json(payload(req));
  }));
  app.post('/api/notifications/read', auth, route((req, res) => {
    mutate(req, (s, p) => {
      const ids = d.reminders(s, p).filter(r => r.due).map(r => r.id);
      p.read = [...new Set([...p.read, ...ids])].slice(-2000);
    }); res.json(payload(req));
  }));
  const inFlight = new Set();
  app.post('/api/recommendations', auth, route(async (req, res) => {
    const p = d.person(store.state, req.user.usuario);
    if (!p.profile?.consentimientoIA) v.fail('Activa el permiso para enviar tu perfil e historial a Gemini en tu perfil');
    if (inFlight.has(req.user.usuario)) throw Object.assign(new Error('Ya se está generando una recomendación'), { status: 409 });
    inFlight.add(req.user.usuario);
    try {
      const result = await recommend(structuredClone(store.state), structuredClone(p));
      mutate(req, (s, current) => { current.advice = result; }); res.json(payload(req));
    } finally { inFlight.delete(req.user.usuario); }
  }));
  app.post('/api/rewards/:id', auth, route((req, res) => {
    const rewards = { focus: { xp: 100, nombre: 'Pausa consciente de 10 minutos' }, explorer: { xp: 300, nombre: 'Una hora para tu pasatiempo favorito' }, champion: { xp: 500, nombre: 'Celebra tu constancia' } };
    const reward = rewards[req.params.id];
    if (!reward) v.fail('Recompensa desconocida');
    mutate(req, (s, p) => { if (p.xp < reward.xp) v.fail('Aún no alcanzas el XP necesario'); if (!p.rewards.includes(req.params.id)) p.rewards.push(req.params.id); });
    res.json(payload(req));
  }));
  app.use('/evidencias', express.static(require('node:path').join(__dirname, 'docs')));
}
module.exports = extras;
