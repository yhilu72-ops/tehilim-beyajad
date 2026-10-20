# Verificación de continuación — 20 octubre 2026

**Continuación nativa actual:** [NATIVE-VERIFICATION-20261020.md](NATIVE-VERIFICATION-20261020.md). Este archivo conserva los resultados de su etapa.
Se recuperó la rama `release/mobile-readiness-20261020`, PR #1, desde `56eeba15add025388ad9093a333ba244b47a1032`. Main seguía en `a5ee9bfb0b0ca338a43fea6a818b9a7cd356ffde`. No se reconstruyó la aplicación ni se cambió su diseño.

## Cambios nuevos aplicados

- `diagnose-mercadopago` versión 7: requiere credencial administrativa además del control JWT de la pasarela. Antes no comprobaba rol de administrador y consultaba registros privilegiados. Se recuperó su fuente en Git para mantenerla auditada.
- `mercadopago-webhook` versión 12: una notificación con datos inconsistentes queda en auditoría y no modifica un pago previamente registrado. Valida también que el importe esperado sea finito y positivo.
- Migración `payment_provider_identity_and_order_guard`: impide reasignar el identificador del proveedor y descarta snapshots anteriores según `date_last_updated`. La comprobación se ejecuta bajo el bloqueo de fila de PostgreSQL.
- No se cambiaron credenciales de Mercado Pago ni se hicieron cargos reales.

## Evidencia de pruebas

- `npm test`: 37/37 aprobadas. Quince pruebas nuevas de webhook/diagnóstico: HMAC inválido, importe, moneda, vendedor, referencia, proyecto, otro pago asociado, importe esperado inválido, estados aprobado/pendiente/rechazado/reembolsado/contracargo y rechazo de pago no real en producción.
- `npm run check`: 47 scripts inline analizados; 150 capítulos/2.527 versículos alineados; JSON válido.
- `npm run build`: producción compilada, 26 recursos offline, caché `tbj-eaba7b0ac07c`.
- HTTP real tras desplegar: diagnóstico con clave pública → 403; webhook con firma incorrecta → 401. No se escribieron pagos para esas solicitudes.
- `tests/database.sql`: PASS en Supabase, con rollback. Salas particulares, invitación, privilegios de limpieza, exclusión de sandbox, aportación idempotente y reembolso.
- `tests/privacy-shabbat.sql`: PASS en Supabase, con rollback. Campos privados, anonimato, bloqueo, dos identidades, reserva ocupada, propiedad, lectura y separación de Shabbat.
- `tests/chapter-lifecycle.sql`: PASS en Supabase, con rollback. Tres minutos por defecto, cancelación propia, rechazo de cancelación/confirmación ajena, vencimiento, persistencia y siguiente vuelta al completar los 150.
- `tests/payment-order.sql`: PASS en Supabase, con rollback. Identidad de proveedor inmutable, snapshot antiguo descartado, reembolso posterior aceptado.
- Las pruebas de dos identidades usan una transacción secuencial; no demuestran concurrencia entre dos conexiones ni funcionamiento en dos teléfonos.
- CI del commit `eca471f93d953e00ce78a45b2daa13d889b0c0fc`: https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39421068262 . Consultar resultado final; Vercel reportó success para su preview.

## Publicación y acceso

La conexión Vercel devuelve 403 para el equipo `yhilu72-ops-projects`; no hay CLI Vercel instalada con credenciales propias disponibles. No se sustituyó el equipo por otro. El panel de Supabase abrió, pero muestra inicio de sesión. La conexión de base de datos no dispone de operación para configurar Auth. La redirección localhost sigue sin corregirse ni verificarse de nuevo. La nueva web todavía no se declara publicada.

## Cobros por plataforma y expansión internacional

Fuentes oficiales consultadas el 20 octubre 2026:

- https://developer.apple.com/app-store/review/guidelines/ — secciones 3.1 y 3.2.1(vi), 3.2.2(iv).
- https://support.google.com/googleplay/android-developer/answer/9858738?hl=en — política de pagos.
- https://support.google.com/googleplay/android-developer/answer/10281818?hl=en — interpretación para bienes digitales.

Apple permite recaudación dentro de la app a entidades sin fines de lucro aprobadas, con Apple Pay y condiciones adicionales. Las otras recaudaciones benéficas deben realizarse fuera de la app conforme a sus reglas. Google excluye donaciones exentas de impuestos del sistema Play Billing, pero vender funcionalidades digitales normalmente requiere su sistema de facturación. No se ha acreditado aquí la categoría legal de la entidad. Llamar a una compra «aportación» no establece una exención. Por eso el checkout móvil permanece desactivado; no se afirma aprobación por las tiendas.

Separar aportación voluntaria, dedicatoria y derecho digital al agregar proveedores. Mantener `room_contributions` como proyección de aportaciones verificadas, no como autorización de funcionalidades. Para EE.UU./Israel hará falta proveedor/cuenta habilitados, moneda original, referencia interna única, identificador compuesto proveedor/operación, conciliación e idempotencia; no convertir silenciosamente los precios MXN. Esta es una dirección de arquitectura, no una integración internacional implementada.

## Pendientes que no se deben presentar como terminados

Recuperación con redirección oficial; compra Sandbox completa y diagnóstico de su fallo; prevención de duplicación de preferencias por reintentos; credenciales reales verificadas; concurrencia real de webhooks y capítulos; auditoría integral de todas las tablas y todos los scripts históricos; español/fonética y tres secciones Ashkenaz con fuentes autorizadas; recordatorios específicos de capítulos pendientes y recepción física; revisión visual; firma y cuentas de publicación; capturas reales y formularios de privacidad de tiendas. Los builds anteriores de Android sin firma y de iOS para simulador no son distribución aprobada.
