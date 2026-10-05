'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer, Share2, X } from 'lucide-react';
import { kitchenImages, type KitchenImage } from '../lib/kitchen-export';
import type { KitchenMeal } from '../lib/kitchen';

export function KitchenShare({ meals, month, onClose, initialAction='preview' }: { meals:KitchenMeal[]; month:string; onClose:()=>void; initialAction?:'preview'|'print' }) {
  const [pages,setPages]=useState<KitchenImage[]>([]);
  const [page,setPage]=useState(0);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const frame=useRef<HTMLIFrameElement>(null);
  const printed=useRef(false);
  useEffect(()=>{
    let active=true;let images:KitchenImage[]=[];
    kitchenImages(meals,month).then(result=>{images=result;if(active)setPages(result);else result.forEach(p=>URL.revokeObjectURL(p.url));}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No pudimos preparar la imagen.');});
    return()=>{active=false;images.forEach(p=>URL.revokeObjectURL(p.url));frame.current?.remove();};
  },[meals,month]);
  function download() {
    const selected=pages[page];if(!selected)return;
    const link=document.createElement('a');link.href=selected.url;link.download=selected.file.name;document.body.appendChild(link);link.click();link.remove();
  }
  async function share() {
    const selected=pages[page];if(!selected)return;
    setError('');setNotice('');
    if(!navigator.canShare?.({files:[selected.file]})||!navigator.share){download();setNotice('Imagen descargada. Abrí WhatsApp y adjuntala al chat o al grupo.');return;}
    setBusy(true);
    try {await navigator.share({files:[selected.file],title:'Compromisos de cocina',text:'Agenda de cocina · '+month});}
    catch(e){if(!(e instanceof Error&&e.name==='AbortError')){download();setNotice('Imagen descargada. Podés adjuntarla desde WhatsApp.');}}
    finally{setBusy(false);}
  }
  async function print() {
    if(!pages.length)return;setBusy(true);setError('');
    try {
      frame.current?.remove();const iframe=document.createElement('iframe');iframe.title='Imprimir agenda de cocina';iframe.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';document.body.appendChild(iframe);frame.current=iframe;
      const doc=iframe.contentDocument;if(!doc)throw new Error('No pudimos abrir la impresión.');
      doc.open();doc.write('<!doctype html><html lang="es"><head><title>Agenda de cocina</title><style>@page{size:A4 portrait;margin:0}body{margin:0}img{display:block;width:210mm;height:297mm;object-fit:contain;break-after:page}img:last-child{break-after:auto}</style></head><body></body></html>');doc.close();
      for(const p of pages){const img=doc.createElement('img');img.src=p.url;img.alt='Agenda de cocina';doc.body.appendChild(img);}
      await Promise.all(Array.from(doc.images,img=>img.decode()));iframe.contentWindow?.focus();iframe.contentWindow?.print();
    } catch(e){setError(e instanceof Error?e.message:'Descargá la imagen para imprimirla.');}
    finally{setBusy(false);}
  }
  useEffect(()=>{if(initialAction==='print'&&pages.length&&!printed.current){printed.current=true;const timer=setTimeout(()=>void print(),0);return()=>clearTimeout(timer);}}); // Trigger once after the image is ready.
  return <div className="modal-backdrop kitchen-share-backdrop"><section className="modal kitchen-share-modal" role="dialog" aria-modal="true" aria-labelledby="kitchen-share-title" onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose();if(e.key==='Tab'){const fields=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)');const first=fields[0],last=fields[fields.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><div className="modal-header"><div><p className="eyebrow">PARA TENER A MANO</p><h2 id="kitchen-share-title">Agenda de cocina del mes</h2></div><button autoFocus aria-label="Cerrar imagen" disabled={busy} onClick={onClose}><X/></button></div><div className="kitchen-share-actions"><button className="outline" disabled={!pages.length||busy} onClick={()=>void print()}><Printer size={18}/>Imprimir</button><button className="outline" disabled={!pages.length||busy} onClick={download}><Download size={18}/>Descargar imagen</button><button className="primary kitchen-whatsapp" disabled={!pages.length||busy} onClick={()=>void share()}><Share2 size={18}/>Compartir por WhatsApp</button></div><p className="helper">La imagen incluye día, actividad, comida y comensales previstos. En el menú de compartir elegí WhatsApp; si tu dispositivo no permite compartir archivos, se descargará para que la adjuntes.</p>{error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}{pages.length>1&&<div className="kitchen-page-selector"><button aria-label="Página anterior" disabled={page===0||busy} onClick={()=>setPage(page-1)}><ChevronLeft/></button><span>Página {page+1} de {pages.length} · Descargá o compartí cada página</span><button aria-label="Página siguiente" disabled={page===pages.length-1||busy} onClick={()=>setPage(page+1)}><ChevronRight/></button></div>}{pages[page]?<Image unoptimized className="kitchen-share-image" src={pages[page].url} width={pages[page].width} height={pages[page].height} alt={'Agenda de cocina de '+month+', página '+(page+1)}/>:!error&&<p role="status" className="loading">Preparando una imagen clara de tus compromisos…</p>}</section></div>;
}
