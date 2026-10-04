'use client';
import {useState,useSyncExternalStore} from 'react';
const noopSubscribe=()=>()=>{};
// Narrow screens default to the weekly view; the server snapshot is false so hydration matches.
export function useCalendarView(){
 const narrow=useSyncExternalStore(noopSubscribe,()=>window.matchMedia('(max-width: 700px)').matches,()=>false);
 const [choice,setChoice]=useState<boolean|null>(null);
 return [choice??narrow,setChoice as (value:boolean)=>void] as const;
}
export function CalendarView({weekly,onChange}:{weekly:boolean;onChange:(value:boolean)=>void}){return <div className="calendar-view" role="group" aria-label="Vista del calendario"><button aria-pressed={!weekly} onClick={()=>onChange(false)}>Mes</button><button aria-pressed={weekly} onClick={()=>onChange(true)}>Semana</button></div>;}
