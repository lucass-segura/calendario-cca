import { kitchenExportPages } from './kitchen-export-data';
import { mealLabels, type KitchenMeal } from './kitchen';

export type KitchenImage = { url:string; file:File; width:number; height:number };
export async function kitchenImages(meals:KitchenMeal[],month:string):Promise<KitchenImage[]> {
  await document.fonts.ready;
  const logo = new Image();logo.src='/cca-logo.png';await logo.decode();
  return Promise.all(kitchenExportPages(meals,month).map(async (rows,page,all)=>{
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=Math.max(1000,395+rows.length*350+140);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No pudimos preparar la imagen.');
    const ink='#213b4a',green='#286f56',muted='#617989';
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    function text(value:string,x:number,y:number,size:number,color=ink,bold=false){ctx!.font=`${bold?'700':'400'} ${size}px Arial, sans-serif`;ctx!.fillStyle=color;ctx!.fillText(value,x,y);}
    function lines(value:string,width:number,size:number){ctx!.font=`700 ${size}px Arial, sans-serif`;const result:string[]=[];let line='';for(const char of value){if(ctx!.measureText(line+char).width>width&&line){result.push(line.trim());line='';}line+=char;}if(line)result.push(line.trim());return result;}
    ctx.drawImage(logo,60,40,200,101);
    text('CCA SECTOR 7',300,85,35,ink,true);text('Equipo de cocina',300,128,28,muted);
    text('Nuestros encuentros',60,235,59,ink,true);
    text(new Date(month+'-01T12:00:00Z').toLocaleDateString('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).toUpperCase(),60,302,41,green,true);
    text('Agenda de comidas · Cantidades previstas',60,355,27,muted);
    if(!rows.length){text('No hay comidas previstas este mes.',60,540,36,muted);}
    rows.forEach((meal,i)=>{
      const top=395+i*350,complete=!!meal.report;
      ctx.fillStyle=complete?'#f0f8f3':'#f8fafb';ctx.fillRect(60,top,1080,330);
      ctx.fillStyle=complete?green:'#dfaa64';ctx.fillRect(60,top,7,330);
      text(String(Number(meal.date.slice(-2))).padStart(2,'0'),85,top+96,70,ink,true);
      text(new Date(meal.date+'T12:00:00Z').toLocaleDateString('es-AR',{weekday:'short',timeZone:'UTC'}).toUpperCase(),87,top+140,25,muted,true);
      text(meal.start+'–'+meal.end,85,top+181,20,muted);
      const label=meal.meal_type?mealLabels[meal.meal_type]:'Comida por definir';
      text(label.toUpperCase(),255,top+44,28,green,true);
      let titleSize=44;let title=lines(meal.title,825,titleSize);
      while(title.length>4&&titleSize>24){titleSize-=2;title=lines(meal.title,825,titleSize);}
      title.forEach((line,j)=>text(line,255,top+101+j*42,titleSize,ink,true));
      text(`${meal.guests} COMENSALES PREVISTOS`,255,top+273,32,ink,true);
      text(complete?`REALIZADO · ${meal.report!.actual_guests} comensales reales`:'POR REALIZAR',255,top+313,25,complete?green:muted,true);
    });
    text('Cada encuentro, una oportunidad para servir.',60,canvas.height-70,22,muted);
    text(`Página ${page+1} de ${all.length}`,930,canvas.height-70,22,muted);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No pudimos crear el JPG.')),'image/jpeg',0.93));
    return {url:URL.createObjectURL(blob),file:new File([blob],`cocina-${month}${all.length>1?'-'+(page+1):''}.jpg`,{type:'image/jpeg'}),width:canvas.width,height:canvas.height};
  }));
}
