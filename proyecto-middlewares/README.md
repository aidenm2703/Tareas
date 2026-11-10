# Vital · Práctica de middlewares

Node.js 22.9 o superior y Express. Ejecutar dentro de esta carpeta:

```sh
npm install
npm start
```

En PowerShell con scripts deshabilitados usar `npm.cmd install` y `npm.cmd start`.
Abrir http://localhost:3000. Los datos se conservan en `data/vital.json`.

No hace falta MySQL, Sequelize, compilar assets ni instalar un frontend. Ejecutar desde `proyecto-middlewares/`, no desde la carpeta padre que contiene otro proyecto.

Para recorrer una versión con datos ficticios: `npm run demo` y abrir http://localhost:3030. La demo usa `data/demo.json`; no modifica los datos normales. Para desarrollar: `npm run dev`. Detener el servidor con Ctrl+C.

## Credenciales de demostración

| Cuenta | Contraseña | Rol | Token API |
|---|---|---|---|
| ana | Ana123! | admin | abc123 |
| luis | Luis123! | user | xyz789 |

Las rutas GET de tareas son públicas. Ambos roles pueden crear; solamente admin elimina.
Son cuentas estáticas educativas, no un sistema de autenticación de producción.

Las tareas son compartidas, como en la consigna; salud, perfil, XP, logros, eventos y recordatorios recurrentes son personales por cuenta. Ambos roles pueden editar y completar las tareas. El servidor impide borrar con el token de Luis aunque se intente directamente desde la API. La sesión se conserva al recargar en la misma pestaña; cerrar sesión elimina el token de esa sesión.

## Cumple el md

- Cuatro middlewares propios, en archivos separados y en el orden exigido.
- Rutas GET públicas; POST con autenticación y validación; DELETE con autenticación y rol admin.
- Errores centralizados, 404, 401, 403, validación de todos los errores y JSON malformado.
- Código sin librerías de validación, autenticación, logging ni rate limiting.
- [Tabla detallada de cumplimiento](docs/cumplimiento.md).
- [Documento de las ocho pruebas con capturas](docs/pruebas-con-capturas.html). Abrirlo en el navegador junto con su carpeta `capturas/`; es imprimible.
- [Resultados reales de curl](docs/resultados.json). Se generaron contra la API base antes de los extras.

## Extras añadidos

- CRUD con detalle, edición, eliminación admin, completar/reabrir, categoría, prioridad, fecha, hora, etiquetas, descripción, búsqueda y filtros combinables.
- XP, niveles, barra de avance, racha diaria, seis insignias y tres recompensas reclamables. Cada tarea otorga XP una sola vez, incluso cambiando de cuenta; las metas de salud puntúan una vez por día. Racha: días consecutivos con una acción que otorgue XP, incluyendo registro de peso.
- Sonidos distintos con Web Audio y silenciador persistente, animaciones y confeti. Se respeta la preferencia de reducir movimiento.
- Agua por vasos de 250 ml, meta diaria y semanal; ejercicio con duración y calorías opcionales; peso con gráfico y registros diarios; metas editables y resúmenes semanales.
- Calendario mensual/semanal de tareas, eventos editables y ejercicio registrado. Crear un evento es planificar; registrar ejercicio es confirmar actividad realizada.
- Avisos automáticos 3 días y 1 día antes, y el mismo día; recurrentes por días de semana y hora; bandeja con estados leído/programado; notificaciones del navegador si se concede permiso.
- Cuestionario inicial y perfil editable; integración real REST con Google Gemini para recomendaciones a partir de objetivos, rutina, horarios, actividad, peso/meta, hábitos e historial. No se simula IA cuando falta clave.
- Dashboard, interfaz responsive, navegación móvil, tema oscuro y preferencias locales.
- Identidad visual en lila, violeta profundo, blanco y menta; iconos SVG propios, estados interactivos y tema oscuro equivalente. `public/identity.css` contiene la personalización visual.
- Avisos con melodía propia, agrupados y sin repetir al recargar. No requieren permiso de notificación del navegador para sonar dentro de la app. El navegador exige una primera interacción para habilitar audio. El silenciador se aplica también a estos avisos.
- Flor animada con carita en el acceso y en la franja principal del dashboard: pétalos que giran, órbita y pequeñas fichas flotantes. Movimiento suave adicional en agua, medallas y cambios de sección. En Perfil y ajustes se puede pausar el movimiento o probar el sonido de los recordatorios. Se respeta `prefers-reduced-motion`.
- Quinto middleware propio: máximo 10 peticiones de API por minuto por `req.ip`, con `429`, `Retry-After` y cabeceras de cuota.

## Configurar Gemini

1. Copiar `.env.example` como `.env` dentro de esta carpeta.
2. Poner una clave de Google AI Studio en `GEMINI_API_KEY` y ajustar `GEMINI_MODEL` si corresponde. No poner la clave en `public/` ni subir `.env` a Git.
3. Reiniciar con `npm start`.
4. Completar el cuestionario y activar el consentimiento para enviar perfil e historial a Google. Entrar en **Mi guía IA**.

```dotenv
PORT=3000
GEMINI_API_KEY=tu_clave_aqui
GEMINI_MODEL=gemini-3.5-flash-lite
```

