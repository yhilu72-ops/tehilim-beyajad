# Mercado Pago — estado comprobado y activación pendiente

## Actualización comprobada — 21/10/2026, 01:31 UTC

**El bloqueo de credenciales está resuelto.** El titular sustituyó el token en Supabase. El diagnóstico administrativo de las 01:27 UTC verificó vendedor `3546561536`, país `MLM`, etiqueta `test_user` y entorno `sandbox`; las cuatro comprobaciones devolvieron `true`. La aplicación observada es `2199523174965454` (`TestApp-3d6c8192`). La presencia del secreto de webhook no demuestra que su firma corresponda a esa aplicación.

Se ejecutó la función desplegada con una cuenta temporal autenticada:

- Creación: HTTP **200**, importe **180 MXN**, preferencia `3546561536-fd581752-09c2-4213-808e-c02849254c9f`.
- Repetición del mismo intento: HTTP **200**, misma preferencia y `reused: true`.
- Mismo intento cambiando de plan: HTTP **409**, `REQUEST_CONFLICT`.
- Consulta PostgreSQL: un registro `pending`, `provider_payment_id: null`. No es un pago aprobado.
- La cuenta temporal se eliminó mediante el endpoint de la app; el registro de pago se conservó anonimizado (`user_id` nulo). No se borró historial de pagos.

[Evidencia de las respuestas, sin credenciales](evidence/mp-sandbox-preference-20261021.json).

Al abrir la preferencia nueva, Mercado Pago mostró de nuevo «Hubo un error accediendo a esta pagina...» en el navegador en la nube. No se completó la compra. El siguiente paso indispensable es completar Checkout Pro con el comprador sandbox y verificar la notificación auténtica. No se activaron producción ni cobros móviles; no se realizaron cargos.

