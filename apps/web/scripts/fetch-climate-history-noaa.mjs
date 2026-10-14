import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const snapshot=JSON.parse(await readFile(new URL('../public/data/majalengka.json',import.meta.url),'utf8'));
const pixels=[...new Set(snapshot.plots.map(p=>p.rainfall.at(-1).pixel))];
const xs=pixels.map(p=>Number(p.split(':')[0])),ys=pixels.map(p=>Number(p.split(':')[1]));
const lon=x=>(-180+(x+.5)*.05).toFixed(3),lat=y=>(50-(y+.5)*.05).toFixed(3);
const api='https://coastwatch.pfeg.noaa.gov/erddap/griddap/chirps20GlobalMonthlyP05.json';
const query=`precip[(1991-01-01T00:00:00Z):1:(2024-12-01T00:00:00Z)][(${lat(Math.max(...ys))}):1:(${lat(Math.min(...ys))})][(${lon(Math.min(...xs))}):1:(${lon(Math.max(...xs))})]`;
const url=api+'?'+encodeURI(query).replaceAll('[','%5B').replaceAll(']','%5D');
let complete=true;
for(let year=1991;year<=2024&&complete;year++)for(let month=1;month<=12;month++){try{const cached=JSON.parse(await readFile(new URL(`../.cache/chirps/${year}-${String(month).padStart(2,'0')}.json`,import.meta.url),'utf8'));if(!pixels.every(p=>p in cached.values))complete=false;}catch{complete=false;}}
if(complete){console.log('All 408 training months already cached');process.exit(0);}
console.log('Fetching CHIRPS 1991–2024 through NOAA ERDDAP');
const requestCode='import urllib.request,sys; print(urllib.request.urlopen(sys.argv[1],timeout=150).read().decode())';
const {stdout}=await promisify(execFile)('python3',['-c',requestCode,url],{timeout:180000,maxBuffer:30*1024*1024});
const result=JSON.parse(stdout);const {columnNames,rows}=result.table;
const ti=columnNames.indexOf('time'),xi=columnNames.indexOf('longitude'),yi=columnNames.indexOf('latitude'),vi=columnNames.indexOf('precip');
if([ti,xi,yi,vi].some(i=>i<0))throw new Error('Unexpected NOAA column schema');
const months={};
for(const row of rows) {
 const id=row[ti].slice(0,7),pixel=`${Math.round((row[xi]+179.975)/.05)}:${Math.round((49.975-row[yi])/.05)}`;
 if(!pixels.includes(pixel))continue;
 const rain=row[vi];(months[id]??={month:id,source:url,values:{}}).values[pixel]=typeof rain==='number'&&rain>=0?Number(rain.toFixed(2)):null;
}
if(Object.keys(months).length!==34*12)throw new Error('NOAA did not provide 34 complete years');
const directory=new URL('../.cache/chirps/',import.meta.url);await mkdir(directory,{recursive:true});let checked=0;
for(const [id,value] of Object.entries(months)) {
 if(!pixels.every(p=>p in value.values))throw new Error(`Missing native grid cells for ${id}`);
 let prior;try{prior=JSON.parse(await readFile(new URL(`${id}.json`,directory),'utf8'));}catch{}
 if(prior?.source.startsWith('https://data.chc.ucsb.edu/'))for(const pixel of pixels)if(prior.values[pixel]!==null&&value.values[pixel]!==null){if(Math.abs(prior.values[pixel]-value.values[pixel])>.2)throw new Error(`Mirror mismatch ${id} ${pixel}: ${prior.values[pixel]} vs ${value.values[pixel]}`);checked++;}
 await writeFile(new URL(`${id}.noaa.tmp`,directory),JSON.stringify(value));await rename(new URL(`${id}.noaa.tmp`,directory),new URL(`${id}.json`,directory));
}
console.log(`Cached ${Object.keys(months).length} months for ${pixels.length} native cells; checked ${checked} overlapping UCSB values`);
