# Tehilim BeYajad — preparación de publicación

Fecha de trabajo: 20 de octubre de 2026. Base recuperada: a5ee9bfb0b0ca338a43fea6a818b9a7cd356ffde.

## Implementado

- Se conserva la aplicación original y sus pantallas, colores, carta y logo del Kolel.
- Proyectos nativos Capacitor 8.5.3 para Android e iOS, iconos propios y contenido local.
- Build web reproducible, dependencias fijadas y archivos para lectura offline. No se cachean respuestas de Supabase ni datos privados con el service worker.
- 150 Tehilim / 2.527 versículos en hebreo y traducción inglesa JPS 1917: ediciones de dominio público identificadas por Sefaria; reemplazan el archivo que declaraba una restricción comercial.
- Shir Hashirim, Tikun Haklali y seis capítulos de Perek Shira con fuentes identificadas.
- Sidur: 129 secciones Edot HaMizrach, 446 Ashkenaz y 214 Sefard con fuente, edición y licencia en cada sección. No se importaron tres secciones de Ashkenaz sin licencia confirmada: Ten Commandments, Veyiten Lekha y Bameh Madlikin. No afirmar que estos sidurim son ediciones íntegramente revisadas.
- Idioma de lectura hebreo/inglés, tamaño de letra y modo noche; búsqueda de oraciones por nusaj.
- Lectura personal sin cuenta. Eliminación de cuenta desde Perfil, privacidad, condiciones y página pública para solicitar eliminación.
- Reportes privados y bloqueo de autores; filtrado en base de datos.
- Restricciones aditivas para salas privadas, ingreso con código y control de cupo bajo bloqueo transaccional.
- Mercado Pago: identidad del usuario verificada, precios decididos por servidor, dedicatoria persistida, límite de intentos y consulta privada de estado. Solo los pagos aprobados de producción publican dedicatorias; reembolsos las ocultan; notificaciones repetidas no duplican registros.
- No se simula una compra exitosa ni una ampliación de cupo. Las ampliaciones no están habilitadas. El código nativo no abre checkout externo para funcionalidades digitales.

## Comprobaciones realizadas

- Análisis sintáctico de los 48 scripts heredados y del módulo de integración.
- Validación de los 150 capítulos, 2.527 versículos y correspondencia hebreo/inglés.
- Siete pruebas de pagos con proveedor simulado: autenticación, precio, dedicatoria, anonimato, separación test/producción, límite de intentos y consulta de estado.
- Prueba transaccional real de base de datos, con rollback: aislamiento de salas privadas, rechazo de código incorrecto, acceso de miembro, privilegio del borrado administrativo, exclusión de aportaciones de prueba, idempotencia y reembolsos.
- Endpoints desplegados: creación de preferencia v10, webhook v11, payment-status v1 y delete-account v1. Requests sin autenticación rechazados con HTTP 401 en las tres funciones privadas.
- GitHub Actions completó correctamente web, Android (`assembleDebug bundleRelease`) e iOS para simulador con Xcode 26. Ejecución: https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39370914308 . Android genera APK de prueba y AAB sin firma de distribución; iOS no genera un IPA de distribución. No equivalen a una prueba funcional en dispositivos ni a binarios firmados para tiendas.
- El navegador de la sesión bloqueó la inspección visual por política. No se afirma una revisión visual ni una prueba completa en dispositivos.

## Pendientes que impiden llamarla lista para tiendas

