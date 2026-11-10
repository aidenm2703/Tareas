// Datos ficticios para recorrer la interfaz. Nunca usa data/vital.json.
const path = require('node:path');
const fs = require('node:fs');
const createStore = require('../store');
const { createApp } = require('../app');
const d = require('../domain');
const file = path.join(__dirname, '..', 'data', 'demo.json');
const store = createStore(file);
if (!fs.existsSync(file)) store.transaction(state => {
  const today = d.day();
  const ana = d.person(state, 'ana');
  ana.profile = { objetivos: 'Organizar mis estudios y cuidar mi rutina', rutina: 'Clases por la mañana y proyectos por la tarde', inicio: '07:00', fin: '22:00', actividad: 'Moderado', peso: 68, metaPeso: 68, habitos: 'Caminar y tomar descansos', metaAgua: 2000, metaEjercicio: 150, metaPesajes: 2, consentimientoIA: false };
  const examples = [
    ['Preparar la práctica de middlewares', 'Estudio', 'alta', today, '10:00', false, ['universidad']],
    ['Leer 20 páginas de mi libro', 'Personal', 'baja', today, '18:00', false, ['lectura']],
    ['Organizar los pendientes de la semana', 'Trabajo', 'media', today, '15:00', false, ['planificación']],
    ['Salir a caminar al aire libre', 'Bienestar', 'media', today, '17:30', false, ['movimiento']],
    ['Repasar el ciclo de una petición HTTP', 'Estudio', 'alta', today, '08:00', true, ['express']],
    ['Entregar el proyecto de backend', 'Estudio', 'alta', d.plusDays(today, 3), '11:00', false, ['proyecto']]
  ];
  state.tasks = examples.map(([titulo,categoria,prioridad,fechaLimite,hora,completada,etiquetas])=>({id:state.nextId++,titulo,categoria,prioridad,fechaLimite,hora,completada,etiquetas,descripcion:'Dato ficticio para explorar Vital.',creada:new Date().toISOString(),creadaPor:'ana',...(completada?{completadaEn:new Date().toISOString(),recompensada:'ana'}:{})}));
  for(let i=0;i<5;i++)ana.water.push({id:d.randomUUID(),fecha:today,ml:250});
  ana.exercise.push({id:d.randomUUID(),fecha:today,tipo:'Caminata',duracion:30,calorias:100});
  ana.exercise.push({id:d.randomUUID(),fecha:d.plusDays(today,-1),tipo:'Yoga',duracion:20});
  for(let i=6;i>=0;i--)ana.weights.push({id:d.randomUUID(),fecha:d.plusDays(today,-i),peso:68+Math.sin(i)*.3});
  ana.xp=175;ana.activeDays=[d.plusDays(today,-2),d.plusDays(today,-1),today];ana.badges=['first','exercise','streak'];ana.xpLedger=[{key:'task:5',xp:25,fecha:today}];
  ana.events.push({id:d.randomUUID(),titulo:'Un rato para moverme',fecha:today,hora:'17:30',tipo:'Ejercicio',duracion:30});
  ana.recurring.push({id:d.randomUUID(),titulo:'Una pausa para beber agua',tipo:'agua',hora:'16:00',dias:[0,1,2,3,4,5,6],desde:today});
});
const port = process.env.DEMO_PORT || 3030;
createApp({store,extensions:require('../extras'),rateLimiter:require('../middlewares/rateLimit')()}).listen(port,'127.0.0.1',()=>console.log(`Demo con datos ficticios: http://localhost:${port}`));
