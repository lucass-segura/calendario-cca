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