1. Activar credenciales y vendedor reales de Mercado Pago y completar una prueba autorizada de cobro/reembolso. La cuenta configurada continúa siendo de prueba. No basta crear una preferencia.
2. Implementar productos y verificación de compras para ampliaciones de cupo/tiempo en Apple y Google, o aprobar explícitamente una primera versión móvil sin cobros. No reemplazar pagos digitales con un checkout externo sin verificar reglas del mercado aplicable.
3. Traducción española y fonética completas: obtener una edición autorizada y revisarla. No se inventaron ni incorporaron fuentes con restricción comercial para suplirlas.
4. Completar/verificar las tres secciones no importadas del Sidur Ashkenaz y revisar los nusjaot con el responsable religioso.
5. Probar funcionalmente Android e iOS en dispositivos, firmar con las cuentas del titular y completar fichas, capturas, privacidad, clasificación y cuentas de revisión. App Store requiere macOS/Xcode y credenciales de desarrollador; Android necesita la llave de firma.
6. Operar la atención de reportes y privacidad; la existencia del botón de reporte no sustituye su revisión humana.

## Variables de producción de Mercado Pago

Configurar únicamente en secretos de Supabase: MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_WEBHOOK_SECRET, MERCADO_PAGO_ENVIRONMENT=production, MERCADO_PAGO_COLLECTOR_ID del vendedor real mexicano. El backend comprueba que el vendedor corresponda al ID y no tenga la etiqueta test_user. No colocar secretos en el cliente ni en GitHub.

## Fuentes técnicas revisadas

- https://developer.apple.com/app-store/review/guidelines/ — compras digitales, donativos, eliminación de cuenta y contenido de usuarios.
- https://support.google.com/googleplay/android-developer/answer/9858738 — pagos y excepciones.
- https://capacitorjs.com/docs/getting-started/environment-setup — Capacitor 8, Xcode 26 y Android.
- https://supabase.com/docs/guides/functions/auth — autenticación de funciones.
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser — eliminación desde servidor.

## Compilar

`npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm run mobile:sync`.
Android: JDK 21, SDK 36, `cd android && ./gradlew assembleDebug bundleRelease`.
iOS: Xcode 26+, abrir `ios/App/App.xcodeproj` y seleccionar el equipo de firma del titular.

## Estado de entrega y accesos

Cambios guardados en la rama `release/mobile-readiness-20261020`, PR: https://github.com/yhilu72-ops/tehilim-beyajad/pull/1 . El frontend no se fusionó ni se publicó en producción; las migraciones aditivas y cuatro funciones de Supabase sí están desplegadas.

La consulta de Vercel devolvió HTTP 403 para el proyecto y equipo originales. No hay CLI Vercel autenticada disponible en esta sesión. No se pudo verificar una vista previa desplegada. La política del navegador también impidió inspeccionar la vista previa local; no se intentó eludirla.

No se encontró una conexión disponible a Mercado Pago, App Store Connect ni Google Play Console. Para terminar hacen falta el vendedor real configurado en secretos del servidor, acceso de publicación/firma de las tiendas y la fuente autorizada de español/fonética. No enviar contraseñas, tokens ni certificados por chat.

## Continuación: integridad de salas y fichas

- Se unificaron las dos referencias históricas de sala activa. Unirse, salir o eliminar una sala ya no deja una referencia distinta entre pantallas.
- Las pantallas y banners antiguos de aportaciones consultan exclusivamente `room_contributions` publicado. No recurren a dedicatorias locales ni a tablas heredadas sin confirmación de pago.
- Al cerrar sesión se elimina la restauración local de sala y se invalidan consultas pendientes; una respuesta tardía de otra sala no se muestra.
- Se agregaron seis pruebas de regresión; las 13 pruebas locales pasan, junto con validación de textos y sincronización nativa.
- Ficha española y notas de revisión preparadas en `store/`; no enviadas a Apple ni Google.
- GitHub informó `Vercel: success` para el commit 6ea94f0. Esto confirma una compilación/vista previa automática, no el despliegue de la rama principal ni una revisión visual.

## Verificación posterior de los ocho pendientes

Ver `docs/TASKS-20261020.md`: privacidad de peticiones desplegada, Shabbat probado con dos identidades, plugin de recordatorios incorporado, correo/cambio de contraseña comprobados, retorno erróneo de Auth identificado y eliminación de cuenta corregida y probada. Las pruebas locales ahora suman 22.
