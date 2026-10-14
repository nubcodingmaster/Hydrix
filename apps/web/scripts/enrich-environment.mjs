import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { sampleRaster } from './raster.mjs';
const snapshot=JSON.parse(await readFile(new URL('../public/data/majalengka.json',import.meta.url),'utf8'));
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const byPlot=Object.fromEntries(snapshot.plots.map(p=>[p.id,{aeti:null,ret:null,cropland:null}]));
const sources=[];
const errors=[];
const gcs='https://storage.googleapis.com/fao-gismgr-wapor-3-data/';
async function fetchJSON(url) { const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);return r.json(); }
function periodOf(name) {
 const match=name.match(/\.(\d{4})-(\d{2})-(D[123]|\d{2})\.tif$/);
 if(!match)return null;
 const [year,month]=[Number(match[1]),Number(match[2])];
 const token=match[3];
 const first=token[0]==='D' ? (Number(token[1])-1)*10+1 : Number(token);
 const last=token==='D3'?new Date(Date.UTC(year,month,0)).getUTCDate():token[0]==='D'?Number(token[1])*10:first;
 return {start:`${match[1]}-${match[2]}-${String(first).padStart(2,'0')}`,end:`${match[1]}-${match[2]}-${String(last).padStart(2,'0')}`};
}
async function water(layer,key) {
 const prefix=`DATA/WAPOR-3/MAPSET/${layer}/WAPOR-3.${layer}.${today.slice(0,4)}`;
 const listing=await fetchJSON('https://storage.googleapis.com/storage/v1/b/fao-gismgr-wapor-3-data/o?'+new URLSearchParams({prefix,maxResults:'1000',fields:'items(name),nextPageToken'}));
 if(listing.nextPageToken)throw new Error('Incomplete WaPOR object listing');
 const files=(listing.items||[]).map(o=>({name:o.name,period:periodOf(o.name)})).filter(o=>o.period&&o.period.end<today).sort((a,b)=>a.name.localeCompare(b.name));
 if(!files.length)throw new Error(`No complete WaPOR period for ${layer}`);
 const selected=files.at(-1),url=gcs+selected.name;
 const raster=await sampleRaster(url,snapshot.plots,{scaled:true});
 if(raster.scale!==0.1)throw new Error(`Unexpected WaPOR scale ${raster.scale}`);
 for(const sample of raster.samples)byPlot[sample.id][key]={value:sample.value,unit:'mm/day',period:selected.period,pixel:sample.pixel,resolutionDegrees:raster.resolution.slice(0,2).map(Math.abs),scale:raster.scale,source:url};
 sources.push({name:`WaPOR v3 ${key==='aeti'?'ET aktual':'ET referensi'}`,url,status:'connected',purpose:key==='aeti'?'Rata-rata ET aktual per hari dalam dekad, piksel sekitar 326 m':'ET referensi harian, piksel regional; bukan ET spesifik tanaman'});
 console.log(`${layer}: ${selected.period.start}–${selected.period.end}, ${raster.samples.filter(p=>p.value!==null).length} valid pixels`);
}
async function cropland() {
 const collection='esa-worldcereal-temporarycrops-10m-2021-v1';
 const query='https://stac.terrascope.be/collections/'+collection+'/items?bbox=108.15,-7.05,108.40,-6.63&limit=10';
 const listing=await fetchJSON(query);
 if(!listing.features?.length)throw new Error('No WorldCereal item covers Majalengka');
 const item=listing.features.find(f=>f.bbox[0]<108.15&&f.bbox[2]>108.4);
 if(!item)throw new Error('No single WorldCereal raster covers the pilot');
 const cacheFile=new URL('../.cache/worldcereal-2021.json',import.meta.url);
 let cache={};try{cache=JSON.parse(await readFile(cacheFile,'utf8'));}catch{}
 let next=0,done=0;
 await Promise.all(Array.from({length:4},async()=>{
  while(next<snapshot.plots.length) {
   const plot=snapshot.plots[next++];
   const endpoint=`https://titiler.terrascope.be/collections/${collection}/items/${item.id}/point/${plot.center[0]},${plot.center[1]}?assets=classification&assets=confidence`;
   let value=cache[plot.id];
   if(!value || value.endpoint!==endpoint) {
    const sample=await fetchJSON(endpoint);
    if(!Array.isArray(sample.values)||sample.values.length!==2)throw new Error('Invalid WorldCereal point response');
    const [classification,confidence]=sample.values;
    value={classification:[0,100].includes(classification)?classification:null,confidence:Number.isFinite(confidence)&&confidence>=0&&confidence<=100?confidence:null,year:2021,source:query,endpoint,item:item.id,resolutionMeters:10};
    cache[plot.id]=value;
   }
   byPlot[plot.id].cropland=value;done++;
   if(done%25===0)console.log(`WorldCereal ${done}/${snapshot.plots.length}`);
  }
 }));
 await mkdir(new URL('../.cache/',import.meta.url),{recursive:true});
 await writeFile(cacheFile,JSON.stringify(cache));
 sources.push({name:'WorldCereal · tanaman semusim',url:query,status:'connected',purpose:'Klasifikasi dan confidence piksel 10 m, koleksi 2021; bukan identifikasi bawang atau kondisi terkini'});
}
await Promise.all([['WaPOR AETI',()=>water('L1-AETI-D','aeti')],['WaPOR RET',()=>water('L1-RET-E','ret')],['WorldCereal',cropland]].map(async([name,run])=>{try{await run();}catch(error){errors.push({name,message:error.message});console.error(name,error.message);sources.push({name,url:'https://developers.google.com/earth-engine/datasets/tags/agriculture',status:'unavailable',purpose:'Pengambilan data gagal; tidak diisi nilai pengganti'});}}));
const out=new URL('../public/data/environment.json',import.meta.url);
await writeFile(new URL('../public/data/environment.tmp',import.meta.url),JSON.stringify({schemaVersion:1,baseFetchedAt:snapshot.fetchedAt,fetchedAt:new Date().toISOString(),sources,byPlot,errors}));
await rename(new URL('../public/data/environment.tmp',import.meta.url),out);
console.log(`Environment saved. ${sources.filter(s=>s.status==='connected').length} connected layers; ${errors.length} failed.`);
if(errors.length)process.exitCode=1;
