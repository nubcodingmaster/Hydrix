import {readFile,writeFile,rename} from 'node:fs/promises';
import {generateAnalyses,readCachedAnalysis} from './gemini-analysis.mjs';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
if(!key||!model){console.error('Set GEMINI_API_KEY and GEMINI_MODEL in .env.local. No AI output has been generated.');process.exit(1);}
const read=async name=>JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const snapshot=await read('majalengka');
for(const name of ['projections','agronomy','environment']){const data=await read(name);if(data.baseFetchedAt!==snapshot.fetchedAt)throw new Error(`Mismatched ${name} snapshot`);snapshot[name]=data;}
const existing=await readCachedAnalysis(()=>read('analysis'));
const target=new URL('../public/data/analysis.json',import.meta.url),temporary=new URL('../public/data/analysis.tmp',import.meta.url);
const result=await generateAnalyses({snapshot,key,model,existing,log:console.log,save:async data=>{await writeFile(temporary,JSON.stringify(data));await rename(temporary,target);}});
console.log(`Gemini coverage: ${Object.keys(result.output.byPlot).length}/${snapshot.plots.length} locations, ${Object.keys(result.output.byPixel).length}/${Object.keys(snapshot.projections.byPixel).length} rainfall pixels. New analyses: ${result.completed}.`);
if(result.failed)process.exitCode=1;
