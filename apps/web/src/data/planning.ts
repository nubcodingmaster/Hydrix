import { analysisEvidence } from './ai';
import { cropLabel, projectionFor, type Plot, type Snapshot } from './live';

export type Priority = 'urgent' | 'mid' | 'long' | 'data';
export type PlanKind = 'water' | 'pest' | 'soil';
export type PlanEvidence = { label: string; value: string; source: string; period?: string };
export type PlanItem = {
  id: string; plotId: string; location: string; district: string; crop: string;
  priority: Priority; kind: PlanKind; title: string; outlook: string;
  eventMonth: string | null; actionMonth: string | null; action: string;
  evidence: PlanEvidence[]; basis: string; timingBasis: string; analysisProvider?: 'Gemini'; analysisModel?: string;
};
export const priorityLabels: Record<Priority, string> = { urgent: 'Urgent', mid: 'Mid-term', long: 'Long-term', data: 'Needs data' };
export function planningDate(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
const index = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
export function shiftMonth(month: string, count: number) {
  const value = index(month) + count;
  return `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, '0')}`;
}
export function priorityFor(actionMonth: string | null, currentMonth: string): Priority {
  if (!actionMonth) return 'data';
  const remaining = index(actionMonth) - index(currentMonth);
  return remaining <= 1 ? 'urgent' : remaining <= 3 ? 'mid' : 'long';
}
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const recent = (end: string | undefined, today: string) => {
  if (!end) return false;
  const days = (Date.parse(today) - Date.parse(end)) / 86400000;
  return Number.isFinite(days) && days >= 0 && days <= 60;
};
const context = (plot: Plot) => ({ plotId: plot.id, location: plot.name, district: plot.district, crop: cropLabel(plot.crop) });

/** Draft scheduling priorities describe action lead times, never probabilities of drought or pest attack. */
export function buildPlanning(snapshot: Snapshot, referenceDate = new Date()) {
  const asOf = planningDate(referenceDate), currentMonth = asOf.slice(0, 7);
  const items: PlanItem[] = [];
  for (const plot of snapshot.plots) {
    const base = context(plot);
    const projection = projectionFor(plot, snapshot);
    const projectedMonths = projection?.months.filter(month => month.id >= currentMonth && Number.isFinite(month.rain) && month.rain >= 0) ?? [];
    const driest = [...projectedMonths].sort((a,b) => a.rain - b.rain || a.id.localeCompare(b.id))[0];
    if (driest && projection) {
      const preparation = shiftMonth(driest.id, -3);
      const actionMonth = preparation < currentMonth ? currentMonth : preparation;
      items.push({ ...base, id: `${plot.id}:water`, kind: 'water', title: 'Prepare water support',
        priority: priorityFor(actionMonth, currentMonth), eventMonth: driest.id, actionMonth,
        outlook: 'The lowest projected monthly rainfall in the remaining outlook. Water stress depends on crop demand and available water.',
        action: 'Review irrigation readiness and reserve a planning slot for repairs or water storage. Assess feasibility before proposing a borehole.',
        evidence: [{ label: 'Projected rainfall', value: `${number(driest.rain)} mm`, source: 'https://coastwatch.pfeg.noaa.gov/erddap/info/chirps20GlobalMonthlyP05/index.html', period: driest.id }, { label: 'Projection range', value: `${number(driest.lower)}–${number(driest.upper)} mm`, source: 'https://coastwatch.pfeg.noaa.gov/erddap/info/chirps20GlobalMonthlyP05/index.html', period: driest.id }],
        basis: `Seasonal CHIRPS model · ${projection.training.observations} observed months · limited reliability`,
        timingBasis: 'Suggested preparation starts three months before the lowest-rainfall month. This planning lead time is adjustable policy, not a model prediction.',
      });
    } else items.push({ ...base, id: `${plot.id}:water`, kind: 'water', title: 'Refresh water outlook', priority: 'data', eventMonth: null, actionMonth: null,
      outlook: 'No current or future rainfall projection is available for this location.', action: 'Refresh the seasonal projection before scheduling water infrastructure support.', evidence: [], basis: 'Seasonal projection unavailable or expired', timingBasis: 'No intervention month assigned without an applicable outlook.' });

    const agronomy = snapshot.agronomy?.byPlot[plot.id], weather = agronomy?.weather, vegetation = agronomy?.vegetation;
    const climate = weather?.temperatureC != null && weather.relativeHumidityPct != null && recent(weather.period.end, asOf);
    const greenness = vegetation?.ndvi != null && recent(vegetation.period.end, asOf);
    const pestEvidence: PlanEvidence[] = [];
    if (climate) pestEvidence.push({ label: 'Air temperature', value: `${number(weather.temperatureC!)} °C`, source: weather.source, period: `${weather.period.start} – ${weather.period.end}` }, { label: 'Relative humidity', value: `${number(weather.relativeHumidityPct!)}%`, source: weather.source, period: `${weather.period.start} – ${weather.period.end}` });
    if (greenness) pestEvidence.push({ label: 'Vegetation NDVI', value: number(vegetation.ndvi!), source: vegetation.source, period: `${vegetation.period.start} – ${vegetation.period.end}` });
    items.push({ ...base, id: `${plot.id}:pest`, kind: 'pest', title: climate || greenness ? 'Prepare pest surveillance' : 'Refresh pest monitoring context',
      priority: climate || greenness ? 'urgent' : 'data', eventMonth: null, actionMonth: climate || greenness ? currentMonth : null,
      outlook: 'Pest species and outbreak month are not predicted by the connected datasets.',
      action: climate || greenness ? 'Prepare monitoring traps, scouting support and extension assistance. Insecticide allocation remains pending pest identification and a crop-specific control decision.' : 'Update weather or satellite observations before prioritizing monitoring support.',
      evidence: pestEvidence, basis: 'Recent environmental observations · surveillance preparation',
      timingBasis: 'A current-month monitoring task based on available observations, not an imminent-outbreak alert. Observations older than sixty days are excluded.',
    });

    const soilEvidence: PlanEvidence[] = [];
    for (const [key, label, unit] of [['ph', 'Modeled soil pH', ''], ['carbon', 'Organic carbon', ' g/kg'], ['texture', 'Soil texture', '']] as const) {
      const sample = agronomy?.[key], depth = sample?.depths.find(depth => depth.depthCm === 10);
      if (sample && depth?.value != null) soilEvidence.push({ label, value: key === 'texture' ? depth.label || `Class ${depth.value}` : `${number(depth.value)}${unit}`, source: sample.source, period: `${sample.period.start} – ${sample.period.end} · depth 10 cm` });
    }
    const soilAvailable = soilEvidence.length === 3;
    const actionMonth = soilAvailable ? shiftMonth(currentMonth, 2) : null;
    items.push({ ...base, id: `${plot.id}:soil`, kind: 'soil', title: soilAvailable ? 'Plan nutrient support' : 'Complete soil evidence',
      priority: priorityFor(actionMonth, currentMonth), eventMonth: null, actionMonth,
      outlook: 'Historical soil estimates provide context for nutrient planning. Current nutrient deficiency is not established.',
      action: soilAvailable ? 'Prepare crop-specific nutrient planning and extension support. Fertilizer products, quantities and recipients remain unassigned.' : 'Keep fertilizer allocation pending because one or more soil indicators are unavailable.',
      evidence: soilEvidence, basis: 'OpenLandMap historical soil estimates · 250 m',
      timingBasis: 'Suggested planning slot two months from the reference month. This is a planning assumption, not a known planting date or fertilizer deadline.',
    });
  }
  let aiLocations = 0;
  for (const plot of snapshot.plots) {
    const analysis = snapshot.analysis?.referenceMonth === currentMonth ? snapshot.analysis.byPlot[plot.id] : undefined;
    if (!analysis) continue;
    aiLocations++;
    for (const item of items.filter(item => item.plotId === plot.id)) {
      const advice = analysis.support.find(support => support.kind === item.kind);
      if (!advice) continue;
      item.outlook = advice.reason;
      item.action = advice.governmentAction;
      item.evidence = [...item.evidence, ...analysisEvidence(snapshot,plot,advice.evidence)];
      item.analysisProvider = 'Gemini';
      item.analysisModel = analysis.model;
      item.basis = `Gemini analysis · ${analysis.model}. ${item.basis}`;
    }
  }
  items.sort((a,b) => (a.actionMonth ?? '9999').localeCompare(b.actionMonth ?? '9999') || a.location.localeCompare(b.location) || a.kind.localeCompare(b.kind));
  return { asOf, aiLocations, provider: aiLocations ? 'Gemini analysis with policy scheduling' : 'Data-based planning rules', version: 'planning-v1', farmerGroupsLinked: false, items };
}
