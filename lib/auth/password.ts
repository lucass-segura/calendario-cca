export function passwordChangeInput(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Completá las tres contraseñas.');
  const input = value as Record<string, unknown>;
  const { currentPassword, password, confirmation } = input;
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 || typeof password !== 'string' || typeof confirmation !== 'string') throw new Error('Completá las tres contraseñas.');
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) throw new Error('La nueva contraseña debe tener al menos 8 caracteres y hasta 72 bytes.');
  if (password !== confirmation) throw new Error('Las nuevas contraseñas no coinciden.');
  if (password === currentPassword) throw new Error('Elegí una contraseña diferente de la actual.');
  return { password, current_password: currentPassword };
}
