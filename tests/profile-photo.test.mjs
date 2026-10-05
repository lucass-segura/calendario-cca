import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { sanitizeProfilePhoto, maxPhotoBytes } from '../lib/profile-photo.ts';

test('profile images are resized, sanitized and reject invalid formats and oversized uploads', async () => {
  const source=await sharp({create:{width:640,height:480,channels:3,background:'#eeccaa'}}).jpeg().withMetadata().toBuffer();
  const result=await sanitizeProfilePhoto(source);
  const metadata=await sharp(result).metadata();
  assert.equal(metadata.width,320);assert.equal(metadata.height,320);assert.equal(metadata.format,'jpeg');
  assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);
  assert.ok(result.length<204800);
  await assert.rejects(()=>sanitizeProfilePhoto(new Uint8Array(maxPhotoBytes+1)));
  await assert.rejects(()=>sanitizeProfilePhoto(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"></svg>')));
  await assert.rejects(()=>sanitizeProfilePhoto(new TextEncoder().encode('not an image')));
});
