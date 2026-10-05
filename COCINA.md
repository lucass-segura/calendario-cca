# Acceso del equipo de cocina

Cada hermana ingresa con su usuario y contraseña. Las cuentas con rol `kitchen` entran directamente a `/cocina`; solo consultan compromisos con comida y registran su realización. No pueden crear, modificar o cancelar reservas, editar configuración, cambiar permisos ni acceder a Viajes Misioneros. Los controles se aplican en servidor y RLS de Postgres, también ante llamadas directas a Supabase.

Organización conserva el rol `member` para los usuarios anteriores. Al crear o editar una reserva con comida debe elegir **Almuerzo** o **Merienda**. Las reservas históricas no se clasifican automáticamente: se muestran como pendientes de clasificación. Organización puede consultar y corregir cierres desde **Para cocina**.

Después del horario de finalización (Argentina), cocina confirma que la reunión se realizó y registra:

- Cantidad real de comensales, incluso cero.
- Gasto total en pesos argentinos, con hasta dos decimales. Se guarda como centavos enteros, moneda ARS. Cero es válido; un valor vacío no significa cero.
- Para corregir un cierre, motivo obligatorio. Cada versión guarda la cuenta que la confirmó y la fecha; las actualizaciones concurrentes requieren recargar.

Los cierres conservan una copia de la planificación original. Una reserva confirmada no se puede cambiar ni eliminar desde la aplicación; los cambios de cifras se hacen mediante una corrección del cierre. El estado anterior de **Preparación lista** sigue separado de **Reunión realizada**.

El resumen de cocina suma solo los comensales reales y gastos confirmados. Las estadísticas generales anteriores siguen mostrando planificación; no deben interpretarse como asistencia real. `kitchen_reports` y `kitchen_report_history` quedan disponibles para futuras estadísticas verificables. La cuenta identifica a quien confirmó, pero no reemplaza un comprobante del gasto.

## Administración local

Aplicar primero `supabase/migrations/20261005000000_kitchen_access_and_reports.sql`. El script usa una transacción y registra el checksum para no reaplicar ni modificar una migración publicada.

```powershell
node --env-file=.env.local scripts/apply-kitchen-migration.mjs
node --env-file=.env.local scripts/create-kitchen-users.mjs
node --env-file=.env.local scripts/verify-kitchen-access.mjs
```

`DATABASE_URL` es únicamente local. `SUPABASE_SECRET_KEY` es privada del servidor; el panel ADM la necesita también en Vercel para crear cuentas. El certificado raíz descargado de Supabase está en `outputs/supabase-ca.crt`; se puede indicar otro mediante `DATABASE_SSL_CA`. La conexión mantiene TLS con verificación del certificado y del servidor. No configurar DATABASE_URL en Vercel. Ver [USUARIOS.md](USUARIOS.md) para la creación desde ADM.

Las cuentas preparadas son `maria.eugenia`, `norma`, `gladis`, `mirian` y `margarita`. Las contraseñas generadas están solo en `outputs/cocina-accesos-privados.json`, excluido de Git. Entregar a cada hermana únicamente sus datos por un canal privado. El script no sobreescribe cuentas existentes. Estas claves no expiran automáticamente; para rotarlas se utiliza el script administrativo o el panel de Supabase.

Para nuevas cuentas individuales:

```powershell
node --env-file=.env.local scripts/create-user.mjs usuario contraseña "Nombre" --role kitchen
```

Solo administración puede modificar roles. Antes de retirar un usuario con cierres, deshabilitar su acceso; no eliminar su perfil, para preservar el historial.

## Comprobaciones

`pnpm test` verifica importes, horarios, requisitos de cierre, migraciones en una base temporal, restricciones de lectura/escritura, rechazo de cierres futuros, conservación del plan, historial y conflictos de revisión. `scripts/verify-kitchen-access.mjs` prueba las cinco cuentas en Supabase mediante una transacción que revierte sus datos temporales. También ejecutar lint, tipos, build y auditoría cuando corresponda.

## Vista de cocina, fotos e imágenes

La pantalla incorpora el logo de la Congregación, perfil personal y un avatar de cocinera dibujada. Cada persona puede subir su foto o volver al dibujo. La foto se guarda como JPEG de 320 × 320 sin EXIF/GPS en un bucket privado `profile-photos`; solo su dueña habilitada puede consultarla, reemplazarla o quitarla. No requiere la clave secreta del servidor. Para una instalación nueva, aplicar:

