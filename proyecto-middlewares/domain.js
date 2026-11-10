const { randomUUID } = require('node:crypto');
function day(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function plusDays(date, n) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function person(state, user) {
  return state.people[user] ||= { profile: null, water: [], exercise: [], weights: [], events: [], recurring: [], read: [], xp: 0, xpLedger: [], activeDays: [], badges: [], rewards: [], advice: null };
}
function streak(p, today = day()) {
  let d = p.activeDays.includes(today) ? today : plusDays(today, -1), count = 0;
  while (p.activeDays.includes(d)) { count++; d = plusDays(d, -1); }
  return count;
}
const badgeList = [
  { id: 'first', nombre: 'Primer paso', icon: '✦', descripcion: 'Completa tu primera tarea', check: p => p.xpLedger.some(x => x.key.startsWith('task:')) },
  { id: 'five', nombre: 'En movimiento', icon: '⚡', descripcion: 'Completa cinco tareas', check: p => p.xpLedger.filter(x => x.key.startsWith('task:')).length >= 5 },
  { id: 'water', nombre: 'Como el agua', icon: '◈', descripcion: 'Alcanza tu meta diaria de agua', check: p => p.xpLedger.some(x => x.key.startsWith('water:')) },
  { id: 'exercise', nombre: 'Energía vital', icon: '↗', descripcion: 'Registra tu primera actividad', check: p => p.exercise.length > 0 },
  { id: 'streak', nombre: 'Constancia', icon: '♨', descripcion: 'Mantén una racha de tres días', check: p => streak(p) >= 3 },
  { id: 'level', nombre: 'Nueva versión', icon: '★', descripcion: 'Alcanza el nivel 3', check: p => p.xp >= 200 }
];
function award(p, key, xp, today = day()) {
  if (!p.xpLedger.some(x => x.key === key)) { p.xp += xp; p.xpLedger.push({ key, xp, fecha: today }); }
  if (!p.activeDays.includes(today)) p.activeDays.push(today);
  for (const badge of badgeList) if (badge.check(p) && !p.badges.includes(badge.id)) p.badges.push(badge.id);
}
function reminders(state, p, now = new Date()) {
  const today = day(now), items = [];
  for (const entry of [...state.tasks.filter(t => !t.completada && t.fechaLimite).map(t => ({ ...t, fecha: t.fechaLimite, kind: 'task' })), ...p.events.map(e => ({ ...e, kind: 'event' }))]) {
    for (const before of [3, 1, 0]) {
      const date = plusDays(entry.fecha.slice(0, 10), -before);
      if (date < plusDays(today, -7)) continue;
      const id = `${entry.kind}:${entry.id}:${entry.fecha}:${before}`;
      items.push({ id, titulo: entry.titulo, fecha: date, hora: before === 0 ? entry.hora || '09:00' : '09:00', detalle: before === 1 ? 'Falta 1 día' : before ? `Faltan ${before} días` : 'Es hoy', read: p.read.includes(id), tipo: entry.kind });
    }
  }
  for (const r of p.recurring) {
    for (let offset = -7; offset <= 7; offset++) {
      const fecha = plusDays(today, offset);
      if (!r.dias.includes(new Date(fecha + 'T12:00:00Z').getUTCDay()) || (r.desde && fecha < r.desde)) continue;
      const id = `recurring:${r.id}:${fecha}`;
      items.push({ id, titulo: r.titulo, detalle: 'Recordatorio recurrente', fecha, hora: r.hora, read: p.read.includes(id), tipo: r.tipo });
    }
  }
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Costa_Rica', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  return items.map(i => ({ ...i, due: i.fecha < today || (i.fecha === today && i.hora <= time) })).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}
function summary(state, p) {
  const today = day(), monday = plusDays(today, -((new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7));
  const water = p.water.filter(w => w.fecha === today).reduce((n, w) => n + w.ml, 0);
  const minutes = p.exercise.filter(e => e.fecha >= monday && e.fecha <= today).reduce((n, e) => n + e.duracion, 0);
  return { today, monday, water, minutes, streak: streak(p), level: Math.floor(p.xp / 100) + 1, levelProgress: p.xp % 100, badges: badgeList.map(({ check, ...b }) => ({ ...b, unlocked: p.badges.includes(b.id) })) };
}
module.exports = { day, plusDays, person, streak, award, reminders, summary, randomUUID };
