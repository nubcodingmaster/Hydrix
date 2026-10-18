import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlanning, shiftMonth } from './planning';
import type { Snapshot } from './live';
const read = (file: string) => JSON.parse(readFileSync(new URL(`../../public/data/${file}.json`, import.meta.url), 'utf8'));
const real = { ...read('majalengka'), projections: read('projections'), agronomy: read('agronomy'), environment: read('environment') } as Snapshot;
const date = new Date('2026-10-18T00:00:00Z');
function fixture() {
 const data=structuredClone(real);data.plots=data.plots.slice(0,1);const plot=data.plots[0];
 const projection=data.projections!.byPixel[plot.rainfall.at(-1)!.pixel!];
 projection.confidence='medium';projection.issuedAt='2026-10-15';
 projection.history=Array.from({length:240},(_,i)=>({id:`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,rain:100}));
 projection.months=Array.from({length:12},(_,i)=>({id:shiftMonth('2026-11',i),rain:100,lower:60,upper:140}));
 const vegetation=data.agronomy!.byPlot[plot.id].vegetation!;
 Object.assign(vegetation,{ndvi:.6,previousNdvi:.65,validCoverage:1,previousValidCoverage:1,meanObservations:5,minimumObservations:3,period:{start:'2026-09-15',end:'2026-10-14'},previousPeriod:{start:'2026-08-16',end:'2026-09-14'}});
 return {data,plot,projection,vegetation};
}
describe('evidence-gated monthly planning',()=>{
 it('does not generate assistance merely because weather, soil or a seasonal low is available',()=>{
  const {data}=fixture();const plan=buildPlanning(data,date);
  expect(plan.items).toHaveLength(0);
 });
 it('screens the real snapshot without manufacturing three proposals per location or confirmed recipients',()=>{
  const plan=buildPlanning(real,date);
  expect(plan.items.length).toBeLessThan(real.plots.length*3);
  expect(plan.items.some(item=>item.kind==='water')).toBe(true);
  expect(plan.items.some(item=>item.kind==='soil')).toBe(true);
  expect(plan.items.every(item=>item.stage==='verification')).toBe(true);
  expect(plan.items.filter(item=>item.stage==='confirmed')).toHaveLength(0);
  expect(plan.farmerGroupsLinked).toBe(false);
 });
 it('routes a substantial recent canopy decline to field verification, never a pest diagnosis',()=>{
  const {data,vegetation}=fixture();vegetation.ndvi=.3;
  const plan=buildPlanning(data,date);expect(plan.items).toHaveLength(1);
  expect(plan.items[0]).toMatchObject({kind:'pest',stage:'verification',actionMonth:'2026-10',eventMonth:null});
  expect(plan.items[0].outlook).toContain('0.65');expect(plan.items[0].outlook).toContain('0.3');
  expect(plan.items[0].basis).toContain('screening');
 });
 it('rejects stale, future, cloudy, low-observation or overlapping NDVI windows',()=>{
  for(const change of [{validCoverage:.5},{validCoverage:Infinity},{previousValidCoverage:null},{meanObservations:2},{meanObservations:Infinity},{period:{start:'2026-05-01',end:'2026-05-30'}},{period:{start:'2026-10-19',end:'2026-10-30'}},{previousPeriod:{start:'2026-09-01',end:'2026-10-01'}}]){
   const {data,vegetation}=fixture();Object.assign(vegetation,{ndvi:.3},change);
   expect(buildPlanning(data,date).items,JSON.stringify(change)).toHaveLength(0);
  }
 });
 it('plans irrigation support before consecutive low-rainfall months even with low confidence',()=>{
  const {data,projection}=fixture();projection.confidence='low';
  Object.assign(projection.months[6],{rain:90,lower:0,upper:200});
  Object.assign(projection.months[7],{rain:70,lower:0,upper:180});
  const water=buildPlanning(data,date).items.filter(item=>item.kind==='water');
  expect(water).toHaveLength(1);expect(water[0]).toMatchObject({eventMonth:'2027-05',eventEndMonth:'2027-06',actionMonth:'2027-02',stage:'verification'});
  expect(water[0].outlook).toContain('low');expect(water[0].action).toContain('irrigation support');
  expect(water[0].outlook).toContain('200');
 });
 it('does not multiply one dry run into monthly proposals, and separates later runs',()=>{
  const {data,projection}=fixture();
  for(const i of [0,1,2,5,6])Object.assign(projection.months[i],{rain:40,lower:0,upper:150});
  expect(buildPlanning(data,date).items.filter(item=>item.kind==='water').map(item=>item.eventMonth)).toEqual(['2026-11','2027-04']);
 });
 it('includes late rainfall events when their preparation date is inside the horizon',()=>{
  const {data,projection}=fixture();
  for(const month of projection.months.slice(-2))Object.assign(month,{rain:10,lower:0,upper:120});
  expect(buildPlanning(data,date).items[0]).toMatchObject({eventMonth:'2027-09',actionMonth:'2027-06'});
 });
 it('rejects isolated, nonconsecutive, invalid or expired rainfall evidence',()=>{
  for(const changes of [[{id:'2027-01',rain:30,lower:0,upper:130}],[{id:'2027-01',rain:30,lower:0,upper:130},{id:'2027-03',rain:40,lower:0,upper:140}],[{id:'2027-01',rain:NaN,lower:0,upper:130},{id:'2027-02',rain:30,lower:0,upper:130}],[{id:'2027-01',rain:30,lower:50,upper:130},{id:'2027-02',rain:30,lower:0,upper:130}]]){
   const {data,projection}=fixture();projection.months=changes;
   expect(buildPlanning(data,date).items).toHaveLength(0);
  }
  expect(buildPlanning(real,new Date('2030-01-01')).items.filter(item=>item.kind!=='soil')).toHaveLength(0);
 });
 it('proposes targeted soil improvement for acidic shallot soil without inventing an NPK dose',()=>{
  const {data,plot}=fixture();plot.crop='Bawang merah';
  const agronomy=data.agronomy!.byPlot[plot.id];
  agronomy.ph=structuredClone(real.agronomy!.byPlot['bawang-merah-432']?.ph??Object.values(real.agronomy!.byPlot).find(p=>p.ph)!.ph)!;
  agronomy.ph.depths=[{depthCm:10,value:5.2}];
  const item=buildPlanning(data,date).items.find(item=>item.kind==='soil')!;
  expect(item).toMatchObject({actionMonth:'2026-10',eventMonth:null,stage:'verification'});
  expect(item.outlook).toContain('5.2');expect(item.action).toContain('dolomite');expect(item.action).toContain('N, P and K');
  expect(item.action).not.toMatch(/\d+\s*(kg|ton)/);
 });
 it('uses carbon g/kg correctly and does not apply shallot pH thresholds to other crops',()=>{
  const {data,plot}=fixture();plot.crop='Bawang merah';
  const agronomy=data.agronomy!.byPlot[plot.id];
  const sample=structuredClone(Object.values(real.agronomy!.byPlot).find(p=>p.carbon)!.carbon)!;
  agronomy.ph={...sample,unit:'pH',depths:[{depthCm:10,value:6}]};
  agronomy.carbon={...sample,unit:'g/kg',depths:[{depthCm:10,value:19}]};
  expect(buildPlanning(data,date).items.find(item=>item.kind==='soil')?.action).toContain('mature compost');
  agronomy.carbon.depths[0].value=20;expect(buildPlanning(data,date).items).toHaveLength(0);
  agronomy.ph.depths[0].value=5.2;plot.crop='Bawang daun';expect(buildPlanning(data,date).items).toHaveLength(0);
  plot.crop='Bawang merah';agronomy.ph.depths[0].value=Infinity;expect(buildPlanning(data,date).items).toHaveLength(0);
 });
 it('does not recommend lime for alkaline soil and does not invent support from normal or missing soil',()=>{
  const {data,plot}=fixture();plot.crop='Bawang merah';const soil=data.agronomy!.byPlot[plot.id];
  const sample=structuredClone(Object.values(real.agronomy!.byPlot).find(p=>p.ph)!.ph)!;
  soil.ph={...sample,depths:[{depthCm:10,value:7}]};
  expect(buildPlanning(data,date).items.find(item=>item.kind==='soil')?.action).toContain('do not supply lime');
  for(const value of [5.6,6.5,null]){soil.ph.depths[0].value=value;expect(buildPlanning(data,date).items).toHaveLength(0);}
 });
 it('includes exactly twelve preparation months and respects Makassar month/year boundaries',()=>{
  expect(shiftMonth('2027-01',-3)).toBe('2026-10');
  const plan=buildPlanning(real,new Date('2026-10-31T17:00:00Z'));
  expect(plan.asOf).toBe('2026-11-01');expect(plan.months).toHaveLength(12);
  expect(plan.months[0]).toBe('2026-11');expect(plan.months.at(-1)).toBe('2027-10');
 });
 it('AI can explain a qualifying check but cannot create eligibility, dates or confirmed need',()=>{
  const {data,plot,vegetation,projection}=fixture();
  data.analysis={model:'gemini-test',referenceMonth:'2026-10',byPlot:{[plot.id]:{provider:'Gemini',model:'gemini-test',generatedAt:'2026-10-18',inputHash:'verified',promptVersion:'test',farmerSummary:'Review with your adviser.',governmentSummary:'Coordinate field verification.',crops:[],support:['water','soil','pest'].map(kind=>({kind:kind as 'water'|'soil'|'pest',reason:'Invented imminent threat.',farmerAction:'Review observations with an adviser.',governmentAction:'Arrange extension-led field verification.',evidence:['survey','vegetation']}))}}};
  expect(buildPlanning(data,date).items).toHaveLength(0);
  vegetation.ndvi=.3;const item=buildPlanning(data,date).items[0];
  expect(item.action).toContain('Arrange extension-led field verification.');expect(item.outlook).not.toContain('Invented');
  expect(item.stage).toBe('verification');expect(item.actionMonth).toBe('2026-10');expect(item.analysisProvider).toBe('Gemini');
  for(const month of projection.months.slice(0,2))Object.assign(month,{rain:30,lower:0,upper:140});
  const advice=data.analysis.byPlot[plot.id].support.find(s=>s.kind==='water')!;
  advice.evidence=['rainfall'];advice.governmentAction='Baseflow declines during the dry period.';
  expect(buildPlanning(data,date).items.find(item=>item.kind==='water')?.action).not.toContain('Baseflow declines');
  advice.governmentAction='Coordinate shared pump servicing with village extension staff.';
  expect(buildPlanning(data,date).items.find(item=>item.kind==='water')?.action).toContain(advice.governmentAction);
 });
});
