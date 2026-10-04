'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
export function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('cca-theme');}catch{}const value=saved?saved==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;setDark(value);document.documentElement.dataset.theme=value?'dark':'light';},[]);
 function toggle(){const value=!dark;setDark(value);document.documentElement.dataset.theme=value?'dark':'light';try{localStorage.setItem('cca-theme',value?'dark':'light');}catch{}}
 return <button className="theme-toggle" onClick={toggle} aria-pressed={dark}>{dark?<Sun size={18}/>:<Moon size={18}/>} {dark?'Modo claro':'Modo oscuro'}</button>;
}
