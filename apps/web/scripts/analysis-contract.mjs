/** Shared by the offline generator and browser: facts, validation and cache identity. */
import {planningPolicy,shiftMonth,dryRuns} from '../src/data/planning-policy.mjs';
export const PROMPT_VERSION = 'hydrix-gemini-analysis-v3';
export const EVIDENCE_KEYS = ['survey', 'rainfall', 'soil', 'weather', 'vegetation', 'water'];
export const currentMonth = () => new Intl.DateTimeFormat('sv-SE', {year:'numeric',month:'2-digit',timeZone:'Asia/Makassar'}).format(new Date());
const rounded = value => Math.round(value * 10) / 10;
const canonical = value => value === null || typeof value !== 'object' ? value : Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
export async function fingerprint(value) {
 const bytes = await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));
 return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2,'0')).join('');
}
function rainfallFacts(projection) {
 if (!projection) return null;
 const climatology = Array.from({length:12},(_,index)=>{
  const values=(projection.history??[]).filter(row=>Number(row.id.slice(5))===index+1&&Number.isFinite(row.rain)&&row.rain>=0).map(row=>row.rain).sort((a,b)=>a-b);
  const middle=Math.floor(values.length/2);
  return {month:index+1,observations:values.length,medianMm:values.length?rounded(values.length%2?values[middle]:(values[middle-1]+values[middle])/2):null};
 });
 const months=projection.months.map(month=>{
  const normal=climatology[Number(month.id.slice(5))-1];
  const valid=normal?.observations>=20&&normal.medianMm>0&&[month.rain,month.lower,month.upper].every(Number.isFinite)&&month.lower<=month.rain&&month.rain<=month.upper;
  const deviation=valid?(month.rain-normal.medianMm)/normal.medianMm*100:null;
  return {...month,anomaly:{status:!valid?'insufficient-data':deviation < -20?'below-normal':deviation > 20?'above-normal':'near-normal',deviationPercent:valid?rounded(deviation):null,signal:!valid?'uncertain':month.upper<normal.medianMm*.8?'below-normal':month.lower>normal.medianMm*1.2?'above-normal':'uncertain'}};
 });
 return {pixel:projection.pixel,issuedAt:projection.issuedAt,confidence:projection.confidence,training:projection.training,validation:projection.validation,months,climatology,anomalyMethod:'Experimental comparison with historical same-month median at ±20%; signal requires the entire projection interval outside the threshold. Not an official warning.'};
}
function sample(value) {
 if (!value) return null;
 const keys=['dataset','source','period','resolutionMeters','kind','unit','depths','temperatureC','relativeHumidityPct','hours','expectedHours','hourlyCoverage','forecast','ndvi','previousNdvi','validCoverage','previousValidCoverage','meanObservations','minimumObservations','previousPeriod','value','resolutionDegrees','year','classification','confidence'];
 return Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
}
export function buildAnalysisInput(snapshot, plot, referenceMonth=currentMonth()) {
 const pixel=plot.rainfall.at(-1)?.pixel;
 const agronomy=snapshot.agronomy?.byPlot[plot.id];
 const environment=snapshot.environment?.byPlot[plot.id];
 const rainfall=rainfallFacts(snapshot.projections?.byPixel[pixel]);
 const dryRun=dryRuns(rainfall,referenceMonth)[0];
 const preparation=dryRun?shiftMonth(dryRun[0].id,-planningPolicy.waterLeadMonths):null;
 return {
  promptVersion:PROMPT_VERSION, referenceMonth, baseFetchedAt:snapshot.fetchedAt,
  survey:Object.fromEntries(['id','name','district','village','crop','surveyDate','irrigation'].map(key=>[key,plot[key]??null])),
  rainfall,
  planning:{waterWindow:dryRun?.[0].id??null,waterWindowEnd:dryRun?.at(-1).id??null,waterPrepareBy:preparation?(preparation<referenceMonth?referenceMonth:preparation):null,waterPolicy:{dryMonthMm:planningPolicy.dryMonthMm,consecutiveMonths:planningPolicy.dryRunMonths,leadMonths:planningPolicy.waterLeadMonths,lowConfidenceIncluded:true},soilReviewSlot:referenceMonth,soilPolicy:{shallotMinPh:planningPolicy.shallotMinPh,shallotMaxPh:planningPolicy.shallotMaxPh,lowCarbonGKg:planningPolicy.lowCarbonGKg},pestOutbreakMonth:null,note:'Calendar slots are administrative preparation assumptions. Water readiness uses consecutive projected dry months, not a confirmed water deficit. Soil allocation needs current testing.'},
  latestRainfall:plot.rainfall.map(({id,rain})=>({id,rain})),
  agronomy:Object.fromEntries(['ph','carbon','texture','weather','vegetation'].map(key=>[key,sample(agronomy?.[key])])),
  water:Object.fromEntries(['aeti','ret','cropland'].map(key=>[key,sample(environment?.[key])])),
  candidates:['Bawang merah','Bawang daun','Bawang putih'].map((name,index)=>({cropId:String(index),name,historicalSurveyCount:snapshot.plots.filter(p=>p.crop===name).length,testRecordsExcluded:name==='Bawang putih'})),
 };
}
export const isSafeAIText=(value,min=15,max=1000)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!/\d/.test(value)&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)&&!/(?:ignore|disregard)\s+(?:all\s+)?(?:previous|system)\s+instructions/i.test(value);
export function validateAnalysis(value, input) {
 const text=isSafeAIText;
 if(!value||!text(value.farmerSummary)||!text(value.governmentSummary))throw new Error('Invalid AI audience summary');
 if(!Array.isArray(value.crops)||value.crops.length!==3||new Set(value.crops.map(c=>c.cropId)).size!==3||!value.crops.every(c=>['0','1','2'].includes(c.cropId)&&text(c.assessment)))throw new Error('Invalid AI crop coverage');
 if(!Array.isArray(value.support)||value.support.length!==3||new Set(value.support.map(s=>s.kind)).size!==3||!value.support.every(s=>['water','soil','pest'].includes(s.kind)&&text(s.reason)&&text(s.farmerAction)&&text(s.governmentAction)&&Array.isArray(s.evidence)&&s.evidence.length>0&&s.evidence.every(key=>EVIDENCE_KEYS.includes(key))))throw new Error('Invalid AI support evidence');
 const issues=groundingIssues(value);
 if(issues.length){const error=new Error('Unsupported AI claims');error.issues=issues;throw error;}
 // Return only known fields; never let model metadata override trusted provenance.
 return {farmerSummary:value.farmerSummary,governmentSummary:value.governmentSummary,crops:value.crops.map(({cropId,assessment})=>({cropId,assessment})),support:value.support.map(({kind,reason,farmerAction,governmentAction,evidence})=>({kind,reason,farmerAction,governmentAction,evidence:[...new Set(evidence)]}))};
}
export function isCurrentAnalysis(value,inputHash,model) {
 if(!value||value.provider!=='Gemini'||value.model!==model||value.inputHash!==inputHash||value.promptVersion!==PROMPT_VERSION||!Number.isFinite(Date.parse(value.generatedAt)))return false;
 try {validateAnalysis(value);return true;} catch{return false;}
}

