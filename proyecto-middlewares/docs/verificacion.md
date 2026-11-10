# Verificación

Fecha: 10 de noviembre de 2026, Costa Rica.

## API

Cinco grupos de pruebas automatizadas con `node:test`, todos aprobados. Cubren los ocho casos obligatorios y validaciones adicionales; rol en el servidor; edición y cambios de estado; recompensa no duplicada; historial de agua, ejercicio y peso; separación por cuenta; lectura de datos desde otra instancia del almacén; recordatorios entre diciembre y enero; rachas; recompensas; cuota 10/min y recuperación; contrato Gemini y respuestas vacías/429 mediante fetch simulado.

Actualización visual posterior: ocho grupos aprobados, incluidos tres sobre audio y avisos. Se verifica desbloqueo tras interacción, reutilización de AudioContext, silencio, agrupación, deduplicación entre recargas y separación de cuentas. El rediseño añade `identity.css` y SVG propios. La revisión visual del nuevo diseño no pudo completarse por actividad del usuario en la ventana y el navegador minimizado; no se afirma una nueva comprobación visual ni una escucha del audio real. Las capturas de la app anteriores se conservan como evidencia de la primera versión; las ocho capturas obligatorias de API siguen siendo válidas.

Revisión lila posterior: acceso y dashboard comprobados visualmente en Chromium. Se observó la flor con distintas posiciones de sus pétalos y fichas en capturas sucesivas; la franja principal está visible sobre los indicadores del día. Se comprobó la distribución estrecha del acceso y la distribución de escritorio. Nuevas capturas: `capturas/lila-dashboard.png` (datos ficticios) y `capturas/lila-bienestar.png`. La app principal conserva sus registros. La demo usa ahora `DEMO_PORT` (3030 por defecto), independientemente del `PORT` de `.env`.

Las ocho peticiones obligatorias se ejecutaron además con curl.exe real contra una instancia aislada antes de implementar extras. Las salidas HTTP completas están en resultados.json. Se abrieron sus transcripciones en el navegador y se tomaron ocho capturas reales. pruebas-con-capturas.html reúne las imágenes y las salidas. No son capturas de Postman: se utilizó curl, permitido por la consigna.

## Interfaz

Revisada en Ecosia/Chromium con datos ficticios de `npm run demo`: acceso como Ana, creación de tarea desde el formulario, búsqueda, completar tarea, XP y subida al nivel 3, recarga conservando la tarea, dashboard, calendario mensual y semanal, modo oscuro y ventana estrecha. Se corrigieron posición inicial de scroll, avisos próximos en el dashboard, tamaño de texto y acceso al cierre de sesión en pantallas de poca altura. Los permisos de Luis se verificaron con peticiones HTTP automatizadas.

Capturas adicionales: capturas/dashboard.png, capturas/modo-oscuro.png y capturas/movil.png. Las capturas muestran una demo; no contienen registros reales de salud.

## Límites de la verificación

- Gemini corregido: se identificó EACCES por restricciones de red del proceso y después 503 UNAVAILABLE en 2.5 Flash. Google devolvió 404 para 2.5 Flash-Lite e indicó 3.5 Flash-Lite como sustituto. Se configuró `gemini-3.5-flash-lite`, se reinició el servidor con acceso de red y se verificó el flujo real completo con perfiles ficticios para Ana/admin y Luis/user: ambos HTTP 200 y recomendaciones persistidas por cuenta. Después se obtuvo HTTP 200 y se guardó la recomendación de Luis en la app principal, respetando el consentimiento ya registrado. La interfaz mostró el modelo y la fecha de la recomendación. Ana debe completar su perfil y consentimiento antes de recibir recomendaciones personales. `scripts/check-accounts-gemini.js` reproduce la prueba aislada con datos ficticios.
- Las ocho pruebas automatizadas siguen aprobadas; se añadieron verificaciones de recuperación de un 503, diagnóstico EACCES y modelo retirado 404. Los errores aparecen en la sección de recomendaciones, no solamente en un toast. Una respuesta tardía de una cuenta no reemplaza la sesión de otra cuenta.
- No se concedieron permisos de notificaciones del sistema durante la prueba; bandeja y cálculo de avisos cubiertos por pruebas de API/dominio. Los avisos del navegador dependen del permiso del usuario.
- El modo móvil se verificó estrechando la ventana de escritorio; no se probó en un teléfono físico.
- Persistencia diseñada para una instancia local. No hay base de datos multiusuario distribuida ni push con el navegador cerrado.
