# Auditoría Mercado Pago — 23 octubre 2026

No se activó producción ni se realizaron cargos.

- Main verificado: ae4f750a5995f6d83a5781bf7eda1718c9500ba8.
- Última verificación en vivo de credencial: 23 octubre 00:06 UTC; /users/me devolvió 403. El valor sí se guardó. No es prueba de que el usuario lo copiara mal.
- Entorno observado: sandbox, vendedor esperado 3546561536. Producción requiere comprobar el vendedor real y configurar entorno/collector; no basta con reemplazar Access Token.
- Diagnóstico anterior descartaba el cuerpo de errores de identidad. Se agregó clasificación acotada sin devolver mensajes arbitrarios ni secretos y comprobaciones booleanas de formato.
- diagnose-mercadopago v13 desplegada ACTIVE, diagnóstico 1.3. Ejecución remota nueva pendiente del acceso al panel (sesión expirada).
- Consulta de base: 20 pagos pending y 1 approved por 180 MXN; payment ID 183304186338, paid_at 2026-10-09 18:04:29 UTC. Environment ausente en ese registro histórico: no se puede afirmar desde esta fila que fuera un cobro real.
- Un evento reconciled_from_verified_api_diagnostic con signature_valid null. No evidencia de webhook auténtico verificado en esta tabla.
- Ambas tablas de pagos tienen RLS activo y ninguna política de acceso directo; acceso mediante servidor privilegiado.
- 69/69 pruebas automatizadas pasan. Son pruebas con proveedores simulados, no una compra ni una notificación real.
- Integración revisada: precios servidor 180/360/720/1800 MXN, identidad autenticada, control de sala, idempotencia, conflicto de intentos, comprobación de vendedor/moneda/monto/referencia, live_mode para producción, manejo pending/rejected/refunded/charged_back.
- Webhook moderno comprueba HMAC. La ruta IPN histórica no tiene firma y obtiene el pago por API para validarlo; no confundirla con prueba de HMAC.
- Pendiente: ejecutar diagnóstico 1.3, resolver rechazo según evidencia, verificar credencial/webhook de la misma aplicación, configurar producción, probar checkout y recepción auténtica. Los cobros dentro de la app móvil siguen sujetos a la ruta permitida por las tiendas.

Documentación consultada: https://developers.mercadolibre.com.mx/es_mx/error-403 y https://www.mercadopago.com.mx/developers/es/docs/checkout-api-orders/resources/credentials?scope=prod

## Verificación remota posterior — 23 octubre 20:15 UTC

Diagnóstico 1.3 ejecutado con éxito mediante panel autenticado. Sin espacios externos/internos, comillas ni prefijo Bearer añadido en la credencial. Todas las consultas de identidad devolvieron HTTP 403, clasificación provider_policy_denied. Esto no prueba que la credencial sea válida ni determina qué política falló; descarta esos cuatro errores de formato concretos. Continúa sandbox con collector de prueba. El panel de la aplicación de Mercado Pago muestra «Hubo un error accediendo a esta pagina...» en este navegador. No se cambió el token ni el entorno y no se realizó ningún cargo. Siguiente paso: revisión del estado/permisos de la aplicación con acceso al panel de Mercado Pago o soporte del proveedor; no repetir reemplazos sin evidencia.
