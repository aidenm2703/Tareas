const fs = require('node:fs');
const path = require('node:path');
function createStore(file = process.env.DATA_FILE || path.join(__dirname, 'data', 'vital.json')) {
  let state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { tasks: [], nextId: 1, people: {} };
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
  }
  // Arreglo en memoria, respaldado en disco por autorización del profesor.
  return { get state() { return state; }, save, transaction(change) {
    const previous = structuredClone(state);
    try { const result = change(state); save(); return result; }
    catch (error) { state = previous; throw error; }
  } };
}
module.exports = createStore;
