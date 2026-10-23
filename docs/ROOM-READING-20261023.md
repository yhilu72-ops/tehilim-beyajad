# Lectura dentro de la sala — 23 de octubre de 2026

## Cambio entregado

La sala muestra «Mis capítulos» y acceso directo a la lectura. Después de tomar
las reservas, se abre la lista de capítulos propios confirmados. Cada capítulo
permite leer el texto integrado, elegir el libro físico ahora/después y marcar
únicamente ese capítulo como leído. El lector ofrece hebreo, inglés o ambos y
tamaño de letra; conserva los textos originales de dominio público ya incluidos.
No se confunde la lectura personal con el avance de una sala.

Abrir el texto o elegir «después» nunca registra una lectura. La elección de libro
queda en este dispositivo, separada por usuario/sala/vuelta/capítulo. Las reservas
y lecturas siguen siendo del servidor y se recuperan al volver a entrar. Realtime
y una consulta de respaldo mantienen el estado; las respuestas de una sala o
sesión anterior se descartan. El fallo de guardado deja el capítulo pendiente.

## Base de datos

Se añadió `tbj_seat_complete_chapter`, sin modificar las funciones existentes.
Valida sesión, acceso a la sala, capítulo, modo, vuelta y propietario. El UPDATE
atómico solo afecta un capítulo confirmado y guarda su fecha de lectura; repetir
la petición es idempotente. `anon` y `PUBLIC` no tienen permiso de ejecución.
No se habilitaron escrituras directas de clientes en `chapter_claims`.

El asesor señala esta función como SECURITY DEFINER ejecutable por usuarios
autenticados. Es intencional para mantener el límite RPC sin abrir UPDATE directo:
search_path vacío, nombres de esquema explícitos, auth.uid y permiso de sala,
propietario y estado comprobados. Pruebas negativas ejecutadas sobre el servidor.

## Verificación

- 77/77 pruebas JavaScript/DOM aprobadas, incluidas siete nuevas del flujo.
- `npm run check`, `npm run build` y `git diff --check`: aprobados.
- `tests/complete-one-chapter.sql`: aprobado antes y después de la migración.
- `chapter-lifecycle.sql`, `privacy-shabbat.sql` y `chapter-write-boundary.sql`:
  aprobados nuevamente sobre Supabase con datos sintéticos y ROLLBACK.
- Los tests SQL no equivalen a pruebas con dos teléfonos físicos.
- Las pruebas DOM utilizan respuestas simuladas; las pruebas SQL validan las
  restricciones reales. No se afirma un recorrido autenticado en teléfono físico.
- Rama de respaldo remoto: `backup/before-room-reading-20261023`, commit
  `79f70abf1bfc4d73c45182420a0f2828ce3ad574`.

## Evaluación de Stripe e idiomas

La conexión expone una cuenta llamada «Programación» en modo real. Solo se
consultó el inventario; no se crearon cobros, productos, claves ni suscripciones.
Mercado Pago no se retiró ni se modificó en este cambio.

Stripe es una alternativa internacional adecuada a evaluar desde la cuenta
mexicana. Monedas objetivo: MXN, USD e ILS, con precios aprobados en servidor y
conciliación por proyecto. Los reportes por producto/metadata no separan saldos
ni depósitos bancarios. Para separar negocios y el dinero de Tehilim/Kolel se
recomienda una cuenta Stripe dedicada bajo el mismo acceso, con el titular y
beneficiario correctos; no asumir que una cuenta personal es la del Kolel.

La migración debe distinguir aportaciones sin contraprestación y mejoras digitales
de la app. Apple exige compras integradas para funcionalidades digitales salvo
excepciones aplicables por tienda/región; las recaudaciones de entidades aprobadas
tienen condiciones propias. Google exige Play Billing para esas mejoras salvo
excepciones/programas aplicables y excluye las donaciones exentas de impuestos.
Llamar «aportación» a una ampliación digital no la convierte en donativo exento.

La app podrá tener interfaz española, inglesa y hebrea con RTL. Este cambio no
traduce toda la interfaz. El texto religioso hebreo e inglés existente sí está
disponible en el nuevo lector. La enumeración vigente de Stripe Checkout no
incluye `he`; no se debe prometer un Checkout alojado íntegramente en hebreo.

Fuentes oficiales consultadas:
- https://stripe.com/global
- https://docs.stripe.com/currencies
- https://docs.stripe.com/api/checkout/sessions/create.md?query=locale
- https://support.stripe.com/questions/create-and-manage-multiple-stripe-accounts
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/9858738?hl=en

## Pendientes de esta propuesta

La migración a Stripe no está implementada ni activada. Requiere elegir la cuenta
receptora adecuada, habilitar un sandbox dedicado, implementar webhooks firmados,
estados e idempotencia, y probar el cobro permitido para cada plataforma.
La firma/publicación en tiendas, las pruebas físicas y la traducción completa
siguen pendientes; esta mejora no elimina esos requisitos.
