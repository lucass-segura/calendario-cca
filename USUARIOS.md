# Usuarios y permisos

Lucas.Segura tiene acceso ADM. En la barra lateral, «Usuarios y permisos» permite crear cuentas individuales con nombre, usuario y contraseña inicial (12 a 128 caracteres), editar sus permisos y deshabilitar su acceso conservando su historial.

Las casillas separan consulta de modificación de reservas y viajes, consulta de cocina de confirmación de eventos, estadísticas, configuración y administración de usuarios. Modificar requiere consultar el mismo módulo; estadísticas requiere consultar reservas y viajes. Marcar ADM concede todos los accesos. No se puede deshabilitar la propia cuenta administradora ni quitarse ese permiso.

Los permisos se verifican en cada petición del servidor y mediante RLS en Postgres; un cambio afecta la siguiente acción aunque la persona mantenga abierta su sesión. El historial `user_access_history` conserva quién cambió los accesos, cuándo y los valores anteriores y nuevos. No contiene contraseñas. Las contraseñas no pueden recuperarse desde este panel.

## Configuración

Aplicar después de la migración de cocina:

```powershell
node --env-file=.env.local scripts/apply-kitchen-migration.mjs 20261005010000_user_permissions.sql
```

La migración conserva los permisos existentes de cocina y organización y otorga ADM exclusivamente a `lucas.segura`. Los perfiles nuevos tienen cero permisos por defecto; la administración los asigna explícitamente.

Para crear cuentas desde el panel publicado, agregar `SUPABASE_SECRET_KEY` en **Vercel → proyecto → Settings → Environment Variables**, con el valor privado ya guardado en `.env.local`, y volver a desplegar. Nunca usar el prefijo `NEXT_PUBLIC_`. La clave se importa solo desde `lib/supabase/admin.ts` protegido por `server-only`, después de validar el permiso ADM. Si falta, el panel explica la limitación y mantiene disponible la edición de permisos. `DATABASE_URL` continúa siendo únicamente local.

La creación usa Supabase Auth desde el servidor y asigna el perfil con una función SQL que vuelve a verificar ADM. Si falla la asignación, elimina el usuario recién creado o bloquea su autenticación si no logra eliminarlo. No modifica la sesión del administrador ni envía correos a las direcciones internas.

## Validación

`pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` y `pnpm build`. Las pruebas de base temporal cubren acceso de consulta, denegación de modificación y escalación, asignación ADM, dependencias, revocación, deshabilitación, cierres de cocina e historial.
