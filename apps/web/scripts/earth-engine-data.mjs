/** Public dataset contracts. Source pixels are never presented as field measurements. */
export const datasets = {
  ph: { id: 'OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02', name: 'OpenLandMap soil pH', resolutionMeters: 250, unit: 'pH', kind: 'modeled-soil', period: { start: '1950-01-01', end: '2018-01-01' } },
  carbon: { id: 'OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02', name: 'OpenLandMap organic carbon', resolutionMeters: 250, unit: 'g/kg', kind: 'modeled-soil', period: { start: '1950-01-01', end: '2018-01-01' } },
  texture: { id: 'OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02', name: 'OpenLandMap soil texture', resolutionMeters: 250, unit: 'USDA class', kind: 'modeled-soil', period: { start: '1950-01-01', end: '2018-01-01' } },
  weather: { id: 'ECMWF/ERA5_LAND/HOURLY', name: 'ERA5-Land temperature and humidity', resolutionMeters: 11132, kind: 'reanalysis' },
  vegetation: { id: 'COPERNICUS/S2_SR_HARMONIZED', name: 'Sentinel-2 vegetation', resolutionMeters: 10, kind: 'satellite-observation' },
};
export const catalogURL = id => `https://developers.google.com/earth-engine/datasets/catalog/${id.replaceAll('/', '_')}`;
export const textureClasses = ['Clay', 'Silty clay', 'Sandy clay', 'Clay loam', 'Silty clay loam', 'Sandy clay loam', 'Loam', 'Silt loam', 'Sandy loam', 'Silt', 'Loamy sand', 'Sand'];
/** Preserve missing hours explicitly; do not impute missing reanalysis observations. */
export function weatherCoverage(timestamps, start, end) {
  const first = Date.parse(start), last = Date.parse(end), hour = 3600000;
  const expectedHours = (last - first) / hour;
  if (expectedHours !== 720 || !Array.isArray(timestamps) || timestamps.some(time => !Number.isFinite(time) || time < first || time >= last || (time - first) % hour !== 0) || new Set(timestamps).size !== timestamps.length) throw new Error('Invalid hourly observation timestamps');
  const hours = timestamps.length, coverage = hours / expectedHours;
  if (coverage < .9) throw new Error('ERA5-Land hourly coverage is below 90%');
  const available = new Set(timestamps);
  const missingHours = Array.from({length: expectedHours}, (_, index) => first + index * hour).filter(time => !available.has(time)).map(time => new Date(time).toISOString());
  return { hours, expectedHours, hourlyCoverage: coverage, missingHours };
}
export function finite(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}
export function decodeSoil(key, raw) {
  if (key === 'ph') { const value = finite(raw, 0, 140); return value === null ? null : value / 10; }
  if (key === 'carbon') { const value = finite(raw, 0, 255); return value === null ? null : value * 5; }
  const value = finite(raw, 1, 12);
  return Number.isInteger(value) ? value : null;
}
export function sourceSample(key, properties, period = datasets[key].period) {
  const dataset = datasets[key];
  return { ...properties, dataset: dataset.id, source: catalogURL(dataset.id), resolutionMeters: dataset.resolutionMeters, kind: dataset.kind, period };
}
export function emptyAgronomy(snapshot, reason) {
  return { schemaVersion: 1, baseFetchedAt: snapshot.fetchedAt, fetchedAt: new Date().toISOString(), provider: 'Google Earth Engine', method: 'api-screening-v1',
    byPlot: Object.fromEntries(snapshot.plots.map(plot => [plot.id, { ph: null, carbon: null, texture: null, weather: null, vegetation: null }])),
    sources: Object.values(datasets).map(d => ({ name: d.name, url: catalogURL(d.id), status: 'unavailable', purpose: reason })),
    errors: Object.keys(datasets).map(layer => ({ name: layer, code: 'not_configured', message: reason })),
  };
}
