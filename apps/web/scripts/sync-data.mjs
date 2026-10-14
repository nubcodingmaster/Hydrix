import { fromUrl } from 'geotiff';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const arcgis = 'https://geoportal.pertanian.go.id/arcgis/rest/services';
const chirps = 'https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_monthly/cogs/';
const output = fileURLToPath(new URL('../public/data/majalengka.json', import.meta.url));
const normalize = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const title = value => normalize(value).replace(/\b\w/g, x => x.toUpperCase());
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}: ${url}`);
  return response;
}
async function query(service, fields) {
  const url = `${arcgis}/${service}/MapServer/0/query?${new URLSearchParams({ where: '1=1', outFields: fields.join(','), outSR: '4326', returnGeometry: 'true', f: 'geojson' })}`;
  const data = await (await get(url)).json();
  if (data.error || !Array.isArray(data.features) || data.exceededTransferLimit || data.properties?.exceededTransferLimit) throw new Error(`Incomplete ArcGIS response: ${service}`);
  return data.features;
}
function polygonArea(geometry) {
  const radians = Math.PI / 180;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((sum, polygon) => sum + polygon.reduce((total, ring, ringIndex) => {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      area += (x2 - x1) * radians * (2 + Math.sin(y1 * radians) + Math.sin(y2 * radians));
    }
    const absolute = Math.abs(area * 6378137 ** 2 / 2);
    return total + (ringIndex ? -absolute : absolute);
  }, 0), 0) / 10000;
}
const rejected = [];
const plots = [];
for (const service of ['BawangMerah', 'Hortikultura']) {
  const fields = ['objectid', 'kabupaten', 'kecamatan', 'desa_kelurahan', 'tanggal_survey', 'komoditas', 'jenis_irigasi'];
  const features = await query(service, fields);
  for (const feature of features) {
    const p = feature.properties;
    if (normalize(p.kabupaten) !== 'majalengka') continue;
    const crop = normalize(p.komoditas).replace(/\s/g, '');
    if (service === 'Hortikultura' && crop !== 'daunbawang') continue;
    const id = `${service.toLowerCase()}-${p.objectid}`;
    const geometry = feature.geometry;
    if (!['bawangmerah', 'daunbawang'].includes(crop)) { rejected.push({ id, reason: 'Komoditas tidak terverifikasi' }); continue; }
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) { rejected.push({ id, reason: 'Geometri tidak valid' }); continue; }
    const points = geometry.coordinates.flat(geometry.type === 'Polygon' ? 1 : 2);
    if (!points.length || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < 108 || x > 108.6 || y < -7.3 || y > -6.5)) { rejected.push({ id, reason: 'Koordinat di luar batas pemeriksaan Majalengka' }); continue; }
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    const surveyDate = typeof p.tanggal_survey === 'number' && Number.isFinite(p.tanggal_survey) ? new Date(p.tanggal_survey).toISOString().slice(0, 10) : null;
    plots.push({ id, objectId: p.objectid, name: `${title(p.desa_kelurahan) || title(p.kecamatan) || 'Lahan'} · ${p.objectid}`, district: title(p.kecamatan) || 'Belum tercatat', village: title(p.desa_kelurahan) || null, crop: crop === 'daunbawang' ? 'Bawang daun' : 'Bawang merah', area: Number(polygonArea(geometry).toFixed(4)), areaMethod: 'Luas geometri sferis; bukan luas tanam survei', center, geometry, surveyDate, irrigation: p.jenis_irigasi || null, source: `${arcgis}/${service}/MapServer/0`, rainfall: [] });
  }
}
if (!plots.length) throw new Error('No valid Majalengka fields received');
const garlic = (await query('BawangPutih', ['objectid', 'kab', 'kec', 'varbenih', 'sediaair', 'keterangan'])).filter(f => normalize(f.properties.kab) === 'majalengka');
const garlicTestCount = garlic.filter(f => ['varbenih', 'sediaair', 'keterangan'].some(key => /uji/i.test(String(f.properties[key] || '')))).length;
const garlicNote = `${garlicTestCount} dari ${garlic.length} record bawang putih Majalengka memuat atribut uji. Layer ini belum menjadi bukti kelayakan; perlu verifikasi agronomis.`;
// Do not expose names of farmers, surveyors, phone numbers, or ownership attributes.
plots.sort((a, b) => a.district.localeCompare(b.district) || a.objectId - b.objectId);
const listing = await (await get(chirps)).text();
const todayMonth = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Makassar' }).format(new Date());
const files = [...new Set([...listing.matchAll(/chirps-v2\.0\.(\d{4})\.(\d{2})\.cog/g)].map(m => `${m[1]}-${m[2]}`))].filter(m => m < todayMonth).sort().slice(-12);
if (files.length !== 12) throw new Error('CHIRPS does not contain 12 complete monthly files');
for (const month of files) {
  const url = `${chirps}chirps-v2.0.${month.replace('-', '.')}.cog`;
  const tiff = await fromUrl(url, { allowFullFile: false });
  const image = await tiff.getImage();
  const origin = image.getOrigin(), resolution = image.getResolution();
  const pixels = plots.map(p => [Math.floor((p.center[0] - origin[0]) / resolution[0]), Math.floor((p.center[1] - origin[1]) / resolution[1])]);
  const x0 = Math.min(...pixels.map(p => p[0])), y0 = Math.min(...pixels.map(p => p[1]));
  const x1 = Math.max(...pixels.map(p => p[0])) + 1, y1 = Math.max(...pixels.map(p => p[1])) + 1;
  const raster = await image.readRasters({ window: [x0, y0, x1, y1], samples: [0] });
  for (let index = 0; index < plots.length; index++) {
    const [x, y] = pixels[index];
    const rain = Number(raster[0][(y - y0) * raster.width + x - x0]);
    plots[index].rainfall.push({ id: month, rain: Number.isFinite(rain) && rain >= 0 ? Number(rain.toFixed(1)) : null, pixel: `${x}:${y}`, source: url });
  }
  console.log(`CHIRPS ${month}: ${plots.length} fields, ${new Set(pixels.map(p => p.join(':'))).size} distinct cells`);
}
const snapshot = { schemaVersion: 1, fetchedAt: new Date().toISOString(), period: { start: files[0], end: files.at(-1), kind: 'historical' }, sources: [{ name: 'Kementan · Bawang Merah', url: `${arcgis}/BawangMerah/MapServer/0`, status: 'connected', purpose: 'Geometri dan atribut survei historis' }, { name: 'Kementan · Hortikultura', url: `${arcgis}/Hortikultura/MapServer/0`, status: 'connected', purpose: 'Survei bawang daun Argapura' }, { name: 'Kementan · Bawang Putih', url: `${arcgis}/BawangPutih/MapServer/0`, status: 'unavailable', purpose: garlicNote }, { name: 'CHIRPS v2 · UCSB', url: chirps, status: 'connected', purpose: 'Total hujan bulanan, piksel 0,05° di pusat batas lahan' }, { name: 'Prakiraan cuaca', url: 'https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY', status: 'unavailable', purpose: 'CHIRPS adalah estimasi hujan historis; tidak menyediakan ramalan masa depan' }, { name: 'ERA5-Land dan Sentinel-2', url: 'https://developers.google.com/earth-engine', status: 'unavailable', purpose: 'Kelembapan tanah dan NDVI belum diambil' }], quality: { accepted: plots.length, rejected, excludedGarlic: garlicNote, rainfallMethod: 'Nearest native 0.05° CHIRPS pixel at field bounding-box center; no field-scale or future inference' }, plots };
await mkdir(fileURLToPath(new URL('../public/data/', import.meta.url)), { recursive: true });
await writeFile(`${output}.tmp`, JSON.stringify(snapshot));
await rename(`${output}.tmp`, output);
console.log(`Saved ${plots.length} fields with ${files.length} real rainfall months to ${output}`);