```powershell
node --env-file=.env.local scripts/apply-kitchen-migration.mjs 20261005020000_private_profile_photos.sql
```

El selector acepta JPG, PNG y WebP de hasta 12 MB y los reduce antes de enviarlos. El servidor vuelve a validar la imagen real, rechaza animaciones y limita dimensiones y tamaño; no acepta SVG ni confía en la extensión. La foto original no se conserva.

«Imprimir», «Descargar imagen» y «WhatsApp» preparan una agenda con logo, mes, día, horario, título completo, almuerzo/merienda y comensales **previstos**. Los cierres se distinguen en verde y muestran aparte los comensales reales. El JPG excluye fotos personales y gastos. Se incluyen todos los eventos mediante páginas de hasta seis compromisos; se descarga o comparte cada página, y se imprimen todas en A4. La altura del JPG se adapta al contenido.

Compartir usa el menú nativo del dispositivo para elegir WhatsApp. Si el navegador no permite compartir archivos, intenta descargar el JPG y explica cómo adjuntarlo. No envía mensajes automáticamente. La impresión abre el diálogo del navegador; la usuaria elige su impresora.

El botón «Confirmar evento realizado» abre el cierre con los comensales previstos precargados, permite corregirlos y cargar el gasto en pesos. Tras guardar, la tarjeta y el botón quedan en verde. «Confirmado · Editar datos» permite corregir el cierre indicando el motivo. Se mantienen los permisos, la espera hasta el fin del evento y el historial auditado existentes.

Las pruebas cubren paginación sin perder eventos ni cantidades previstas, procesamiento de fotos e aislamiento entre cuentas mediante las políticas de Storage. La revisión visual usa ejemplos aislados, sin insertar encuentros ficticios en producción.

### Avatar predeterminado

Archivo final: `public/cook-avatar.webp` (24 KB, 512 × 512). Generado mediante la herramienta integrada `image_gen` y optimizado para la web. Prompt final:

> Use case: illustration-story. Asset type: default profile avatar for a church community kitchen app. Primary request: a kind adult female cook with a lovely friendly smiling face, depicted as a polished welcoming hand-drawn cartoon portrait. Subject: woman wearing a white chef hat and a simple apron, warm eyes, natural proportions, head and shoulders. Composition: centered square avatar, face clearly recognizable at small sizes, generous padding around hat and shoulders. Background: plain soft cream. Style: gentle clean storybook drawing, rounded shapes, subtle shading. Constraints: no lettering, no logo, no watermark, no extra people.

## Contraseñas y restablecimiento

Cada persona puede usar Cambiar contraseña desde su perfil. Se pide y verifica expresamente la contraseña actual, una nueva de al menos 8 caracteres y su repetición. La nueva clave nunca se guarda en los perfiles ni se muestra en la administración.

En Usuarios y permisos, un administrador puede confirmar Restablecer contraseña. Vuelve al DNI registrado; puede registrar o corregir el DNI en ese diálogo. Una cuenta deshabilitada sigue deshabilitada. Los DNI no se devuelven al navegador: están en una tabla con RLS y permisos exclusivos para la clave privada del servidor. El historial registra administrador, cuenta y fecha, sin incluir DNI ni contraseñas. Producción necesita SUPABASE_SECRET_KEY, únicamente en el entorno del servidor de Vercel.

Migración: 20261005030000_private_password_reset.sql. Las cuentas existentes mantienen sus permisos. Usar el DNI es una preferencia solicitada por el administrador; se recomienda reemplazarlo por una contraseña personal después del ingreso.

## Almanaque de cocina

Vista almanaque abre una imagen mensual o anual con un selector de mes o año. Consulta solo los compromisos de comida mediante el permiso kitchen.read. La vista mensual indica evento, almuerzo o merienda y comensales previstos; la anual resume los días con compromisos. Se conserva la impresión A4 y la descarga JPG. El selector de eventos permite volver a sus detalles en la agenda. Si un día tiene más de dos encuentros, la imagen indica cuántos más hay y los detalles siguen disponibles en la agenda.
