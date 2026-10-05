export const permissionOptions = [
  { key: 'reservations.read', label: 'Ver calendario de reservas' },
  { key: 'reservations.write', label: 'Crear, modificar y cancelar reservas' },
  { key: 'kitchen.read', label: 'Ver compromisos y gastos de cocina' },
  { key: 'kitchen.confirm', label: 'Confirmar eventos y corregir datos reales' },
  { key: 'missions.read', label: 'Ver viajes misioneros y listas' },
  { key: 'missions.write', label: 'Modificar viajes, hermanos y lugares' },
  { key: 'stats.read', label: 'Ver estadísticas generales' },
  { key: 'settings.write', label: 'Cambiar nombres y configuración' },
  { key: 'users.manage', label: 'Administrar usuarios y permisos (ADM)' },
] as const;
export type Permission = typeof permissionOptions[number]['key'];
export const permissionKeys = permissionOptions.map(p => p.key);
export const dependencies: Partial<Record<Permission, Permission[]>> = {
  'reservations.write': ['reservations.read'], 'kitchen.confirm': ['kitchen.read'],
  'missions.write': ['missions.read'], 'stats.read': ['reservations.read', 'missions.read'],
};
export function normalizePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value) || value.some(p => !permissionKeys.includes(p))) throw new Error('Permisos inválidos.');
  const selected = new Set<Permission>(value);
  if (selected.has('users.manage')) return [...permissionKeys];
  for (const p of selected) for (const dependency of dependencies[p] ?? []) selected.add(dependency);
  return permissionKeys.filter(p => selected.has(p));
}
export function togglePermission(selected: Permission[], key: Permission, checked: boolean): Permission[] {
  if (checked) return normalizePermissions([...selected, key]);
  const next = selected.filter(p => p !== key && !(dependencies[p] ?? []).includes(key));
  return next.filter(p => p !== 'users.manage');
}
export function validateUser(value: unknown, creating = true) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Datos inválidos.');
  const b = value as Record<string, unknown>;
  const full_name = typeof b.full_name === 'string' ? b.full_name.trim() : '';
  const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
  if (!full_name || full_name.length > 120) throw new Error('Ingresá un nombre de hasta 120 caracteres.');
  if (creating && !/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error('El usuario debe tener entre 3 y 32 letras, números, puntos, guiones o guiones bajos.');
  if (creating && (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128)) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  if (typeof b.enabled !== 'boolean') throw new Error('Indicá si la cuenta está habilitada.');
  return { full_name, username, password: creating ? b.password as string : '', enabled: b.enabled, permissions: normalizePermissions(b.permissions) };
}
