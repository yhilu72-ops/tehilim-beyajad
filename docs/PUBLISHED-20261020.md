# Publicación y verificación — 20 octubre 2026

Este informe actualiza los bloqueos de URL y frontend descritos en los informes anteriores. No declara la app terminada para tiendas.

## Recuperación de contraseña

Se guardó y verificó tras recargar el panel de Supabase:

- Site URL: `https://tehilim-beyajad.vercel.app`
- Única redirección autorizada: `https://tehilim-beyajad.vercel.app/**`

Prueba con una cuenta temporal del titular: registro 200; solicitud de recuperación 200; correo recibido; enlace 303 con sesión de recuperación hacia el dominio oficial, sin localhost; cambio de contraseña 200; inicio de sesión con la nueva contraseña 200 y mismo ID de usuario. Las operaciones de contraseña fueron HTTP/API; no se presenta esta prueba como entrada manual en un teléfono. La cuenta habitual del titular no se modificó.

Comprobante: [configuración guardada](evidence/auth-url-configuration.jpg).

## Frontend publicado

PR #1 fusionada: https://github.com/yhilu72-ops/tehilim-beyajad/pull/1

Commit de publicación: `ce4d235e8c9785dc138be138cb83c1f19587ef21`.

Dominio: https://tehilim-beyajad.vercel.app

Vercel notificó estado `success` para ese commit:
https://vercel.com/yhilu72-ops-projects/tehilim-beyajad/4Ln3ej58jQdADZsShdMrUXfw1Xjj

HTTP 200 y coincidencia byte por byte con el build local para `index.html`, `assets/release.js`, `assets/room-integrity.js`, `assets/reminders.js` y `sw.js`. Caché: `tbj-eaba7b0ac07c`.

Se abrió la web oficial en el navegador, se recorrió inicio de sesión → lectura sin cuenta → Tehilim → lectura corrida, y se comprobó el texto hebreo y el cambio a hebreo/inglés. Se restauró hebreo. [Captura del lector](evidence/published-reader.jpg). La vista previa local seguía bloqueada; esta comprobación se hizo en el dominio oficial publicado.

La API directa de Vercel sigue sin autorizar el equipo. Se informa el estado `success` observado en GitHub y la respuesta del dominio, sin inventar una consulta directa de `READY`.

## Reserva simultánea y creación privada

Una prueba HTTP con dos cuentas temporales detectó un defecto no cubierto por la prueba anterior: `INSERT ... RETURNING` de sala privada fallaba porque la función estable de membresía no veía todavía la fila nueva. Se corrigió `rooms_access_guard` para reconocer al creador directamente en la fila; conserva la restricción de usuarios ajenos.

Migración aplicada: `private_room_creator_insert_returning`. Nueva prueba `tests/room-create.sql`: PASS con rollback, creación privada bajo rol authenticated y aislamiento de otro usuario.

Repetición real por HTTP: creación de sala PASS; ingreso con código PASS; dos solicitudes simultáneas para el mismo capítulo → una `ok:true` y otra `reason:taken`; confirmación ajena sin capítulos; confirmación propia; otra sesión ve el estado confirmado; lectura completada por el propietario. No equivale a dos teléfonos ni a una prueba de carga sostenida.

Limpieza de ambas cuentas temporales mediante `delete-account`: HTTP 200 y 200. Verificación SQL posterior: cero cuentas y cero salas de estas pruebas. Las pruebas de privacidad y Shabbat se repitieron después de la migración y volvieron a pasar.

## Mercado Pago: bloqueo actual identificado

`create-mercadopago-preference` versión 12 desplegada. En Sandbox ya no se impone el correo real de la app como comprador de prueba. Diagnóstico autenticado reducido a indicadores sin secretos.

La prueba HTTP real de preferencia devolvió **409** antes de crear la preferencia:

```json
{"environment":"sandbox","collectorMatches":false,"mexicanAccount":true,"testAccount":false}
```

La credencial actual identifica una cuenta mexicana no marcada como cuenta de prueba; no coincide con el vendedor de prueba esperado. Esto explica el rechazo **actual**; no demuestra por sí solo la causa de cada fallo histórico del checkout hospedado.

No se cambió a producción, no se cambiaron secretos ni se realizó ningún cargo. Para continuar Sandbox se necesita la credencial del vendedor de prueba correcto y una sesión de comprador de prueba distinto. Para producción hay que verificar titular, vendedor, credencial, firma de webhook y habilitación de los métodos de pago; cualquier cargo real requiere autorización específica. No compartir claves por chat.

Fuentes oficiales de cuentas y compras de prueba:
https://www.mercadopago.com.mx/developers/en/docs/checkout-pro-preferences/test-accounts
https://www.mercadopago.com.mx/developers/en/docs/checkout-pro-preferences/integration-test/test-purchases

## Pruebas y límites

39/39 pruebas locales después de la corrección de correo Sandbox. Análisis de scripts y build aprobados. CI previo del mismo frontend: web, Android e iOS aprobados. CI de la fusión `39436185670`: web y Android aprobados; iOS fue cancelado antes de ejecutar pasos y se solicitó repetir solo ese job. No confundir esa cancelación con una compilación iOS aprobada de la fusión.

Permanecen pendientes cobro Sandbox completo, credenciales reales verificadas, idempotencia al crear preferencias por reintentos, revisión integral de código/RLS, español/fonética y tres secciones de Sidur, recordatorios de capítulos pendientes, recepción física de notificaciones, pruebas iPhone/Android, capturas de tiendas, firma y envíos a revisión. Ningún paquete está declarado firmado o aprobado por Apple/Google.
