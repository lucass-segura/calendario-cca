import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sameOrigin } from '@/lib/reservations';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.headers.get('origin')!), { status: 303 });
}
