import { database, validate, sameOrigin } from '../../../lib/reservations';
import { monthlyDates, type MonthlyRule } from '../../../lib/recurrence';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams;const month=query.get('month');const year=query.get('year');let from:string;let until:string;
 if(month&&!year&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){from=month+'-01';until=month+'-31';}
 else if(year&&!month&&/^\d{4}$/.test(year)&&Number(year)>=1900&&Number(year)<=9998){from=year+'-01-01';until=year+'-12-31';}
 else return Response.json({error:'Elegí un mes o año válido.'},{status:400});
 try{const result=await database().prepare('SELECT * FROM reservations WHERE date>=? AND date<=? ORDER BY date,start').bind(from,until).all();return Response.json(result.results,{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'No pudimos cargar las reservas. Intentá nuevamente.'},{status:503});}
}
export async function POST(request: Request) {
 if(!sameOrigin(request)) return Response.json({error:'Solicitud no permitida.'},{status:403});
 let d;let rule:MonthlyRule|null=null;let dates:string[];
 try {const body=await request.json() as Record<string,unknown>;d=validate(body);if(body.repeat!==undefined&&body.repeat!==null){if(typeof body.repeat!=='object')throw new Error('Repetición inválida.');rule=body.repeat as MonthlyRule;dates=monthlyDates(d.date,rule);rule={ordinal:rule.ordinal,weekday:rule.weekday,until:rule.until,weekend:rule.weekend??false,frequency:rule.frequency??'all',...(rule.frequency==='selected'?{months:[...new Set(rule.months)].sort()}: {})};}else dates=[d.date];}catch(e){return Response.json({error:e instanceof Error?e.message:'Datos inválidos.'},{status:400});}
 try {
  const incoming=dates.map(date=>({id:crypto.randomUUID(),date}));const series=rule?crypto.randomUUID():null;
  const result=await database().prepare(`WITH incoming AS MATERIALIZED (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.date') AS date FROM json_each(?)), eligible AS MATERIALIZED (SELECT * FROM incoming WHERE NOT EXISTS (SELECT 1 FROM reservations r JOIN incoming i ON r.date=i.date WHERE r.start<? AND r.end>?)) INSERT INTO reservations (id,title,sector,sectors_json,responsible,contact,date,start,end,service,guests,notes,prepared,updated,series_id,repeat_ordinal,repeat_weekday,repeat_until,repeat_rule) SELECT id,?,?,?,?,?,date,?,?,?,?,?,0,?,?,?,?,?,? FROM eligible`).bind(JSON.stringify(incoming),d.end,d.start,d.title,d.sector,JSON.stringify(d.sectors),d.responsible,d.contact,d.start,d.end,d.service,d.guests,d.notes,new Date().toISOString(),series,rule?.ordinal??null,rule?.weekday??null,rule?.until??null,rule?JSON.stringify(rule):null).run();
  if(!result.meta.changes){const clashes=await database().prepare('SELECT DISTINCT date FROM reservations WHERE date IN (SELECT value FROM json_each(?)) AND start<? AND end>? ORDER BY date').bind(JSON.stringify(dates),d.end,d.start).all<{date:string}>();return Response.json({error:'Hay horarios ocupados en las fechas indicadas. No se creó ninguna reserva. Cambiá el horario o el período.',conflicts:clashes.results.map(r=>r.date)},{status:409});}
  return Response.json({id:incoming[0].id,count:result.meta.changes,firstDate:dates[0],series_id:series},{status:201});
 }catch(e){console.error(e);return Response.json({error:'No pudimos guardar. Tus datos siguen en el formulario.'},{status:503});}
}
