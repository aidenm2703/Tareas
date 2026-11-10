// Ejecuta curl real contra una instancia aislada; no modifica los datos de la app.
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const folder = path.join(__dirname, '..', 'docs');
mkdirSync(folder, { recursive: true });
const temp = mkdtempSync(path.join(tmpdir(), 'vital-evidence-'));
const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); const { createApp } = require(workerData.app); const store = require(workerData.store)(workerData.file); const server = createApp({store}).listen(0, '127.0.0.1', () => parentPort.postMessage(server.address().port));`, { eval: true, workerData: { app: path.join(__dirname, '..', 'app.js'), store: path.join(__dirname, '..', 'store.js'), file: path.join(temp, 'test.json') } });
worker.once('message', async port => {
  const cases = [
    ['GET', '/api/tasks', '', null, 200],
    ['GET', '/api/tasks/999', '', null, 404],
    ['POST', '/api/tasks', '', { titulo: 'Prueba sin token' }, 401],
    ['POST', '/api/tasks', 'abc123', { prioridad: 'urgente' }, 400],
    ['POST', '/api/tasks', 'abc123', { titulo: 'Preparar la práctica', prioridad: 'alta' }, 201],
    ['DELETE', '/api/tasks/1', 'xyz789', null, 403],
    ['DELETE', '/api/tasks/1', 'abc123', null, 200],
    ['GET', '/api/ruta-que-no-existe', '', null, 404]
  ];
  const results = cases.map(([method, route, token, body, expected], i) => {
    const args = ['-sS', '-i', '-X', method, `http://127.0.0.1:${port}${route}`];
    if (token) args.push('-H', `Authorization: Bearer ${token}`);
    if (body) { const bodyFile = path.join(temp, `${i}.json`); writeFileSync(bodyFile, JSON.stringify(body)); args.push('-H', 'Content-Type: application/json', '--data-binary', `@${bodyFile}`); }
    const result = spawnSync('curl.exe', args, { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw result.error || Error(result.stderr);
    const actual = Number(/^HTTP\/1\.1 (\d+)/.exec(result.stdout)?.[1]);
    if (actual !== expected) throw Error(`Caso ${i + 1}: ${actual}, esperado ${expected}`);
    return { caso: i + 1, method, route, token, body, expected, actual, output: result.stdout, command: `curl -i -X ${method} http://localhost:3000${route}${token ? ` -H "Authorization: Bearer ${token}"` : ''}${body ? ` -H "Content-Type: application/json" --data '${JSON.stringify(body)}'` : ''}` };
  });
  writeFileSync(path.join(folder, 'resultados.json'), JSON.stringify({ fecha: new Date().toISOString(), herramienta: 'curl.exe', results }, null, 2));
  const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  writeFileSync(path.join(folder, 'pruebas.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><title>Evidencias · 8 pruebas curl</title><style>body{font:16px system-ui;background:#eef2f6;color:#17252d;margin:40px}article{background:white;border:1px solid #ccd7df;border-radius:16px;padding:28px;margin:24px auto;max-width:1000px;page-break-after:always}pre{background:#13262e;color:#d7f8ef;padding:20px;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:10px;font:14px Consolas,monospace}img{max-width:100%}h2{color:#107663}@media print{body{margin:0;background:white}article{border:0}}</style><h1>Práctica: evidencias de ocho pruebas</h1><p>Salida real de curl contra una instancia aislada. Ejecutado ${new Date().toISOString()}. Las capturas se agregan al verificar visualmente.</p>${results.map(r => `<article id="caso-${r.caso}"><h2>Caso ${r.caso} · ${r.method} ${r.route}</h2><p>Esperado: ${r.expected} · Obtenido: ${r.actual} · CORRECTO</p><pre>${esc(r.command)}</pre><pre>${esc(r.output)}</pre></article>`).join('')}</html>`);
  console.log('8/8 casos correctos. Evidencia en docs/pruebas.html y docs/resultados.json');
  await worker.terminate();
});
