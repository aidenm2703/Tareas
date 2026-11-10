Práctica: Middlewares en Node.js

Desarrollo Backend con Express.js
Nombre del estudiante: Fecha de entrega:
Grupo / Sección: Calificación: / 100

1. Objetivo
Al finalizar esta práctica el estudiante será capaz de comprender el ciclo de vida de una petición HTTP en
Express, implementar middlewares propios (sin librerías externas que resuelvan el problema por él) y
encadenarlos correctamente usando next(), incluyendo el manejo centralizado de errores.
2. ¿Qué es un middleware?
Un middleware es una función que se ejecuta entre la llegada de la petición y el envío de la respuesta.
Recibe tres parámetros: req (la petición), res (la respuesta) y next (función que pasa el control al siguiente
middleware). Un middleware puede leer o modificar req y res, terminar la petición enviando una respuesta, o
llamar a next() para continuar. Si no hace ninguna de las dos cosas, la petición se queda colgada.
// Estructura general de un middleware
function miMiddleware(req, res, next) {
// 1. Hacer algo con req / res
// 2. Terminar la respuesta -> res.status(...).json(...)
// o continuar -> next()
// o reportar un error -> next(error)
}
// Middleware de errores: SIEMPRE lleva 4 parámetros
function manejadorErrores(err, req, res, next) { ... }
3. Escenario
Construirás una pequeña API REST de tareas (tasks) que se guardan en memoria (un arreglo). La API debe
tener las siguientes rutas:
Método Ruta Descripción Protegida
GET /api/tasks Lista todas las tareas No
GET /api/tasks/:id Obtiene una tarea por id No
POST /api/tasks Crea una tarea nueva Sí (token)
DELETE /api/tasks/:id Elimina una tarea Sí (token + rol admin)

Práctica: Middlewares en Node.js con Express Página 2
4. Middlewares obligatorios
Debes implementar los 4 middlewares siguientes. Cada uno va en su propio archivo dentro de la carpeta
middlewares/.
Middleware 1: Logger de peticiones
Archivo: middlewares/logger.js
Registra en consola cada petición que llega al servidor.
• Mostrar la fecha y hora, el método HTTP y la URL.
• Mostrar el código de estado de la respuesta y el tiempo que tardó en milisegundos (pista: usa el evento
res.on('finish', ...)).
• Debe aplicarse de forma global con app.use() y ser el primero en registrarse.
• Siempre debe llamar a next().
Resultado esperado:
[2026-10-08 10:15:32] POST /api/tasks -> 201 (4 ms)
Middleware 2: Autenticación por token
Archivo: middlewares/auth.js
Verifica que la petición incluya un token válido antes de permitir el acceso a rutas protegidas.
• Leer el encabezado Authorization con el formato Bearer <token>.
• Comparar el token contra una lista de usuarios de prueba definida en el código, por ejemplo: { token:
'abc123', nombre: 'Ana', rol: 'admin' } y { token: 'xyz789', nombre: 'Luis', rol: 'user' }.
• Si falta el encabezado o el token no existe: responder 401 con un JSON de error.
• Si es válido: guardar el usuario en req.user y llamar a next().
• Crear además una función authorize(rol) que devuelva un middleware y responda 403 si req.user.rol no
coincide.
Resultado esperado:
401 -> { "error": "Token no proporcionado" }
403 -> { "error": "No tienes permisos para esta acción" }

Práctica: Middlewares en Node.js con Express Página 3
Middleware 3: Validación de datos
Archivo: middlewares/validateTask.js
Valida el cuerpo (req.body) antes de crear una tarea.
• El campo titulo es obligatorio, debe ser texto y tener entre 3 y 100 caracteres.
• El campo prioridad es opcional, pero si viene solo puede ser 'baja', 'media' o 'alta'.
• Si hay errores responder 400 con la lista completa de errores encontrados (no solo el primero).
• Recordar registrar express.json() para que req.body exista.
• No se permite usar librerías de validación (Joi, express-validator, zod, etc.).
Resultado esperado:
400 -> { "errores": ["El titulo es obligatorio",
"La prioridad debe ser baja, media o alta"] }
Middleware 4: Manejo centralizado de errores
Archivo: middlewares/errorHandler.js
Captura todos los errores de la aplicación y responde con un formato uniforme.
• Debe tener 4 parámetros: (err, req, res, next).
• Debe registrarse al final, después de todas las rutas.
• Usar err.status si existe; de lo contrario responder 500.
• Las rutas deben enviar sus errores con next(error), por ejemplo cuando una tarea no existe (404).
• Incluir también un middleware para rutas inexistentes que responda 404 ("Ruta no encontrada").
Resultado esperado:
404 -> { "error": "Tarea no encontrada", "status": 404 }
500 -> { "error": "Error interno del servidor", "status": 500 }

5. Orden de ejecución
El orden en que se registran los middlewares importa. Tu archivo app.js debe respetar esta secuencia
(completa las partes marcadas con ...):
app.use(logger); // 1. Siempre primero
app.use(express.json()); // 2. Para leer req.body
app.get('/api/tasks', ...);
app.get('/api/tasks/:id', ...);
app.post('/api/tasks', auth, validateTask, ...);
app.delete('/api/tasks/:id', auth, authorize('admin'), ...);
app.use(notFound); // 3. Rutas inexistentes
app.use(errorHandler); // 4. Siempre al final

Práctica: Middlewares en Node.js con Express Página 4
6. Estructura del proyecto
proyecto-middlewares/
|-- app.js
|-- package.json
|-- middlewares/
| |-- logger.js
| |-- auth.js
| |-- validateTask.js
| `-- errorHandler.js
`-- README.md
7. Pruebas que deben funcionar
Comprueba tu API con Postman, Thunder Client o curl. Incluye capturas de pantalla de cada caso:
# Petición Resultado esperado
1 GET /api/tasks 200 y la lista de tareas
2 GET /api/tasks/999 404 desde el manejador de errores
3 POST /api/tasks sin token 401
4 POST /api/tasks con token válido y sin titulo 400 con la lista de errores
5 POST /api/tasks con token válido y datos correctos 201 y la tarea creada
6 DELETE /api/tasks/1 con token de rol user 403
7 DELETE /api/tasks/1 con token de rol admin 200 o 204
8 GET /api/ruta-que-no-existe 404 "Ruta no encontrada"
8. Entregables
• Repositorio (GitHub o archivo .zip) con el código fuente, sin la carpeta node_modules.
• Archivo README.md con instrucciones para instalar y ejecutar el proyecto.
• Documento con las capturas de las 8 pruebas.
• Breve explicación (máximo media página) respondiendo: ¿qué pasaría si el errorHandler se registrara
antes de las rutas? ¿Y si un middleware no llamara a next()?

Práctica: Middlewares en Node.js con Express Página 5
9. Rúbrica de evaluación
Criterio Puntos
Middleware 1 – Logger (método, URL, estado y tiempo) 15
Middleware 2 – Autenticación (401) y autorización por rol (403) 20
Middleware 3 – Validación con lista completa de errores 20
Middleware 4 – Manejo de errores y ruta 404 20
Orden correcto de registro y uso de next() / next(error) 10
Pruebas documentadas con capturas 10
Código limpio, organizado y README 5
Total 100
10. Reto extra (+10 puntos)
Implementa un quinto middleware de límite de peticiones (rate limiting) que permita como máximo 10
peticiones por minuto por dirección IP (req.ip) y responda 429 Too Many Requests al superar el límite. Debe
hacerse sin librerías externas.