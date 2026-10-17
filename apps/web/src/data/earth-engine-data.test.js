import { expect, test } from 'vitest';
import { decodeSoil, emptyAgronomy, weatherCoverage } from '../../scripts/earth-engine-data.mjs';
test('decodes native soil units and preserves missing observations', () => {
  expect(decodeSoil('ph', 55)).toBe(5.5);
  expect(decodeSoil('carbon', 4)).toBe(20);
  expect(decodeSoil('texture', 7)).toBe(7);
  for (const key of ['ph', 'carbon', 'texture']) for (const raw of [null, undefined, -9999, NaN, '5']) expect(decodeSoil(key, raw)).toBeNull();
  expect(decodeSoil('ph', 255)).toBeNull();
  expect(decodeSoil('texture', 7.5)).toBeNull();
});
test('unconfigured extraction records all five sources without fabricated values', () => {
  const value = emptyAgronomy({ fetchedAt: 'test-version', plots: [{ id: 'a' }] }, 'Not configured');
  expect(value.sources).toHaveLength(5);
  expect(value.sources.every(source => source.status === 'unavailable')).toBe(true);
  expect(Object.values(value.byPlot.a)).toEqual([null, null, null, null, null]);
  expect(value.baseFetchedAt).toBe('test-version');
});
test('retains provider gaps and rejects insufficient or duplicate hourly observations', () => {
  const start = '2026-09-10', end = '2026-10-10';
  const timestamps = Array.from({ length: 720 }, (_, i) => Date.parse(start) + i * 3600000);
  const complete = weatherCoverage(timestamps, start, end);
  expect(complete.hours).toBe(720);
  expect(complete.missingHours).toEqual([]);
  const partial = weatherCoverage(timestamps.slice(28), start, end);
  expect(partial.hours).toBe(692);
  expect(partial.hourlyCoverage).toBe(692 / 720);
  expect(partial.missingHours).toHaveLength(28);
  expect(partial.missingHours[0]).toBe('2026-09-10T00:00:00.000Z');
  expect(() => weatherCoverage(timestamps.slice(73), start, end)).toThrow('below 90%');
  expect(() => weatherCoverage([...timestamps.slice(1), timestamps[1]], start, end)).toThrow('timestamps');
  expect(() => weatherCoverage([...timestamps.slice(1), Date.parse(end)], start, end)).toThrow('timestamps');
});
