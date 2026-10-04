'use client';
import {useEffect,useState} from 'react';
export function useCalendarView(){const [weekly,setWeekly]=useState(false);useEffect(()=>{setWeekly(window.matchMedia('(max-width: 700px)').matches);},[]);return [weekly,setWeekly] as const;}
export function CalendarView({weekly,onChange}:{weekly:boolean;onChange:(value:boolean)=>void}){return <div className="calendar-view" role="group" aria-label="Vista del calendario"><button aria-pressed={!weekly} onClick={()=>onChange(false)}>Mes</button><button aria-pressed={weekly} onClick={()=>onChange(true)}>Semana</button></div>;}
