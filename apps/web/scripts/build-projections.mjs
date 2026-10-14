import { readFile, writeFile, rename } from 'node:fs/promises';
import { buildProjection } from './seasonal-model.mjs';
const snapshot=JSON.parse(await readFile(new URL('../public/data/majalengka.json',import.meta.url),'utf8'));
const byPixel={};const issuedAt=new Date().toISOString();
for(const plot of snapshot.plots) {
 const pixel=plot.rainfall.at(-1).pixel;if(byPixel[pixel])continue;
 const history=[];const sources=new Set();
 for(let year=1991;year<=2024;year++)for(let month=1;month<=12;month++) {
  const id=`${year}-${String(month).padStart(2,'0')}`;
  const data=JSON.parse(await readFile(new URL(`../.cache/chirps/${id}.json`,import.meta.url),'utf8'));
  if(!(pixel in data.values))throw new Error(`Missing training cell ${pixel} ${id}`);
  history.push({id,rain:data.values[pixel]});sources.add(data.source);
 }
 for(const month of plot.rainfall)if(!history.some(m=>m.id===month.id)){history.push({id:month.id,rain:month.rain});sources.add(month.source);}
 const projection=buildProjection(history,issuedAt,pixel);
 byPixel[pixel]={...projection,history,sources:[...sources]};
 console.log(pixel,projection.method,'MAE',projection.validation.maeMm,'mm; empirical coverage',projection.validation.intervalCoverage+'%');
}
const out=new URL('../public/data/projections.json',import.meta.url),temporary=new URL('../public/data/projections.tmp',import.meta.url);
await writeFile(temporary,JSON.stringify({schemaVersion:1,baseFetchedAt:snapshot.fetchedAt,issuedAt,provider:'Local seasonal statistical model; CHIRPS observations',byPixel}));await rename(temporary,out);
console.log('Saved 12-month projections for',Object.keys(byPixel).length,'CHIRPS cells');
