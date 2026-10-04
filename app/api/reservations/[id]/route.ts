import { database, validate, sameOrigin } from '../../../../lib/reservations';
function getScope(request:Request){const scope=new URL(request.url).searchParams.get('scope')||'single';if(!['single','series'].includes(scope))throw new Error('Elegí esta fecha o toda la serie.');return scope;}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!sameOrigin(request))return Response.json({error:'Solicitud no permitida.'},{status:403});
 const {id}=await params;let d;let scope;try{d=validate(await request.json() as Record<string,unknown>);scope=getScope(request);}catch(e){return Response.json({error:e instanceof Error?e.message:'Datos inválidos.'},{status:400});}
 try {
  let result;
  if(scope==='series'){
   result=await database().prepare(`WITH targets AS MATERIALIZED (SELECT id,date FROM reservations WHERE series_id=(SELECT series_id FROM reservations WHERE id=?)), conflicts AS MATERIALIZED (SELECT r.id FROM reservations r JOIN targets t ON r.date=t.date WHERE r.id NOT IN (SELECT id FROM targets) AND r.start<? AND r.end>?) UPDATE reservations SET title=?,sector=?,sectors_json=?,responsible=?,contact=?,start=?,end=?,service=?,guests=?,notes=?,prepared=0,updated=? WHERE id IN (SELECT id FROM targets) AND NOT EXISTS (SELECT 1 FROM conflicts) AND NOT EXISTS (SELECT date FROM targets GROUP BY date HAVING COUNT(*)>1)`).bind(id,d.end,d.start,d.title,d.sector,JSON.stringify(d.sectors),d.responsible,d.contact,d.start,d.end,d.service,d.guests,d.notes,new Date().toISOString()).run();
  }else{
   result=await database().prepare(`UPDATE reservations SET title=?,sector=?,sectors_json=?,responsible=?,contact=?,date=?,start=?,end=?,service=?,guests=?,notes=?,prepared=0,updated=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM reservations WHERE id<>? AND date=? AND start<? AND end>?)`).bind(d.title,d.sector,JSON.stringify(d.sectors),d.responsible,d.contact,d.date,d.start,d.end,d.service,d.guests,d.notes,new Date().toISOString(),id,id,d.date,d.end,d.start).run();
  }
  if(!result.meta.changes)return Response.json({error:scope==='series'?'La serie ya no está disponible o algún horario está ocupado. No se modificó ninguna fecha.':'La reserva cambió o ese horario ya está ocupado.'},{status:409});return Response.json({ok:true,count:result.meta.changes});
 }catch(e){console.error(e);return Response.json({error:'No pudimos actualizar la reserva.'},{status:503});}
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!sameOrigin(request))return Response.json({error:'Solicitud no permitida.'},{status:403});
 const {id}=await params;let body;try{body=await request.json() as {prepared?:unknown};if(typeof body?.prepared!=='boolean')throw new Error();}catch{return Response.json({error:'Estado inválido.'},{status:400});}
 try{const r=await database().prepare("UPDATE reservations SET prepared=?,updated=? WHERE id=? AND service='food'").bind(body.prepared?1:0,new Date().toISOString(),id).run();return Response.json({ok:!!r.meta.changes},{status:r.meta.changes?200:404});}catch(e){console.error(e);return Response.json({error:'No pudimos guardar el estado.'},{status:503});}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!sameOrigin(request))return Response.json({error:'Solicitud no permitida.'},{status:403});const {id}=await params;let scope;try{scope=getScope(request);}catch{return Response.json({error:'Alcance inválido.'},{status:400});}
 try{const result=scope==='series'?await database().prepare('DELETE FROM reservations WHERE series_id=(SELECT series_id FROM reservations WHERE id=?)').bind(id).run():await database().prepare('DELETE FROM reservations WHERE id=?').bind(id).run();if(!result.meta.changes)return Response.json({error:'La reserva ya no está disponible.'},{status:404});return Response.json({ok:true,count:result.meta.changes});}catch(e){console.error(e);return Response.json({error:'No pudimos cancelar la reserva.'},{status:503});}
}
