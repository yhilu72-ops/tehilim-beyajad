# Mercado Pago — estado comprobado y activación pendiente

Comprobación del 20/10/2026, con cuenta desechable de la aplicación, mediante HTTPS contra la función desplegada. Respuesta real HTTP 409:

```json
{"code":"SELLER_CONFIGURATION_MISMATCH","checks":{"environment":"sandbox","collectorMatches":false,"mexicanAccount":true,"testAccount":false}}
```

No se creó una preferencia, no se abrió checkout, no se ejecutó ningún pago. La cuenta temporal fue eliminada y se comprobó que no quedan cuentas de esta prueba.

## Lo que está implementado y verificado

- Autenticación del usuario y pertenencia a la sala; montos exclusivamente del servidor: 180, 360, 720, 1800 MXN.
- Verificación del vendedor mexicano y separación sandbox/production antes de crear preferencias. En sandbox no se manda el correo real de la app como identidad de comprador de pruebas.
- Clave de intento UUID por usuario, restricción única en PostgreSQL, recuperación de la misma preferencia al reintentar, rechazo de la misma clave con distintos datos, bloqueo conservador cuando la respuesta previa es incierta. Las versiones antiguas sin `requestId` siguen siendo compatibles; no tienen esta nueva deduplicación de solicitudes.
- Firma HMAC del webhook, consulta del pago al proveedor, comprobaciones de vendedor/monto/moneda/referencia, estados de pago y reembolso. Un evento inválido no modifica un pago aprobado. Una notificación vieja no sustituye a una más reciente.
- El diagnóstico exige credencial administrativa; `payment-status` muestra solamente la aportación del usuario autenticado. Las tablas de pagos y eventos no están expuestas a clientes.
- La deduplicación del intento y del registro no constituye evidencia de un pago simulado completo ni una garantía de que el proveedor nunca permita dos pagos intencionales. Un segundo ID de pago para una aportación existente se registra como evento anómalo y no sobrescribe el primer pago; requiere revisión, sin reembolsos automáticos no autorizados.

Funciones actuales: `create-mercadopago-preference` v13, `mercadopago-webhook` v13. Migración añadida: `checkout_retry_guard` (tres columnas y un índice único, sin eliminar historial).

## Bloqueo concreto

La credencial almacenada corresponde a una cuenta mexicana que no se identifica como usuario de prueba y cuyo vendedor no coincide con el esperado. La página de desarrolladores de Mercado Pago muestra un error de acceso en la sesión disponible; no se ha obtenido acceso al panel del titular. No se han cambiado credenciales ni activado producción.

Se necesita acceso legítimo al panel del titular para obtener las credenciales de la aplicación y del vendedor de pruebas correctos, y usar un comprador de pruebas distinto. El titular debe completar personalmente cualquier verificación de identidad o acceso que Mercado Pago solicite. No enviar claves ni contraseñas por chat.

Variables del servidor que deben quedar coherentes, sin revelar sus valores:

| Variable | Uso |
|---|---|
| MERCADO_PAGO_ENVIRONMENT | `sandbox` hasta terminar las pruebas; `production` solo tras validar titular y configuración |
| MERCADO_PAGO_ACCESS_TOKEN | Credencial correspondiente al vendedor y aplicación del entorno elegido |
| MERCADO_PAGO_TEST_COLLECTOR_ID | Vendedor sandbox; si se omite conserva el vendedor de pruebas histórico |
| MERCADO_PAGO_COLLECTOR_ID | Vendedor de producción, obligatorio para activar ese entorno |
| MERCADO_PAGO_WEBHOOK_SECRET | Secreto del webhook de la misma aplicación |

## Verificación todavía necesaria

1. Crear una preferencia con el vendedor y comprador de pruebas correctos.
2. Completar Checkout Pro con medios simulados oficiales, incluyendo estados aprobado, pendiente y rechazado.
3. Recibir una notificación auténtica de Mercado Pago, repetirla y comprobar una sola publicación/registro.
4. Probar pérdida de respuesta, retorno al dispositivo y estado consultado desde la app.
5. Confirmar qué métodos locales ofrece realmente la cuenta. SPEI todavía no está validado.
6. Resolver la ruta permitida de aportaciones en cada tienda según `store/NATIVE-DISTRIBUTION.md`.
7. Verificar credenciales y titular de producción. No realizar una transacción real sin autorización específica.

Una respuesta de regreso con `mp_status=success` nunca confirma por sí sola la aportación. Si una preferencia queda incierta, el operador debe conciliarla por `external_reference` con Mercado Pago antes de permitir otro intento; el diagnóstico administrativo conserva la consulta por referencia.

Fuentes: https://www.mercadopago.com.mx/developers/en/docs/checkout-pro-preferences/test-accounts y https://www.mercadopago.com.mx/developers/en/docs/checkout-pro-preferences/integration-test/test-purchases
