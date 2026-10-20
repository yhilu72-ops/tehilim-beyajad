# Tehilim BeYajad — entrega como app para iOS y Android

El producto es la aplicación instalada, con identificador `com.tehilimbeyajad.app`. Capacitor empaqueta los textos y pantallas dentro del APK/AAB y del proyecto iOS: no carga la interfaz desde una URL de Vercel (`server.url` no está configurado). Se conserva el diseño existente y las mismas RPC atómicas de capítulos. La web sirve de infraestructura complementaria para enlaces, soporte, privacidad y recuperación de contraseña.

## Compilación y distribución

Versión 1.0.0, compilación de base 2; incrementar `TBJ_BUILD_NUMBER` en cada entrega. El número final debe contrastarse con las consolas del titular. El identificador todavía debe comprobarse en ambas cuentas.

- `npm run mobile:sync`: empaqueta los recursos y sincroniza los proyectos nativos.
- GitHub Actions `Verify web and native builds`: pruebas JS, APK debug, AAB sin firma de distribución, compilación iOS para simulador. Incluye prueba instrumentada Android (arranque sin internet, 150 capítulos locales, registro y cancelación de avisos con el complemento real) y arranque en simulador iOS con comprobación de texto visible. Consultar el resultado de cada ejecución; programar una prueba no significa que haya pasado.
- `bash scripts/android-release.sh`: exige keystore de subida existente, alias y contraseñas mediante variables seguras; construye y verifica firma del AAB. Variables: `TBJ_ANDROID_KEYSTORE_PATH`, `TBJ_ANDROID_STORE_PASSWORD`, `TBJ_ANDROID_KEY_ALIAS`, `TBJ_ANDROID_KEY_PASSWORD`, `TBJ_BUILD_NUMBER`.
- `bash scripts/ios-release.sh`: exige Mac/Xcode, certificado Apple Distribution ya instalado y perfil App Store correspondiente. Variables: `TBJ_APPLE_TEAM_ID`, `TBJ_IOS_PROFILE_NAME`, `TBJ_BUILD_NUMBER`. Archiva para dispositivo y exporta IPA. No se ha ejecutado una firma real: faltan las credenciales del titular.
- Los scripts de entrega no suben automáticamente a las tiendas. No guardar certificados, claves privadas o contraseñas en GitHub ni en mensajes.

Los artefactos de CI son de prueba y caducan a los siete días. Un APK debug permite pruebas Android; un AAB sin firma no puede publicarse. Un `.app` de simulador no se instala en un iPhone físico ni reemplaza un IPA de distribución.

## Recordatorios nativos

Dos horarios editables de domingo a jueves, sin avisos viernes/sábado. Los avisos de capítulos pendientes son opcionales, se consultan para el usuario autenticado y se programan una sola vez para el próximo horario permitido. Se actualizan al volver a primer plano, al recuperar conexión y después de confirmar/completar capítulos; se cancelan al completar todo, cerrar sesión o desactivarlos. No revelan nombres, números de capítulos ni salas en la pantalla bloqueada. Si la lectura se completa en otro dispositivo mientras esta app permanece cerrada, el aviso local puede quedar desactualizado hasta la siguiente sincronización. No se presenta como un sistema push remoto. Los permisos, ahorro de batería y ajustes del teléfono pueden retrasar avisos. No se ha comprobado recepción en teléfonos físicos.

## Cobros dentro de las apps

Las aportaciones y la ampliación de cupo permanecen desactivadas en la compilación móvil actual. No se habilitarán únicamente porque exista una URL de Mercado Pago. Falta verificar la entidad beneficiaria, la ruta admitida en cada tienda y la cuenta de cobro.

- Apple 3.2.1(vi): recaudación dentro de la app para entidades aprobadas exige Apple Pay y las demás condiciones de Apple. Apple 3.2.2(iv) permite a una app gratuita recaudar para estas causas fuera de la app, por ejemplo en Safari, cuando no tiene esa aprobación. La ampliación digital tiene un tratamiento distinto y no se venderá como donativo.
- Google Play: compras de funciones digitales requieren su sistema de cobro salvo excepciones/programas aplicables. Los donativos exentos de impuestos figuran como excepción; no se ha acreditado que la entidad cumpla esa categoría.
- México: importes del servidor 180/360/720/1800 MXN. El Checkout determina los métodos disponibles según la cuenta; SPEI no está verificado. No anunciar su disponibilidad hasta probar el vendedor correcto.
- Estados Unidos e Israel: conservar un núcleo de aportaciones con usuario, sala, moneda, monto, país, proveedor y referencia. Cada adaptador verifica por separado identidad del vendedor y webhook. El campo `provider` ya existe; no convertir a USD/ILS ni reutilizar credenciales mexicanas automáticamente. Falta integrar y probar un proveedor admitido en esos países.

Fuentes oficiales revisadas el 20 de octubre de 2026:
https://developer.apple.com/app-store/review/guidelines/ (3.1, 3.2.1 y 3.2.2)
https://support.google.com/googleplay/android-developer/answer/9858738?hl=en
https://developer.android.com/studio/publish/app-signing
https://capacitorjs.com/docs/apis/local-notifications

## Condiciones todavía necesarias para una entrega pública

Acceso a las cuentas de desarrollador y firma, pruebas físicas de iPhone/Android, capturas de las pantallas reales y formularios de privacidad de las tiendas. Validación de pagos simulados de punta a punta con comprador y vendedor correctos. Revisión religiosa y fuentes reutilizables para español, fonética y las tres secciones de sidur pendientes. Completar la auditoría del código histórico antes de calificar toda la aplicación como terminada.