export function groundingIssues(value) {
 const issues=[];
 const conditional=/\b(may|might|could|potential|conditionally|conditional|pending|unconfirmed|uncertain|not|cannot|unknown|unmeasured)\b/i;
 for(const crop of value?.crops??[]){
  for(const sentence of String(crop.assessment??'').split(/(?<=[.!?])\s+/)){
   if(/\b(well[ -]suited|suitable for|suited for|suited to|ideal for)\b/i.test(sentence)&&!conditional.test(sentence))issues.push(`crop ${crop.cropId}: suitability cannot be established from regional evidence; describe a conditional candidate requiring field verification`);
  }
 }
 const texts=[value?.farmerSummary,value?.governmentSummary,...(value?.support??[]).flatMap(s=>[s.reason,s.farmerAction,s.governmentAction]),...(value?.crops??[]).map(c=>c.assessment)].filter(text=>typeof text==='string');
 for(const text of texts)for(const sentence of text.split(/(?<=[.!?])\s+/)){
  if(/\b(well[ -]suited|suitable for|suited for|suited to|ideal for)\b/i.test(sentence)&&!conditional.test(sentence))issues.push('Crop suitability is unconfirmed; describe a conditional candidate requiring field verification');
  if(/\b(indicat\w*|reflect\w*|points? to|due to|caused by|confirm\w*|because)\b/i.test(sentence)&&/\b(harvest\w*|land clearing|infestation|pest outbreak)\b/i.test(sentence)&&!conditional.test(sentence)&&!/\b(assess|confirm|check|verify|determine)\s+whether\b/i.test(sentence))issues.push('NDVI does not establish harvest, clearing or pest cause; present possible causes and require field scouting');
  if(/\b(seasonal (?:flow|stream drops|low flows)|(?:baseflow|streamflow|stream flows?|stream levels?)\s+(?:drops?|declines?|diminish\w*|ebb\w*|reaches annual minimums)|shallow supplies dry out|flow (?:diminishes|declines|increases)|water supply (?:diminishes|declines)|evapotranspiration.{0,60}(?:persists|will|continues|rises|falls|contracts))\b/i.test(sentence)&&!conditional.test(sentence))issues.push('No seasonal irrigation-flow or future evapotranspiration series is supplied; use dated observations and rainfall uncertainty only');
 }
 if(texts.some(text=>/\b(?:scout\w*|check(?:ing)? (?:plant|crop|field)|field walks?|crop inspections?|crop health checks?)\b[^.!?]*\b(?:weekly|daily)\b|\b(?:weekly|daily)\b[^.!?]*\b(?:field walks?|crop inspections?|crop health checks?)\b/i.test(text)))issues.push('No calibrated scouting schedule is supplied; recommend field scouting without a fixed daily or weekly frequency');
 return [...new Set(issues)];
}
