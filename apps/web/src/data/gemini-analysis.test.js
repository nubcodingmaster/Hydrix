import { test,expect } from 'vitest';
import { requestAnalysisBatch,generateAnalyses } from '../../scripts/gemini-analysis.mjs';
const report={farmerSummary:'Review seasonal uncertainty with your extension adviser.',governmentSummary:'Review regional evidence before proposing public support.',crops:['0','1','2'].map(cropId=>({cropId,assessment:'Crop suitability remains conditional on field verification.'})),support:['water','soil','pest'].map(kind=>({kind,reason:'The available observations do not confirm current field conditions.',farmerAction:'Consult an extension adviser before deciding on inputs.',governmentAction:'Prepare verification and extension assistance before allocating inputs.',evidence:['survey']}))};
const input={survey:{id:'a'},rainfall:{pixel:'cell',months:[{id:'2026-11'}]}};
const json={analyses:[{locationId:'a',...report}],rainfallSummaries:[{pixel:'cell',summary:'The seasonal outlook remains uncertain; review local water availability.',watchMonths:['2026-11'],actions:['verify_water']}]};
test('Gemini batch output must cover every requested location and reject truncated or invented output',async()=>{
 const options={key:'not-a-real-key',model:'test-model',fetcher:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(json)}]}}]})})};
 const result=await requestAnalysisBatch([input],options);expect(result.analyses[0].farmerSummary).toBe(report.farmerSummary);
 await expect(requestAnalysisBatch([input,{...input,survey:{id:'b'}}],options)).rejects.toThrow(/coverage/);
 await expect(requestAnalysisBatch([input],{...options,fetcher:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(json)}]}}]})})})).rejects.toThrow(/truncated/i);
});
test('saves each successful batch before a quota failure and resumes without regenerating current reports',async()=>{
 const plots=['a','b'].map(id=>({id,crop:'Bawang merah',rainfall:[{id:'2026-08',rain:10,pixel:'cell'}]}));
 const snapshot={fetchedAt:'2026-10-14',plots};let saved;let calls=0;
 const generate=async inputs=>{calls++;if(calls>=2)throw Object.assign(new Error('Quota exhausted'),{status:429});return {analyses:[{locationId:inputs[0].survey.id,...report}],rainfallSummaries:[]};};
 const first=await generateAnalyses({snapshot,key:'test',model:'test-model',referenceMonth:'2026-10',batchSize:1,generate,save:async value=>{saved=structuredClone(value)},wait:async()=>{},requestDelayMs:0});
 expect(Object.keys(saved.byPlot)).toEqual(['a']);expect(first.failed).toBe(true);
 const resumed=await generateAnalyses({snapshot,key:'test',model:'test-model',referenceMonth:'2026-10',batchSize:1,existing:saved,generate:async inputs=>({analyses:inputs.map(input=>({locationId:input.survey.id,...report})),rainfallSummaries:[]}),save:async value=>{saved=structuredClone(value)},wait:async()=>{},requestDelayMs:0});
 expect(resumed.completed).toBe(1);expect(Object.keys(saved.byPlot).sort()).toEqual(['a','b']);
 const current=structuredClone(saved);
 const cached=await generateAnalyses({snapshot,key:'test',model:'test-model',referenceMonth:'2026-10',existing:current,generate:async()=>{throw new Error('Current cache must not call Gemini');},save:async value=>{saved=structuredClone(value);}});
 expect(cached.completed).toBe(0);expect(saved).toEqual(current);
});

test('an invalid optional cache does not prevent fresh generation while real file errors still surface', async()=>{
 const {readCachedAnalysis}=await import('../../scripts/gemini-analysis.mjs');
 await expect(readCachedAnalysis(async()=>{throw new SyntaxError('Unexpected end of JSON input');})).resolves.toBeUndefined();
 await expect(readCachedAnalysis(async()=>({schemaVersion:1,byPlot:null,byPixel:{}}))).resolves.toBeUndefined();
 await expect(readCachedAnalysis(async()=>{throw Object.assign(new Error('Permission denied'),{code:'EACCES'});})).rejects.toThrow('Permission denied');
});

test('grounding repair changes only flagged fields and rejects edits outside the allowed targets',async()=>{
 const {repairAnalyses}=await import('../../scripts/gemini-analysis.mjs');
 const risky=structuredClone(report);risky.locationId='a';risky.crops[1].assessment='Well suited for local cultivation because modeled soil is favorable.';
 const correction='A potential candidate only; verify local soil, water and variety suitability before planting.';
 const fetcher=async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({patches:[{locationId:'a',path:'crops.1.assessment',text:correction}]})}]}}]})});
 const fixed=await repairAnalyses([input],[risky],{key:'test',model:'test-model',fetcher});
 expect(fixed[0].crops[1].assessment).toBe(correction);expect(fixed[0].farmerSummary).toBe(report.farmerSummary);
 expect(risky.crops[1].assessment).toContain('Well suited');
 await expect(repairAnalyses([input],[risky],{key:'test',model:'test-model',fetcher:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({patches:[{locationId:'a',path:'farmerSummary',text:correction}]})}]}}]})})})).rejects.toThrow(/target/);
});

test('a failed repair exposes validated records so the offline review can checkpoint them',async()=>{
 const {repairAnalyses}=await import('../../scripts/gemini-analysis.mjs');
 const risky=id=>({...structuredClone(report),locationId:id,crops:report.crops.map((crop,index)=>({...crop,assessment:index===1?'Well suited for local cultivation because modeled soil is favorable.':crop.assessment}))});
 const fetcher=async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({patches:[{locationId:'a',path:'crops.1.assessment',text:'A conditional candidate requiring field verification of water and soil.'},{locationId:'b',path:'crops.1.assessment',text:'Well suited for local cultivation because modeled soil is favorable.'}]})}]}}]})});
 let failure;try{await repairAnalyses([input,{...input,survey:{id:'b'}}],[risky('a'),risky('b')],{key:'test',model:'test-model',fetcher});}catch(error){failure=error;}
 expect(failure.validatedAnalyses.map(record=>record.locationId)).toEqual(['a']);
 expect(failure.rejected.map(record=>record.locationId)).toEqual(['b']);
});
