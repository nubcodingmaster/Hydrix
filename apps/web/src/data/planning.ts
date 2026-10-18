import { analysisEvidence } from './ai';
import { cropLabel, projectionFor, type Plot, type Snapshot } from './live';
export type PlanKind = 'water' | 'pest' | 'soil';
export type PlanEvidence = { label: string; value: string; source: string; period?: string };
export type PlanItem = {
 id: string; plotId: string; location: string; district: string; crop: string;
 stage: 'verification' | 'confirmed'; kind: PlanKind; title: string; outlook: string;
 eventMonth: string | null; actionMonth: string; action: string;
 evidence: PlanEvidence[]; basis: string; timingBasis: string; analysisProvider?: 'Gemini'; analysisModel?: string;
};
/** Pilot screening policy, not calibrated crop damage or assistance eligibility thresholds. */
export const planningPolicy = { ndviDrop: .15, ndviRelativeDrop: .3, previousNdvi: .3, validCoverage: .8, recentDays: 30, rainfallFraction: .8, historicalYears: 20 };
export function planningDate(date: Date) {
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
const index=(month:string)=>Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
export function shiftMonth(month:string,count:number) {
 const value=index(month)+count;return `${Math.floor(value/12)}-${String(((value%12)+12)%12+1).padStart(2,'0')}`;
}
const number=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:2});
const fresh=(end:string,today:string,days:number)=>{const age=(Date.parse(today)-Date.parse(end))/86400000;return Number.isFinite(age)&&age>=0&&age<=days;};
const context=(plot:Plot)=>({plotId:plot.id,location:plot.name,district:plot.district,crop:cropLabel(plot.crop)});
const rainfallSource='https://chc.ucsb.edu/data/chirps';
/** Only qualifying evidence creates a field check. Connected APIs do not verify aid need or recipients. */
export function buildPlanning(snapshot:Snapshot,referenceDate=new Date()) {
 const asOf=planningDate(referenceDate),currentMonth=asOf.slice(0,7);
 const months=Array.from({length:12},(_,i)=>shiftMonth(currentMonth,i));
 const items:PlanItem[]=[];
 for(const plot of snapshot.plots){
  const base=context(plot),vegetation=snapshot.agronomy?.byPlot[plot.id]?.vegetation;
  if(vegetation){
   const {ndvi,previousNdvi,validCoverage,previousValidCoverage,meanObservations,period,previousPeriod}=vegetation;
   const duration=(Date.parse(period.end)-Date.parse(period.start))/86400000;
   const previousDuration=(Date.parse(previousPeriod.end)-Date.parse(previousPeriod.start))/86400000;
   const comparable=duration>0&&previousDuration>0&&duration/previousDuration>=.5&&duration/previousDuration<=2&&previousPeriod.end<period.start&&fresh(previousPeriod.end,asOf,90);
   if(ndvi!=null&&previousNdvi!=null&&Number.isFinite(ndvi)&&Number.isFinite(previousNdvi)&&previousNdvi>=planningPolicy.previousNdvi&&ndvi>=-1&&ndvi<=1&&previousNdvi<=1&&previousNdvi-ndvi>=planningPolicy.ndviDrop&&(previousNdvi-ndvi)/previousNdvi>=planningPolicy.ndviRelativeDrop&&validCoverage!=null&&Number.isFinite(validCoverage)&&validCoverage>=planningPolicy.validCoverage&&validCoverage<=1&&previousValidCoverage!=null&&Number.isFinite(previousValidCoverage)&&previousValidCoverage>=planningPolicy.validCoverage&&previousValidCoverage<=1&&meanObservations!=null&&Number.isFinite(meanObservations)&&meanObservations>=3&&vegetation.minimumObservations===3&&fresh(period.end,asOf,planningPolicy.recentDays)&&comparable){
    items.push({...base,id:`${plot.id}:vegetation:${period.end}`,stage:'verification',kind:'pest',title:'Verify vegetation decline',eventMonth:null,actionMonth:currentMonth,
     outlook:`NDVI fell from ${number(previousNdvi)} to ${number(ndvi)} (${number((previousNdvi-ndvi)/previousNdvi*100)}%). This change does not establish pest damage, drought or a need for inputs.`,
     action:'Ask extension staff to inspect crop stage, harvest activity, water access and visible damage before deciding whether any assistance is needed.',
     evidence:[{label:'Current NDVI',value:number(ndvi),source:vegetation.source,period:`${period.start} – ${period.end}`},{label:'Previous NDVI',value:number(previousNdvi),source:vegetation.source,period:`${previousPeriod.start} – ${previousPeriod.end}`},{label:'Valid coverage, current / previous',value:`${number(validCoverage*100)}% / ${number(previousValidCoverage*100)}%`,source:vegetation.source}],
     basis:'Pilot vegetation screening: absolute NDVI decline at least 0.15 and relative decline at least 30%, previous NDVI at least 0.3, both windows at least 80% valid coverage, minimum three observations. These are review thresholds, not validated crop-loss thresholds.',
     timingBasis:'Check in the current month because the observation is no older than thirty days. No future pest outbreak month is inferred.'});
   }
  }
  const projection=projectionFor(plot,snapshot);
  if(!projection||!['medium','high'].includes(projection.confidence)||!fresh(projection.issuedAt.slice(0,10),asOf,60))continue;
  const screened=projection.months.filter(month=>month.id>=currentMonth).sort((a,b)=>a.id.localeCompare(b.id)).map(month=>{
   const historical=new Map((projection.history??[]).filter(row=>row.id<projection.issuedAt.slice(0,7)&&row.id.slice(5)===month.id.slice(5)&&row.rain!=null&&Number.isFinite(row.rain)&&row.rain>=0).map(row=>[row.id,row.rain!]));
   const values=[...historical.values()].sort((a,b)=>a-b),middle=Math.floor(values.length/2);
   const median=values.length?(values.length%2?values[middle]:(values[middle-1]+values[middle])/2):0;
   const valid=values.length>=planningPolicy.historicalYears&&median>0&&[month.rain,month.lower,month.upper].every(Number.isFinite)&&month.lower>=0&&month.lower<=month.rain&&month.rain<=month.upper;
   return {...month,median,signal:valid&&month.upper<median*planningPolicy.rainfallFraction};
  });
  for(let i=0;i<screened.length-1;i++){
   const first=screened[i],next=screened[i+1];
   if(!first.signal||!next.signal||shiftMonth(first.id,1)!==next.id||(i>0&&screened[i-1].signal&&shiftMonth(screened[i-1].id,1)===first.id))continue;
   const preparation=shiftMonth(first.id,-3),actionMonth=preparation<currentMonth?currentMonth:preparation;
   if(!months.includes(actionMonth))continue;
   items.push({...base,id:`${plot.id}:water:${first.id}`,stage:'verification',kind:'water',title:'Verify seasonal water readiness',eventMonth:first.id,actionMonth,
    outlook:`The entire rainfall interval is below 80% of the same-month historical median in ${first.id} and ${next.id}. Current irrigation capacity and crop water demand are unmeasured.`,
    action:'Verify active cropping, water sources and irrigation delivery before proposing targeted water support. Do not infer drought damage or infrastructure recipients from rainfall alone.',
    evidence:[first,next].flatMap(month=>[{label:'Rainfall interval',value:`${number(month.lower)}–${number(month.upper)} mm`,source:rainfallSource,period:month.id},{label:'Historical same-month median',value:`${number(month.median)} mm`,source:rainfallSource,period:month.id}]),
    basis:'Pilot rainfall screening: at least twenty historical same-month observations, medium or high model confidence, and two consecutive intervals entirely below eighty percent of their historical medians. Shared rainfall pixels are not independent field observations. This is not an official drought warning.',
    timingBasis:'Suggested readiness review three months before the first qualifying month, clamped to the current month. This is an administrative lead time, not a forecast of crop damage.'});
  }
 }
 let aiLocations=0;
 for(const plot of snapshot.plots){
  const analysis=snapshot.analysis?.referenceMonth===currentMonth?snapshot.analysis.byPlot[plot.id]:undefined;
  if(!analysis)continue;aiLocations++;
  // Cached water advice targets the old lowest-rainfall policy, so it cannot supply a new anomaly-specific action.
  for(const item of items.filter(item=>item.plotId===plot.id&&item.kind==='pest')){
   const advice=analysis.support.find(support=>support.kind==='pest'&&support.evidence.includes('vegetation'));
   if(!advice)continue;
   item.action=`Verify the observed decline before implementing support. ${advice.governmentAction}`;
   item.evidence.push(...analysisEvidence(snapshot,plot,advice.evidence));
   item.analysisProvider='Gemini';item.analysisModel=analysis.model;
  }
 }
 items.sort((a,b)=>a.actionMonth.localeCompare(b.actionMonth)||a.location.localeCompare(b.location)||a.id.localeCompare(b.id));
 return {asOf,months,aiLocations,farmerGroupsLinked:false,items,version:'planning-v2',screenedLocations:snapshot.plots.length};
}
