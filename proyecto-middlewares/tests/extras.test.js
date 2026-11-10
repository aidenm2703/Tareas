const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../app');
const createStore = require('../store');
const extensions = require('../extras');
const rateLimit = require('../middlewares/rateLimit');
const d = require('../domain');
async function setup(t, limiter) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vital-extras-')), 'vital.json');
  const store = createStore(file);
  const server = createApp({store, extensions, rateLimiter:limiter}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve)); t.after(()=>server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, method='GET', body, token='abc123') {
    const response = await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  return {request,store,file};
}
const profile={objetivos:'Organizar estudios',rutina:'Clases por la mañana',inicio:'07:00',fin:'21:00',actividad:'Principiante',peso:70,metaPeso:70,habitos:'Caminar',metaAgua:500,metaEjercicio:100,metaPesajes:2,consentimientoIA:false};
test('Cuentas, CRUD, XP sin duplicados, salud aislada, eventos y persistencia',async t=>{
  const {request:r,store,file}=await setup(t);
  assert.equal((await r('/login','POST',{usuario:'ana',password:'mal'},null)).status,401);
  for(const [usuario,password,role] of [['ana','Ana123!','admin'],['luis','Luis123!','user']]){const result=await r('/login','POST',{usuario,password},null);assert.equal(result.status,200);assert.equal(result.body.user.rol,role);assert.equal(result.body.user.password,undefined);}
  assert.equal((await r('/state','GET',undefined,null)).status,401);
  assert.equal((await r('/profile','PUT',profile)).status,200);
  assert.equal((await r('/profile','PUT',{...profile,metaAgua:-10})).status,400);
  assert.equal((await r('/profile','PUT',{...profile,fin:'06:00'})).status,400);
  const created=await r('/tasks','POST',{titulo:'Estudiar Express',prioridad:'alta',categoria:'Estudio',fechaLimite:d.plusDays(d.day(),3),etiquetas:['api']},'xyz789');
  assert.equal(created.status,201);assert.equal(created.body.categoria,'Estudio');
  const id=created.body.id;
  assert.equal((await r('/tasks/'+id,'PATCH',{titulo:'Repasar Express',completada:true},'xyz789')).status,200);
  const firstXp=store.state.people.luis.xp;assert.equal(firstXp,25);
  await r('/tasks/'+id,'PATCH',{completada:false},'xyz789');await r('/tasks/'+id,'PATCH',{completada:true},'xyz789');
  assert.equal(store.state.people.luis.xp,firstXp);
  await r('/tasks/'+id,'PATCH',{completada:false});await r('/tasks/'+id,'PATCH',{completada:true});assert.equal(store.state.people.ana.xp,0);
  assert.equal((await r('/tasks/'+id,'DELETE',undefined,'xyz789')).status,403);
  assert.equal((await r('/health/water','POST',{ml:-250})).status,400);
  await r('/health/water','POST',{ml:250});await r('/health/water','POST',{ml:250});await r('/health/water','POST',{ml:250});
  assert.equal(store.state.people.ana.xp,15);
  assert.equal((await r('/health/exercise','POST',{tipo:'Caminata',duracion:30,calorias:100})).status,201);
  assert.equal((await r('/health/weights','POST',{peso:69.5})).status,201);
  assert.equal((await r('/health/weights','POST',{peso:69.7})).status,201);
  assert.equal(store.state.people.ana.weights.length,1);assert.equal(store.state.people.ana.xp,35);
  const event=await r('/events','POST',{titulo:'Yoga suave',fecha:d.plusDays(d.day(),3),hora:'17:00',tipo:'Ejercicio',duracion:30});
  assert.equal(event.status,201);assert.equal(event.body.reminders.filter(x=>x.tipo==='event').length,3);
  assert.equal((await r('/events','POST',{titulo:'Fecha inválida',fecha:'2026-02-30',hora:'99:00',tipo:'Ejercicio'})).status,400);
  assert.equal((await r('/recurring','POST',{titulo:'Beber agua',tipo:'agua',hora:'10:00',dias:[0,1,2,3,4,5,6]})).status,201);
  assert.equal((await r('/notifications/read','POST',{})).status,200);
  const luis=await r('/state','GET',undefined,'xyz789');assert.equal(luis.body.person.water.length,0);assert.equal(luis.body.person.profile,null);
  const reloaded=createStore(file);assert.equal(reloaded.state.tasks[0].titulo,'Repasar Express');assert.equal(reloaded.state.people.ana.exercise.length,1);
  assert.equal((await r('/recommendations','POST',{})).status,400);
  await r('/profile','PUT',{...profile,consentimientoIA:true});
  const oldKey=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;
  assert.equal((await r('/recommendations','POST',{})).status,503);
  if(oldKey)process.env.GEMINI_API_KEY=oldKey;
  assert.equal((await r('/rewards/focus','POST',{})).status,400);
  store.transaction(s=>{s.people.ana.xp=100;});
  assert.equal((await r('/rewards/focus','POST',{})).status,200);await r('/rewards/focus','POST',{});assert.deepEqual(store.state.people.ana.rewards,['focus']);
  assert.equal((await r('/tasks/'+id,'DELETE')).status,200);
});
test('Límite real: diez peticiones, onceava 429, reinicio al minuto',async t=>{
  let now=1000;const {request:r}=await setup(t,rateLimit({now:()=>now}));
  for(let i=0;i<10;i++)assert.equal((await r('/tasks')).status,200);
  const exceeded=await r('/tasks');assert.equal(exceeded.status,429);assert.equal(exceeded.headers.get('Retry-After'),'60');
  now+=60000;assert.equal((await r('/tasks')).status,200);
});
test('Rachas y recordatorios con cambio de mes/año',()=>{
  const p={activeDays:['2026-12-30','2026-12-31','2027-01-01'],events:[{id:'1',titulo:'Evento',fecha:'2027-01-03',hora:'10:00'}],recurring:[],read:[]};
  assert.equal(d.streak(p,'2027-01-01'),3);assert.equal(d.streak(p,'2027-01-02'),3);assert.equal(d.streak(p,'2027-01-03'),0);
  const items=d.reminders({tasks:[]},p,new Date('2026-12-31T16:00:00Z'));
  assert.equal(items.find(r=>r.detalle==='Faltan 3 días').fecha,'2026-12-31');
  assert.equal(items.find(r=>r.detalle==='Falta 1 día').fecha,'2027-01-02');
});
test('Gemini: contrato HTTP, errores, caché y secreto fuera de respuesta',async()=>{
  const {recommend}=require('../gemini');const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-not-a-real-key';
  try {
    const p={profile,water:[],exercise:[],weights:[],events:[],recurring:[],activeDays:[],xp:0,badges:[],advice:null};
    const state={tasks:[]};let calls=0;
    const fetcher=async(url,options)=>{calls++;assert.match(url,/:generateContent$/);assert.equal(options.headers['x-goog-api-key'],'test-not-a-real-key');return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Organiza una tarea a las 9:00.'}]}}]})};};
    const advice=await recommend(state,p,fetcher);assert.equal(advice.texto,'Organiza una tarea a las 9:00.');assert.ok(!JSON.stringify(advice).includes('test-not-a-real-key'));
    p.advice=advice;await recommend(state,p,fetcher);assert.equal(calls,1);
    p.advice=null;await assert.rejects(()=>recommend(state,p,async()=>({ok:false,status:429})),e=>e.status===429);
    await assert.rejects(()=>recommend(state,p,async()=>({ok:true,json:async()=>({})})),e=>e.status===502);
    let retries=0;
    const recovered=await recommend(state,p,async()=>++retries===1?{ok:false,status:503}:{ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Servicio recuperado'}]}}]})});
    assert.equal(retries,2);assert.equal(recovered.texto,'Servicio recuperado');
    await assert.rejects(()=>recommend(state,p,async()=>{throw Object.assign(new Error('fetch failed'),{cause:{code:'EACCES'}});}),e=>e.status===502&&e.message.includes('bloqueada'));
    await assert.rejects(()=>recommend(state,p,async()=>({ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND'}})})),e=>e.status===503&&e.message.includes('ya no está disponible'));
  }finally{if(old)process.env.GEMINI_API_KEY=old;else delete process.env.GEMINI_API_KEY;}
});
