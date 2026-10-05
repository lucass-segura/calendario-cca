import { currentAccess } from '../../../../lib/auth/access';
import { passwordChangeInput } from '../../../../lib/auth/password';
import { sameOrigin } from '../../../../lib/reservations';
import { createClient } from '@supabase/supabase-js';

const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403, headers });
  const session = await currentAccess();
  if (!session) return Response.json({ error: 'Necesitás ingresar con una cuenta habilitada.' }, { status: 403, headers });
  if (Number(request.headers.get('content-length') || 0) > 4096) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413, headers });
  let input;
  try { input = passwordChangeInput(await request.json()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Revisá las contraseñas.' }, { status: 400, headers }); }
  // Verify explicitly: Auth may ignore current_password unless that project setting is enabled.
  const { data: identity, error: identityError } = await session.supabase.auth.getUser();
  if (identityError || !identity.user?.email || identity.user.id !== session.profile.id) return Response.json({ error: 'Volvé a ingresar para cambiar tu contraseña.' }, { status: 403, headers });
  const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verificationError } = await verifier.auth.signInWithPassword({ email: identity.user.email, password: input.current_password });
  if (verificationError || verified.user?.id !== session.profile.id) return Response.json({ error: 'La contraseña actual es incorrecta o no pudimos verificarla. Volvé a intentarlo.' }, { status: 400, headers });
  await verifier.auth.signOut({ scope: 'local' });
  // Only the current authenticated user's account is updated; no administrative key is used.
  const { error } = await session.supabase.auth.updateUser(input);
  if (error) return Response.json({ error: 'No pudimos cambiar la contraseña. Revisá la contraseña actual y elegí una clave distinta; si ingresaste hace mucho, cerrá sesión y volvé a entrar.' }, { status: 400, headers });
  return Response.json({ ok: true }, { headers });
}