Se usa `generateContent` con la clave en una cabecera del servidor, timeout de 25 segundos por intento, un reintento ante fallos temporales (502/503/504) y manejo explícito de errores/cuota. El modelo es configurable. La cuota gratuita depende del proyecto, región y modelo: comprobar [precios y modelos de Google](https://ai.google.dev/gemini-api/docs/pricing). Esta app no activa facturación ni cambia el plan de tu cuenta. Referencia del [endpoint REST](https://ai.google.dev/api/generate-content). Para comprobar la conexión sin enviar datos personales: `node --env-file=.env scripts/check-gemini.js`.

Al abrir Mi guía IA se comprueba si cambió el contexto; se reutiliza una respuesta idéntica hasta 6 horas y se evita generar más de una por minuto por cuenta. El botón permite volver a solicitarla bajo esas mismas reglas. Antes de configurar una clave aparece un aviso, sin presentar recomendaciones ficticias como IA. Se verificó la conexión real con `gemini-3.5-flash-lite`: HTTP 200 y respuesta al mensaje de prueba, sin enviar datos personales. El contrato de recomendaciones e historial también se verificó mediante un servicio simulado en las pruebas. La clave local queda en `.env`, excluido de Git y de los ZIP.

## Recordatorios y fechas

Se usa `America/Costa_Rica` en el servidor y en la interfaz. La semana comienza el lunes. Avisos anticipados a las 09:00 y aviso del día a la hora elegida o a las 09:00. Las tareas completadas dejan de generar avisos; cambiar fecha recalcula sus recordatorios. Los recurrentes pueden configurarse varias veces al día creando varios horarios.

El temporizador del navegador revisa los avisos cada minuto mientras la app está abierta. No hay servidor push ni notificaciones con el navegador cerrado. Al volver, se reconstruyen los pendientes de los últimos 7 días. Los avisos del navegador se deduplican por cuenta en el dispositivo. Se puede leer la bandeja sin conceder permisos.

## Pruebas y evidencias

```sh
npm test
npm run evidence
```

`npm test` usa instancias y archivos temporales separados: contrato obligatorio, validación, cuentas/roles, edición, XP sin duplicados, aislamiento personal, salud, persistencia, fechas, calendario, recompensas, cuota y contrato Gemini simulado. `npm run evidence` necesita `curl.exe` en Windows y regenera las transcripciones de los ocho casos contra una instancia aislada. Las capturas entregadas corresponden a la ejecución documentada original; al regenerar transcripciones se deben volver a tomar capturas si se necesitan nuevas evidencias.

Ver [verificación de la interfaz](docs/verificacion.md). Las capturas adicionales de la app usan datos ficticios de la demo.

Para comprobar el flujo completo con Gemini real y ambos roles sin usar datos personales: `node --env-file=.env scripts/check-accounts-gemini.js`. Requiere conexión con Google y consume dos solicitudes del proyecto. La app local debe ejecutarse en un proceso con acceso a internet; un proceso restringido puede fallar con EACCES aunque la clave sea válida. El servidor registra solo códigos de diagnóstico, sin claves ni perfiles.

## API adicional

Todas salvo login exigen Bearer. Usar `Content-Type: application/json` para cuerpos JSON.

| Ruta | Uso |
|---|---|
| `POST /api/login` | `{ "usuario": "ana", "password": "Ana123!" }` → token y rol |
| `GET /api/state` | Tareas, estado personal, resumen y recordatorios en una petición |
| `PATCH /api/tasks/:id` | Editar campos o `{ "completada": true }` |
| `PUT /api/profile` | Guardar cuestionario y metas |
| `POST /api/health/water` | `{ "ml": 250, "fecha": "AAAA-MM-DD" }` (fecha opcional) |
| `POST /api/health/exercise` | `{ "tipo": "Caminata", "duracion": 30, "calorias": 100 }` |
| `POST /api/health/weights` | `{ "peso": 70.5 }`; actualiza el registro si ya existe para ese día |
| `POST /api/events` | Crear evento con titulo, fecha, hora, tipo y duracion |
| `PATCH /api/events/:id` | Editar evento personal |
| `POST /api/recurring` | Crear recordatorio: titulo, tipo agua/ejercicio/peso, hora, dias (0 domingo a 6 sábado) |
| `DELETE /api/recurring/:id` | Quitar recordatorio personal; no elimina tareas |
| `POST /api/notifications/read` | Marcar avisos recibidos como leídos |
| `POST /api/recommendations` | Recomendación Gemini, con consentimiento y clave configurados |
| `POST /api/rewards/:id` | Reclamar focus/explorer/champion si se alcanza el XP |

El límite de 10/min es compartido por IP y por todos los endpoints `/api`, incluidos login y estado. El frontend agrupa la lectura en `/state` y evita polling de API por minuto. Si se realizan muchas acciones seguidas, esperar el tiempo indicado. La cuota se reinicia al reiniciar el proceso; las cuentas y datos sí se conservan.

## Explicación de middlewares

Express recorre la cadena en orden. Si `errorHandler` se registra antes de las rutas, no recibe los errores que estas envían posteriormente mediante `next(error)`: Express busca un manejador de errores a partir de la posición actual, sin volver atrás. Por eso debe ser el último.

Si un middleware no llama a `next()` y tampoco termina la respuesta, la petición queda pendiente hasta que se agote el tiempo de espera. Si ya envió la respuesta, no necesita continuar. `next(error)` salta al manejo de errores; `next()` continúa con el siguiente middleware normal.

## Almacenamiento autorizado

Se mantiene un arreglo de tareas en memoria y se respalda con escritura temporal y renombrado en JSON. Esta extensión a la consigna fue autorizada por el profesor según la indicación del estudiante. Se admite un solo proceso del servidor; no ejecutar varias instancias sobre el mismo archivo.

No se incluye información personal, claves, `.env`, `node_modules`, caché npm ni archivos JSON de ejecución en el ZIP. `data/vital.json` se crea al usar la app. Para respaldar datos, detener el servidor y copiar ese archivo. No borrarlo si se quiere conservar el progreso. `DATA_FILE` permite elegir otra ubicación. El servidor escucha solamente en `127.0.0.1` para esta práctica local.
