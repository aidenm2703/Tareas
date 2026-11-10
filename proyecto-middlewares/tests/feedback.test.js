const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require('node:path').join(__dirname, '../public/feedback.js'), 'utf8');
function setup() {
  const nodes = [], contexts = [];
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; contexts.push(this); }
    async resume() { this.state = 'running'; }
    createOscillator() { const node = {frequency:{value:0},connect(){},start(){node.started=true;},stop(){node.stopped=true;}}; nodes.push(node); return node; }
    createGain() { return {connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}}; }
  }
  const context = vm.createContext({AudioContext});vm.runInContext(code,context);
  return { feedback:context.VitalFeedback,nodes,contexts };
}
test('Audio de recordatorio: requiere interacción, reutiliza contexto y respeta silenciador',async()=>{
  const {feedback,nodes,contexts}=setup();
  assert.equal(feedback.play('notification'),false);assert.equal(nodes.length,0);
  assert.equal(await feedback.unlock(),true);await feedback.unlock();assert.equal(contexts.length,1);
  assert.equal(feedback.play('notification',true),false);assert.equal(nodes.length,0);
  assert.equal(feedback.play('notification'),true);assert.equal(nodes.length,3);
  assert.ok(nodes.every(n=>n.started&&n.stopped));
});
test('Avisos: agrupa, deduplica entre recargas, separa cuentas y descarta leídos/futuros',()=>{
  const {feedback}=setup();const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  let sounds=0,toasts=0;
  const options={user:'ana',storage,muted:false,play:()=>{sounds++;return true;},toast:()=>toasts++};
  const reminders=[{id:'1',titulo:'Agua',due:true,read:false},{id:'2',titulo:'Caminar',due:true,read:false},{id:'3',due:false},{id:'4',due:true,read:true}];
  assert.equal(feedback.announce(reminders,options),2);assert.equal(sounds,1);assert.equal(toasts,1);
  assert.equal(feedback.announce(reminders,options),0);assert.equal(sounds,1);
  assert.equal(feedback.announce(reminders,{...options,user:'luis'}),2);assert.equal(sounds,2);
  assert.equal(feedback.announce([{id:'5',due:true}],{...options,muted:true}),1);assert.equal(sounds,2);assert.equal(toasts,2);
});
test('Un navegador que bloquea audio no consume el aviso hasta poder reproducirlo',()=>{
  const {feedback}=setup();const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  const options={user:'ana',storage,muted:false,play:()=>false,toast(){}};
  assert.equal(feedback.announce([{id:'1',due:true}],options),0);assert.equal(map.size,0);
});
