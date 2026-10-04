export type SectorRecord = {sector:string; sectors?:string[];sectors_json?:string|null};
export function sectorsOf(row:SectorRecord):string[]{
 if(Array.isArray(row.sectors))return row.sectors;
 if(row.sectors_json)try{const names=JSON.parse(row.sectors_json);if(Array.isArray(names)&&names.every(s=>typeof s==='string'))return names;}catch{}
 return row.sector?[row.sector]:[];
}
