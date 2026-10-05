'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Camera, LogOut } from 'lucide-react';
import { ChangePassword } from './change-password';

async function preparePhoto(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('Elegí una foto JPG, PNG o WebP de hasta 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=640;
    const context = canvas.getContext('2d'); if (!context) throw new Error('No pudimos preparar la foto.');
    const side=Math.min(bitmap.width,bitmap.height);
    context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,640,640);
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No pudimos leer la imagen.')),'image/jpeg',0.85));
    return new File([blob],'foto.jpg',{type:'image/jpeg'});
  } finally { bitmap.close(); }
}

export function KitchenProfile({ name, username }: { name:string; username:string }) {
  const [photo,setPhoto]=useState('/api/profile/photo');
  const [custom,setCustom]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const input=useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);setError('');setNotice('');
    try {
      const body=new FormData();body.set('photo',await preparePhoto(file));
      const response=await fetch('/api/profile/photo',{method:'POST',body});const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setCustom(true);setPhoto('/api/profile/photo?v='+Date.now());setNotice('Tu foto quedó guardada.');
    } catch(e){setError(e instanceof Error?e.message:'No pudimos subir la foto.');}
    finally{setBusy(false);if(input.current)input.current.value='';}
  }
  async function remove() {
    setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/profile/photo',{method:'DELETE'});const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setCustom(false);setPhoto('/cook-avatar.webp');setNotice('Ahora usás la cocinera dibujada.');
    } catch(e){setError(e instanceof Error?e.message:'No pudimos quitar la foto.');}
    finally{setBusy(false);}
  }
  return <section className="kitchen-profile" aria-label="Mi perfil"><div className="kitchen-profile-main"><button className="profile-avatar-button" type="button" disabled={busy} aria-label="Subir mi foto de perfil" onClick={()=>input.current?.click()}><Image unoptimized src={photo} alt="Mi foto de perfil" width={88} height={88} onError={()=>{setCustom(false);setPhoto('/cook-avatar.webp');}}/><span><Camera size={15}/></span></button><div><span className="profile-greeting">¡Qué bueno que estés acá!</span><strong>{name}</strong><small>@{username}</small><button className="profile-photo-link" type="button" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Guardando foto…':custom?'Cambiar mi foto':'Subir mi foto'}</button>{custom&&<button className="profile-photo-link muted" disabled={busy} onClick={()=>void remove()}>Usar dibujo</button>}</div></div><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label="Elegir foto de perfil" onChange={e=>void upload(e.target.files?.[0])}/>{error&&<p className="profile-message error" role="alert">{error}</p>}{notice&&<p className="profile-message" role="status">{notice}</p>}<ChangePassword/><form action="/auth/signout" method="post"><button className="profile-signout" type="submit"><LogOut size={16}/>Cerrar sesión</button></form></section>;
}
