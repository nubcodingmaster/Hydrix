import { describe, it, expect } from 'vitest';
import { buildProjection, hindcast, classifyRainfallAnomaly } from '../../scripts/seasonal-model.mjs';
const history=Array.from({length:34*12},(_,i)=>({id:`${1991+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,rain:120+90*Math.cos(2*Math.PI*(i%12)/12)+(i%5-2)*6}));
describe('seasonal model integrity',()=>{
    it('projects 12 complete future months with bounds, not a relabeled observation year',()=>{
        const extreme=history.map(row=>row.id.startsWith('2024')?{...row,rain:row.rain+1000}:row);
        const p=buildProjection(extreme,'2026-10-14T04:00:00Z','cell');
        expect(p.months).toHaveLength(12);
        expect(p.months[0].id).toBe('2026-11');expect(p.months.at(-1).id).toBe('2027-10');
        expect(p.months.every(m=>m.lower<=m.rain&&m.rain<=m.upper&&m.lower>=0)).toBe(true);
        expect(p.months.every(m=>m.rain<500)).toBe(true);
        expect(p.validation.evaluatedMonths).toBe(60);
    });
    it('prevents future observations from leaking into a hindcast',()=>{
        const original=hindcast(history,'harmonic-ridge',2015,2015);
        const changed=hindcast(history.map(row=>row.id>'2015-12'?{...row,rain:100000}:row),'harmonic-ridge',2015,2015);
        expect(changed).toEqual(original);
        expect(original.every(row=>row.trainingEnd<row.id)).toBe(true);
    });
    it('rejects future data and insufficient training history',()=>{
        expect(()=>buildProjection([...history,{id:'2027-01',rain:50}],'2026-10-14T00:00:00Z','cell')).toThrow('Future');
        expect(()=>buildProjection(history.slice(0,120),'2026-10-14T00:00:00Z','cell')).toThrow('25 years');
    });
    it('uses the client month at the Makassar boundary',()=>{
        const p=buildProjection(history,'2026-10-31T18:00:00Z','cell');
        expect(p.months[0].id).toBe('2026-12');
    });
});


describe('Rainfall anomaly classification', () => {
    it('detects a below-normal median projection', () => {
        const result = classifyRainfallAnomaly(60, 40, 70, 100);

        expect(result.status).toBe('below-normal');
        expect(result.signal).toBe('below-normal');
        expect(result.deviationPercent).toBe(-40);
    });

    it('detects above-normal rainfall', () => {
        const result = classifyRainfallAnomaly(150, 130, 170, 100);

        expect(result.status).toBe('above-normal');
        expect(result.signal).toBe('above-normal');
    });

    it('keeps the signal uncertain when intervals overlap', () => {
        const result = classifyRainfallAnomaly(60, 30, 110, 100);

        expect(result.status).toBe('below-normal');
        expect(result.signal).toBe('uncertain');
    });

    it('handles missing climatology safely', () => {
        const result = classifyRainfallAnomaly(60, 30, 100, 0);

        expect(result.status).toBe('insufficient-data');
        expect(result.signal).toBe('uncertain');
    });
});
