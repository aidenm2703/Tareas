// Prueba de conexión sin perfil, tareas ni registros de salud.
async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY en el servidor');
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Responde solamente: Conexion correcta.' }] }], generationConfig: { maxOutputTokens: 100 } })
  });
  const result = await response.json();
  if (!response.ok) {
    console.log(JSON.stringify({ ok: false, http: response.status, status: result.error?.status, mensaje: String(result.error?.message || 'Solicitud rechazada').replaceAll(key, '[CLAVE OCULTA]') }));
    process.exitCode = 1; return;
  }
  const texto = result.candidates?.[0]?.content?.parts?.filter(p => p.text && !p.thought).map(p => p.text).join('\n');
  console.log(JSON.stringify({ ok: Boolean(texto), http: response.status, model, respuesta: texto || null }));
  if (!texto) process.exitCode = 1;
}
main().catch(error => { console.log(JSON.stringify({ ok: false, mensaje: error.name === 'TimeoutError' ? 'Tiempo de espera agotado' : 'No se pudo conectar con Google', causa: error.cause?.code || error.code || error.name })); process.exitCode = 1; });
