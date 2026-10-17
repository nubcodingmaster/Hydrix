import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { supportRecommendations, isAgronomy, type Agronomy } from './agronomy';
import { loadSnapshot, fieldReport } from './live';
const base = JSON.parse(readFileSync(new URL('../../public/data/majalengka.json', import.meta.url), 'utf8'));
const metadata = { dataset: 'test', source: 'https://developers.google.com/earth-engine/datasets/catalog/test', resolutionMeters: 250, kind: 'modeled-soil', period: { start: '1950-01-01', end: '2018-01-01' } };
const soil = (value: number | null) => ({ ...metadata, unit: 'test', depths: [{ depthCm: 10, value }] });
const empty: Agronomy = { ph: null, carbon: null, texture: null, weather: null, vegetation: null };
const full: Agronomy = { ph: soil(5.5), carbon: soil(20), texture: soil(7),
  weather: { ...metadata, temperatureC: 26, relativeHumidityPct: 80, hours: 720, expectedHours: 720, hourlyCoverage: 1, missingHours: [], forecast: false },
  vegetation: { ...metadata, ndvi: .4, previousNdvi: .6, validCoverage: .8, previousValidCoverage: .8, meanObservations: 4, minimumObservations: 3, previousPeriod: metadata.period },
};
const snapshot = (data: Agronomy) => ({ schemaVersion: 1, baseFetchedAt: base.fetchedAt, fetchedAt: new Date().toISOString(), byPlot: { [base.plots[0].id]: data }, sources: [] });
afterEach(() => vi.unstubAllGlobals());
describe('API-only support planning', () => {
  it('accepts the published agronomy snapshot so live values can reach the interface', () => {
    const published = JSON.parse(readFileSync(new URL('../../public/data/agronomy.json', import.meta.url), 'utf8'));
    expect(published.baseFetchedAt).toBe(base.fetchedAt);
    expect(isAgronomy(published)).toBe(true);
    expect(Object.keys(published.byPlot).sort()).toEqual(base.plots.map((plot: {id: string}) => plot.id).sort());
  });
  it('does not allocate fertilizer or pesticide when observations are absent or null', () => {
    for (const data of [undefined, empty, { ...empty, ph: soil(null) }]) {
      const plans = supportRecommendations(data);
      expect(plans.every(plan => plan.status === 'Data needed')).toBe(true);
      expect(plans.flatMap(plan => plan.evidence)).toEqual(data?.ph ? [data.ph.source] : []);
    }
  });
  it('uses source values as context without diagnosing deficiency or pests', () => {
    const plans = supportRecommendations(full);
    expect(plans[0].reason).toContain('pH 5.5');
    expect(plans[0].action).toContain('do not establish current nutrient deficiency');
    expect(plans[1].reason).toContain('not a pest forecast');
    expect(plans[1].action).toContain('does not identify a pest');
    expect(plans.every(plan => plan.status === 'Review')).toBe(true);
  });
  it('rejects malformed or impossible API values before displaying recommendations', () => {
    expect(isAgronomy(snapshot(full))).toBe(true);
    expect(isAgronomy(snapshot({ ...full, weather: { ...full.weather!, relativeHumidityPct: 150 } }))).toBe(false);
    expect(isAgronomy(snapshot({ ...full, ph: soil(500) }))).toBe(false);
    expect(isAgronomy(snapshot({ ...full, vegetation: { ...full.vegetation!, ndvi: 5 } }))).toBe(false);
    expect(isAgronomy(snapshot({ ...full, vegetation: { ...full.vegetation!, validCoverage: .2 } }))).toBe(false);
    expect(isAgronomy(snapshot({ ...full, weather: { ...full.weather!, hours: 647 } }))).toBe(false);
    expect(isAgronomy(snapshot({ ...full, ph: { ...soil(5), period: {start:'invalid', end:'invalid'} } }))).toBe(false);
    expect(isAgronomy({ ...snapshot(empty), sources: [{}] })).toBe(false);
  });
  it('discards stale base versions and exports evidence from matching observations', async () => {
    let version = 'outdated';
    vi.stubGlobal('fetch', vi.fn(async (path: string) => ({ ok: true, json: async () => path.endsWith('majalengka.json') ? structuredClone(base) : path.endsWith('agronomy.json') ? { ...snapshot(full), baseFetchedAt: version } : {} })));
    expect((await loadSnapshot()).agronomy).toBeUndefined();
    version = base.fetchedAt;
    const loaded = await loadSnapshot();
    const report = fieldReport(loaded.plots[0], loaded);
    expect(report.ndvi).toBe(.4);
    expect(report.agronomy?.weather?.forecast).toBe(false);
    expect(report.support_proposals[0].evidence).toContain(metadata.source);
  });
});
