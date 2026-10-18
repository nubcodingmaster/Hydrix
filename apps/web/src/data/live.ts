import { attachAnalysis, type AnalysisSnapshot } from './ai';
import type { MultiPolygon, Polygon } from 'geojson';
import { isAgronomy, supportRecommendations, type Agronomy } from './agronomy';

export type RainMonth = { id: string; rain: number | null; pixel: string; source: string };
export type ProjectionMonth = { id: string; rain: number; lower: number; upper: number };
export type Projection = {
  pixel: string; issuedAt: string; kind: 'seasonal-projection'; method: string;
  training: { start: string; end: string; observations: number };
  validation: { selectionYears: string; calibrationYears: string; evaluationYears: string; maeMm: number; baselineMaeMm: number; intervalCoverage: number; evaluatedMonths: number };
  interval: { nominalCoverage: number; radiusMm: number; method: string };
  history?: { id: string; rain: number | null }[];
  confidence: 'low' | 'medium' | 'high'; months: ProjectionMonth[]; limitations: string[];
  aiSummary?: { provider: string; model: string; generatedAt: string; summary: string; watchMonths: string[]; actions: string[] };
};
export type WaterSample = { value: number | null; unit: string; period: { start: string; end: string }; pixel: string; resolutionDegrees: number[]; scale: number; source: string };
export type Environment = { aeti: WaterSample | null; ret: WaterSample | null; cropland: { classification: number | null; confidence: number | null; year: number; source: string; endpoint: string; resolutionMeters: number } | null };
export type Plot = {
  id: string; objectId: number; name: string; district: string; village: string | null;
  crop: string; area: number; areaMethod: string; center: [number, number];
  geometry: Polygon | MultiPolygon; surveyDate: string | null; irrigation: string | null;
  source: string; rainfall: RainMonth[];
};
export type Snapshot = {
  analysis?: AnalysisSnapshot;
  schemaVersion: 1; fetchedAt: string; period: { start: string; end: string; kind: 'historical' };
  plots: Plot[];
  sources: { name: string; url: string; status: 'connected' | 'unavailable' | 'cached'; purpose: string }[];
  quality: { accepted: number; rejected: { id: string; reason: string }[]; excludedGarlic: string; rainfallMethod: string };
  environment?: { fetchedAt: string; byPlot: Record<string, Environment>; sources: Snapshot['sources']; errors: { name: string; message: string }[] };
  agronomy?: { fetchedAt: string; byPlot: Record<string, Agronomy>; sources: Snapshot['sources'] };
  projections?: { issuedAt: string; provider: string; byPixel: Record<string, Projection> };
};
export type Candidate = { id: string; name: string; status: string; note: string; unknown: string; count: number };
export function monthLabel(id: string, short = false) {
  return new Intl.DateTimeFormat('en-US', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric', timeZone: 'UTC' }).format(new Date(`${id}-01T00:00:00Z`));
}
export function dateLabel(id: string | null) {
  if (!id) return 'Date not recorded';
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' }).format(new Date(id));
}
export function rainfallText(value: number | null) {
  return value === null ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} mm`;
}
export function cropLabel(crop: string) {
  return ({ 'Bawang merah': 'Shallot', 'Bawang daun': 'Spring onion', 'Bawang putih': 'Garlic' } as Record<string, string>)[crop] ?? crop;
}
export function candidates(snapshot: Snapshot): Candidate[] {
  return ['Bawang merah', 'Bawang daun', 'Bawang putih'].map((name, index) => {
    const count = snapshot.plots.filter(p => p.crop === name).length;
    return {
      id: String(index), name: cropLabel(name), count,
      status: count ? 'Recorded in surveys' : 'Insufficient evidence',
      note: count ? `${count} historical survey polygons recorded in Majalengka. Records support candidate review, but do not establish current suitability.` : 'The Majalengka garlic records contain test attributes and are excluded as suitability evidence.',
      unknown: 'Crop-specific soil requirements, elevation, operational water, variety and pest history',
    };
  });
}
export function plotAction(plot: Plot) {
  return `Review seasonal patterns and API evidence for ${plot.village || plot.district}. Survey irrigation: ${irrigationLabel(plot.irrigation).toLowerCase()}. Crop suitability and specific aid requirements remain conditional.`;
}
export function irrigationLabel(value: string | null) {
  return ({ IrigasiSederhana: 'Simple irrigation', IrigasiTeknis: 'Technical irrigation', IrigasiTadahHujan: 'Rainfed', IrigasiSetengahTeknis: 'Semi-technical irrigation' } as Record<string, string>)[value || ''] ?? (value ? value.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Not recorded');
}
export function fieldReport(plot: Plot, snapshot: Snapshot) {
  const agronomy = snapshot.agronomy?.byPlot[plot.id];
  return { location: plot, candidates: candidates(snapshot), action: plotAction(plot), support_proposals: supportRecommendations(agronomy), agronomy: agronomy ?? null, seasonal_projection: projectionFor(plot,snapshot), environment: snapshot.environment?.byPlot[plot.id] ?? null, soil_moisture: null, ndvi: agronomy?.vegetation?.ndvi ?? null, fetched_at: snapshot.fetchedAt, rainfall_period: snapshot.period, limitations: ['Land attributes are historical survey records, not current observations.', 'Statistical seasonal projections are not daily weather forecasts.', 'API-only screening does not establish nutrient deficiency, pest occurrence, fertilizer doses or pesticide allocation.'] };
}
export function projectionFor(plot: Plot, snapshot: Snapshot) {
  return snapshot.projections?.byPixel[plot.rainfall.at(-1)?.pixel || ''] ?? null;
}
/** Merge long model history with latest observations, keeping original monthly gaps. */
export function rainfallHistory(plot: Plot, snapshot: Snapshot): RainMonth[] {
  const pixel = plot.rainfall.at(-1)?.pixel || '';
  const history = projectionFor(plot, snapshot)?.history ?? [];
  const months = new Map<string, RainMonth>();
  const source = 'https://coastwatch.pfeg.noaa.gov/erddap/info/chirps20GlobalMonthlyP05/index.html';
  for (const month of history) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month.id) && (month.rain === null || (typeof month.rain === 'number' && Number.isFinite(month.rain) && month.rain >= 0))) {
      months.set(month.id, { ...month, pixel, source });
    }
  }
  for (const month of plot.rainfall) months.set(month.id, month);
  return [...months.values()].sort((a,b) => a.id.localeCompare(b.id));
}
export function projectionSummary(projection: Projection | null) {
  if (!projection) return 'Projection unavailable. Future values are not generated without a model.';
  const dry = [...projection.months].sort((a,b)=>a.rain-b.rain).slice(0,3);
  return `Months projected to be relatively drier: ${dry.map(m=>monthLabel(m.id)).join(', ')}. Review water availability and crop requirements before choosing planting dates.`;
}
export function regionalGroups(snapshot: Snapshot) {
  const districts = [...new Set(snapshot.plots.map(p => p.district))];
  return districts.map(district => {
    const plots = snapshot.plots.filter(p => p.district === district);
    const missing = plots.filter(p => !p.surveyDate || !p.irrigation).length;
    const values = plots.flatMap(p => p.rainfall.flatMap(m => m.rain === null ? [] : [m.rain]));
    return { district, plots, missing, minimumRain: values.length ? Math.min(...values) : null };
  }).sort((a, b) => b.missing - a.missing || b.plots.length - a.plots.length);
}
export function containsPoint(plot: Plot, [x, y]: [number, number]) {
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const polygons = plot.geometry.type === 'Polygon' ? [plot.geometry.coordinates] : plot.geometry.coordinates;
  return polygons.some(polygon => inRing(polygon[0]) && !polygon.slice(1).some(inRing));
}
export async function loadSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const response = await fetch('/data/majalengka.json', { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error('Source data could not be loaded. Please retry.');
  const data = await response.json();
  if (data.schemaVersion !== 1 || !Array.isArray(data.plots) || !data.plots.length || !data.plots.every((p: Plot) => p.id && p.geometry && Array.isArray(p.rainfall))) throw new Error('Source data format is invalid.');
  const optional = async (path: string) => {
    try { const response = await fetch(path,{signal,cache:'no-cache'}); if(!response.ok) return undefined; const value=await response.json(); return value.schemaVersion===1?value:undefined; } catch { return undefined; }
  };
  const [environment,projections,agronomy,analysis] = await Promise.all([optional('/data/environment.json'),optional('/data/projections.json'),optional('/data/agronomy.json'),optional('/data/analysis.json')]);
  data.environment=environment?.baseFetchedAt===data.fetchedAt?environment:undefined; data.projections=projections?.baseFetchedAt===data.fetchedAt?projections:undefined;
  data.agronomy=isAgronomy(agronomy) && agronomy.baseFetchedAt===data.fetchedAt ? agronomy : undefined;
  await attachAnalysis(data,analysis);
  // Localize presentation without changing original source attributes or IDs.
  const sourceLabels: Record<string, [string,string]> = {
    'Kementan · Bawang Merah': ['Kementan · Shallot', 'Historical survey geometry and attributes'],
    'Kementan · Hortikultura': ['Kementan · Horticulture', 'Historical spring onion survey in Argapura'],
    'Kementan · Bawang Putih': ['Kementan · Garlic', 'Test attributes excluded from crop suitability evidence'],
    'CHIRPS v2 · UCSB': ['CHIRPS v2 · UCSB', 'Observed monthly rainfall; native 0.05° pixels sampled at field bounding-box centers'],
    'Prakiraan cuaca': ['Dynamic weather forecasts', 'No atmospheric forecast connected; statistical seasonal projections are shown separately'],
    'WaPOR v3 ET aktual': ['WaPOR v3 actual ET', 'Average daily actual evapotranspiration over a ten-day period; approximately 326 m pixels'],
    'WaPOR v3 ET referensi': ['WaPOR v3 reference ET', 'Daily regional reference evapotranspiration, not crop-specific ET'],
    'WorldCereal · tanaman semusim': ['WorldCereal · temporary crops', 'Historical 2021 crop classification and confidence at 10 m; does not identify current crops'],
  };
  data.sources=data.sources.filter((source: Snapshot['sources'][number]) => source.name !== 'ERA5-Land dan Sentinel-2');
  if(data.environment?.sources) data.sources.push(...data.environment.sources);
  data.sources=data.sources.map((source: Snapshot['sources'][number]) => sourceLabels[source.name] ? {...source,name:sourceLabels[source.name][0],purpose:sourceLabels[source.name][1]} : source);
  if(data.agronomy) data.sources.push(...data.agronomy.sources);
  else data.sources.push({name:'Google Earth Engine soil and crop context',url:'https://developers.google.com/earth-engine',status:'unavailable',purpose:'No valid matching Earth Engine snapshot is available. Soil, weather and vegetation observations have not been substituted.'});
  if(data.projections) data.sources.push({name:'Seasonal rainfall model',url:'https://coastwatch.pfeg.noaa.gov/erddap/info/chirps20GlobalMonthlyP05/index.html',status:'connected',purpose:'Local model trained on historical CHIRPS; evaluation and uncertainty included. Not an atmospheric weather forecast.'});
  const aiCount=Object.keys(data.analysis?.byPlot ?? {}).length;
  data.sources.push({name:'Google Gemini analysis',url:'https://ai.google.dev/',status:aiCount?'connected':'unavailable',purpose:`Validated Gemini analysis for ${aiCount}/${data.plots.length} locations. Statistical projections and measured observations remain separate from AI interpretation.`});
  return data;
}
