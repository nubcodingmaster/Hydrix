import type { SoilSample } from './agronomy';
import { analysisEvidence } from './ai';
import { cropLabel, projectionFor, type Plot, type Snapshot } from './live';
export type PlanKind = 'water' | 'pest' | 'soil';
export type PlanEvidence = { label: string; value: string; source: string; period?: string };
export type PlanItem = {
 id: string; plotId: string; location: string; district: string; crop: string;
 stage: 'verification' | 'confirmed'; kind: PlanKind; title: string; outlook: string;
 eventMonth: string | null; eventEndMonth?: string; actionMonth: string; action: string;
 evidence: PlanEvidence[]; basis: string; timingBasis: string; analysisProvider?: 'Gemini'; analysisModel?: string;
};
/** Pilot screening policy, not calibrated crop damage or assistance eligibility thresholds. */
export const planningPolicy = { ndviDrop: .15, ndviRelativeDrop: .3, previousNdvi: .3, validCoverage: .8, recentDays: 30, dryMonthMm: 100, dryRunMonths: 2, waterLeadMonths: 3, shallotMinPh: 5.6, shallotMaxPh: 6.5, lowCarbonGKg: 20 };
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
export const planningSources={
 rainfall:'https://www.bmkg.go.id/iklim/analisis-dinamika-atmosfer-dasarian-iii-juni-2020',
 shallot:'https://banten.brmp.pertanian.go.id/storage/assets/uploads/file/GeY2HQf382EJXVJsYRiE9ZwRfFwnHSw5fL8twqWy.pdf',
 carbon:'https://tanahpupuk.brmp.pertanian.go.id/berita/bpsi-tanah-dan-pupuk-hadir-dalam-webinar-standar-mutu-dan-mekanisme-pendaftaran-pupuk-organik',
 fertilizer:'https://sulteng.brmp.pertanian.go.id/berita/wabin-dilatih-cara-menentukan-dosis-pemupukan-spesifik-lokasi-untuk-komoditi-bawang-lokal-palu',
};
const surface=(sample:SoilSample|null|undefined,unit:string,max:number)=>{
 const value=sample?.depths.find(d=>d.depthCm===10)?.value;
 return sample?.unit===unit&&value!=null&&Number.isFinite(value)&&value>=0&&value<=max?value:null;
};
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
  const soil=snapshot.agronomy?.byPlot[plot.id],ph=surface(soil?.ph,'pH',14),carbon=surface(soil?.carbon,'g/kg',1275);
  const acidic=plot.crop==='Bawang merah'&&ph!=null&&ph<planningPolicy.shallotMinPh;
  const alkaline=plot.crop==='Bawang merah'&&ph!=null&&ph>planningPolicy.shallotMaxPh;
  const lowCarbon=carbon!=null&&carbon<planningPolicy.lowCarbonGKg;
  if(acidic||alkaline||lowCarbon){
   const signals=[acidic?`pH ${number(ph!)} is below the shallot review threshold of 5.6`:alkaline?`pH ${number(ph!)} is above the shallot reference range ending at 6.5`:null,lowCarbon?`organic carbon ${number(carbon!)} g/kg (${number(carbon!/10)}%) is below 20 g/kg (2%)`:null].filter(Boolean);
   const actions=['Provide soil testing and extension support for pH, N, P and K, soil class, crop variety and planting date before selecting fertilizer products and quantities.'];
   if(acidic)actions.push('If field testing confirms acidity, prepare dolomite or other liming support according to the soil-test recommendation; lime is a soil amendment, not NPK fertilizer.');
   if(alkaline)actions.push('Review nutrient availability with an agronomist; do not supply lime to raise this pH further.');
   if(lowCarbon)actions.push('If field testing confirms low organic carbon, prepare mature compost or suitable organic fertilizer support, with rate and quality checked locally.');
   actions.push('Do not infer an NPK deficiency or prescribe a fertilizer dose from pH, carbon or texture alone.');
   items.push({...base,id:`${plot.id}:soil:${currentMonth}`,stage:'verification',kind:'soil',title:acidic?'Prepare acidity correction & fertilizer assessment':lowCarbon?'Prepare organic soil support':'Review soil pH & fertilizer suitability',eventMonth:null,actionMonth:currentMonth,
    outlook:`Modeled soil at 10 cm: ${signals.join('; ')}. Historical regional estimates are screening context, not current field-test results.`,action:actions.join(' '),
    evidence:[...(acidic||alkaline?[{label:'Modeled soil pH · 10 cm',value:number(ph!),source:soil!.ph!.source,period:`${soil!.ph!.period.start} – ${soil!.ph!.period.end}`}]:[]),...(lowCarbon?[{label:'Modeled organic carbon · 10 cm',value:`${number(carbon!)} g/kg (${number(carbon!/10)}%)`,source:soil!.carbon!.source,period:`${soil!.carbon!.period.start} – ${soil!.carbon!.period.end}`}]:[]),{label:'Kementan shallot cultivation guidance',value:'Review liming below pH 5.6; verify the field first',source:planningSources.shallot},{label:'Site-specific fertilizer recommendation',value:'Use soil nutrient testing to select products and rates',source:planningSources.fertilizer},...(lowCarbon?[{label:'Organic carbon reference',value:'Low carbon screening below 2%; not a crop-specific dose',source:planningSources.carbon}]:[])],
    basis:'Soil support is targeted to modeled shallot pH outside 5.6–6.5 or organic carbon below 20 g/kg (2%). These regional proxies identify assessment priorities. Current soil nutrients and crop stage are not measured.',
    timingBasis:'Arrange soil sampling in the current month. Apply amendments or fertilizer only after verification and according to the actual planting schedule; no planting date is inferred.'});
  }
  const projection=projectionFor(plot,snapshot);
  if(!projection||!fresh(projection.issuedAt.slice(0,10),asOf,60))continue;
  const screened=[...new Map(projection.months.filter(month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month.id)&&month.id>=currentMonth).map(month=>[month.id,month])).values()].sort((a,b)=>a.id.localeCompare(b.id)).map(month=>{
   const valid=[month.rain,month.lower,month.upper].every(Number.isFinite)&&month.lower>=0&&month.lower<=month.rain&&month.rain<=month.upper;
   return {...month,signal:valid&&month.rain<planningPolicy.dryMonthMm};
  });
  for(let i=0;i<screened.length;i++){
   const first=screened[i];if(!first.signal)continue;
   const run=[first];
   while(i+1<screened.length&&screened[i+1].signal&&shiftMonth(screened[i].id,1)===screened[i+1].id)run.push(screened[++i]);
   if(run.length<planningPolicy.dryRunMonths)continue;
   const last=run.at(-1)!,preparation=shiftMonth(first.id,-planningPolicy.waterLeadMonths),actionMonth=preparation<currentMonth?currentMonth:preparation;
   if(!months.includes(actionMonth))continue;
   items.push({...base,id:`${plot.id}:water:${first.id}`,stage:'verification',kind:'water',title:'Prepare irrigation support for projected dry months',eventMonth:first.id,eventEndMonth:last.id,actionMonth,
    outlook:`Projected rainfall is below 100 mm/month from ${first.id} to ${last.id}: point estimates ${number(Math.min(...run.map(month=>month.rain)))}–${number(Math.max(...run.map(month=>month.rain)))} mm, intervals spanning ${number(Math.min(...run.map(month=>month.lower)))}–${number(Math.max(...run.map(month=>month.upper)))} mm. Model confidence: ${projection.confidence}. This is seasonal preparation, not a confirmed drought or measured irrigation deficit.`,
    action:`Prepare irrigation support before the projected dry period: inspect and repair channels, service shared pumps, and plan water storage or delivery where appropriate. Survey irrigation: ${plot.irrigation||'not recorded'}. Confirm active planting, actual water access and unmet demand before selecting recipients, equipment or water volumes. Recheck the projection before procurement.`,
    evidence:[...run.map(month=>({label:'Projected rainfall and interval',value:`${number(month.rain)} mm; ${number(month.lower)}–${number(month.upper)} mm`,source:rainfallSource,period:month.id})),{label:'Seasonal model confidence',value:`${projection.confidence}; historical test MAE ${number(projection.validation.maeMm)} mm/month`,source:rainfallSource,period:projection.issuedAt.slice(0,10)},{label:'Low monthly rainfall reference',value:'Below 100 mm/month; used here as a preparation screen',source:planningSources.rainfall},{label:'Historical irrigation survey',value:plot.irrigation||'Not recorded',source:plot.source,period:plot.surveyDate??'Not recorded'}],
    basis:'Readiness policy: at least two consecutive point projections below 100 mm/month create one preparation proposal per continuous dry run. Model confidence and uncertainty are disclosed, including low confidence. This is not an official BMKG season-onset or drought declaration. Shared pixels do not establish independent field-level water deficits.',
    timingBasis:'Prepare three months before the first projected dry month, clamped to the current month. This is an administrative preparation lead time; field verification determines actual allocation.'});
  }
 }
 let aiLocations=0;
 for(const plot of snapshot.plots){
  const analysis=snapshot.analysis?.referenceMonth===currentMonth?snapshot.analysis.byPlot[plot.id]:undefined;
  if(!analysis)continue;aiLocations++;
  for(const item of items.filter(item=>item.plotId===plot.id)){
   const evidenceKey=item.kind==='pest'?'vegetation':item.kind==='water'?'rainfall':'soil';
   const advice=analysis.support.find(support=>support.kind===item.kind&&support.evidence.includes(evidenceKey));
   if(!advice)continue;
   // Cached rainfall prose cannot assert unmeasured future hydrology.
   if(item.kind==='water'&&/\b(?:baseflow|streamflow|aquifer|water table|soil moisture|flows?)\b/i.test(advice.governmentAction))continue;
   item.action=item.kind==='pest'?`Verify the observed decline before implementing support. ${advice.governmentAction}`:`${item.action} Additional AI planning guidance, subject to the checks above: ${advice.governmentAction}`;
   item.evidence.push(...analysisEvidence(snapshot,plot,advice.evidence));
   item.analysisProvider='Gemini';item.analysisModel=analysis.model;
  }
 }
 items.sort((a,b)=>a.actionMonth.localeCompare(b.actionMonth)||a.location.localeCompare(b.location)||a.id.localeCompare(b.id));
 return {asOf,months,aiLocations,farmerGroupsLinked:false,items,version:'planning-v3',screenedLocations:snapshot.plots.length};
}
