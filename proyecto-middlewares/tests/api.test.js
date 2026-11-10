const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../app');
const createStore = require('../store');
test('Contrato de la práctica, validación y persistencia', async t => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vital-test-')), 'data.json');
  const server = createApp({ store: createStore(file) }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(route, method = 'GET', body, token) {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
  }
  assert.equal((await req('/api/tasks')).status, 200);
  assert.deepEqual(await req('/api/tasks/999'), { status: 404, body: { error: 'Tarea no encontrada', status: 404 } });
  assert.equal((await req('/api/tasks', 'POST', {})).status, 401);
  assert.equal((await req('/api/tasks', 'POST', {}, 'no')).status, 401);
  const invalid = await req('/api/tasks', 'POST', { prioridad: 'urgente' }, 'abc123');
  assert.equal(invalid.status, 400); assert.equal(invalid.body.errores.length, 2);
  for (const titulo of ['a', 'a'.repeat(101), 123, '   ']) assert.equal((await req('/api/tasks', 'POST', { titulo }, 'abc123')).status, 400);
  const created = await req('/api/tasks', 'POST', { titulo: 'Mi tarea', prioridad: 'alta' }, 'abc123');
  assert.equal(created.status, 201); assert.equal(created.body.id, 1);
  assert.equal(createStore(file).state.tasks[0].titulo, 'Mi tarea');
  assert.equal((await req('/api/tasks/1', 'DELETE', undefined, 'xyz789')).status, 403);
  assert.equal((await req('/api/tasks/1', 'DELETE', undefined, 'abc123')).status, 200);
  assert.deepEqual(await req('/api/ruta-que-no-existe'), { status: 404, body: { error: 'Ruta no encontrada', status: 404 } });
  const malformed = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
});
