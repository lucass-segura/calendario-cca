import { currentAccess } from '../../../../lib/auth/access';
import { sameOrigin } from '../../../../lib/reservations';
import { sanitizeProfilePhoto, maxPhotoBytes } from '../../../../lib/profile-photo';

export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function GET() {
  const session = await currentAccess();
  if (!session) return new Response(null,{status:403,headers:privateHeaders});
  const { data, error } = await session.supabase.storage.from('profile-photos').download(session.profile.id+'/avatar.jpg');
  if (error || !data) return new Response(null,{status:404,headers:privateHeaders});
  return new Response(data,{headers:{...privateHeaders,'Content-Type':'image/jpeg'}});
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:'Solicitud no permitida.'},{status:403});
  const session = await currentAccess();
  if (!session) return Response.json({error:'Necesitás una cuenta habilitada.'},{status:403});
  if (Number(request.headers.get('content-length') || 0) > maxPhotoBytes + 10000) return Response.json({error:'La foto es demasiado grande.'},{status:413});
  let jpeg;
  try {
    const form = await request.formData();
    const file = form.get('photo');
    if (!(file instanceof File) || !file.size || file.size > maxPhotoBytes) throw new Error('Foto inválida.');
    jpeg = await sanitizeProfilePhoto(new Uint8Array(await file.arrayBuffer()));
  } catch { return Response.json({error:'No pudimos leer la foto. Elegí una imagen JPG, PNG o WebP de hasta 3 MB.'},{status:400}); }
  const { error } = await session.supabase.storage.from('profile-photos').upload(session.profile.id+'/avatar.jpg',jpeg,{contentType:'image/jpeg',upsert:true,cacheControl:'0'});
  if (error) return Response.json({error:'No pudimos guardar la foto. Volvé a intentarlo.'},{status:503});
  return Response.json({ok:true},{headers:privateHeaders});
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:'Solicitud no permitida.'},{status:403});
  const session = await currentAccess();
  if (!session) return Response.json({error:'Necesitás una cuenta habilitada.'},{status:403});
  const { error } = await session.supabase.storage.from('profile-photos').remove([session.profile.id+'/avatar.jpg']);
  if (error) return Response.json({error:'No pudimos quitar la foto.'},{status:503});
  return Response.json({ok:true},{headers:privateHeaders});
}
