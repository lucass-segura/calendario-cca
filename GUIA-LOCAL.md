# Trabajar en Windows

Herramientas instaladas: Git para Windows, Node.js LTS 24.19.0 (incluye npm) y pnpm 11.19.0. Cerrar y abrir la terminal después de instalar para cargar el PATH nuevo. Usar pnpm para las dependencias de este proyecto.

## Ejecutar

En PowerShell:

```powershell
cd 'C:\Users\Lucas\Desktop\DESARROLLO PROPIOS\calendario-cca'
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1
```

Antes de iniciar, completar `.env.local` con la URL y la clave pública de tu proyecto de Supabase. El archivo ya está creado y excluido de Git. No dejar los ejemplos entre `< >`. La clave secreta solo hace falta para el script administrativo de creación de usuarios; no es necesaria para ejecutar la aplicación. No pegar claves en código ni subirlas a GitHub.

Abrir http://127.0.0.1:3000. Detener con Ctrl+C. El acceso y los datos requieren Supabase configurado y un usuario existente. Si el proyecto de Supabase ya tiene las migraciones, no volver a ejecutarlas; consultar README.md para configurar una base nueva.

## Revisar y subir cambios

Todo el trabajo se realiza por Codex en `main`. Codex prepara los cambios, revisa el diff y ejecuta las comprobaciones aplicables. Cuando estén listos, pregunta si querés subir ese conjunto de cambios a `main`. La publicación requiere tu respuesta afirmativa. Las instrucciones permanentes están en `AGENTS.md`.

El proyecto incluye `pnpm test` para validaciones de cocina y permisos en una base temporal. Lint, tipos y compilación son comprobaciones adicionales; las pruebas funcionales se realizan según el cambio y requieren Supabase cuando corresponda. Los problemas pendientes se informan antes de pedir la aprobación.

Comandos de referencia que ejecutará Codex:

```powershell
# Editar archivos y comprobar:
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
git status
git diff
git add package.json pnpm-lock.yaml pnpm-workspace.yaml AGENTS.md CLAUDE.md GUIA-LOCAL.md
# Cambiar la lista anterior por los archivos que realmente quieras incluir.
git diff --cached
git commit -m "Describir el cambio"
# Solo después de tu aprobación y de revisar cambios remotos:
git push origin main
```

Git Credential Manager gestiona el inicio de sesión sin guardar tokens en el repositorio. La identidad configurada solo para este proyecto es `predolucassegura <pedrolucassegura@gmail.com>`.

## Dependencias y seguridad

- pnpm fijado mediante `packageManager`; instalar con el lockfile para conservar versiones e integridad.
- Scripts de instalación bloqueados (`ignoreScripts: true`). No habilitarlos globalmente. Los comandos explícitos `dev`, `lint` y `build` sí se ejecutan.
- Antigüedad mínima de 24 horas para nuevas versiones y bloqueo de subdependencias de fuentes exóticas. Estas medidas reducen riesgos, no garantizan que un paquete sea seguro.
- Ejecutar `pnpm audit` periódicamente y revisar los cambios del lockfile antes de subirlos.
- Next.js y eslint-config-next actualizados de 16.3.4 a 16.3.6 para corregir GHSA-vcvr-r3jv-pc5j: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j
- Hallazgo pendiente: `braces` 3.0.3, dependencia transitiva de las herramientas de desarrollo. El aviso GHSA-vfj7-8cjw-p6xm indica 3.0.4 como parche, pero el registro consultado todavía solo publica 3.0.3. Revisar cuando se publique: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

No usar `pnpm audit --fix` ni actualizar todo automáticamente sin revisar compatibilidad. No se publicaron los cambios de preparación.

## Verificación de esta preparación

`pnpm lint` terminó sin errores (un aviso existente sobre una imagen), `pnpm exec tsc --noEmit` pasó y `pnpm build` compiló correctamente. `pnpm audit --prod` no encontró vulnerabilidades conocidas; la auditoría completa conserva el hallazgo de `braces` mencionado arriba. La simulación `git push --dry-run origin HEAD:refs/heads/main` terminó correctamente sin publicar cambios. El inicio de sesión y las operaciones con datos requieren completar los valores reales de Supabase y todavía no fueron comprobados.
