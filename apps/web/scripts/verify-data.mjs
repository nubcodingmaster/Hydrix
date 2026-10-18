import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildAnalysisInput,currentMonth,fingerprint,isCurrentAnalysis,PROMPT_VERSION} from './analysis-contract.mjs';
import {validateSummary} from './gemini-summary.mjs';
export async function verifySnapshots(data,{requireAI=false,referenceMonth=currentMonth()}={}){
 const base=data.majalengka,ids=base?.plots?.map(p=>p.id)??[];
 if(!ids.length||new Set(ids).size!==ids.length||!Number.isFinite(Date.parse(base.fetchedAt)))throw new Error('Invalid base snapshot');
 const snapshot={...base};
 for(const name of ['agronomy','environment','projections']){
  const value=data[name];if(value?.baseFetchedAt!==base.fetchedAt)throw new Error(`Mismatched ${name} snapshot`);
  snapshot[name]=value;
  if(name!=='projections'&&ids.some(id=>!value.byPlot?.[id]))throw new Error(`Missing ${name} location`);
 }
 const pixels=[...new Set(base.plots.map(p=>p.rainfall?.at(-1)?.pixel))];
 for(const pixel of pixels){
  const p=data.projections.byPixel?.[pixel];
  if(!p||!['low','medium','high'].includes(p.confidence)||!Number.isFinite(Date.parse(p.issuedAt))||!Array.isArray(p.months)||p.months.length!==12||new Set(p.months.map(m=>m.id)).size!==12||p.months.some(m=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(m.id)||![m.rain,m.lower,m.upper].every(Number.isFinite)||m.lower<0||m.lower>m.rain||m.rain>m.upper))throw new Error('Invalid rainfall projection');
 }
 let locations=0,rainfall=0;const analysis=data.analysis;
 if(analysis?.baseFetchedAt===base.fetchedAt&&analysis.referenceMonth===referenceMonth&&analysis.promptVersion===PROMPT_VERSION){
  const verifiedPixels=new Set();
  for(const plot of base.plots){
   const input=buildAnalysisInput(snapshot,plot,referenceMonth);
   if(isCurrentAnalysis(analysis.byPlot?.[plot.id],await fingerprint(input),analysis.model))locations++;
   if(!input.rainfall||verifiedPixels.has(input.rainfall.pixel))continue;
   verifiedPixels.add(input.rainfall.pixel);const record=analysis.byPixel?.[input.rainfall.pixel];
   if(record?.provider!=='Gemini'||record.model!==analysis.model||record.promptVersion!==PROMPT_VERSION||!Number.isFinite(Date.parse(record.generatedAt))||record.inputHash!==await fingerprint({promptVersion:PROMPT_VERSION,referenceMonth,rainfall:input.rainfall}))continue;
   try{validateSummary(record,input.rainfall.months);rainfall++;}catch{}
  }
 }
 if(requireAI&&(locations!==ids.length||rainfall!==pixels.length))throw new Error(`Incomplete current AI coverage: ${locations}/${ids.length} locations; ${rainfall}/${pixels.length} rainfall pixels`);
 return {baseFetchedAt:base.fetchedAt,referenceMonth,locations:ids.length,rainfallPixels:pixels.length,aiLocations:locations,aiRainfallPixels:rainfall};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const data={};for(const name of ['majalengka','agronomy','environment','projections','analysis'])data[name]=JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
  console.log(JSON.stringify(await verifySnapshots(data,{requireAI:process.argv.includes('--require-ai')}),null,2));
 }catch(error){console.error(`Snapshot verification failed: ${error.message}`);process.exitCode=1;}
}
