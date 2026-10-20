# Preparación de fichas — no enviadas a las tiendas

El contenido de `es-MX/listing.json` describe únicamente las funciones de la compilación actual. Los enlaces de privacidad y eliminación deben verificarse tras desplegar el frontend. No presentar el sidur como una edición completa revisada ni anunciar español/fonética, cobros móviles o ampliaciones aún no implementadas.

## Información para la revisión

- Lectura sin cuenta: abrir la app, entrar a lectura personal y seleccionar un capítulo. Activar modo avión después de instalar y verificar que los textos incluidos sigan disponibles.
- Salas: iniciar sesión, crear una sala, compartir su código con una segunda cuenta y reservar capítulos distintos. Confirmar lectura y revisar el progreso desde ambas cuentas.
- Privacidad: comprobar con una tercera cuenta que una sala privada no se pueda consultar sin invitación; cerrar sesión y comprobar que no se restaure la sala anterior.
- Moderación: Perfil → Reportar contenido; comprobar envío y bloqueo de un participante de la sala. El titular debe atender los reportes desde el servidor.
- Cuenta: Perfil → Eliminar cuenta; exige escribir ELIMINAR. Probar solo con cuentas desechables autorizadas.
- Pagos: desactivados en móvil. No hay productos de compra configurados ni ampliaciones de cupo activas. La versión web conserva Mercado Pago en entorno de prueba.
- Proporcionar una cuenta de revisión funcional a cada tienda mediante su consola privada. No escribir contraseñas en este repositorio público.

## Capturas pendientes de dispositivo

Capturar la interfaz real, sin datos de personas ni salas reales: inicio, lectura personal, selección de capítulos, progreso de sala y biblioteca. No utilizar montajes para presentar funciones inexistentes. Verificar tamaños requeridos en la consola al preparar la entrega.

## Datos para declaraciones de privacidad

Inventario técnico preliminar; no es un formulario enviado ni una declaración legal definitiva:

- Cuenta: correo, identificador y nombre opcional, usados para autenticar y administrar salas.
- Contenido enviado: salas, mensajes, buenos deseos, kabalot, reportes y actividad de lectura grupal, almacenados en Supabase con controles de acceso.
- Preferencias locales: tamaño de letra, idioma y tema. Los textos de lectura se incluyen en el paquete.
- No se integra una red de publicidad ni un SDK de seguimiento publicitario en esta versión.
- La app permite borrar la cuenta. El servidor conserva los registros que corresponda de operaciones de pago, desvinculándolos según el flujo implementado.
- Revisar retención y tratamiento real de registros técnicos de Supabase y Vercel antes de completar los cuestionarios de las tiendas.

## Firma y publicación pendientes

Identificador propuesto del paquete: `com.tehilimbeyajad.app`; todavía no se ha comprobado ni registrado en las cuentas de las tiendas. Android genera APK debug y AAB sin firma de distribución. iOS se compiló para simulador, no como IPA de distribución. Se necesitan las cuentas del titular y su configuración de firma para crear los paquetes de entrega.
