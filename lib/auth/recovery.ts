export function recoveryDni(input: unknown) {
  if (input === undefined || input === '') return null;
  if (typeof input !== 'string' || !/^\d{7,8}$/.test(input)) throw new Error('Ingresá el DNI con 7 u 8 números, sin puntos ni espacios.');
  return input;
}
