import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlanning, priorityFor, shiftMonth } from './planning';
import type { Snapshot } from './live';

const read = (file: string) => JSON.parse(readFileSync(new URL(`../../public/data/${file}.json`, import.meta.url), 'utf8'));
const snapshot = { ...read('majalengka'), projections: read('projections'), agronomy: read('agronomy'), environment: read('environment') } as Snapshot;
const date = new Date('2026-10-16T12:00:00Z');
describe('government support planning', () => {
  it('schedules across year boundaries using action lead times, not invented severity', () => {
    expect(shiftMonth('2027-01', -3)).toBe('2026-10');
    expect(shiftMonth('2026-12', 2)).toBe('2027-02');
    expect(priorityFor('2026-10','2026-10')).toBe('urgent');
    expect(priorityFor('2026-11','2026-10')).toBe('urgent');
    expect(priorityFor('2026-12','2026-10')).toBe('mid');
    expect(priorityFor('2027-01','2026-10')).toBe('mid');
    expect(priorityFor('2027-02','2026-10')).toBe('long');
    expect(priorityFor(null,'2026-10')).toBe('data');
  });
  it('covers every real location and retains source evidence without inventing groups or pest forecasts', () => {
    const plan = buildPlanning(snapshot, date);
    expect(plan.items).toHaveLength(snapshot.plots.length * 3);
    expect(new Set(plan.items.map(item => item.id)).size).toBe(plan.items.length);
    expect(plan.farmerGroupsLinked).toBe(false);
    for (const item of plan.items) {
      expect(snapshot.plots.some(plot => plot.id === item.plotId && plot.name === item.location)).toBe(true);
      if (item.kind === 'pest') {
        expect(item.eventMonth).toBeNull();
        expect(item.outlook).toContain('not predicted');
        expect(item.action).not.toMatch(/apply|spray|kg|litres/i);
      }
      if (item.kind === 'water') {
        expect(item.actionMonth! <= item.eventMonth!).toBe(true);
        expect(item.evidence[0].source).toContain('noaa.gov');
      }
    }
  });
  it('keeps missing soil or future weather evidence out of scheduled proposals', () => {
    const without = { ...snapshot, agronomy: undefined, projections: undefined };
    const plans = buildPlanning(without, date).items;
    expect(plans.every(item => item.priority === 'data' && item.actionMonth === null && item.eventMonth === null)).toBe(true);
    const expired = buildPlanning(snapshot, new Date('2030-01-01T00:00:00Z'));
    expect(expired.items.filter(item => item.kind !== 'soil').every(item => item.priority === 'data')).toBe(true);
  });
  it('does not treat unavailable soil indicators as a reason for fertilizer allocation', () => {
    const plan = buildPlanning(snapshot, date);
    for (const item of plan.items.filter(item => item.kind === 'soil')) {
      if (item.evidence.length < 3) {
        expect(item.actionMonth).toBeNull();
        expect(item.priority).toBe('data');
      } else {
        expect(item.priority).toBe('mid');
        expect(item.action).toContain('remain unassigned');
      }
    }
  });
  it('uses the client timezone when determining the planning reference month', () => {
    expect(buildPlanning(snapshot, new Date('2026-10-31T17:00:00Z')).asOf).toBe('2026-11-01');
  });
});

it('validated Gemini advice replaces narrative without changing policy lead times or evidence', () => {
  const data = { ...snapshot } as Snapshot;
  const baseline = buildPlanning(data, new Date('2026-10-18T00:00:00Z'));
  const first = data.plots[0];
  data.analysis = {model:'gemini-test',referenceMonth:'2026-10',byPlot:{[first.id]:{provider:'Gemini',model:'gemini-test',generatedAt:'2026-10-18',inputHash:'verified',promptVersion:'test',farmerSummary:'Review with your adviser.',governmentSummary:'Coordinate field verification.',crops:[],support:['water','soil','pest'].map(kind=>({kind:kind as 'water'|'soil'|'pest',reason:'Gemini identifies missing field evidence.',farmerAction:'Review conditions with an adviser.',governmentAction:'Prepare extension-led verification support.',evidence:['survey','water']}))}}};
  const enriched=buildPlanning(data,new Date('2026-10-18T00:00:00Z'));
  const item=enriched.items.find(item=>item.plotId===first.id && item.kind==='water')!;
  expect(item.action).toBe('Prepare extension-led verification support.');
  expect(item.actionMonth).toBe(baseline.items.find(candidate=>candidate.id===item.id)?.actionMonth);
  expect(item.analysisProvider).toBe('Gemini');
  expect(item.evidence.some(evidence=>evidence.source===data.environment!.byPlot[first.id].cropland!.source)).toBe(true);
  expect(item.evidence.some(evidence=>evidence.source===first.source)).toBe(true);
  expect(enriched.items.find(item=>item.plotId!==first.id)?.analysisProvider).toBeUndefined();
});
