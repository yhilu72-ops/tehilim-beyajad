# Tehilim BeYajad — verificación del 21/10/2026

El producto sigue siendo la app instalada para iOS y Android, con recursos empaquetados y el diseño original. No se declara terminada al 100% ni publicada en las tiendas.

## Código y pruebas
Revisión de código: e26805ee8f879c7521657185f271b4acf9b0851a.
Rama conservada: release/sandbox-verified-20261021.
Ejecución https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39528222874 : **success** en web, Android e iOS.
68/68 pruebas automáticas pasan; comprobación de contenido, build y sincronización Capacitor pasan.
Android: APK/AAB compilados, prueba instrumentada aprobada y captura inspeccionada.
iOS: compilación de simulador y comprobación de arranque/texto visible aprobadas. No son pruebas en teléfonos físicos.

## Mercado Pago
El titular sustituyó el token en Supabase. Diagnóstico real: vendedor sandbox 3546561536, país MLM y etiqueta test_user correctos.
Creación de preferencia por 180 MXN: HTTP 200.
Repetición del mismo intento: HTTP 200, misma preferencia y reused=true.
Mismo intento cambiando el plan: HTTP 409 REQUEST_CONFLICT.
Preferencia: 3546561536-fd581752-09c2-4213-808e-c02849254c9f.
Referencia: dfe07dc1-7d96-413f-8449-d601f20b56d2.
PostgreSQL conserva un único registro pending, sin provider_payment_id. La cuenta sintética se eliminó por el endpoint de la app; el historial de pago se conservó anonimizado.
[Evidencia sin secretos](evidence/mp-sandbox-preference-20261021.json).
El checkout nuevo vuelve a mostrar un error genérico de acceso en el navegador en la nube. No se completó una compra simulada ni se verificó su webhook auténtico. SPEI, producción y cobros móviles siguen pendientes. No se efectuaron cargos reales.

## Textos y seguridad
Se incorporaron los Diez Mandamientos a Ashkenaz desde Exodus 20:2–14, edición Tanach with Nikkud, Public Domain. Las 620 letras coinciden con la sección pendiente, ignorando puntuación/vocalización; se conservan las 13 divisiones de versículos canónicos y su procedencia. La prueba de integridad protege el contenido importado. No se inventaron versículos.
Sidur: 790 secciones (447 Ashkenaz, 129 Edot HaMizrach y 214 Sefard). Tehilim conserva 150 capítulos y 2527 versículos.
Búsqueda de patrones de secretos en 353 blobs del historial Git disponible localmente: cero coincidencias. No equivale a auditoría exhaustiva ni a revisar todas las referencias remotas.
No se cambiaron RPC ni se aplicaron migraciones nuevas. Diagnóstico v9; preferencia y webhook v13.

## Entrega Android
APK de prueba: Tehilim-BeYajad-20261021-test.apk, 7.266.367 bytes.
SHA-256: 5c220594331ec54673157b09efb75879ee2e9319017e3173c787486dfc062b9e.
Origen: https://github.com/yhilu72-ops/tehilim-beyajad/actions/runs/39528222874/artifacts/12315100294 .
No es un paquete firmado para Google Play. iOS sigue sin IPA de distribución.

## Infraestructura publicada
https://tehilim-beyajad.vercel.app es infraestructura complementaria de la app.
Privacidad, términos y eliminación de cuenta devolvieron HTTP 200 y coincidieron con el repositorio. No se atribuye un estado READY a la API de Vercel, cuyo acceso sigue pendiente.

## Pendientes e intervenciones
- Completar Checkout Pro sandbox con el comprador de pruebas y verificar el webhook auténtico de la misma aplicación. Validar después vendedor real y métodos locales, sin efectuar cargos reales sin autorización.
- Acceso del titular a Apple Developer/App Store Connect y Google Play Console, junto con firma existente. Faltan paquetes de distribución, capturas completas y formularios de las tiendas. No se compraron cuentas.
- Resolver la ruta de cobro móvil admitida para la entidad beneficiaria; las ampliaciones digitales requieren tratamiento separado. No hay IAP ni acreditación de donataria.
- Remitente SMTP verificado del proyecto; el correo incorporado de Supabase no es la configuración final de producción.
- Español, fonética y dos secciones Ashkenaz (Veyiten Lekha y Bameh Madlikin) con fuentes reutilizables y revisión religiosa. No se sustituyeron variantes litúrgicas por textos diferentes.
- Pruebas de todos los recorridos y recepción de avisos en teléfonos físicos, con varios usuarios.
- Auditoría integral del código histórico y operación de moderación/retención.
No se deben enviar claves privadas por chat.
