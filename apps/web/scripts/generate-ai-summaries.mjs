import { readFile, writeFile, rename } from 'node:fs/promises';
import { summarizeProjection } from './gemini-summary.mjs';
try { process.loadEnvFile('.env.local'); } catch(error) { if(error.code!=='ENOENT')throw error; }
const key=process.env.GEMINI_API_KEY;
const model=process.env.GEMINI_MODEL;
if(!key){console.log('Gemini is not configured. Statistical projections remain available; no AI text is fabricated.');process.exit(0);}
if(!model)throw new Error('Set GEMINI_MODEL before requesting AI summaries');
const file=new URL('../public/data/projections.json',import.meta.url);
const data=JSON.parse(await readFile(file,'utf8'));
for(const projection of Object.values(data.byPixel)) {
 if(projection.aiSummary?.model===model)continue;
 projection.aiSummary=await summarizeProjection(projection,{key,model});
}
const temporary=new URL('../public/data/projections-ai.tmp',import.meta.url);
await writeFile(temporary,JSON.stringify(data));await rename(temporary,file);
console.log('Validated Gemini explanations saved; forecast numbers were not changed.');
