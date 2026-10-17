export type AgronomySample = {
  dataset: string; source: string; resolutionMeters: number; kind: string;
  period: { start: string; end: string };
};
export type SoilSample = AgronomySample & {
  unit: string; depths: { depthCm: number; value: number | null; label?: string | null }[];
};
export type WeatherSample = AgronomySample & {
  temperatureC: number | null; relativeHumidityPct: number | null; hours: number; forecast: false;
  expectedHours: number; hourlyCoverage: number; missingHours: string[];
};
export type VegetationSample = AgronomySample & {
  ndvi: number | null; previousNdvi: number | null; validCoverage: number | null;
  previousValidCoverage: number | null; meanObservations: number | null; minimumObservations: number;
  previousPeriod: { start: string; end: string };
};
export type Agronomy = {
  ph: SoilSample | null; carbon: SoilSample | null; texture: SoilSample | null;
  weather: WeatherSample | null; vegetation: VegetationSample | null;
};
export type SupportRecommendation = {
  id: string; title: string; status: 'Review' | 'Data needed'; reason: string; action: string; evidence: string[];
};
const surface = (sample?: SoilSample | null) => sample?.depths.find(depth => depth.depthCm === 10)?.value ?? null;
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** API-only support planning. Environmental proxies cannot diagnose nutrient deficiency or pests. */
export function supportRecommendations(data?: Agronomy): SupportRecommendation[] {
  const ph = surface(data?.ph), carbon = surface(data?.carbon), texture = surface(data?.texture);
  const soil = ph !== null && carbon !== null && texture !== null;
  const weather = data?.weather;
  const climate = weather?.temperatureC != null && weather.relativeHumidityPct != null;
  const vegetation = data?.vegetation;
  const ndvi = vegetation?.ndvi;
  const evidence = [data?.ph, data?.carbon, data?.texture].filter((sample): sample is SoilSample => !!sample);
  return [
    {
      id: 'nutrient-planning', title: 'Fertilizer & soil support', status: soil ? 'Review' : 'Data needed',
      reason: soil ? `Modeled soil at 10 cm: pH ${number(ph)}, organic carbon ${number(carbon)} g/kg, texture class ${texture}. These are historical regional estimates.` : 'Soil pH, organic carbon and texture are not all available for this location.',
      action: soil ? 'Consider a soil fertility assessment and crop-specific nutrient planning support. Available APIs do not establish current nutrient deficiency, fertilizer type or dose.' : 'Fertilizer allocation cannot be assessed from the available API evidence. Keep the proposal pending until soil coverage is available.',
      evidence: evidence.map(sample => sample.source),
    },
    {
      id: 'pest-preparedness', title: 'Pest monitoring & crop protection', status: climate || ndvi != null ? 'Review' : 'Data needed',
      reason: climate ? `Recent reanalysis averages: ${number(weather.temperatureC!)} °C and ${number(weather.relativeHumidityPct!)}% relative humidity. This is climate context, not a pest forecast.` : 'Temperature and humidity context is unavailable. Satellite vegetation coverage may also be limited.',
      action: ndvi != null ? `Current NDVI is ${number(ndvi)}${vegetation?.previousNdvi != null ? `; previous window ${number(vegetation.previousNdvi)}` : ''}. Consider pest surveillance and extension support. Vegetation change does not identify a pest or justify insecticide allocation.` : climate ? 'Consider pest surveillance and extension support using this climate context. No pest occurrence, pesticide product or dose is inferred.' : 'Consider monitoring support only after API evidence becomes available. No pest occurrence, pesticide product or dose is inferred.',
      evidence: [climate ? weather?.source : null, ndvi != null ? vegetation?.source : null].filter((source): source is string => !!source),
    },
  ];
}

export function isAgronomy(value: unknown): value is { schemaVersion: 1; baseFetchedAt: string; fetchedAt: string; byPlot: Record<string, Agronomy>; sources: { name: string; url: string; status: 'connected' | 'unavailable' | 'cached'; purpose: string }[] } {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 || typeof data.baseFetchedAt !== 'string' || typeof data.fetchedAt !== 'string' || !data.byPlot || typeof data.byPlot !== 'object' || Array.isArray(data.byPlot) || !Array.isArray(data.sources)) return false;
  const range = (n: unknown, min: number, max: number) => n === null || (typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
  const period = (value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const p = value as { start?: unknown; end?: unknown };
    return typeof p.start === 'string' && typeof p.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.start) && /^\d{4}-\d{2}-\d{2}$/.test(p.end) && Number.isFinite(Date.parse(p.start)) && Number.isFinite(Date.parse(p.end)) && p.start <= p.end;
  };
  return Object.values(data.byPlot).every(plot => {
    if (!plot || typeof plot !== 'object') return false;
    return ['ph', 'carbon', 'texture', 'weather', 'vegetation'].every(key => {
      const sample = plot[key];
      if (sample === null) return true;
      if (!sample || typeof sample.dataset !== 'string' || typeof sample.source !== 'string' || !sample.source.startsWith('https://developers.google.com/earth-engine/datasets/catalog/') || !period(sample.period) || !Number.isFinite(sample.resolutionMeters) || sample.resolutionMeters <= 0) return false;
      if (key === 'weather') return sample.forecast === false && Number.isInteger(sample.hours) && sample.hours >= 648 && sample.hours <= 720 && sample.expectedHours === 720 && sample.hourlyCoverage === sample.hours / sample.expectedHours && Array.isArray(sample.missingHours) && sample.missingHours.length === sample.expectedHours - sample.hours && sample.missingHours.every((hour: unknown) => typeof hour === 'string' && Number.isFinite(Date.parse(hour))) && range(sample.temperatureC, -90, 65) && range(sample.relativeHumidityPct, 0, 100);
      if (key === 'vegetation') return range(sample.ndvi, -1, 1) && range(sample.previousNdvi, -1, 1) && range(sample.validCoverage, 0, 1) && range(sample.previousValidCoverage, 0, 1) && period(sample.previousPeriod) && sample.minimumObservations === 3 && range(sample.meanObservations, 0, 1000) && (sample.ndvi === null || (sample.validCoverage !== null && sample.validCoverage >= .5)) && (sample.previousNdvi === null || (sample.previousValidCoverage !== null && sample.previousValidCoverage >= .5));
      return Array.isArray(sample.depths) && sample.depths.length > 0 && sample.depths.every((depth: { depthCm: number; value: unknown; label?: unknown }) => depth && [0, 10, 30].includes(depth.depthCm) && range(depth.value, key === 'ph' ? 0 : key === 'texture' ? 1 : 0, key === 'ph' ? 14 : key === 'texture' ? 12 : 1275) && (key !== 'texture' || depth.value === null || Number.isInteger(depth.value)) && (depth.label === undefined || depth.label === null || typeof depth.label === 'string'));
    });
  }) && data.sources.every(source => source && typeof source.name === 'string' && typeof source.url === 'string' && ['connected', 'cached', 'unavailable'].includes(source.status) && typeof source.purpose === 'string');
}