La URL usa `init_point`, también para usuarios de prueba, según la [documentación oficial de Mercado Pago](https://www.mercadopago.com.mx/developers/es/news/2023/11/16/Questions-on-how-to-test-your-integration--). No cambiarla a `sandbox_init_point` para intentar corregir un error de acceso del navegador.

Los apartados históricos siguientes conservan la evidencia del problema anterior; ya no describen la credencial actual.

## Diagnóstico histórico del 20/10/2026 a las 19:25 UTC

Se ejecutó `diagnose-mercadopago` v9 desde el panel autenticado de Supabase, con `{"mode":"configuration"}`. Respuesta real HTTP 200. La comprobación solo hizo consultas de lectura al proveedor; no creó preferencias ni cargos y no consultó registros de pagos.

| Comprobación real | Resultado |
|---|---|
| Entorno configurado | `sandbox` |
| Vendedor de pruebas esperado | `3546561536` (valor histórico; no hay variable explícita) |
| Titular de la credencial guardada | `3544258173`, cuenta mexicana `MLM`, activa y sin etiqueta de prueba |
| Credencial aceptada por Mercado Pago | Sí: `/users/me` devolvió HTTP 200 |
| Coincide el vendedor con el esperado | No |
| Coincide el tipo de cuenta con el entorno | No |
| Secreto de webhook almacenado | Sí; su correspondencia con la aplicación aún no está probada |
| Listo para iniciar checkout de prueba | No |

La causa comprobada del bloqueo actual es la mezcla de una credencial de cuenta real con una integración que exige el vendedor sandbox. No se arregla cambiando el ID esperado al titular real ni quitando esa validación. La aplicación `Tehilim BeYajad` con ID `9001196078600708` respondió HTTP 200, pero el proveedor no devolvió su propietario: esa consulta no acredita propiedad ni habilitación para producción.

Evidencia: [respuesta sin secretos](evidence/mp-configuration-20261020.json) y [captura del panel](evidence/mp-configuration-20261020.jpg). El encabezado administrativo fue retirado antes de capturar la pantalla.

### Correcciones guardadas y desplegadas

- Corregido un error del diagnóstico: la expresión regular anterior no retiraba un prefijo `Bearer ` normal y rechazaba una credencial administrativa válida.
- Añadido soporte para las claves secretas administrativas actuales de Supabase mediante `apikey`, conservando el soporte para el JWT administrativo anterior. Las claves públicas y las sesiones ordinarias no autorizan este diagnóstico.
- Añadido modo de configuración que muestra únicamente identidad resumida y comprobaciones; nunca devuelve claves, contraseñas, correo ni domicilio del titular.
- Añadido `supabase/config.toml` para conservar la configuración real de las cinco funciones. La autorización sigue dentro de cada función; el webhook exige su firma HMAC. No se desactivó esa validación.
- Versión desplegada del diagnóstico: **v9 ACTIVE**, SHA-256 del paquete `c3cf3059302affbf6c2287905ec3f1c0474be041ab80059d08d25836f8acdcec`.

Validación: **67/67 pruebas automáticas pasan**, incluidas siete del diagnóstico. Además, pruebas HTTPS contra el despliegue rechazaron solicitudes sin credencial y con Bearer inválido (403), y la pasarela rechazó una clave pública inválida (401). La ejecución administrativa real devolvió 200. Esto verifica el diagnóstico y las protecciones probadas; no equivale a completar Checkout Pro.

No se cambiaron secretos, no se activó producción, no se modificaron pagos históricos y no se hicieron cargos. Las funciones de preferencia y webhook permanecen en v13. En la sesión disponible, Mercado Pago sigue mostrando un error de acceso; no hay una conexión OAuth de Mercado Pago disponible. El servicio oficial MCP ofrece `get_credentials` con OAuth, pero el Access Token existente no sustituye esa autorización. No se crearon cuentas adicionales ni otra aplicación.

Referencias técnicas: [claves actuales de Supabase](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), [configuración de funciones](https://supabase.com/docs/guides/functions/function-configuration), [herramientas oficiales de Mercado Pago MCP](https://www.mercadopago.com.mx/developers/es/docs/mcp-server/tools).

## Prueba de creación de preferencia anterior al diagnóstico

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

## Bloqueo anterior de credenciales — resuelto el 21/10/2026

La credencial almacenada corresponde a una cuenta mexicana que no se identifica como usuario de prueba y cuyo vendedor no coincide con el esperado. La página de desarrolladores de Mercado Pago muestra un error de acceso en la sesión disponible; no se ha obtenido acceso al panel del titular. No se han cambiado credenciales ni activado producción.

La documentación vigente de Checkout Pro mediante Preferences indica que el vendedor de prueba se crea con la aplicación y que su Access Token también puede comenzar por `APP_USR`; el prefijo por sí solo no identifica producción. Se comprueba identidad y etiqueta del vendedor, no únicamente el nombre de la clave.

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

1. Creación de preferencia y deduplicación: verificadas el 21/10/2026. Falta completar el checkout con el comprador de pruebas correcto.
2. Completar Checkout Pro con medios simulados oficiales, incluyendo estados aprobado, pendiente y rechazado.
3. Recibir una notificación auténtica de Mercado Pago, repetirla y comprobar una sola publicación/registro.
4. Probar pérdida de respuesta, retorno al dispositivo y estado consultado desde la app.
5. Confirmar qué métodos locales ofrece realmente la cuenta. SPEI todavía no está validado.
6. Resolver la ruta permitida de aportaciones en cada tienda según `store/NATIVE-DISTRIBUTION.md`.
7. Verificar credenciales y titular de producción. No realizar una transacción real sin autorización específica.

Una respuesta de regreso con `mp_status=success` nunca confirma por sí sola la aportación. Si una preferencia queda incierta, el operador debe conciliarla por `external_reference` con Mercado Pago antes de permitir otro intento; el diagnóstico administrativo conserva la consulta por referencia.

Fuentes: https://www.mercadopago.com.mx/developers/en/docs/checkout-pro-preferences/test-accounts y https://www.mercadopago.com.mx/developers/en/docs/checkout-pro-preferences/integration-test/test-purchases
