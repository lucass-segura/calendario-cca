import sharp from 'sharp';

export const maxPhotoBytes = 3 * 1024 * 1024;
export async function sanitizeProfilePhoto(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > maxPhotoBytes) throw new Error('La foto no puede superar 3 MB.');
  const image = sharp(bytes, { limitInputPixels: 16000000, animated: false, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!['jpeg','png','webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Elegí una foto JPG, PNG o WebP sin animación.');
  // rotate() corrects phone orientation. Sharp strips EXIF/GPS by default.
  return image.rotate().resize(320,320,{fit:'cover',position:'attention'}).flatten({background:'#fff'}).jpeg({quality:85}).toBuffer();
}
