# Continuación verificable — 23 octubre 2026

## Ejecutado
- 70/70 pruebas JavaScript aprobadas; check y build aprobados (150 capítulos / 2527 versículos; 46 scripts analizados).
- 8 archivos de pruebas contra PostgreSQL real aprobados, con datos sintéticos dentro de transacciones revertidas: chapter-lifecycle, privacy-shabbat, payment-order, chapter-write-boundary, checkout-retry, social-privacy, kabala-join-privacy, room-create.
- Reservas de 180 segundos, cancelación propia, propiedad de confirmación/lectura, vencimiento, vueltas, separación Shabbat, privacidad y protección de pagos comprobados por esas pruebas; no son pruebas físicas ni una carga simultánea de dispositivos.
- Diagnóstico Supabase versión 15 ACTIVE. No hay cambios de credenciales, tablas o RPC de capítulos.
- Diagnóstico remoto 20:20:15 UTC: environment sandbox; expectedCollector 3546561536; tokenOwner 403 provider_policy_denied. Sin espacios/comillas/Bearer añadido; looksLikePublicKey false; hasRecognizedTokenStructure false. El último campo es una pista de formato y no demuestra por sí mismo la causa del rechazo o la validez de una credencial.
- Recuperación única del panel de Mercado Pago mediante recarga: mismo error genérico de acceso. No se intentó evadir la restricción.
- GitHub Actions 40017157997 success para código 050984c3 (Android y simulador iOS incluidos). La ejecución 40017882509 seguía en curso al consultar; no se presenta como aprobada.

## Alertas revisadas
RLS activo sin políticas en las dos tablas de pagos: acceso deliberadamente limitado al servidor, no abrirlas para quitar avisos. Las siete funciones SECURITY DEFINER de salas/capítulos son RPC intencionales; sus límites se comprobaron con las pruebas anteriores, no se cambió su mecanismo atómico. La protección contra contraseñas filtradas está desactivada; no se contrató un plan para habilitarla.

## Textos
Se revisaron fuentes de Bameh Madlikin: siete primeras secciones coinciden letra por letra (ignorando puntuación/vocales) con Mishnah Shabbat 2, edición Torat Emet 357 Public Domain. El bloque litúrgico contiene además dos párrafos: no sustituir la sección completa por solo esas siete mishnayot. No se publicó una versión incompleta. Siguen pendientes Bameh Madlikin/Veyiten Lekha completos con procedencia y revisión, español y fonética.

## Bloqueos que no resuelve una compilación
- Mercado Pago: acceso a credenciales de producción y comprobación de identidad/autorización. No activar entorno real antes de verificar vendedor. Webhook auténtico y métodos locales aún sin prueba completa.
- Tiendas: cuentas y firma de distribución del titular; no hay IPA App Store ni AAB firmado para Play. Cobros móviles no se habilitan como ampliaciones digitales externas.
- Remitente de correo propio verificado, pruebas físicas, capturas definitivas y formularios de privacidad.

## Texto listo para soporte de Mercado Pago (no enviado)
Aplicación Tehilim BeYajad, app ID 9001196078600708, México. Desde el servidor Supabase y usando Authorization Bearer, GET /users/me devuelve 403 clasificado como rechazo de políticas; también rechaza consultas de identidad de la aplicación. Última reproducción: 2026-10-23T20:20:15Z. No se ha efectuado una compra. Por favor indiquen la causa específica y el estado de autorización de la aplicación/vendedor. El panel Developers también muestra un error genérico en el navegador en la nube. No adjuntar Access Token, Client Secret ni secretos de webhook al caso.
