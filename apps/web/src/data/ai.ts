import {validateSummary} from '../../scripts/gemini-summary.mjs';
import { buildAnalysisInput, fingerprint, isCurrentAnalysis, currentMonth, PROMPT_VERSION } from '../../scripts/analysis-contract.mjs';
import type { Snapshot } from './live';
export type AISupport = { kind: 'water' | 'soil' | 'pest'; reason: string; farmerAction: string; governmentAction: string; evidence: string[] };
export type AIAnalysis = { provider: 'Gemini'; model: string; generatedAt: string; inputHash: string; promptVersion: string; farmerSummary: string; governmentSummary: string; crops: {cropId:string;assessment:string}[]; support: AISupport[] };
export type AnalysisSnapshot = { model: string; referenceMonth: string; byPlot: Record<string, AIAnalysis> };
/** Only matching inputs may be presented as live AI analysis; partial coverage remains explicit. */
export async function attachAnalysis(snapshot: Snapshot, raw: unknown, referenceMonth = currentMonth()) {
 delete snapshot.analysis;
 const data = raw as {schemaVersion?:number;baseFetchedAt?:string;referenceMonth?:string;model?:string;byPlot?:Record<string,AIAnalysis>;byPixel?:Record<string,NonNullable<NonNullable<Snapshot['projections']>['byPixel'][string]['aiSummary']> & {inputHash:string;promptVersion:string}>} | undefined;
 // Old inline summaries have no fact hash and must not be shown as current AI.
 for (const projection of Object.values(snapshot.projections?.byPixel ?? {})) delete projection.aiSummary;
 if (!data || data.schemaVersion !== 1 || data.baseFetchedAt !== snapshot.fetchedAt || data.referenceMonth !== referenceMonth || typeof data.model !== 'string') return;
 const byPlot: Record<string,AIAnalysis> = {};
 await Promise.all(snapshot.plots.map(async plot => {
  const input = buildAnalysisInput(snapshot,plot,referenceMonth);
  const record = data.byPlot?.[plot.id];
  if (record && isCurrentAnalysis(record,await fingerprint(input),data.model!)) byPlot[plot.id] = record;
  const projection = snapshot.projections?.byPixel[plot.rainfall.at(-1)?.pixel ?? ''];
  const summary = projection && data.byPixel?.[projection.pixel];
  if (projection && summary?.provider === 'Gemini' && summary.model === data.model && summary.promptVersion === PROMPT_VERSION && summary.inputHash === await fingerprint({promptVersion:PROMPT_VERSION,referenceMonth,rainfall:input.rainfall})) {
   try { validateSummary(summary,projection.months); projection.aiSummary=summary; } catch { /* Invalid model output is never attached to the UI. */ }
  }
 }));
 snapshot.analysis = {model:data.model,referenceMonth,byPlot};
}

/** Resolve model-selected evidence IDs to the actual public values and observation periods. */
export function analysisEvidence(snapshot: Snapshot, plot: Snapshot['plots'][number], keys: string[]) {
 const result: {label:string;value:string;source:string;period?:string}[]=[];
 const agronomy=snapshot.agronomy?.byPlot[plot.id];
 const projection=snapshot.projections?.byPixel[plot.rainfall.at(-1)?.pixel??''];
 const period=(value:{start:string;end:string})=>`${value.start} – ${value.end}`;
 const number=(value:number|null|undefined)=>value==null?'Unavailable':value.toLocaleString('en-US',{maximumFractionDigits:2});
 for(const key of keys){
  if(key==='survey')result.push({label:'Historical land survey',value:`${plot.crop}; irrigation: ${plot.irrigation??'not recorded'}`,source:plot.source,period:plot.surveyDate??'Date not recorded'});
  if(key==='rainfall')result.push({label:'CHIRPS seasonal model',value:projection?`${projection.training.observations} observed months; confidence ${projection.confidence}; test MAE ${projection.validation.maeMm} mm/month`:'Projection unavailable',source:'https://coastwatch.pfeg.noaa.gov/erddap/info/chirps20GlobalMonthlyP05/index.html',period:projection?`${projection.training.start} – ${projection.training.end}`:undefined});
  if(key==='soil'){
   let available=false;
   for(const [name,sample] of [['Modeled soil pH',agronomy?.ph],['Modeled organic carbon',agronomy?.carbon],['Modeled soil texture',agronomy?.texture]] as const){
    if(!sample)continue;available=true;const depth=sample.depths.find(depth=>depth.depthCm===10);
    result.push({label:`${name} · 10 cm`,value:depth?.label??`${number(depth?.value)} ${sample.unit}`,source:sample.source,period:period(sample.period)});
   }
   if(!available)result.push({label:'Soil evidence missing',value:'No matching soil estimates; field verification required',source:'https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_PH-H2O_USDA-4C1A2A_M_v02'});
  }
  if(key==='weather'){
   const sample=agronomy?.weather;
   result.push({label:'Reanalysis weather',value:sample?`${number(sample.temperatureC)} °C; ${number(sample.relativeHumidityPct)}% RH; ${number(sample.hourlyCoverage*100)}% coverage`:'Unavailable',source:sample?.source??'https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_HOURLY',period:sample?period(sample.period):undefined});
  }
  if(key==='vegetation'){
   const sample=agronomy?.vegetation;
   result.push({label:'Cloud-masked NDVI',value:sample?`${number(sample.ndvi)}; previous ${number(sample.previousNdvi)}; ${number(sample.validCoverage==null?null:sample.validCoverage*100)}% valid coverage`:'Unavailable',source:sample?.source??'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED',period:sample?period(sample.period):undefined});
  }
  if(key==='water'){
   const environment=snapshot.environment?.byPlot[plot.id];let available=false;
   for(const [name,sample] of [['Actual ET',environment?.aeti],['Reference ET',environment?.ret]] as const){
    if(!sample)continue;available=true;result.push({label:name,value:`${number(sample.value)} ${sample.unit}`,source:sample.source,period:period(sample.period)});
   }
   if(environment?.cropland)result.push({label:'WorldCereal historical crop classification',value:`Class ${number(environment.cropland.classification)}; ${number(environment.cropland.confidence)}% confidence; historical land-cover context only`,source:environment.cropland.source,period:String(environment.cropland.year)});
   if(!available)result.push({label:'Water evidence missing',value:'ET context unavailable; current irrigation capacity is unmeasured',source:'https://data.apps.fao.org/wapor/'});
  }
 }
 return result;
}
