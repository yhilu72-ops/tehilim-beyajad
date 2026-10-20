# Tehilim BeYajad — comprobación de la app instalada

Trabajo del 20 de octubre de 2026 sobre la aplicación original. No se declara terminada para publicación pública ni libre de errores. Este documento actualiza los informes anteriores; conserva la distinción entre código, simulación, pruebas reales y bloqueos.

## 1. Producto y dominio existente

El producto es la app iOS/Android `com.tehilimbeyajad.app`, versión 1.0.0, build 2. Pantallas, textos y recursos se empaquetan dentro del binario mediante Capacitor; `server.url` no está configurado. Se conserva el diseño aprobado. https://tehilim-beyajad.vercel.app sigue como infraestructura complementaria para enlaces, soporte, privacidad y recuperación.

Tras las comprobaciones críticas se integró `7ce370e2c8a0b556a0ace67ac5ea6dad7b469df1`. Vercel notificó `success` y «Deployment has completed» para [este despliegue](https://vercel.com/yhilu72-ops-projects/tehilim-beyajad/7T6Mz9SBQMrYBQm3SrLdjPGNtduK). El dominio oficial respondió HTTP 200 y coincidió byte por byte con el build comprobado en nueve archivos: inicio, Kabalot, recordatorios, funciones nativas, integración de interfaz, service worker, privacidad, términos y eliminación de cuenta. [Resultados y hashes](evidence/native-production-check.json).

La API directa de Vercel sigue sin autorizar el equipo; no se atribuye un estado `READY` a una consulta que no pudo hacerse. La evidencia de publicación es el estado comunicado por Vercel a GitHub y el contenido recibido del dominio oficial. Este despliegue mantiene la infraestructura de la app; no sustituye el instalador móvil por una web.

## 2. Código guardado

Rama de trabajo conservada: `release/native-finish-20261020`. PR #2 fusionada después de pasar las tres tareas de CI: https://github.com/yhilu72-ops/tehilim-beyajad/pull/2 . Commit de integración en `main`: `7ce370e2c8a0b556a0ace67ac5ea6dad7b469df1`. Se conserva el historial anterior; no se reconstruyó la aplicación.

Código de app sometido a la verificación nativa final: `96102cc29898b4e5330ac47a2029ce93a71a6d17`.

El commit `61d6e516855c1e697c9769373cb077d265de4050` añade comprobación visual de iOS y la prueba SQL de privacidad social; no cambia los recursos de la app entregada. Los resultados de esa comprobación se documentan abajo.

## 3. Supabase

Proyecto `yxsustuawcqjewygvxbg`.

Migraciones aplicadas en esta continuación, confirmadas contra el historial del proyecto:

| Versión | Nombre |
|---|---|
| `20261020153429` | `checkout_retry_guard` |
| `20261020161045` | `chapter_rpc_only_writes` |
| `20261020161531` | `kabala_join_privacy` |
| `20261020161553` | `kabala_join_retry_grants` |

- Desplegadas `create-mercadopago-preference` v13 y `mercadopago-webhook` v13. Diagnóstico administrativo v7, consulta privada de estado y eliminación propia de cuenta ya existentes.
- Migración `checkout_retry_guard`: clave de intento, huella del contenido, URL del checkout e índice único por usuario/intento. No elimina historial de pagos.
- Migración `chapter_rpc_only_writes`: retira las escrituras directas de clientes sobre `chapter_claims`. Mantiene las lecturas permitidas por RLS, las funciones RPC existentes y sus bloqueos. Evita saltarse reserva/confirmación mediante inserciones o actualizaciones directas. El archivo incluye los permisos previos para reversión controlada.
- Migraciones `kabala_join_privacy` y `kabala_join_retry_grants`: un usuario ajeno ya no puede leer participantes de una kabalá privada ni unirse; el segundo toque de «Me uno» es idempotente. Se mantiene la escritura mínima de sus dos identificadores bajo RLS.
- Las 16 tablas públicas tienen RLS activo. Se revisó el inventario de políticas de perfiles, peticiones, salas, mensajes, kabalot, presencia, bloqueos, reportes y pagos. Esto no certifica una auditoría completa de todas las funciones históricas.
- Las pruebas usan cuentas y salas sintéticas con rollback. La prueba HTTPS de pagos creó y eliminó su propia cuenta temporal; se verificó que no quedan cuentas de esa prueba.
- La URL de Auth se corrigió y probó en la etapa anterior: dominio oficial, sin dependencia de localhost. En esta revisión se detectó que todavía se usa el correo incorporado de Supabase, que el panel advierte que no es para producción. Falta configurar y probar SMTP con un remitente del proyecto.

El asesor de seguridad mantiene siete avisos sobre RPC `SECURITY DEFINER` intencionalmente accesibles a usuarios autenticados; se comprobaron identidad, pertenencia y propiedad en las pruebas de capítulos. Los dos avisos informativos sobre pagos sin políticas corresponden a tablas cerradas a clientes, operadas por servidor. La protección de contraseñas filtradas está apagada y el panel exige plan Pro; no se contrató. Estos avisos no se ocultaron.

Referencias de los avisos: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable y https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . La revisión integral del código histórico continúa pendiente.

## 4. Mercado Pago

**No está habilitado para cobrar.** La petición real autenticada devuelve HTTP 409 `SELLER_CONFIGURATION_MISMATCH`: entorno sandbox, vendedor distinto del esperado, cuenta mexicana que no está marcada como usuario de prueba. No se creó una preferencia ni se realizó una transacción. El panel de desarrolladores de Mercado Pago muestra un error de acceso en la sesión disponible.

Sí se comprobaron con proveedor simulado: autenticación, precios 180/360/720/1800 MXN decididos en servidor, usuario/sala, reintentos, colisión concurrente de solicitudes, HMAC, vendedor, moneda, importe, referencia, estados y reembolso. PostgreSQL verifica unicidad y orden de eventos. El endpoint desplegado rechaza una firma incorrecta con HTTP 401. Esto no sustituye una compra sandbox completa ni un webhook auténtico del proveedor. SPEI no está verificado.

Las apps móviles mantienen los cobros desactivados hasta validar cuenta y ruta de cobro permitida por las tiendas. No se han configurado productos IAP ni se ha acreditado a la entidad como beneficiaria aprobada. Véanse [activación de Mercado Pago](MERCADO-PAGO-ACTIVATION.md) y [distribución nativa](../store/NATIVE-DISTRIBUTION.md). Los adaptadores futuros para Estados Unidos/Israel están previstos en el modelo; no hay integración internacional terminada.

## 5. Pruebas ejecutadas

| Prueba | Resultado y alcance |
|---|---|
| `npm run check` | PASS: sintaxis de 46 scripts heredados, módulos, datos y licencias declaradas |
| `npm test` | 60/60 PASS: pagos, webhook, recuperación, lecturas, salas, recordatorios y funciones nativas con dobles de prueba |
| `npm run build` / `mobile:sync` | PASS: recursos locales y complementos sincronizados |
| `npm audit --omit=dev --audit-level=high` | Cero vulnerabilidades reportadas por el registro; no equivale a auditoría total |
| `tests/database.sql` | PASS: salas privadas/invitación, permisos administrativos, deduplicación y reembolsos |
| `tests/room-create.sql` | PASS: crear sala privada con respuesta y aislamiento de no miembros |
| `tests/chapter-lifecycle.sql` | PASS: tres minutos, cancelación propia, rechazo ajeno, caducidad, confirmación, lectura y siguiente vuelta |
| `tests/privacy-shabbat.sql` | PASS: peticiones privadas, anonimato, bloqueo, colisión con dos identidades y Shabbat independiente |
| `tests/payment-order.sql` | PASS: identidad inmutable del pago, rechazo de eventos atrasados y reembolso posterior |
| `tests/checkout-retry.sql` | PASS: índice único y tablas de pagos no escribibles por clientes |
| `tests/chapter-write-boundary.sql` | PASS: escritura directa rechazada; reserva/confirmación/lectura por RPC y consulta propia siguen funcionando |
| `tests/kabala-join-privacy.sql` | PASS: publicación autenticada con respuesta, privacidad frente a no miembros, uniones repetidas y borrado ajeno rechazado |
| `tests/social-privacy.sql` | PASS: perfiles/reportes privados, buenos deseos y actualizaciones de sala, publicación del creador y bloqueo de autor |
| HTTPS contra Mercado Pago integrado | Bloqueo 409 verificado sin transacción; firma inválida 401; eliminación de cuenta de prueba 200 |
| Recuperación y concurrencia HTTP de capítulos | Comprobadas en la etapa anterior, documentadas en [PUBLISHED-20261020.md](PUBLISHED-20261020.md); no son pruebas en dos teléfonos |
| Android instalado | PASS: un test instrumentado en Android 15, sin internet; 150 capítulos locales, complementos nativos, programación de 10 avisos y cancelación. Captura real inspeccionada |
| iOS instalado | PASS: compilación, instalación, arranque, reconocimiento de título/controles visibles y revisión manual de la captura. Se reforzó la prueba porque una captura de la ejecución anterior quedó en blanco |

Las tres suites SQL de capítulos/privacidad se repitieron después de restringir las escrituras y pasaron. No hubo alteraciones de filas reales. Búsqueda de patrones de claves privadas/tokens en 151 archivos versionados: cero hallazgos; no representa una revisión completa del historial Git.

## 6. Android

Proyecto nativo, icono de notificación, splash, botón Atrás, compartir y reanudación configurados. APK debug para pruebas y AAB sin firma de distribución. La ejecución https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39456447595 pasó las tres tareas; Android incluyó instalación, prueba instrumentada y captura.

APK entregado: `Tehilim-BeYajad-1.0.0-test.apk`, 7.265.203 bytes, SHA-256 `563cdf8bca30baf92234a9ecc14ae3f82e104740b22a415c743ac86732098e3c`. Artefacto de origen: https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39456447595/artifacts/12281367337 . La firma es de prueba; no sustituye una entrega de Google Play ni garantiza actualizar una instalación firmada con otra clave. El flujo instrumentado comprueba arranque sin internet, 150 capítulos y registro/cancelación de avisos a través del complemento nativo real. Consultar el resultado final; un build exitoso por sí solo no acredita esa prueba.

Firma de publicación preparada en `scripts/android-release.sh`, pero no ejecutada: faltan keystore y acceso a Play Console del titular. No se ha publicado en Google Play.

Evidencia guardada: [captura del emulador Android](evidence/android-emulator-start.png) y [resultado instrumentado, 1 prueba y 0 fallos](evidence/android-instrumentation.html). La captura muestra la interfaz de la aplicación instalada; no es un diseño generado.

## 7. iOS

Proyecto nativo compilado con Xcode, instalado y arrancado en simulador iPhone 17 Pro. Se inspeccionó la [captura final](evidence/ios-simulator-start.png): muestra la pantalla de inicio de sesión del diseño existente, incluido el acceso sin cuenta. Ejecución final: https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39468684029 ; Android, iOS y pruebas de recursos/código terminaron en `success`.

El log de iOS registró `BUILD SUCCEEDED` a las 17:52:16 UTC y la comprobación de texto visible pasó a las 17:54:19 UTC del 20/10/2026. Se comprobó el SHA-256 del archivo de evidencia descargado: `bc264263f6e8d1629acd9d408c96aaf2c36682157a1313e021e29e11aa249437`. Artefacto: https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39468684029/artifacts/12287340234 . El test espera que se dibuje la pantalla; no considera suficiente que exista un proceso de app. No se atribuye este resultado a un iPhone físico.

`scripts/ios-release.sh` prepara archivo/IPA con certificado y perfil existentes. No hay IPA de distribución firmado ni envío a App Store Connect; un `.app` de simulador no se instala en un iPhone físico.

## 8. Funciones terminadas dentro del alcance probado

Empaquetado local, navegación nativa, compartir invitaciones, guardado/cancelación de recordatorios, aviso opcional genérico de capítulos pendientes, control de reintentos de checkout y escrituras de capítulos restringidas a RPC. Los capítulos conservan su estado y sus permisos en las pruebas de servidor. Kabalot ahora envía únicamente columnas existentes, exige confirmación del servidor, conserva el texto si falla y ya no presenta copias locales antiguas como publicaciones. Se extrajo el módulo a `assets/kabalot.js`, conservando su presentación. Los buenos deseos sin nombre no publican automáticamente el correo de la cuenta.

Los recordatorios se programan de domingo a jueves. No se programan viernes/sábado. Se actualizan al abrir/reanudar y cambiar los capítulos; una lectura hecha en otro dispositivo mientras esta app permanece cerrada puede dejar un aviso local pendiente hasta sincronizar. No es push remoto ni entrega física certificada.

Textos comprobados estructuralmente: Tehilim 150/2527 hebreo e inglés JPS 1917; Shir Hashirim 8/117; los diez salmos de Tikún Haklalí; Perek Shirá 6 capítulos; Sidur 789 secciones con licencia identificada. No se afirma revisión religiosa completa.

## 9. Pendientes reales

Compra sandbox y webhook auténtico; cuenta de producción y métodos locales; ruta de cobro móvil; remitente SMTP; español/fonética; tres secciones de Sidur Ashkenaz (Ten Commandments, Veyiten Lekha, Bameh Madlikin); limpieza/auditoría integral del código histórico; pruebas de todos los recorridos en teléfonos y con varios usuarios; recepción física de avisos; capturas completas, declaraciones de privacidad, firma y revisión de tiendas.

## 10. Intervenciones del titular

1. Completar el acceso/verificación que solicite Mercado Pago para disponer del vendedor, comprador y aplicación de pruebas correctos. Las claves se configuran en secretos del servidor, nunca por chat. Después se deben ejecutar las pruebas pendientes antes de activar cobros reales.
2. Dar acceso autorizado a las cuentas existentes de Apple Developer/App Store Connect y Google Play, y a su firma. Si no existen o requieren cuotas, su compra necesita autorización específica.
3. Disponer de un remitente/dominio de correo autorizado para Tehilim y completar su verificación; no se reutilizó el dominio de otro proyecto conectado.
4. Facilitar la revisión religiosa y permisos de las ediciones elegidas cuando no haya una fuente reutilizable comprobada. Aportar dispositivos para validar recepción física y recorridos finales.

No se efectuaron cargos, compras de cuentas, contrataciones ni cambios a credenciales de producción.
