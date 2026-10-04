export type MissionEntry={id:string;name:string;active:number};
export type MissionTrip={id:string;date:string;place_id:string;person_ids:string[];place:string;people:string[];notes:string;updated:string};
export function validDate(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function dateRange(request:Request){const p=new URL(request.url).searchParams,m=p.get('month'),y=p.get('year');if(m&&!y&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m))return [m+'-01',m+'-31'];if(y&&!m&&/^\d{4}$/.test(y)&&Number(y)>=1900&&Number(y)<=9998)return [y+'-01-01',y+'-12-31'];throw new Error('Elegí un mes o año válido.');}
