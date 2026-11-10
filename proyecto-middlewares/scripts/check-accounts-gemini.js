// Prueba real de ambos roles con perfiles ficticios y almacenamiento temporal.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../app');
const createStore = require('../store');
const { person } = require('../domain');
async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'vital-gemini-roles-'));
  const dataFile = path.join(folder, 'test.json');
  const store = createStore(dataFile);
  store.transaction(s => {
    for (const user of ['ana', 'luis']) person(s, user).profile = { objetivos: 'Organizar estudios y hábitos', rutina: 'Estudiar por la mañana', inicio: '07:00', fin: '21:00', actividad: 'Principiante', peso: 70, metaPeso: 70, habitos: 'Caminar', metaAgua: 2000, metaEjercicio: 150, metaPesajes: 1, consentimientoIA: true };
  });
  const server = createApp({store,extensions:require('../extras')}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try {
    for (const [user, token, role] of [['ana','abc123','admin'],['luis','xyz789','user']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/recommendations`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}',signal:AbortSignal.timeout(60000) });
      const result=await response.json();
      assert.equal(response.status,200,result.error);assert.equal(result.user.usuario,user);assert.equal(result.user.rol,role);assert.ok(result.person.advice.texto.length>50);
      assert.ok(!JSON.stringify(result).includes(process.env.GEMINI_API_KEY));
      console.log(JSON.stringify({cuenta:user,rol:role,http:response.status,modelo:result.person.advice.model,caracteres:result.person.advice.texto.length,persistida:Boolean(createStore(dataFile).state.people[user].advice)}));
    }
  } finally { server.close(); }
}
main().catch(error=>{console.error(JSON.stringify({ok:false,mensaje:error.message}));process.exitCode=1;});
