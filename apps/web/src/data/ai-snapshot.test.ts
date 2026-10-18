import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { attachAnalysis } from './ai';

test('published Gemini snapshot validates against every location and rainfall input', async () => {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../../public/data/${name}.json`, import.meta.url), 'utf8'));
  const snapshot = read('majalengka');
  for (const name of ['agronomy', 'environment', 'projections']) snapshot[name] = read(name);
  const analysis = read('analysis');
  await attachAnalysis(snapshot, analysis, analysis.referenceMonth);
  expect(Object.keys(snapshot.analysis.byPlot).sort()).toEqual(snapshot.plots.map((plot: { id: string }) => plot.id).sort());
  for (const projection of Object.values(snapshot.projections.byPixel) as { aiSummary?: { provider: string } }[]) {
    expect(projection.aiSummary?.provider).toBe('Gemini');
  }
});
