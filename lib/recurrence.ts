export type MonthlyRule = {ordinal:number; weekday:number; until:string; weekend?:boolean; frequency?:'all'|'alternate'|'selected'; months?:string[]};
export const weekdays = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
export const ordinals = [{value:1,label:'primer'},{value:2,label:'segundo'},{value:3,label:'tercer'},{value:4,label:'cuarto'},{value:5,label:'quinto'},{value:-1,label:'último'}];
export function validDate(value:unknown): value is string {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function availableMonths(start:string,until:string):string[] {
 if(!validDate(start)||!validDate(until)||until<start)throw new Error('La fecha de finalización debe ser igual o posterior al inicio.');
 const first=new Date(start+'T12:00:00Z');const last=new Date(until+'T12:00:00Z');const count=(last.getUTCFullYear()-first.getUTCFullYear())*12+last.getUTCMonth()-first.getUTCMonth()+1;
 if(count>60)throw new Error('Podés programar hasta 60 meses por serie.');
 return Array.from({length:count},(_,i)=>new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+i,1,12)).toISOString().slice(0,7));
}
export function monthLabel(month:string){return new Date(month+'-01T12:00:00Z').toLocaleDateString('es-AR',{month:'long',year:'numeric',timeZone:'UTC'});}
export function monthlyDates(start:string,rule:MonthlyRule):string[] {
 const months=availableMonths(start,rule.until);
 if(![1,2,3,4,5,-1].includes(rule.ordinal)||!Number.isInteger(rule.weekday)||rule.weekday<0||rule.weekday>6)throw new Error('Elegí el día de semana y su posición en el mes.');
 if(rule.weekend!==undefined&&typeof rule.weekend!=='boolean')throw new Error('Elegí un día o ambos días del fin de semana.');
 if(rule.weekend&&rule.weekday!==6)throw new Error('El fin de semana se cuenta por su sábado.');
 const frequency=rule.frequency??'all';if(!['all','alternate','selected'].includes(frequency))throw new Error('Elegí la frecuencia de repetición.');
 if(frequency==='selected'&&(!Array.isArray(rule.months)||rule.months.length>60||!rule.months.length||rule.months.some(m=>typeof m!=='string'||!months.includes(m))))throw new Error('Marcá al menos un mes dentro del período elegido.');
 const dates:string[]=[];
 for(const [i,month] of months.entries()){
  if(frequency==='alternate'&&i%2!==0)continue;if(frequency==='selected'&&!rule.months!.includes(month))continue;
  const current=new Date(month+'-01T12:00:00Z');
  if(rule.ordinal===-1){current.setUTCMonth(current.getUTCMonth()+1,0);current.setUTCDate(current.getUTCDate()-((current.getUTCDay()-rule.weekday+7)%7));}
  else{const m=current.getUTCMonth();current.setUTCDate(1+((rule.weekday-current.getUTCDay()+7)%7)+(rule.ordinal-1)*7);if(current.getUTCMonth()!==m)continue;}
  for(let day=0;day<(rule.weekend?2:1);day++){const date=new Date(current);date.setUTCDate(date.getUTCDate()+day);const value=date.toISOString().slice(0,10);if(value>=start&&value<=rule.until)dates.push(value);}
 }
 if(!dates.length)throw new Error('No hay fechas de esa repetición dentro de los meses y el período elegidos.');return [...new Set(dates)].sort();
}
export function ruleLabel(rule:Pick<MonthlyRule,'ordinal'|'weekday'|'weekend'|'frequency'>){const when=rule.weekend?'fin de semana':weekdays[rule.weekday];const frequency=rule.frequency==='alternate'?'mes por medio':rule.frequency==='selected'?'de los meses elegidos':'de cada mes';return `El ${ordinals.find(o=>o.value===rule.ordinal)?.label} ${when} ${frequency}`;}
export function savedRuleLabel(row:{repeat_rule?:string|null;repeat_ordinal?:number|null;repeat_weekday?:number|null}){
 if(row.repeat_rule)try{return ruleLabel(JSON.parse(row.repeat_rule) as MonthlyRule);}catch{/* Older records use individual rule fields. */}
 return row.repeat_ordinal!=null&&row.repeat_weekday!=null?ruleLabel({ordinal:row.repeat_ordinal,weekday:row.repeat_weekday}):'Reserva de una serie';
}
