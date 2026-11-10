# Requisito del md → Cómo se cumplió

| Requisito del md | Cómo se cumplió |
|---|---|
| Node.js y Express | app.js, package.json; única dependencia de ejecución: Express |
| Arreglo de tareas | store.state.tasks; respaldo JSON autorizado por el profesor |
| GET públicos de lista y detalle | GET /api/tasks y GET /api/tasks/:id |
| POST con token y validación | auth → validateTask → creación 201 |
| DELETE con token y admin | auth → authorize('admin') → eliminación 200 |
| Logger primero, global, fecha/hora, método, URL, estado y duración | middlewares/logger.js; finish y next() |
| Bearer y usuarios de prueba | middlewares/auth.js; Ana/abc123/admin y Luis/xyz789/user |
| 401 y req.user | auth valida formato y token, guarda usuario y continúa |
| Función authorize(rol) y 403 | Exportada desde auth.js |
| titulo de texto, obligatorio, 3–100 caracteres | middlewares/validateTask.js |
| prioridad opcional baja/media/alta | validateTask.js; 400 con lista completa de errores |
| Sin librerías de validación ni middlewares externos | Implementaciones propias |
| express.json() y orden obligatorio | app.js conserva la secuencia requerida |
| Manejador con cuatro argumentos, err.status o 500 | middlewares/errorHandler.js |
| next(error), tarea 404 y ruta 404 | app.js y notFound; formato error/status |
| Estructura y nombres obligatorios | proyecto-middlewares/app.js, package.json, middlewares/*, README.md |
| Ocho pruebas Postman/Thunder/curl | curl.exe real; docs/resultados.json |
| Documento con ocho capturas | docs/pruebas-con-capturas.html y docs/capturas/caso-1.png … caso-8.png |
| README de instalación/ejecución | README.md |
| Explicación de máximo media página | Apartado Explicación de middlewares del README |
| Entrega ZIP sin node_modules | proyecto-middlewares-base.zip; después se entrega ZIP ampliado |
| Reto opcional: 10/min/IP, sin librerías | middlewares/rateLimit.js; app.js lo aplica a /api; prueba de onceava petición 429 y recuperación al minuto |

La persistencia en disco es la excepción expresamente autorizada por el estudiante con visto bueno del profesor. La base retiene el arreglo en memoria.
