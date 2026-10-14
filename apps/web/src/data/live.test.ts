import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { candidates, containsPoint, fieldReport, regionalGroups, type Snapshot } from './live';
const data = JSON.parse(readFileSync(new URL('../../public/data/majalengka.json', import.meta.url), 'utf8')) as Snapshot;

describe('public source snapshot', () => {
  it('contains native field boundaries and 12 observed months with source provenance', () => {
    expect(data.plots.length).toBeGreaterThan(100);
    const publishedMonths = new Set(data.plots[0].rainfall.map(m => m.id));
    expect(publishedMonths.size).toBe(12);
    for (const plot of data.plots) {
      expect(plot.source).toMatch(/^https:\/\/geoportal\.pertanian\.go\.id\/arcgis\/rest\/services\//);
      expect(plot.geometry.coordinates.length).toBeGreaterThan(0);
      expect(plot.center[0]).toBeGreaterThan(108);
      expect(plot.center[1]).toBeLessThan(-6.5);
      expect(plot.area).toBeGreaterThan(0);
      expect(plot.rainfall.map(m => m.id)).toEqual([...publishedMonths]);
      for (const month of plot.rainfall) {
        expect(month.source).toContain(`chirps-v2.0.${month.id.replace('-', '.')}.cog`);
        expect(month.rain === null || month.rain >= 0).toBe(true);
        expect(month.id < data.fetchedAt.slice(0, 7)).toBe(true);
      }
    }
  });
  it('preserves regional pixel values instead of inventing field-scale differences', () => {
    const byPixel = new Map<string, number | null>();
    for (const plot of data.plots) for (const month of plot.rainfall) {
      const key = `${month.id}:${month.pixel}`;
      if (byPixel.has(key)) expect(month.rain).toBe(byPixel.get(key));
      byPixel.set(key, month.rain);
    }
  });
  it('reports missing forecasts and excludes test garlic as evidence', () => {
    const report = fieldReport(data.plots[0], data);
    expect(report.seasonal_projection).toBeNull();
    expect(report.soil_moisture).toBeNull();
    expect(report.ndvi).toBeNull();
    expect(candidates(data).find(c => c.name === 'Bawang putih')?.count).toBe(0);
    expect(data.quality.rejected.length).toBeGreaterThan(0);
    expect(regionalGroups(data).flatMap(g => g.plots).length).toBe(data.plots.length);
  });
  it('matches GPS against polygon boundaries, including holes', () => {
    const plot = { ...data.plots[0], geometry: { type: 'Polygon' as const, coordinates: [[[0,0],[4,0],[4,4],[0,4],[0,0]], [[1,1],[2,1],[2,2],[1,2],[1,1]]] } };
    expect(containsPoint(plot, [3,3])).toBe(true);
    expect(containsPoint(plot, [1.5,1.5])).toBe(false);
    expect(containsPoint(plot, [5,5])).toBe(false);
  });
});

describe('environmental enrichment and projections',()=>{
  const environment=JSON.parse(readFileSync(new URL('../../public/data/environment.json',import.meta.url),'utf8'));
  const projections=JSON.parse(readFileSync(new URL('../../public/data/projections.json',import.meta.url),'utf8'));
  const enriched={...data,environment,projections} as Snapshot;
  it('keeps WaPOR scale, observation dates, and real WorldCereal classes',()=>{
    expect(environment.errors).toEqual([]);
    expect(environment.baseFetchedAt).toBe(data.fetchedAt);
    for(const plot of data.plots){
      const e=environment.byPlot[plot.id];
      expect(e.aeti.scale).toBe(.1);expect(e.ret.scale).toBe(.1);
      expect(e.aeti.unit).toBe('mm/day');expect(e.ret.unit).toBe('mm/day');
      expect(e.aeti.source).toMatch(/^https:\/\/storage.googleapis.com\/fao-gismgr-wapor-3-data\//);
      expect(e.aeti.period.end<=environment.fetchedAt.slice(0,10)).toBe(true);
      expect([0,100,null]).toContain(e.cropland.classification);
      expect(e.cropland.year).toBe(2021);
    }
  });
  it('exports future projection separately from observed rainfall and survey dates',()=>{
    for(const plot of data.plots){
      const report=fieldReport(plot,enriched);
      expect(report.location.surveyDate).toBe(plot.surveyDate);
      expect(report.environment).toBeTruthy();
      const p=report.seasonal_projection!;
      expect(p.kind).toBe('seasonal-projection');
      expect(p.training.observations).toBeGreaterThanOrEqual(300);
      expect(p.months).toHaveLength(12);
      expect(p.months.every(m=>m.id>p.issuedAt.slice(0,7))).toBe(true);
      expect(p.months.every(m=>m.lower<=m.rain&&m.upper>=m.rain)).toBe(true);
      expect(p.confidence).toBe('low');
    }
  });
});
