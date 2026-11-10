// Diagnóstico con datos ficticios; nunca lee el archivo de datos del usuario.
const { recommend } = require('../gemini');
const { person } = require('../domain');
async function main() {
  const state = { tasks: [], people: {} };
  const p = person(state, 'prueba');
  p.profile = { objetivos: 'Organizar estudios y cuidar hábitos', rutina: 'Clases por la mañana', inicio: '07:00', fin: '21:00', actividad: 'Principiante', peso: 70, metaPeso: 70, habitos: 'Caminar', metaAgua: 2000, metaEjercicio: 150, metaPesajes: 1, consentimientoIA: true };
  const start = Date.now();
  const result = await recommend(state, p, async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      const body = await response.clone().json();
      console.log(JSON.stringify({ http: response.status, status: body.error?.status, mensaje: String(body.error?.message || '').replaceAll(process.env.GEMINI_API_KEY || 'SIN_CLAVE', '[OCULTA]') }));
    }
    return response;
  });
  console.log(JSON.stringify({ ok: true, model: result.model, caracteres: result.texto.length, duracionMs: Date.now() - start }));
}
main().catch(error => { console.log(JSON.stringify({ ok: false, mensaje: error.message, status: error.status })); process.exitCode = 1; });
