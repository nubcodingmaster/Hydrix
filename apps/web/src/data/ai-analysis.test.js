import { test, expect } from 'vitest';
import { buildAnalysisInput, fingerprint, validateAnalysis, isCurrentAnalysis } from '../../scripts/analysis-contract.mjs';
const plot={id:'field-a',name:'Field A',crop:'Bawang merah',irrigation:null,surveyDate:'2019-07-01',rainfall:[{id:'2026-08',rain:20,pixel:'cell'}]};
const snapshot={fetchedAt:'2026-10-14',plots:[plot],projections:{byPixel:{cell:{issuedAt:'2026-10-14',confidence:'low',history:Array.from({length:24},(_,i)=>({id:`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,rain:100})),months:[{id:'2026-11',rain:100,lower:0,upper:200}],training:{},validation:{}}}},agronomy:{byPlot:{'field-a':{ph:null,carbon:null,texture:null,weather:null,vegetation:null}}}};
const valid=()=>({farmerSummary:'Review seasonal uncertainty with your extension adviser.',governmentSummary:'Coordinate a review of water and soil evidence before support.',crops:['0','1','2'].map(cropId=>({cropId,assessment:'Check local suitability with an extension adviser.'})),support:['water','soil','pest'].map(kind=>({kind,reason:'Available regional evidence requires local verification.',farmerAction:'Review the available evidence with an extension adviser.',governmentAction:'Prepare verification support before allocating resources.',evidence:['survey']}))});
test('cache invalidates when the field evidence, month, model or prompt changes',async()=>{
 const input=buildAnalysisInput(snapshot,plot,'2026-10');const hash=await fingerprint(input);
 const result={...valid(),provider:'Gemini',model:'configured-model',inputHash:hash,generatedAt:'2026-10-18T00:00:00Z',promptVersion:input.promptVersion};
 expect(isCurrentAnalysis(result,hash,'configured-model')).toBe(true);
 expect(isCurrentAnalysis(result,hash,'another-model')).toBe(false);
 expect(await fingerprint(buildAnalysisInput(snapshot,{...plot,irrigation:'IrigasiTeknis'},'2026-10'))).not.toBe(hash);
 expect(await fingerprint(buildAnalysisInput(snapshot,plot,'2026-11'))).not.toBe(hash);
 expect(isCurrentAnalysis({...result,promptVersion:'old'},hash,'configured-model')).toBe(false);
 expect(await fingerprint({b:2,a:1})).toBe(await fingerprint({a:1,b:2}));
});
test('input includes observed data, uncertainty and computed rainfall comparison without exposing coordinates',()=>{
 const input=buildAnalysisInput(snapshot,{...plot,center:[108,-6],geometry:{coordinates:[]}},'2026-10');
 expect(input.rainfall.months[0].anomaly.signal).toBe('uncertain');
 expect(input.rainfall.climatology[10].medianMm).toBe(100);
 expect(input.agronomy.ph).toBeNull();expect(JSON.stringify(input)).not.toMatch(/coordinates|center/);
});
test('rejects incomplete coverage, invented quantities and unknown evidence in model output',()=>{
 const input=buildAnalysisInput(snapshot,plot,'2026-10');expect(validateAnalysis(valid(),input).support).toHaveLength(3);
 expect(()=>validateAnalysis({...valid(),crops:valid().crops.slice(1)},input)).toThrow();
 expect(()=>validateAnalysis({...valid(),farmerSummary:'Use 50 kg fertilizer per hectare.'},input)).toThrow();
 const unsupported=valid();unsupported.support[0].evidence=['invented-source'];expect(()=>validateAnalysis(unsupported,input)).toThrow();
 const duplicate=valid();duplicate.support[2].kind='soil';expect(()=>validateAnalysis(duplicate,input)).toThrow();
});

test('browser attaches matching analyses and hides stale results after a source change',async()=>{
 const {attachAnalysis}=await import('./ai');
 const data=structuredClone(snapshot);const input=buildAnalysisInput(data,plot,'2026-10');
 const raw={schemaVersion:1,baseFetchedAt:data.fetchedAt,referenceMonth:'2026-10',model:'configured-model',byPlot:{'field-a':{...valid(),provider:'Gemini',model:'configured-model',promptVersion:input.promptVersion,inputHash:await fingerprint(input),generatedAt:'2026-10-18T00:00:00Z'}},byPixel:{}};
 await attachAnalysis(data,raw,'2026-10');expect(data.analysis.byPlot['field-a'].farmerSummary).toContain('seasonal uncertainty');
 await attachAnalysis(data,undefined,'2026-10');expect(data.analysis).toBeUndefined();
 const changed=structuredClone(snapshot);changed.plots[0].irrigation='IrigasiTeknis';
 await attachAnalysis(changed,raw,'2026-10');expect(changed.analysis.byPlot['field-a']).toBeUndefined();
});

test('rejects unsupported crop certainty, NDVI causes and future flow or ET claims',async()=>{
 const {groundingIssues}=await import('../../scripts/analysis-contract.mjs');
 const crop=valid();crop.crops[1].assessment='Well suited for local cultivation because modeled soil is favorable.';
 expect(groundingIssues(crop)).not.toHaveLength(0);
 const cause=valid();cause.farmerSummary='Vegetation index has dropped significantly, indicating land clearing or harvesting in recent weeks.';
 expect(groundingIssues(cause)).not.toHaveLength(0);
 const flow=valid();flow.support[0].reason='Seasonal flow diminishes severely in the driest quarter.';
 expect(groundingIssues(flow)).not.toHaveLength(0);
 const et=valid();et.support[0].reason='Moderate evapotranspiration persists even as rainfall contracts.';
 expect(groundingIssues(et)).not.toHaveLength(0);
 const cautious=valid();cautious.farmerSummary='Vegetation decline may reflect harvest or water stress; verify the cause through field scouting.';
 expect(groundingIssues(cautious)).toHaveLength(0);
 for(const text of ['Prepare before shallow supplies dry out.', 'Schedule readiness ahead of seasonal stream drops.', 'Act before streamflow reaches annual minimums.', 'Prepare before stream flows ebb.', 'Low greenness points to fallow ground or post-harvest status.', 'Scout the field weekly for pest damage.']){
  expect(groundingIssues({farmerSummary:text}),text).not.toHaveLength(0);
 }
 expect(groundingIssues({farmerSummary:'Inspect local stream diversions before the lowest-rainfall window.'})).toHaveLength(0);
 cautious.farmerSummary='Conduct field diagnostics to assess whether canopy drop reflects harvest, moisture stress, or vegetative phenology.';
 expect(groundingIssues(cautious)).toHaveLength(0);
});
