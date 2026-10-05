# Instrucciones del proyecto

## Flujo acordado con el usuario

- El usuario realiza el trabajo por Codex. Trabajar en la rama local `main` y subir únicamente a `origin/main`. No crear ramas ni Pull Requests salvo que el usuario cambie esta preferencia.
- Antes de editar, revisar el estado de Git y los cambios locales. No descartar trabajo del usuario. Consultar el remoto antes de publicar; integrar cambios remotos sin sobrescribir trabajo y repetir las comprobaciones si cambia el código.
- Completar los cambios y revisar el diff antes de pedir autorización para subirlos.
- Validación mínima para cambios de código: `pnpm lint`, `pnpm exec tsc --noEmit` y `pnpm build`. Ejecutar también las pruebas relevantes para el comportamiento modificado. Si se agregan scripts de tests, ejecutarlos. Para cambios solo de documentación, revisar el contenido y `git diff --check`; no repetir compilaciones innecesariamente.
- Ejecutar `pnpm test` además de las comprobaciones de código. Incluye pruebas de cocina y permisos sobre una base temporal; no confundirlas con pruebas de la base de producción. Informar cuáles comprobaciones se realizaron y qué no se pudo comprobar.
- Cuando cambien dependencias, instalar con pnpm, revisar el lockfile y ejecutar `pnpm audit` y `pnpm audit --prod`. No desactivar las protecciones para hacer pasar una instalación.
- Si falla una comprobación, corregir y volver a comprobar. Informar avisos, vulnerabilidades pendientes y limitaciones materiales; no afirmar que todo está OK si hay problemas sin resolver.
- Al terminar la validación, resumir los cambios y resultados, y preguntar explícitamente: "¿Querés que suba estos cambios a main?". Esta confirmación es una instrucción expresa del usuario. No ejecutar `git push` antes de recibir su aprobación para ese conjunto de cambios.
- Preparar un commit local revisable con los archivos correspondientes; se puede crearlo antes de la confirmación. No incluir secretos, `.env.local`, archivos generados o cambios ajenos. No usar `git add .` sin revisar los archivos.
- Después de la aprobación, subir con `git push origin main`, sin force push. Si la rama está protegida o hay conflictos, informar el impedimento y resolver sin saltar protecciones. Si aparecen nuevos cambios materiales tras la aprobación, volver a validar y solicitar aprobación del resultado actualizado.
- No publicar ni desplegar por otra vía sin autorización. Un push puede activar despliegues automáticos configurados en el remoto; tenerlo presente al resumir la publicación.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
