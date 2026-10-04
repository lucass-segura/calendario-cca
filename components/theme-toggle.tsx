'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {Moon,Sun} from 'lucide-react';
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
// In-memory choice for this page, so toggling still works when localStorage is blocked.
let chosen:boolean|null=null;
// Source of truth: this page's choice, then the saved choice, then the OS preference. Never read <html data-theme>:
// the effect below writes it with the server snapshot during hydration, before the real value is known.
function readDark(){if(chosen!==null)return chosen;let saved:string|null=null;try{saved=localStorage.getItem('cca-theme');}catch{}return saved?saved==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;}
export function ThemeToggle(){
 const dark=useSyncExternalStore(subscribe,readDark,()=>false);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
 function toggle(){const value=!dark;chosen=value;document.documentElement.dataset.theme=value?'dark':'light';try{localStorage.setItem('cca-theme',value?'dark':'light');}catch{}listeners.forEach(l=>l());}
 return <button className="theme-toggle" onClick={toggle} aria-pressed={dark}>{dark?<Sun size={18}/>:<Moon size={18}/>} {dark?'Modo claro':'Modo oscuro'}</button>;
}
