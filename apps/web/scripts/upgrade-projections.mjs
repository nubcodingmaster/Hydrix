
import { readFile, writeFile, rename } from 'node:fs/promises';
import { buildProjection } from './seasonal-model.mjs';

const input = new URL('../public/data/projections.json', import.meta.url);
const temporary = new URL('../public/data/projections.tmp', import.meta.url);
const snapshot = JSON.parse(await readFile(input, 'utf8'));
const byPixel = {};
const issuedAt = new Date().toISOString();

for (const [pixel, previous] of Object.entries(snapshot.byPixel)) {
    if (!Array.isArray(previous.history) || previous.history.length < 300) {
        throw new Error(`Missing historical observations for ${pixel}`);
    }

    const projection = buildProjection(previous.history, issuedAt, pixel);

    if (projection.climatology?.length !== 12 || projection.months.some(month => !month.anomaly)) {
        throw new Error(`Incomplete anomaly data for ${pixel}`);
    }

    byPixel[pixel] = {
        ...projection,
        history: previous.history,
        sources: previous.sources,
        ...(previous.aiSummary
        ? { aiSummary: previous.aiSummary }
        : {}),
    };

    console.log(pixel, 'climatology:', projection.climatology.length, 'months:', projection.months.length);
}

const upgraded = {
    ...snapshot,
    issuedAt,
    byPixel,
};

await writeFile(temporary, JSON.stringify(upgraded));
await rename(temporary, input);

console.log('Upgraded projections for', Object.keys(byPixel).length, 'CHIRPS cells');
