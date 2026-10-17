import { readFile, writeFile, rename } from 'node:fs/promises';
import ee from '@google/earthengine';
import { GoogleAuth } from 'google-auth-library';
import { datasets, decodeSoil, finite, emptyAgronomy, sourceSample, textureClasses, weatherCoverage } from './earth-engine-data.mjs';

try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const snapshot = JSON.parse(await readFile(new URL('../public/data/majalengka.json', import.meta.url), 'utf8'));
const output = new URL('../public/data/agronomy.json', import.meta.url);
const reason = 'Earth Engine access is not configured. No observation has been substituted.';
const result = emptyAgronomy(snapshot, reason);
const project = process.env.EARTH_ENGINE_PROJECT;
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const token = process.env.EARTH_ENGINE_ACCESS_TOKEN;
const evaluate = object => new Promise((resolve, reject) => object.evaluate((value, error) => error ? reject(new Error(String(error))) : resolve(value)));
async function save() {
  // Keep the last successful, matching snapshot on a failed refresh.
  let previous;
  try { previous = JSON.parse(await readFile(output, 'utf8')); } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
  if (previous?.baseFetchedAt === snapshot.fetchedAt) {
    for (const key of Object.keys(datasets)) {
      if (!result.sources.some(source => source.name === datasets[key].name && source.status === 'connected')) {
        for (const plot of snapshot.plots) result.byPlot[plot.id][key] = previous.byPlot?.[plot.id]?.[key] ?? null;
        const prior = previous.sources?.find(source => source.name === datasets[key].name && ['connected', 'cached'].includes(source.status));
        if (prior) result.sources[Object.keys(datasets).indexOf(key)] = { ...prior, status: 'cached', purpose: `${prior.purpose} Refresh failed; showing the previous observation dates.` };
      }
    }
  }
  const temporary = new URL('../public/data/agronomy.tmp', import.meta.url);
  await writeFile(temporary, JSON.stringify(result));
  await rename(temporary, output);
}
if (!project || (!credentials && !token)) {
  await save();
  console.error('Earth Engine not configured. Set EARTH_ENGINE_PROJECT and GOOGLE_APPLICATION_CREDENTIALS (or EARTH_ENGINE_ACCESS_TOKEN) in .env.local.');
  process.exitCode = 1;
} else {
  try {
    ee.data.setDeadline(120000);
    if (credentials) {
      const key = JSON.parse(await readFile(credentials, 'utf8'));
      if (key.type !== 'service_account') throw new Error('Expected a service account JSON credential');
      // Use the maintained auth client; the Earth Engine SDK's legacy JWT constructor is incompatible with current Google Auth.
      const auth = new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/earthengine.readonly'] });
      const client = await auth.getClient();
      const access = await client.getAccessToken();
      if (!access.token) throw new Error('Google returned no access token');
      ee.data.setAuthToken(null, 'Bearer', access.token, 3600, [], undefined, false, true);
      ee.data.setAuthTokenRefresher((_args, callback) => {
        client.getAccessToken().then(access => callback({ access_token: access.token, token_type: 'Bearer', expires_in: 3600 })).catch(() => callback({ error: 'Token refresh failed' }));
      });
    } else {
      ee.data.setAuthToken(null, 'Bearer', token, 3600, [], undefined, false);
    }
    await new Promise((resolve, reject) => ee.initialize(null, null, resolve, reject, null, project));
    const plots = ee.FeatureCollection(snapshot.plots.map(plot => ee.Feature(ee.Geometry(plot.geometry), { plotId: plot.id })));
    const weatherPoints = ee.FeatureCollection(snapshot.plots.map(plot => ee.Feature(ee.Geometry.Point(plot.center), { plotId: plot.id })));
    const bounds = plots.geometry().bounds();
    const known = new Set(snapshot.plots.map(plot => plot.id));
    const summaries = async (image, scale, reducer = ee.Reducer.mean(), locations = plots) => {
      const collection = await evaluate(image.reduceRegions({ collection: locations, reducer, scale, tileScale: 4 }));
      if (!Array.isArray(collection?.features) || collection.features.length !== known.size || new Set(collection.features.map(f => f.properties?.plotId)).size !== known.size || collection.features.some(f => !known.has(f.properties?.plotId))) throw new Error('Incomplete Earth Engine response');
      return collection.features.map(feature => feature.properties);
    };
    async function soil(key) {
      // These are depths at 0, 10 and 30 cm, not a measured 0–30 cm layer.
      const image = ee.Image(datasets[key].id).select(['b0', 'b10', 'b30']);
      const rows = await summaries(image, 250, key === 'texture' ? ee.Reducer.mode() : ee.Reducer.mean());
      return rows.map(row => ({ id: row.plotId, sample: sourceSample(key, { unit: datasets[key].unit, depths: [0, 10, 30].map(depth => {
        const value = decodeSoil(key, row[`b${depth}`]);
        return { depthCm: depth, value, ...(key === 'texture' ? { label: value === null ? null : textureClasses[value - 1] } : {}) };
      }), method: key === 'texture' ? 'Polygon modal class at native resolution' : 'Polygon mean at native resolution' }) }));
    }
    async function weather() {
      const collection = ee.ImageCollection(datasets.weather.id).filterBounds(bounds);
      const latest = await evaluate(collection.aggregate_max('system:time_start'));
      if (!Number.isFinite(latest)) throw new Error('No ERA5-Land observations');
      // Exclude the latest UTC day. Provider gaps within the preceding window remain explicit.
      const end = new Date(latest).toISOString().slice(0, 10);
      const start = new Date(Date.parse(end) - 30 * 86400000).toISOString().slice(0, 10);
      const recent = collection.filterDate(start, end);
      const coverage = weatherCoverage(await evaluate(recent.aggregate_array('system:time_start')), start, end);
      if (coverage.missingHours.length) console.log(`weather: ${coverage.hours}/${coverage.expectedHours} hours available; missing hours are not filled`);
      const image = recent.map(image => {
        const temperature = image.select('temperature_2m').subtract(273.15).rename('temperatureC');
        const dewpoint = image.select('dewpoint_temperature_2m').subtract(273.15);
        const humidity = image.expression('100 * exp((17.625 * Td) / (243.04 + Td) - (17.625 * T) / (243.04 + T))', { T: temperature, Td: dewpoint }).clamp(0, 100).rename('relativeHumidityPct');
        return temperature.addBands(humidity);
      }).mean();
      // Small survey plots can fall below polygon-reducer overlap thresholds on this 11 km grid.
      // Sample the regional pixel at the field bounding-box center, as with CHIRPS; never claim field-scale weather.
      return (await summaries(image, 11132, ee.Reducer.first(), weatherPoints)).map(row => ({ id: row.plotId, sample: sourceSample('weather', { temperatureC: finite(row.temperatureC, -90, 65), relativeHumidityPct: finite(row.relativeHumidityPct, 0, 100), ...coverage, spatialMethod: 'Regional pixel at field bounding-box center', samplePoint: snapshot.plots.find(plot => plot.id === row.plotId).center, method: 'Mean available hourly temperature and Magnus relative humidity; regional pixel at field bounding-box center; minimum 90% temporal coverage; missing hours not imputed', forecast: false }, { start, end: new Date(Date.parse(end) - 86400000).toISOString().slice(0, 10) }) }));
    }
    async function vegetation() {
      const collection = ee.ImageCollection(datasets.vegetation.id).filterBounds(bounds);
      const latest = await evaluate(collection.aggregate_max('system:time_start'));
      if (!Number.isFinite(latest)) throw new Error('No Sentinel-2 observations');
      const end = new Date(Date.parse(new Date(latest).toISOString().slice(0, 10)) + 86400000).toISOString().slice(0, 10);
      const start = new Date(Date.parse(end) - 30 * 86400000).toISOString().slice(0, 10);
      const previousStart = new Date(Date.parse(start) - 30 * 86400000).toISOString().slice(0, 10);
      function window(from, to, prefix) {
        const observations = collection.filterDate(from, to).map(image => {
          const scl = image.select('SCL');
          // SCL 4/5/6: vegetation, bare soil, water; exclude cloud, shadow, snow and unclassified pixels.
          const mask = scl.eq(4).or(scl.eq(5)).or(scl.eq(6));
          const red = image.select('B4').multiply(.0001), nir = image.select('B8').multiply(.0001);
          const sum = nir.add(red);
          return nir.subtract(red).divide(sum).updateMask(mask.and(sum.gt(0))).rename('ndvi');
        });
        const empty = ee.Image.constant(0).rename('ndvi').updateMask(ee.Image.constant(0));
        const safe = ee.ImageCollection(ee.Algorithms.If(observations.size().gt(0), observations, ee.ImageCollection([empty])));
        const count = safe.count();
        const sufficient = count.gte(3);
        return safe.median().updateMask(sufficient).rename(prefix + 'Ndvi').addBands(count.rename(prefix + 'Observations')).addBands(sufficient.unmask(0).rename(prefix + 'Coverage'));
      }
      const image = window(start, end, 'current').addBands(window(previousStart, start, 'previous'));
      return (await summaries(image, 10)).map(row => {
        const coverage = finite(row.currentCoverage, 0, 1), previousCoverage = finite(row.previousCoverage, 0, 1);
        return { id: row.plotId, sample: sourceSample('vegetation', { ndvi: coverage !== null && coverage >= .5 ? finite(row.currentNdvi, -1, 1) : null, previousNdvi: previousCoverage !== null && previousCoverage >= .5 ? finite(row.previousNdvi, -1, 1) : null, validCoverage: coverage, previousValidCoverage: previousCoverage, meanObservations: finite(row.currentObservations, 0, 1000), minimumObservations: 3, previousPeriod: { start: previousStart, end: new Date(Date.parse(start) - 86400000).toISOString().slice(0, 10) }, method: 'Median cloud-masked NDVI; at least three observations per pixel over at least half the polygon' }, { start, end: new Date(Date.parse(end) - 86400000).toISOString().slice(0, 10) }) };
      });
    }
    result.errors = [];
    // Keep requests sequential to avoid excess concurrent raster aggregation.
    for (const [key, run] of Object.entries({ ph: () => soil('ph'), carbon: () => soil('carbon'), texture: () => soil('texture'), weather, vegetation })) {
      const source = result.sources.find(source => source.name === datasets[key].name);
      try {
        const rows = await run();
        for (const row of rows) result.byPlot[row.id][key] = row.sample;
        Object.assign(source, { status: 'connected', purpose: `${datasets[key].kind}; native resolution ${datasets[key].resolutionMeters} m; dates and quality retained per location.` });
        console.log(`${key}: received ${rows.length} polygon summaries`);
      } catch {
        // Do not write provider messages, credentials or request headers into public snapshots.
        result.errors.push({ name: key, code: 'fetch_failed', message: 'Earth Engine extraction failed. Check access, source availability and data coverage.' });
        source.purpose = 'Extraction failed. No replacement values were generated.';
        console.error(`${key}: extraction failed`);
      }
    }
  } catch {
    result.errors = Object.keys(datasets).map(name => ({ name, code: 'authentication_failed', message: 'Earth Engine initialization failed. Check project registration and credentials.' }));
    console.error('Earth Engine initialization failed. Check project registration and credentials.');
  }
  await save();
  if (result.errors.length) process.exitCode = 1;
}
