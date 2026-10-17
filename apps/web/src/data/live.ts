import type { MultiPolygon, Polygon } from 'geojson';

export type RainMonth = { id: string; rain: number | null; pixel: string; source: string };
export type RainfallAnomaly = {
  status:
    | 'below-normal'
    | 'near-normal'
    | 'above-normal'
    | 'insufficient-data';
  deviationPercent: number | null;
  signal:
    | 'below-normal'
    | 'above-normal'
    | 'uncertain';
};
export type ProjectionMonth = {
  id: string;
  rain: number;
  lower: number;
  upper: number;
  anomaly?: RainfallAnomaly;
};
export type MonthlyClimatology = {
  month: number;
  medianMm: number;
  observations: number;
};
export type Projection = {
  pixel: string; issuedAt: string; kind: 'seasonal-projection'; method: string;
  training: { start: string; end: string; observations: number };
  validation: { selectionYears: string; calibrationYears: string; evaluationYears: string; maeMm: number; baselineMaeMm: number; intervalCoverage: number; evaluatedMonths: number };
  interval: { nominalCoverage: number; radiusMm: number; method: string };
  confidence: 'low'; months: ProjectionMonth[]; climatology?: MonthlyClimatology[]; limitations: string[];
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
  schemaVersion: 1; fetchedAt: string; period: { start: string; end: string; kind: 'historical' };
  plots: Plot[];
  sources: { name: string; url: string; status: 'connected' | 'unavailable'; purpose: string }[];
  quality: { accepted: number; rejected: { id: string; reason: string }[]; excludedGarlic: string; rainfallMethod: string };
  environment?: { fetchedAt: string; byPlot: Record<string, Environment>; sources: Snapshot['sources']; errors: { name: string; message: string }[] };
  projections?: { issuedAt: string; provider: string; byPixel: Record<string, Projection> };
};
export type Candidate = { id: string; name: string; status: string; note: string; unknown: string; count: number };
export function monthLabel(id: string, short = false) {
  return new Intl.DateTimeFormat('id-ID', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric', timeZone: 'UTC' }).format(new Date(`${id}-01T00:00:00Z`));
}
export function dateLabel(id: string | null) {
  if (!id) return 'Tanggal belum tercatat';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' }).format(new Date(id));
}
export function rainfallText(value: number | null) {
  return value === null ? 'Belum tersedia' : `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} mm`;
}
export function candidates(snapshot: Snapshot): Candidate[] {
  return ['Bawang merah', 'Bawang daun', 'Bawang putih'].map((name, index) => {
    const count = snapshot.plots.filter(p => p.crop === name).length;
    return {
      id: String(index), name, count,
      status: count ? 'Tercatat dalam survei' : 'Bukti belum layak',
      note: count ? `${count} poligon survei historis tercatat di Majalengka. Catatan ini mendukung peninjauan kandidat, belum membuktikan kesesuaian saat ini.` : snapshot.quality.excludedGarlic,
      unknown: 'Suhu, elevasi, pH, air operasional, varietas, dan riwayat OPT terkini',
    };
  });
}
export function plotAction(plot: Plot) {
  return `Verifikasi kondisi lahan ${plot.village || plot.district}, sumber air, dan fungsi ${plot.irrigation ? irrigationLabel(plot.irrigation).toLowerCase() : 'irigasi'}. Perbarui kondisi lapangan sebelum menetapkan bantuan atau waktu tanam.`;
}
export function irrigationLabel(value: string | null) {
  return value ? value.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Belum tercatat';
}
export function fieldReport(plot: Plot, snapshot: Snapshot) {
  return { location: plot, candidates: candidates(snapshot), action: plotAction(plot), seasonal_projection: projectionFor(plot,snapshot), environment: snapshot.environment?.byPlot[plot.id] ?? null, soil_moisture: null, ndvi: null, fetched_at: snapshot.fetchedAt, rainfall_period: snapshot.period, limitations: ['Atribut lahan berasal dari survei historis, bukan kondisi saat ini.', 'Proyeksi statistik memakai pola musiman historis; bukan prakiraan atmosfer atau cuaca harian.', 'Bantuan dan kesesuaian tanaman memerlukan verifikasi lapangan.'] };
}
export function projectionFor(plot: Plot, snapshot: Snapshot) {
  return snapshot.projections?.byPixel[plot.rainfall.at(-1)?.pixel || ''] ?? null;
}
export function projectionSummary(projection: Projection | null) {
  if (!projection) {
    return 'Proyeksi belum tersedia. Angka masa depan tidak diisi tanpa model.';
  }

  const aiSummary = projection.aiSummary;

  if (aiSummary?.provider === 'Gemini' && aiSummary.summary.trim()) {
    return aiSummary.summary;
  }

  const dry = [...projection.months].sort((a, b) => a.rain - b.rain).slice(0, 3);
  return `Bulan yang diproyeksikan relatif lebih kering: ${dry.map(m => monthLabel(m.id)).join(', ')}. Tinjau sumber air dan kebutuhan tanaman sebelum menentukan waktu tanam.`;
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
  if (!response.ok) throw new Error('Data sumber belum dapat dimuat. Coba lagi.');
  const data = await response.json();
  if (data.schemaVersion !== 1 || !Array.isArray(data.plots) || !data.plots.length || !data.plots.every((p: Plot) => p.id && p.geometry && Array.isArray(p.rainfall))) throw new Error('Format data sumber tidak valid.');
  const optional = async (path: string) => {
    try { const response = await fetch(path,{signal,cache:'no-cache'}); if(!response.ok) return undefined; const value=await response.json(); return value.schemaVersion===1?value:undefined; } catch { return undefined; }
  };
  const [environment,projections] = await Promise.all([optional('/data/environment.json'),optional('/data/projections.json')]);
  data.environment=environment?.baseFetchedAt===data.fetchedAt?environment:undefined; data.projections=projections?.baseFetchedAt===data.fetchedAt?projections:undefined;
  if(data.environment?.sources) data.sources.push(...data.environment.sources);
  if(data.projections) data.sources.push({name:'Model proyeksi hujan musiman',url:'https://coastwatch.pfeg.noaa.gov/erddap/info/chirps20GlobalMonthlyP05/index.html',status:'connected',purpose:'Model lokal terlatih dari CHIRPS multi-tahun; uji historis dan rentang ketidakpastian tersedia. Bukan layanan ramalan BMKG atau Gemini.'});
  data.sources=data.sources.map((source: Snapshot['sources'][number])=>source.name==='Prakiraan cuaca'?{...source,name:'Prakiraan atmosfer dinamis',purpose:'Belum ada keluaran model cuaca BMKG/ECMWF; proyeksi statistik disajikan terpisah.'}:source);
  return data;
}
