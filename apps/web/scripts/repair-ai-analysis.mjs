/** Revalidate published prose and ask Gemini to correct only unsupported claims. */
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {buildAnalysisInput,fingerprint,groundingIssues,currentMonth} from './analysis-contract.mjs';
import {repairAnalyses} from './gemini-analysis.mjs';
process.loadEnvFile('.env.local');
const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
if(!key||!model)throw new Error('Gemini credentials are not configured');
const read=async name=>JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const snapshot=await read('majalengka');for(const name of ['agronomy','environment','projections'])snapshot[name]=await read(name);
const data=await read('analysis');
const inputs=[],analyses=[];
for(const plot of snapshot.plots){
 const record=data.byPlot[plot.id];if(!record||!groundingIssues(record).length)continue;
 const input=buildAnalysisInput(snapshot,plot,currentMonth());
 if(record.model!==model||record.inputHash!==await fingerprint(input))throw new Error(`Stale input for ${plot.id}; regenerate instead of repairing`);
 inputs.push(input);analyses.push({...record,locationId:plot.id});
}
console.log(`Grounding review: ${analyses.length} locations require correction`);
if(analyses.length){
 let fixed,rejected=[];
 try{fixed=await repairAnalyses(inputs,analyses,{key,model});}
 catch(error){if(!error.validatedAnalyses)throw error;fixed=error.validatedAnalyses;rejected=error.rejected;}
 for(const {locationId,...record} of fixed)data.byPlot[locationId]={...record,generatedAt:new Date().toISOString(),groundingReview:'grounding-v1'};
 data.fetchedAt=new Date().toISOString();
 const temporary=new URL('../public/data/analysis-review.tmp',import.meta.url),target=new URL('../public/data/analysis.json',import.meta.url);
 await writeFile(temporary,JSON.stringify(data));await rename(temporary,target);
 console.log(`Saved ${fixed.length} corrected Gemini analyses; measurements and unflagged prose unchanged`);
 if(rejected.length){
  const directory=new URL('../.cache/',import.meta.url);await mkdir(directory,{recursive:true});
  await writeFile(new URL('ai-grounding-review.json',directory),JSON.stringify(rejected,null,2));
  console.error(`${rejected.length} analyses still need grounding review; details saved privately in .cache/ai-grounding-review.json`);process.exitCode=1;
 }
}
