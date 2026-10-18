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
  expect(plan.items.length).toBeLessThan(real.plots.length);
  expect(plan.items.every(item=>item.stage==='verification'&&item.kind!=='soil')).toBe(true);
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
 it('requires reliable rainfall intervals below the historical median for consecutive months',()=>{
  const {data,projection}=fixture();Object.assign(projection.months[0],{rain:10,lower:0,upper:20});
  expect(buildPlanning(data,date).items).toHaveLength(0);
  Object.assign(projection.months[1],{rain:15,lower:0,upper:25});
  const item=buildPlanning(data,date).items[0];expect(item).toMatchObject({kind:'water',stage:'verification',eventMonth:'2026-11',actionMonth:'2026-10'});
  expect(buildPlanning(data,date).items).toHaveLength(1);
  projection.confidence='low';expect(buildPlanning(data,date).items).toHaveLength(0);
 });
 it('includes late rainfall events when their preparation date is inside the horizon',()=>{
  const {data,projection}=fixture();
  for(const month of projection.months.slice(-2))Object.assign(month,{rain:10,lower:0,upper:20});
  expect(buildPlanning(data,date).items).toHaveLength(1);
  expect(buildPlanning(data,date).items[0]).toMatchObject({eventMonth:'2027-09',actionMonth:'2027-06'});
 });
 it('does not schedule from uncertain, sparse or expired rainfall evidence',()=>{
  const {data,projection}=fixture();for(const month of projection.months)Object.assign(month,{rain:10,lower:0,upper:150});
  expect(buildPlanning(data,date).items).toHaveLength(0);
  for(const month of projection.months)month.upper=20;
  projection.history=projection.history!.slice(0,12);expect(buildPlanning(data,date).items).toHaveLength(0);
  expect(buildPlanning(real,new Date('2030-01-01')) .items).toHaveLength(0);
 });
 it('includes exactly twelve preparation months and respects Makassar month/year boundaries',()=>{
  expect(shiftMonth('2027-01',-3)).toBe('2026-10');
  const plan=buildPlanning(real,new Date('2026-10-31T17:00:00Z'));
  expect(plan.asOf).toBe('2026-11-01');expect(plan.months).toHaveLength(12);
  expect(plan.months[0]).toBe('2026-11');expect(plan.months.at(-1)).toBe('2027-10');
 });
 it('AI can explain a qualifying check but cannot create eligibility, dates or confirmed need',()=>{
  const {data,plot,vegetation}=fixture();
  data.analysis={model:'gemini-test',referenceMonth:'2026-10',byPlot:{[plot.id]:{provider:'Gemini',model:'gemini-test',generatedAt:'2026-10-18',inputHash:'verified',promptVersion:'test',farmerSummary:'Review with your adviser.',governmentSummary:'Coordinate field verification.',crops:[],support:['water','soil','pest'].map(kind=>({kind:kind as 'water'|'soil'|'pest',reason:'Invented imminent threat.',farmerAction:'Review observations with an adviser.',governmentAction:'Arrange extension-led field verification.',evidence:['survey','vegetation']}))}}};
  expect(buildPlanning(data,date).items).toHaveLength(0);
  vegetation.ndvi=.3;const item=buildPlanning(data,date).items[0];
  expect(item.action).toContain('Arrange extension-led field verification.');expect(item.outlook).not.toContain('Invented');
  expect(item.stage).toBe('verification');expect(item.actionMonth).toBe('2026-10');expect(item.analysisProvider).toBe('Gemini');
 });
});
