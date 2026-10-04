export function validate(v: Record<string, unknown>): Record<'title'|'sector'|'responsible'|'contact'|'date'|'start'|'end'|'service'|'notes',string> & {guests:number;sectors:string[]} {
 const fields = ['title','sector','responsible','contact','date','start','end','service','notes'] as const;
 const data = Object.fromEntries(fields.map(k => [k, typeof v[k] === 'string' ? (v[k] as string).trim() : ''])) as Record<(typeof fields)[number],string>;
 const rawSectors=v.sectors===undefined?[data.sector]:v.sectors;if(!Array.isArray(rawSectors)||!rawSectors.length||rawSectors.length>12||rawSectors.some(n=>typeof n!=='string'||!n.trim()||n.trim().length>120))throw new Error('Elegí entre 1 y 12 sectores, con nombres de hasta 120 caracteres.');const sectors=[...new Set(rawSectors.map(n=>(n as string).trim()))];data.sector=sectors.join(' + ');
 if ((['title','responsible'] as const).some(k => !data[k] || data[k].length > 120) || data.contact.length > 120 || data.notes.length > 2000) throw new Error('Completá actividad, sector y responsable. Revisá la extensión de los datos.');
 if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date+'T12:00:00Z')) || new Date(data.date+'T12:00:00Z').toISOString().slice(0,10)!==data.date) throw new Error('Elegí una fecha válida.');
 if (![data.start,data.end].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || data.start >= data.end) throw new Error('La hora de fin debe ser posterior al inicio, en el mismo día.');
 if (!['food','space'].includes(data.service)) throw new Error('Elegí el tipo de uso.');
 const guests = Number(v.guests); if (!Number.isInteger(guests) || guests < 1 || guests > 10000) throw new Error('Ingresá entre 1 y 10.000 personas.');
 return {...data, guests,sectors};
}
export function sameOrigin(request: Request) {const origin=request.headers.get('origin');return !!origin && origin===new URL(request.url).origin;}
