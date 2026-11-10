'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const prettyDate = (date, options = { day: 'numeric', month: 'short' }) => date ? new Date(date.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-CR', { ...options, timeZone: 'America/Costa_Rica' }) : 'Sin fecha';
let token = sessionStorage.getItem('vital-token'), data, view = 'dashboard', busy = false;
let filters = { search: '', status: 'all', priority: '', category: '', tag: '', date: '' };
let calendarDate = dateKey(), calendarMode = 'month', dashboardTab = 'pending', reminderTimer, adviceAttempt = '';
let theme = localStorage.getItem('vital-theme') || 'light', muted = localStorage.getItem('vital-muted') === 'true';
let motion = localStorage.getItem('vital-motion') !== 'off', lastRenderedView;
const recommendationErrors = {};
document.body.classList.toggle('dark', theme === 'dark');
document.body.classList.toggle('motion-off', !motion);
for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => {
  VitalFeedback.unlock().then(ready => { if (ready && data) notifyDue(); });
}, { passive: true });
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 4500); }
async function api(path, method = 'GET', body) {
  let response;
  try { response = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error('No se pudo conectar con el servidor. Revisa que esté encendido.'); }
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/login') logout();
    let message = result.errores?.join('\n') || result.error || 'Ocurrió un error';
    if (response.status === 429 && response.headers.get('Retry-After')) message = `Límite de la práctica: 10 peticiones por minuto. Espera ${response.headers.get('Retry-After')} segundos.`;
    throw new Error(message);
  }
  return result;
}
function sound(type = 'task') {
  return VitalFeedback.play(type, muted);
}
function confetti() {
  if (!motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $('#confetti').innerHTML = Array.from({ length: 55 }, () => `<i class="confetti-bit" style="left:${Math.random() * 100}%;background:${['#e76b42','#efc64d','#3e65c4','#77a79a'][Math.floor(Math.random()*4)]};--dx:${Math.random()*300-150}px;animation-delay:${Math.random()*.4}s"></i>`).join('');
  setTimeout(() => $('#confetti').replaceChildren(), 3200);
}
function acceptState(next, celebrate = true) {
  const previous = data; data = next;
  if (celebrate && previous?.user.usuario === data.user.usuario) {
    const newBadges = data.person.badges.filter(b => !previous.person.badges.includes(b));
    if (data.summary.level > previous.summary.level) { sound('level'); confetti(); toast(`¡Nivel ${data.summary.level}! Cada paso cuenta.`); }
    else if (newBadges.length) { sound('badge'); confetti(); toast(`¡Logro desbloqueado: ${data.summary.badges.find(b => b.id === newBadges[0]).nombre}!`); }
    else if (data.person.xp > previous.person.xp) { sound(); toast(`¡Bien hecho! +${data.person.xp - previous.person.xp} XP`); }
    if (previous.summary.water < goal('water') && data.summary.water >= goal('water')) confetti();
  }
  render(); notifyDue();
}
async function mutation(path, method, body) {
  if (busy) return;
  busy = true;
  try { const next = await api(path, method, body); acceptState(next); return next; }
  finally { busy = false; }
}
function goal(type) { return data?.person.profile?.[({ water: 'metaAgua', exercise: 'metaEjercicio', weights: 'metaPesajes' })[type]] || ({ water: 2000, exercise: 150, weights: 1 })[type]; }
const pct = (n, max) => Math.min(100, Math.max(0, n / max * 100));
const progress = (n, max, color = '') => `<div class="progress ${color}" role="progressbar" aria-valuenow="${Math.round(pct(n,max))}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso"><span style="width:${pct(n,max)}%"></span></div>`;
const empty = (title, text = '') => `<div class="empty-state"><span>✧</span>${esc(title)}${text ? `<br><small>${esc(text)}</small>` : ''}</div>`;
const heading = (title, subtitle, actions = '') => `<div class="page-heading"><div><h1>${title}</h1><p>${esc(subtitle)}</p></div>${actions}</div>`;
const newTaskButton = '<button class="btn primary" data-action="new-task">＋ Nueva tarea</button>';
function openModal(title, content) { $('#modal-title').textContent = title; $('#modal-content').innerHTML = content; $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function formError(form, err) { const field = $('[data-form-error]', form); if (field) field.textContent = err.message; else toast(err.message); }
function formFooter(label = 'Guardar') { return `<p class="error wide" data-form-error role="alert"></p><div class="form-actions wide"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn primary" type="submit">${label}</button></div>`; }
function taskRow(t) {
  return `<div class="task-row"><button class="task-check ${t.completada ? 'checked' : ''}" data-action="complete" data-id="${t.id}" aria-label="${t.completada ? 'Reabrir' : 'Completar'} ${esc(t.titulo)}">${t.completada ? '✓' : ''}</button><div class="task-body"><button class="task-title ${t.completada ? 'done' : ''}" data-action="view-task" data-id="${t.id}">${esc(t.titulo)}</button><div class="task-meta"><span>${esc(t.categoria || 'General')}</span>${t.fechaLimite ? `<span>·</span><span>${prettyDate(t.fechaLimite)}${t.hora ? ' · '+esc(t.hora) : ''}${t.fechaLimite < data.summary.today && !t.completada ? ' · Vencida' : ''}</span>` : ''}${(t.etiquetas || []).map(tag => `<span class="badge">#${esc(tag)}</span>`).join('')}</div></div><span class="badge ${esc(t.prioridad)}">${esc(t.prioridad)}</span><div class="task-ops"><button class="icon-btn" data-action="edit-task" data-id="${t.id}" aria-label="Editar ${esc(t.titulo)}">✎</button>${data.user.rol === 'admin' ? `<button class="icon-btn" data-action="delete-task" data-id="${t.id}" aria-label="Eliminar ${esc(t.titulo)}">×</button>` : ''}</div></div>`;
}
function waterCard() {
  const water = data.summary.water, target = goal('water'), glasses = Math.min(16, Math.ceil(target / 250));
  return `<section class="card water-card"><div class="card-header"><h2>Un respiro. Un vaso de agua.</h2><span class="badge" style="background:#eaf3f9;color:#7d9eb9">HIDRATACIÓN</span></div><div class="water-content"><div class="water-ring" style="--pct:${pct(water,target)}"><div><b>${(water/1000).toLocaleString('es-CR',{maximumFractionDigits:2})} <small>L</small></b><small>de ${(target/1000).toLocaleString('es-CR')} L diarios</small></div></div><div class="water-info"><p>${water >= target ? '¡Meta del día alcanzada!' : 'Tu cuerpo te lo agradece.'}</p><small>${Math.round(water/250)} vasos registrados hoy</small><div class="glasses">${Array.from({length:glasses},(_,i)=>`<button class="glass ${water >= (i+1)*250 ? 'filled' : ''}" data-action="water" aria-label="Añadir un vaso de 250 mililitros">${water >= (i+1)*250 ? '✓' : '+'}</button>`).join('')}</div><button class="btn small" data-action="water">＋ Añadir 250 ml</button></div></div></section>`;
}
function weeklyBars() {
  const { monday, today } = data.summary;
  const values = Array.from({length:7},(_,i)=>{ const date=addDays(monday,i); return { date, n:data.person.exercise.filter(e=>e.fecha===date).reduce((s,e)=>s+e.duracion,0) }; });
  const max = Math.max(30,...values.map(v=>v.n));
  return `<div class="week-bars" aria-label="Minutos de actividad por día">${values.map((v,i)=>`<div class="week-bar ${v.date===today?'today':''}" title="${prettyDate(v.date)}: ${v.n} minutos"><span style="height:${Math.max(4,v.n/max*65)}px"></span><small>${['L','M','M','J','V','S','D'][i]}</small></div>`).join('')}</div>`;
}
function dashboard() {
  const {tasks, summary:s, person:p}=data, pending=tasks.filter(t=>!t.completada), doneToday=tasks.filter(t=>t.completada && t.completadaEn&&dateKey(new Date(t.completadaEn))===s.today);
  const sorted=[...tasks].sort((a,b)=>(a.fechaLimite||'9999').localeCompare(b.fechaLimite||'9999')||({alta:0,media:1,baja:2}[a.prioridad]-{alta:0,media:1,baja:2}[b.prioridad]));
  const shown=sorted.filter(t=>dashboardTab==='completed'?t.completada:dashboardTab==='today'? !t.completada&&t.fechaLimite===s.today:!t.completada).slice(0,5);
  const reminders=data.reminders.filter(r=>!r.read&&r.fecha>=s.today).slice(0,3);
  const advice=p.advice?.texto || (data.geminiConfigured?'Completa tu perfil y genera tu primera recomendación personalizada.':'Tu guía personalizada te espera. Configura Gemini para recibir recomendaciones basadas en tu rutina.');
  return `<div class="page-heading"><div><div class="date-label">${prettyDate(s.today,{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</div><h1>Hola, ${esc(data.user.nombre)} <span>☀</span></h1><p>Un nuevo día para avanzar. Hagamos que cuente.</p></div>${newTaskButton}</div><div class="overview"><section class="card stat"><div class="stat-label">Tareas de hoy <span class="stat-icon">☑</span></div><div class="stat-value">${doneToday.length}<small>/ ${doneToday.length+pending.filter(t=>t.fechaLimite===s.today).length} completadas</small></div>${progress(doneToday.length,doneToday.length+pending.filter(t=>t.fechaLimite===s.today).length||1)}<div class="stat-bottom"><span>${pending.length} pendientes en total</span><span>↗</span></div></section><section class="card stat"><div class="stat-label">Agua tomada <span class="stat-icon">♧</span></div><div class="stat-value">${(s.water/1000).toLocaleString('es-CR')}<small>/ ${goal('water')/1000} L</small></div>${progress(s.water,goal('water'),'blue')}<div class="stat-bottom"><span>${Math.round(pct(s.water,goal('water')))}% de tu meta diaria</span><span>＋</span></div></section><section class="card stat"><div class="stat-label">Actividad física <span class="stat-icon">↗</span></div><div class="stat-value">${p.exercise.filter(e=>e.fecha===s.today).reduce((n,e)=>n+e.duracion,0)}<small>min hoy</small></div>${progress(s.minutes,goal('exercise'),'purple')}<div class="stat-bottom"><span>${s.minutes} de ${goal('exercise')} min esta semana</span><span>↗</span></div></section><section class="card stat"><div class="stat-label">Tu racha actual <span class="stat-icon">♨</span></div><div class="stat-value">${s.streak}<small>días seguidos</small></div><div class="stat-bottom" style="margin-top:20px"><span>${s.streak?'¡Sigue cuidando tu constancia!':'Hoy puede ser tu primer día.'}</span><span>✦</span></div></section></div><div class="dashboard-grid"><div class="column"><section class="card"><div class="card-header"><h2>Tus tareas, paso a paso</h2><a href="#tasks" class="text-link">Ver todas →</a></div><div class="task-tabs"><button data-action="dashboard-tab" data-value="pending" class="${dashboardTab==='pending'?'active':''}">Pendientes <small>${pending.length}</small></button><button data-action="dashboard-tab" data-value="today" class="${dashboardTab==='today'?'active':''}">Para hoy</button><button data-action="dashboard-tab" data-value="completed" class="${dashboardTab==='completed'?'active':''}">Completadas</button></div>${shown.length?shown.map(taskRow).join(''):empty('Todo empieza con un pequeño paso.','Crea una tarea y dale espacio en tu día.')}</section>${waterCard()}<section class="card"><div class="card-header"><h2>Movimiento que suma</h2><a href="#health" class="text-link">Registrar actividad →</a></div><p class="muted" style="font-size:10px">${s.minutes} minutos de movimiento esta semana. Cada uno cuenta.</p>${weeklyBars()}</section></div><div class="column"><section class="card level-card"><div class="level-top"><span class="level-medal">✦</span><div><h3>Nivel ${s.level} · ${s.level<3?'Sembrando hábitos':s.level<6?'Creciendo cada día':'Constancia en acción'}</h3><p>Cada pequeño logro te hace crecer.</p></div></div>${progress(s.levelProgress,100)}<div class="level-line"><span>${p.xp} XP acumulados</span><span>${100-s.levelProgress} XP para subir</span></div></section><section class="card coach-card"><div class="card-header"><h2><span>✧</span> Un consejo para ti</h2><span class="badge purple">${p.advice?'GEMINI':'TU GUÍA IA'}</span></div><p>${esc(advice.slice(0,235))}${advice.length>235?'…':''}</p><div class="coach-foot"><small>${p.advice?'A partir de tu perfil e historial':'Personalizado a tu ritmo'}</small><a href="#coach" class="text-link">Ver mi guía →</a></div></section><section class="card reminders-card"><div class="card-header"><h2>Lo que viene</h2><a href="#calendar" class="text-link">▦</a></div>${reminders.length?reminders.map(r=>`<div class="reminder-row"><span class="reminder-time">${esc(r.hora)}</span><span class="reminder-mark"></span><div class="reminder-detail"><b>${esc(r.titulo)}</b><p>${prettyDate(r.fecha)} · ${esc(r.detalle)}</p></div></div>`).join(''):empty('Tu agenda tiene espacio.','Añade una fecha a tus tareas.')}<button class="text-link" data-action="notifications">Ver recordatorios →</button></section></div></div>`;
}
function filterTasks() {
  const q=filters.search.toLocaleLowerCase('es');
  return data.tasks.filter(t=>(!q||[t.titulo,t.descripcion,t.categoria,...(t.etiquetas||[])].join(' ').toLocaleLowerCase('es').includes(q))&&(filters.status==='all'||(filters.status==='done'?t.completada:!t.completada))&&(!filters.priority||t.prioridad===filters.priority)&&(!filters.category||(t.categoria||'General')===filters.category)&&(!filters.tag||(t.etiquetas||[]).includes(filters.tag))&&(!filters.date||t.fechaLimite===filters.date)).sort((a,b)=>Number(a.completada)-Number(b.completada)||b.id-a.id);
}
function tasksView() {
  const categories=[...new Set(data.tasks.map(t=>t.categoria||'General'))], tags=[...new Set(data.tasks.flatMap(t=>t.etiquetas||[]))];
  return heading('Mis tareas','Dale claridad a tus pendientes y espacio a lo que importa.',newTaskButton)+`<div class="toolbar" id="task-filters"><div class="search"><span>⌕</span><input id="task-search" type="search" placeholder="Buscar por título, categoría o etiqueta…" aria-label="Buscar tareas" value="${esc(filters.search)}"></div><select data-filter="status" aria-label="Filtrar por estado">${[['all','Todos los estados'],['pending','Pendientes'],['done','Completadas']].map(([v,l])=>`<option value="${v}" ${filters.status===v?'selected':''}>${l}</option>`).join('')}</select><select data-filter="priority" aria-label="Filtrar por prioridad"><option value="">Prioridad</option>${['alta','media','baja'].map(v=>`<option ${filters.priority===v?'selected':''}>${v}</option>`).join('')}</select><select data-filter="category" aria-label="Filtrar por categoría"><option value="">Categoría</option>${categories.map(v=>`<option ${filters.category===v?'selected':''}>${esc(v)}</option>`).join('')}</select><select data-filter="tag" aria-label="Filtrar por etiqueta"><option value="">Etiqueta</option>${tags.map(v=>`<option ${filters.tag===v?'selected':''}>${esc(v)}</option>`).join('')}</select><input type="date" data-filter="date" aria-label="Filtrar por fecha" value="${esc(filters.date)}" style="width:145px"><button class="btn small" data-action="clear-filters">Limpiar</button></div><section class="card task-list-card"><div class="card-header"><h2 id="filtered-count">${filterTasks().length} tareas</h2><span class="muted">${data.user.rol==='admin'?'Cuenta administradora':'La eliminación está reservada al administrador'}</span></div><div id="filtered-tasks">${filterTasks().map(taskRow).join('')||empty('No hay tareas con estos filtros.')}</div></section>`;
}
function chart() {
  const weights=data.person.weights.slice(-15);
  if(!weights.length)return empty('Tu evolución empieza aquí.','Registra tu primer peso.');
  const values=weights.map(w=>w.peso), min=Math.min(...values)-1,max=Math.max(...values)+1;
  const x=i=>45+i*(490/Math.max(1,weights.length-1)), y=n=>145-(n-min)/(max-min)*115;
  const points=weights.map((w,i)=>`${x(i)},${y(w.peso)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 570 180" role="img" aria-label="Evolución de peso: ${esc(weights.map(w=>`${prettyDate(w.fecha)}: ${w.peso} kg`).join('; '))}">${[min,(min+max)/2,max].map(n=>`<line x1="40" y1="${y(n)}" x2="540" y2="${y(n)}"/><text x="0" y="${y(n)+4}">${n.toFixed(1)}</text>`).join('')}<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>${weights.map((w,i)=>`<circle cx="${x(i)}" cy="${y(w.peso)}" r="4" fill="currentColor"><title>${prettyDate(w.fecha)}: ${w.peso} kg</title></circle>`).join('')}<text x="40" y="173">${prettyDate(weights[0].fecha)}</text><text x="490" y="173">${prettyDate(weights.at(-1).fecha)}</text></svg>`;
}
function healthView() {
  const {person:p,summary:s}=data,weeklyWater=p.water.filter(w=>w.fecha>=s.monday&&w.fecha<=s.today).reduce((n,w)=>n+w.ml,0),daysPassed=Math.round((Date.parse(s.today)-Date.parse(s.monday))/86400000)+1;
  const latest=p.weights.at(-1),first=p.weights[0],weightGoal=p.profile?.metaPeso,weightProgress=latest&&first&&weightGoal!==first.peso?pct(Math.abs(latest.peso-first.peso),Math.abs(weightGoal-first.peso)):0;
  const weekWeights=p.weights.filter(w=>w.fecha>=s.monday&&w.fecha<=s.today).length;
  return heading('Tu bienestar importa','Escucha tu ritmo. Registra tus hábitos, sin presión.','<button class="btn" data-action="profile">⚙ Ajustar metas</button>')+`<div class="section-grid">${waterCard()}<section class="card"><div class="card-header"><h2>Actividad de esta semana</h2><button class="btn small soft" data-action="exercise">＋ Registrar</button></div><div class="metric-number">${s.minutes}<small> / ${goal('exercise')} minutos</small></div>${progress(s.minutes,goal('exercise'),'purple')}${weeklyBars()}</section><section class="card"><div class="card-header"><h2>Mi evolución de peso</h2><button class="btn small soft" data-action="weight">＋ Registrar</button></div><div class="metric-number">${latest?latest.peso:'—'}<small>kg · meta personal ${weightGoal||'—'} kg</small></div>${chart()}<p class="muted" style="font-size:10px">${weightGoal?`${Math.round(weightProgress)}% del cambio hacia tu meta registrada`:'Configura una meta en tu perfil'}. El peso fluctúa de forma natural.</p></section><section class="card"><div class="card-header"><h2>Metas semanales</h2><span class="badge">${prettyDate(s.monday)} – ${prettyDate(addDays(s.monday,6))}</span></div><div class="history-item"><b>Agua · semana completa</b><span>${(weeklyWater/1000).toLocaleString('es-CR')} / ${goal('water')*7/1000} L</span></div>${progress(weeklyWater,goal('water')*7,'blue')}<div class="history-item"><b>Movimiento</b><span>${s.minutes} / ${goal('exercise')} min</span></div>${progress(s.minutes,goal('exercise'),'purple')}<div class="history-item"><b>Registros de peso</b><span>${weekWeights} / ${goal('weights')} esta semana</span></div>${progress(weekWeights,goal('weights'))}<p class="muted" style="font-size:10px;line-height:1.9;margin-top:19px">${daysPassed} días transcurridos esta semana. Tus metas son editables; úsalas como guía personal.</p></section><section class="card"><div class="card-header"><h2>Historial de actividad</h2><button class="text-link" data-action="exercise">Añadir →</button></div><div class="history">${[...p.exercise].reverse().map(e=>`<div class="history-item"><div><b>${esc(e.tipo)}</b><p class="muted" style="font-size:9px;margin-top:5px">${prettyDate(e.fecha)}</p></div><span>${e.duracion} min${e.calorias!==undefined?` · ${e.calorias} kcal`:''}</span></div>`).join('')||empty('Aún no hay actividades.')}</div></section><section class="card"><div class="card-header"><h2>Registros de peso</h2><span class="muted">Un registro por día</span></div><div class="history">${[...p.weights].reverse().map(w=>`<div class="history-item"><b>${w.peso} kg</b><span>${prettyDate(w.fecha,{day:'numeric',month:'long',year:'numeric'})}</span></div>`).join('')||empty('Aún no hay registros.')}</div></section></div>`;
}
function calendarView() {
  const date=new Date(calendarDate+'T12:00:00Z'),monthStart=calendarDate.slice(0,7)+'-01';
  const start=calendarMode==='week'?addDays(calendarDate,-((date.getUTCDay()+6)%7)):addDays(monthStart,-((new Date(monthStart+'T12:00:00Z').getUTCDay()+6)%7));
  const count=calendarMode==='week'?7:42;
  const entries=[...data.tasks.filter(t=>t.fechaLimite).map(t=>({...t,fecha:t.fechaLimite,kind:'task'})),...data.person.events.map(e=>({...e,kind:'event'})),...data.person.exercise.map(e=>({...e,titulo:e.tipo+' · '+e.duracion+' min',kind:'exercise'}))];
  return heading('Tu calendario','Haz espacio para tus pendientes y para ti.','<div class="heading-actions"><button class="btn" data-action="recurring">↻ Recordatorio</button><button class="btn primary" data-action="new-event">＋ Evento</button></div>')+`<section class="card calendar-card"><div class="card-header"><div class="calendar-controls"><button class="icon-btn" data-action="calendar-prev" aria-label="Periodo anterior">‹</button><h2>${prettyDate(calendarDate,{month:'long',year:'numeric'})}</h2><button class="icon-btn" data-action="calendar-next" aria-label="Periodo siguiente">›</button><button class="btn small" data-action="calendar-today">Hoy</button></div><div class="segmented"><button data-action="calendar-mode" data-value="month" class="${calendarMode==='month'?'active':''}">Mes</button><button data-action="calendar-mode" data-value="week" class="${calendarMode==='week'?'active':''}">Semana</button></div></div><div class="calendar-container"><div class="calendar">${['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'].map(d=>`<div class="weekday">${d}</div>`).join('')}${Array.from({length:count},(_,i)=>{const key=addDays(start,i),items=entries.filter(e=>e.fecha===key); return `<div class="calendar-day ${key===data.summary.today?'today':''} ${key.slice(0,7)!==calendarDate.slice(0,7)?'faded':''} ${calendarMode==='week'?'week':''}"><div class="day-number">${Number(key.slice(-2))}</div>${items.map(e=>`<button class="calendar-event ${e.kind!=='task'?'activity':''} ${e.completada?'completed':''}" data-action="${e.kind==='task'?'view-task':e.kind==='event'?'edit-event':'view-exercise'}" data-id="${esc(e.id)}">${e.hora?esc(e.hora)+' ':''}${esc(e.titulo)}</button>`).join('')}</div>`;}).join('')}</div></div><div class="calendar-legend"><span><i></i> Tareas</span><span><i class="purple"></i> Eventos y actividad</span><span>Zona horaria: Costa Rica</span></div></section><div class="section-grid" style="margin-top:22px"><section class="card"><div class="card-header"><h2>Hábitos que quieres recordar</h2><button class="text-link" data-action="recurring">Añadir →</button></div>${data.person.recurring.map(r=>`<div class="history-item"><div><b>${esc(r.titulo)}</b><p class="muted" style="font-size:9px;margin-top:6px">${esc(r.hora)} · ${r.dias.map(d=>['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d]).join(', ')}</p></div><button class="icon-btn" data-action="delete-recurring" data-id="${esc(r.id)}" aria-label="Quitar recordatorio">×</button></div>`).join('')||empty('Crea un recordatorio de agua, ejercicio o peso.')}</section><section class="card"><div class="card-header"><h2>Recordatorios automáticos</h2><button class="text-link" data-action="notifications">Ver todos →</button></div><p class="section-description">Cada tarea y evento con fecha genera avisos 3 días antes, 1 día antes y el mismo día. Los verás aquí y en el navegador si das permiso.</p><button class="btn small" data-action="enable-notifications">Activar avisos del navegador</button></section></div>`;
}
function achievementsView() {
  const p=data.person;
  return heading('Cada paso merece celebrarse','Tu constancia tiene valor. Mira todo lo que vas construyendo.',`<span class="badge">NIVEL ${data.summary.level} · ${p.xp} XP</span>`)+`<div class="achievement-grid">${data.summary.badges.map(b=>`<section class="card achievement-card ${b.unlocked?'unlocked':''}"><div class="achievement-icon">${b.icon}</div><h3>${esc(b.nombre)}</h3><p>${esc(b.descripcion)}</p><span class="badge ${b.unlocked?'':'purple'}">${b.unlocked?'✓ Desbloqueado':'Por descubrir'}</span></section>`).join('')}</div><h2 class="section-title">Date una pequeña recompensa</h2><section class="card"><p class="section-description">El XP abre nuevas celebraciones. Reclama cada una una sola vez; tus puntos se conservan.</p>${[['focus',100,'☕','Pausa consciente de 10 minutos'],['explorer',300,'✧','Una hora para tu pasatiempo favorito'],['champion',500,'☆','Celebra tu constancia']].map(([id,xp,icon,title])=>`<div class="reward-row"><span>${icon}</span><div><h3>${title}</h3><p>Se desbloquea a los ${xp} XP</p></div><button class="btn small ${p.xp>=xp?'soft':''}" data-action="reward" data-id="${id}" ${p.xp<xp||p.rewards.includes(id)?'disabled':''}>${p.rewards.includes(id)?'✓ Reclamada':p.xp>=xp?'Reclamar':'Aún bloqueada'}</button></div>`).join('')}</section><div class="notice">Completar una tarea: 25 XP · Meta diaria de agua: 15 XP · Actividad del día: 15 XP · Registro de peso: 5 XP. Reabrir tareas no duplica puntos. Las acciones de cada día alimentan tu racha.</div>`;
}
function coachView() {
  const p=data.person;
  return heading('Tu guía, a tu ritmo','Una perspectiva para organizarte mejor y cuidar tus hábitos.','<button class="btn" data-action="profile">Editar mi perfil</button>')+`<section class="card coach-hero"><span class="coach-orb">✧</span><div><h2>Un plan que empieza contigo.</h2><p>Tu rutina, objetivos e historial ayudan a Gemini a sugerir horarios, movimiento, hidratación y prioridades. Tú decides qué incorporar.</p></div></section><section class="card"><div class="card-header"><h2>Mi recomendación personalizada</h2><span class="badge purple">${p.advice?esc(p.advice.model):'GEMINI'}</span></div>${!data.geminiConfigured?'<div class="notice warning">La conexión con Gemini está preparada. Falta agregar la clave de API al archivo .env del servidor y reiniciarlo.</div>':''}${!p.profile?.consentimientoIA?'<div class="notice">Para generar recomendaciones, autoriza en tu perfil el envío de tus objetivos, rutina y registros a Google Gemini.</div>':''}${p.advice?`<p class="muted" style="font-size:10px">Actualizado ${new Date(p.advice.fecha).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'})}</p><div class="advice-content">${esc(p.advice.texto)}</div>`:empty(p.profile?'Tu guía está lista para generarse.':'Tu primera recomendación está por llegar.',p.profile?'Genera una recomendación a partir de tu perfil e historial.':'Completa tu perfil para que tenga sentido para ti.')}<div class="form-actions"><button class="btn primary" data-action="recommend" ${!data.geminiConfigured||!p.profile?.consentimientoIA?'disabled':''}>✧ Generar recomendación</button></div></section><div class="notice">Con tu permiso, la recomendación se actualiza al volver a esta sección si cambió tu historial. Se reutiliza por hasta 6 horas si nada cambió. Los consejos no sustituyen atención profesional.</div>`;
}
function profileForm(modal = false) {
  const p=data.person.profile||{objetivos:'',rutina:'',inicio:'08:00',fin:'21:00',actividad:'Principiante',peso:'',metaPeso:'',habitos:'',metaAgua:2000,metaEjercicio:150,metaPesajes:1,consentimientoIA:false};
  return `<form id="profile-form" class="form-grid"><p class="section-description wide">Cuéntanos cómo es tu día. Puedes cambiar tus metas cuando quieras. Los campos de peso están en kilogramos.</p><label class="wide">¿Qué te gustaría lograr?<textarea name="objetivos" maxlength="1000" placeholder="Organizar mis estudios, moverme más…" required>${esc(p.objetivos)}</textarea></label><label class="wide">Tu rutina habitual<textarea name="rutina" maxlength="1000" placeholder="Estudio de 8 a 12, trabajo por las tardes…" required>${esc(p.rutina)}</textarea></label><label>Mi día empieza a las<input type="time" name="inicio" value="${esc(p.inicio)}" required></label><label>Mi día termina a las<input type="time" name="fin" value="${esc(p.fin)}" required></label><label class="wide">Nivel de actividad<select name="actividad">${['Principiante','Moderado','Activo'].map(a=>`<option ${p.actividad===a?'selected':''}>${a}</option>`).join('')}</select></label><label>Peso actual (kg)<input name="peso" type="number" min="20" max="400" step="0.1" value="${p.peso}" required></label><label>Meta personal de peso (kg)<input name="metaPeso" type="number" min="20" max="400" step="0.1" value="${p.metaPeso}" required></label><label>Agua al día (ml)<input name="metaAgua" type="number" min="250" max="6000" step="50" value="${p.metaAgua}" required></label><label>Ejercicio semanal (min)<input name="metaEjercicio" type="number" min="10" max="1200" value="${p.metaEjercicio}" required></label><label>Pesajes por semana<input name="metaPesajes" type="number" min="1" max="7" value="${p.metaPesajes}" required></label><label class="wide">Hábitos que quieres cuidar<textarea name="habitos" maxlength="1000" placeholder="Dormir mejor, beber agua, caminar…">${esc(p.habitos)}</textarea></label><label class="checkbox-line wide"><input type="checkbox" name="consentimientoIA" ${p.consentimientoIA?'checked':''}><span>Permito enviar mis objetivos, rutina, tareas y registros de salud a Google Gemini para recibir recomendaciones. En el nivel gratuito, Google puede usar el contenido para mejorar sus productos. Puedo desactivar este envío aquí.</span></label><p class="muted wide" style="font-size:10px;line-height:1.8">Las metas son personales y editables. Ajusta cualquier hábito a tus necesidades y a las indicaciones de tu profesional de salud.</p><p class="error wide" data-form-error role="alert"></p><div class="form-actions wide">${modal&&data.person.profile?'<button type="button" class="btn" data-action="close">Cancelar</button>':''}<button class="btn primary" type="submit">Guardar mi perfil →</button></div></form>`;
}
function settingsView() {
  return heading('Tu perfil y preferencias','Un espacio que se adapta a ti.')+`<section class="card settings-card"><div class="card-header"><h2>Sobre ti</h2><span class="badge">${esc(data.user.nombre)} · ${esc(data.user.rol)}</span></div>${profileForm()}</section><section class="card settings-card" style="margin-top:22px"><h2>Hazlo tuyo</h2><div class="toggle-row"><div><h3>Apariencia</h3><p>Elige el modo que sea más cómodo para ti.</p></div><button class="btn small" data-action="theme">${theme==='dark'?'☀ Modo claro':'☾ Modo oscuro'}</button></div><div class="toggle-row"><div><h3>Sonidos para celebrar</h3><p>Tareas, niveles y logros con su propio sonido.</p></div><button class="btn small" data-action="mute">${muted?'Activar sonidos':'Silenciar'}</button></div><div class="toggle-row"><div><h3>Notificaciones del navegador</h3><p>Se muestran mientras la app esté abierta. También verás los avisos pendientes al volver.</p></div><button class="btn small" data-action="enable-notifications">Activar</button></div><div class="toggle-row"><div><h3>Sesión de ${esc(data.user.nombre)}</h3><p>${data.user.rol==='admin'?'Puedes crear, editar, completar y eliminar tareas.':'Puedes crear, editar y completar tareas. Solo admin puede eliminarlas.'}</p></div><button class="btn small" data-action="logout">Salir</button></div><div class="notice"><a href="/evidencias/pruebas-con-capturas.html" target="_blank" rel="noopener">Ver evidencias de la práctica →</a></div></section>`;
}
function notificationsView() {
  return heading('Tus recordatorios','Un pequeño aviso para lo que no quieres dejar pasar.','<button class="btn" data-action="read-notifications">Marcar recibidos como leídos</button>')+`<section class="card"><div class="card-header"><h2>Recibidos y próximos</h2><button class="text-link" data-action="enable-notifications">Activar navegador →</button></div>${data.reminders.map(r=>`<div class="notification-item ${r.due&&!r.read?'unread':''}"><span>${r.tipo==='task'?'☑':'♧'}</span><div><b>${esc(r.titulo)}</b><p>${esc(r.detalle)} · ${r.due?(r.read?'Leído':'Recibido'):'Programado'}</p></div><small>${prettyDate(r.fecha)}<br>${esc(r.hora)}</small></div>`).join('')||empty('Sin recordatorios por ahora.','Pon una fecha a una tarea o crea un hábito recurrente.')}</section>`;
}
const pages={dashboard,tasks:tasksView,health:healthView,calendar:calendarView,achievements:achievementsView,coach:coachView,settings:settingsView,notifications:notificationsView};
const titles={dashboard:'Mi día',tasks:'Mis tareas',health:'Bienestar',calendar:'Calendario',achievements:'Mis logros',coach:'Mi guía IA',settings:'Perfil y ajustes',notifications:'Recordatorios'};
function render() {
  if(!data)return;
  view=location.hash.slice(1)||'dashboard'; if(!pages[view])view='dashboard';
  $('#main').innerHTML=pages[view](); $('#page-crumb').textContent=titles[view]; document.title=`${titles[view]} · Vital`;
  if(view==='coach' && recommendationErrors[data.user.usuario]) {
    const recommendationCard=$('#main > .card:not(.coach-hero)');
    $('.card-header',recommendationCard)?.insertAdjacentHTML('afterend',`<div class="notice warning" role="alert">${esc(recommendationErrors[data.user.usuario])}</div>`);
    const retry=$('[data-action="recommend"]');if(retry)retry.textContent='Intentar de nuevo';
  }
  if(view==='dashboard') {
    $('.overview')?.insertAdjacentHTML('beforebegin',`<section class="momentum-banner"><div><span class="momentum-kicker">UN PASO A LA VEZ</span><h2>Dale movimiento a tu día.</h2><p>${data.tasks.filter(t=>!t.completada).length?`Tienes ${data.tasks.filter(t=>!t.completada).length} tareas pendientes. Empieza por una.`:'Tu lista está al día. Haz espacio para algo que disfrutes.'}</p></div><div class="kinetic-mark dashboard-kinetic" data-kinetic aria-hidden="true"></div><a href="#tasks" class="momentum-link">Vamos a ello <span>↗</span></a></section>`);
  }
  $('#main').classList.remove('view-enter');
  if(lastRenderedView!==view){void $('#main').offsetWidth;$('#main').classList.add('view-enter');lastRenderedView=view;}
  if(view==='settings') {
    const rows=$$('.toggle-row');
    rows[1]?.insertAdjacentHTML('afterend',`<div class="toggle-row"><div><h3>Movimiento y detalles</h3><p>Animaciones de entrada, agua y elementos gráficos. Se respeta reducir movimiento del sistema.</p></div><button class="btn small" data-action="motion">${motion?'Pausar movimiento':'Activar movimiento'}</button></div><div class="toggle-row"><div><h3>Sonido de recordatorio</h3><p>Una melodía corta para avisos nuevos, incluso sin notificaciones del navegador.</p></div><button class="btn small" data-action="test-sound">▷ Probar sonido</button></div>`);
  }
  $$('#main-nav a').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);a.setAttribute('aria-current',a.dataset.view===view?'page':'false');});
  $('#nav-task-count').textContent=data.tasks.filter(t=>!t.completada).length;
  $('#profile-name').textContent=data.user.nombre; $('#profile-role').textContent=data.user.rol==='admin'?'Administradora':'Usuario'; $('#avatar').textContent=data.user.nombre[0];
  $('#header-date').textContent=prettyDate(data.summary.today,{weekday:'short',day:'numeric',month:'long'});
  $('#notification-dot').hidden=!data.reminders.some(r=>r.due&&!r.read);
  $('#theme-toggle').textContent=theme==='dark'?'☀':'☾';$('#mute-toggle').textContent=muted?'♫̸':'♪';$('#mute-toggle').setAttribute('aria-label',muted?'Activar sonidos':'Silenciar sonidos');
  window.VitalIcons?.paint();
  if(view==='coach'&&data.geminiConfigured&&data.person.profile?.consentimientoIA){const key=JSON.stringify([data.user.usuario,data.person.xp,data.tasks.map(t=>[t.id,t.completada,t.fechaLimite,t.titulo]),data.summary.water,data.person.profile,data.person.exercise.length,data.person.weights]); if(adviceAttempt!==key){adviceAttempt=key;setTimeout(()=>generateAdvice(false),100);}}
}
async function loadState() { const next=await api('/state');acceptState(next,false); }
function logout() { token=null; data=null;adviceAttempt='';sessionStorage.removeItem('vital-token');clearInterval(reminderTimer);$('#app-shell').hidden=true;$('#login-screen').hidden=false;closeModal();$('#login-form').reset(); }
async function start() {
  $('#login-screen').hidden=true;$('#app-shell').hidden=false;$('#main').innerHTML='<div class="loading">Preparando tu día…</div>';
  try {await loadState();window.scrollTo(0,0);clearInterval(reminderTimer);reminderTimer=setInterval(()=>{if(!data)return; if(data.summary.today!==dateKey()){loadState().catch(e=>toast(e.message));return;} notifyDue();},60000);if(!data.person.profile)openModal('Empecemos por conocerte',profileForm(true));}
  catch(err){toast(err.message);if(!data)logout();}
}
function notifyDue() {
  if(!data)return;
  const current=dateKey(),time=new Date().toLocaleTimeString('en-GB',{timeZone:'America/Costa_Rica',hour:'2-digit',minute:'2-digit',hour12:false});
  for(const r of data.reminders){
    r.due=r.fecha<current||(r.fecha===current&&r.hora<=time);
    if(r.due&&!r.read&&'Notification'in window&&Notification.permission==='granted'){
      const key=`vital-notified:${data.user.usuario}:${r.id}`;
      if(!localStorage.getItem(key))try{
        new Notification('Vital · '+r.titulo,{body:r.detalle+' · '+r.hora,tag:r.id,silent:muted});
        localStorage.setItem(key,'1');
      }catch{/* Algunos navegadores móviles no admiten el constructor. La bandeja sigue disponible. */}
    }
  }
  VitalFeedback.announce(data.reminders,{user:data.user.usuario,storage:localStorage,muted,play:sound,toast});
  $('#notification-dot').hidden=!data.reminders.some(r=>r.due&&!r.read);
}
function taskForm(task) {
  const t=task||{titulo:'',prioridad:'media',categoria:'General',fechaLimite:'',hora:'',etiquetas:[],descripcion:''};
  openModal(task?'Editar tarea':'Un nuevo pequeño paso',`<form id="task-form" data-id="${task?.id||''}" class="form-grid"><label class="wide">Título<input name="titulo" minlength="3" maxlength="100" value="${esc(t.titulo)}" placeholder="¿Qué quieres hacer?" required></label><label>Categoría<input name="categoria" maxlength="40" value="${esc(t.categoria||'General')}" list="categories" required><datalist id="categories"><option>Estudio</option><option>Trabajo</option><option>Personal</option><option>Bienestar</option></datalist></label><label>Prioridad<select name="prioridad">${['baja','media','alta'].map(p=>`<option ${t.prioridad===p?'selected':''}>${p}</option>`).join('')}</select></label><label>Fecha límite<input type="date" name="fechaLimite" value="${esc(t.fechaLimite)}"></label><label>Hora<input type="time" name="hora" value="${esc(t.hora)}"></label><label class="wide">Etiquetas <span class="muted">Separadas por comas · máximo 10</span><input name="etiquetas" value="${esc((t.etiquetas||[]).join(', '))}" placeholder="universidad, proyecto…"></label><label class="wide">Descripción<textarea name="descripcion" maxlength="1500" placeholder="Un poco de contexto…">${esc(t.descripcion)}</textarea></label>${formFooter(task?'Guardar cambios':'Crear tarea')}</form>`);
}
function viewTask(id) {
  const t=data.tasks.find(t=>t.id===Number(id));if(!t)return;
  openModal(t.titulo,`<span class="badge ${esc(t.prioridad)}">Prioridad ${esc(t.prioridad)}</span><dl class="detail-data"><div><dt>Categoría</dt><dd>${esc(t.categoria||'General')}</dd></div><div><dt>Fecha límite</dt><dd>${prettyDate(t.fechaLimite)} ${esc(t.hora)}</dd></div><div><dt>Estado</dt><dd>${t.completada?'Completada':'Pendiente'}</dd></div><div><dt>Creada por</dt><dd>${esc(t.creadaPor)}</dd></div></dl><p class="detail-description">${esc(t.descripcion||'Sin descripción adicional.')}</p><div class="task-meta">${(t.etiquetas||[]).map(tag=>`<span class="badge">#${esc(tag)}</span>`).join('')}</div><div class="form-actions"><button class="btn" data-action="edit-task" data-id="${t.id}">Editar</button><button class="btn primary" data-action="complete" data-id="${t.id}">${t.completada?'Reabrir':'Completar tarea'}</button></div>`);
}
function healthForm(type) {
  if(!data.person.profile){openModal('Configura tus metas',profileForm(true));return;}
  const fields=type==='exercise'?'<label class="wide">Tipo de actividad<input name="tipo" maxlength="60" placeholder="Caminata, yoga, bicicleta…" required></label><label>Duración (minutos)<input name="duracion" type="number" min="1" max="600" required></label><label>Calorías (opcional)<input name="calorias" type="number" min="0" max="10000"></label>':'<label class="wide">Peso (kg)<input name="peso" type="number" min="20" max="400" step="0.1" required></label>';
  openModal(type==='exercise'?'Cada movimiento cuenta':'Un registro para ti',`<form id="health-form" data-type="${type}" class="form-grid">${fields}<label class="wide">Fecha<input type="date" name="fecha" max="${data.summary.today}" value="${data.summary.today}" required></label>${formFooter('Guardar registro')}</form>`);
}
function eventForm(id) {
  const e=data.person.events.find(e=>e.id===id)||{titulo:'',fecha:calendarDate,hora:'09:00',tipo:'Ejercicio',duracion:30};
  openModal(id?'Editar evento':'Un espacio en tu agenda',`<form id="event-form" data-id="${id||''}" class="form-grid"><label class="wide">Título<input name="titulo" maxlength="100" minlength="3" value="${esc(e.titulo)}" required></label><label>Fecha<input type="date" name="fecha" value="${esc(e.fecha)}" required></label><label>Hora<input type="time" name="hora" value="${esc(e.hora)}" required></label><label>Tipo<select name="tipo">${['Ejercicio','Personal','Estudio','Trabajo','Bienestar'].map(t=>`<option ${t===e.tipo?'selected':''}>${t}</option>`).join('')}</select></label><label>Duración (min)<input name="duracion" type="number" min="1" max="600" value="${e.duracion}" required></label><p class="notice wide">Generaremos recordatorios 3 días antes, 1 día antes y el mismo día.</p>${formFooter()}</form>`);
}
function recurringForm() {
  openModal('Un hábito que quieres recordar',`<form id="recurring-form" class="form-grid"><label class="wide">Título<input name="titulo" maxlength="100" placeholder="Es hora de beber agua" required></label><label>Hábito<select name="tipo"><option value="agua">Agua</option><option value="ejercicio">Ejercicio</option><option value="peso">Pesarse</option></select></label><label>Hora<input name="hora" type="time" value="10:00" required></label><div class="wide"><p class="section-description" style="margin-bottom:10px">Repetir estos días</p><div class="recurring-days">${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d,i)=>`<label><input type="checkbox" name="dias" value="${i}" checked>${d}</label>`).join('')}</div></div>${formFooter('Crear recordatorio')}</form>`);
}
async function generateAdvice(manual=true) {
  if(busy||!data?.geminiConfigured||!data.person.profile?.consentimientoIA)return;
  const requestingUser=data.user.usuario;
  busy=true;const button=$('[data-action="recommend"]');if(button){button.disabled=true;button.textContent='✧ Preparando tu recomendación…';}
  try {const next=await api('/recommendations','POST',{});delete recommendationErrors[requestingUser];if(data?.user.usuario!==requestingUser)return;acceptState(next,false);if(manual)toast('Tu guía está lista.');}
  catch(err){recommendationErrors[requestingUser]=err.message;if(data?.user.usuario===requestingUser){if(view==='coach')render();toast(err.message);}}
  finally{busy=false;if(data&&data.user.usuario!==requestingUser){adviceAttempt='';render();}}
}
async function action(name, element) {
  const id=element?.dataset.id;
  switch(name){
    case 'new-task':taskForm();break;
    case 'edit-task':closeModal();taskForm(data.tasks.find(t=>t.id===Number(id)));break;
    case 'view-task':viewTask(id);break;
    case 'complete':{const t=data.tasks.find(t=>t.id===Number(id));await mutation('/tasks/'+id,'PATCH',{completada:!t.completada});closeModal();break;}
    case 'delete-task':openModal('¿Eliminar esta tarea?',`<p class="section-description">Se eliminará «${esc(data.tasks.find(t=>t.id===Number(id)).titulo)}». Esta acción está reservada a administradores.</p><div class="form-actions"><button class="btn" data-action="close">Cancelar</button><button class="btn danger" data-action="confirm-delete" data-id="${id}">Eliminar tarea</button></div>`);break;
    case 'confirm-delete':await api('/tasks/'+id,'DELETE');closeModal();await loadState();toast('Tarea eliminada.');break;
    case 'water':if(!data.person.profile){openModal('Configura tus metas',profileForm(true));break;}await mutation('/health/water','POST',{ml:250});break;
    case 'exercise':healthForm('exercise');break;
    case 'weight':healthForm('weights');break;
    case 'profile':openModal('Tu perfil, tus metas',profileForm(true));break;
    case 'close':closeModal();break;
    case 'theme':theme=theme==='dark'?'light':'dark';localStorage.setItem('vital-theme',theme);document.body.classList.toggle('dark',theme==='dark');render();break;
    case 'mute':muted=!muted;localStorage.setItem('vital-muted',String(muted));render();toast(muted?'Sonidos silenciados':'Sonidos activados');break;
    case 'motion':motion=!motion;localStorage.setItem('vital-motion',motion?'on':'off');document.body.classList.toggle('motion-off',!motion);render();toast(motion?'Movimiento activado':'Movimiento pausado');break;
    case 'test-sound':if(muted){toast('Activa los sonidos para escuchar la prueba.');break;}await VitalFeedback.unlock();if(sound('notification'))toast('Así suenan tus recordatorios.');else toast('Este navegador no permitió reproducir audio.');break;
    case 'logout':logout();break;
    case 'notifications':location.hash='notifications';break;
    case 'read-notifications':await mutation('/notifications/read','POST',{});break;
    case 'enable-notifications':if(!('Notification'in window)){toast('Este navegador no admite notificaciones. Puedes verlas dentro de Vital.');break;}if(await Notification.requestPermission()==='granted'){toast('Avisos activados mientras Vital esté abierto.');notifyDue();}else toast('Puedes consultar todos los avisos dentro de Vital.');break;
    case 'new-event':eventForm();break;
    case 'edit-event':eventForm(id);break;
    case 'view-exercise':{const e=data.person.exercise.find(e=>e.id===id);openModal(e.tipo,`<p class="section-description">${e.duracion} minutos · ${prettyDate(e.fecha)}${e.calorias!==undefined?' · '+e.calorias+' kcal':''}</p>`);break;}
    case 'recurring':recurringForm();break;
    case 'delete-recurring':await mutation('/recurring/'+encodeURIComponent(id),'DELETE');break;
    case 'calendar-prev':case 'calendar-next':{const direction=name==='calendar-prev'?-1:1;if(calendarMode==='week')calendarDate=addDays(calendarDate,direction*7);else{const d=new Date(calendarDate.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+direction);calendarDate=d.toISOString().slice(0,10);}render();break;}
    case 'calendar-today':calendarDate=data.summary.today;render();break;
    case 'calendar-mode':calendarMode=element.dataset.value;render();break;
    case 'reward':await mutation('/rewards/'+id,'POST',{});confetti();toast('Recompensa reclamada. ¡Disfrútala!');break;
    case 'recommend':await generateAdvice();break;
    case 'dashboard-tab':dashboardTab=element.dataset.value;render();break;
    case 'clear-filters':filters={search:'',status:'all',priority:'',category:'',tag:'',date:''};render();break;
  }
}
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(el){event.preventDefault();action(el.dataset.action,el).catch(err=>toast(err.message));}});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!['login-form','task-form','profile-form','health-form','event-form','recurring-form'].includes(form.id))return;
  event.preventDefault();const button=$('button[type="submit"]',form),values=Object.fromEntries(new FormData(form));button.disabled=true;
  try{
    if(form.id==='login-form') {$('#login-error').textContent='';const result=await api('/login','POST',values);token=result.token;sessionStorage.setItem('vital-token',token);await start();}
    else if(form.id==='task-form') {values.etiquetas=values.etiquetas.split(',').map(t=>t.trim()).filter(Boolean);if(form.dataset.id){await mutation('/tasks/'+form.dataset.id,'PATCH',values);}else {await api('/tasks','POST',values);await loadState();toast('Tu nuevo paso está listo.');}closeModal();}
    else if(form.id==='profile-form') {for(const key of ['peso','metaPeso','metaAgua','metaEjercicio','metaPesajes'])values[key]=Number(values[key]);values.consentimientoIA=form.elements.consentimientoIA.checked;await mutation('/profile','PUT',values);closeModal();toast('Tu perfil se guardó.');}
    else if(form.id==='health-form') {for(const key of ['peso','duracion','calorias'])if(values[key]!==undefined){if(values[key]==='')delete values[key];else values[key]=Number(values[key]);}await mutation('/health/'+form.dataset.type,'POST',values);closeModal();}
    else if(form.id==='event-form') {values.duracion=Number(values.duracion);await mutation('/events'+(form.dataset.id?'/'+encodeURIComponent(form.dataset.id):''),form.dataset.id?'PATCH':'POST',values);closeModal();toast('Evento guardado con sus recordatorios.');}
    else if(form.id==='recurring-form') {values.dias=new FormData(form).getAll('dias').map(Number);await mutation('/recurring','POST',values);closeModal();toast('Recordatorio creado.');}
  }catch(err){if(form.id==='login-form')$('#login-error').textContent=err.message;else formError(form,err);}
  finally{button.disabled=false;}
});
document.addEventListener('input',event=>{if(event.target.id==='task-search'){filters.search=event.target.value;$('#filtered-count').textContent=filterTasks().length+' tareas';$('#filtered-tasks').innerHTML=filterTasks().map(taskRow).join('')||empty('No hay tareas con estos filtros.');}});
document.addEventListener('change',event=>{if(event.target.dataset.filter){filters[event.target.dataset.filter]=event.target.value;render();}});
$('#close-modal').addEventListener('click',closeModal);
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const rect=$('#modal').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
$('#show-password').addEventListener('click',()=>{const input=$('[name="password"]');input.type=input.type==='password'?'text':'password';$('#show-password').setAttribute('aria-label',input.type==='password'?'Mostrar contraseña':'Ocultar contraseña');});
$('#theme-toggle').addEventListener('click',()=>action('theme'));
$('#mute-toggle').addEventListener('click',()=>action('mute'));
$('#notification-toggle').addEventListener('click',()=>action('notifications'));
$('#logout').addEventListener('click',logout);
window.addEventListener('hashchange',()=>{if(data){render();window.scrollTo(0,0);$('#main').focus({preventScroll:true});}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data)loadState().catch(err=>toast(err.message));});
if(token)start();
