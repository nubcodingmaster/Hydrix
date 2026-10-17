
import { readFile, writeFile, rename } from 'node:fs/promises';
import { summarizeProjection } from './gemini-summary.mjs';

try {
    process.loadEnvFile('.env.local');
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL;

if (!key) {
    console.log('Gemini is not configured. Statistical projections remain available.');
    process.exit(0);
}

if (!model) {
    throw new Error('Set GEMINI_MODEL before requesting AI summaries');
}

const file = new URL('../public/data/projections.json', import.meta.url);
const temporary = new URL('../public/data/projections-ai.tmp', import.meta.url);
const data = JSON.parse(await readFile(file, 'utf8'));
const entries = Object.entries(data.byPixel);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function saveProgress() {
    await writeFile(temporary, JSON.stringify(data));
    await rename(temporary, file);
}

async function generateWithRetry(projection) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await summarizeProjection(projection, { key, model });
        } catch (error) {
            const retryable = /Gemini HTTP (429|503)/.test(error.message);

            if (!retryable || attempt === 3) {
                throw error;
            }

            const delay = attempt * 30000;
            console.warn(`Request failed (${error.message}). Retrying in ${delay / 1000}s...`);
            await sleep(delay);
        }
    }
}

let completed = 0;

for (const [pixel, projection] of entries) {
  if (projection.aiSummary?.model === model) {
    console.log(`Skipping ${pixel}: existing Gemini summary`);
    continue;
  }

  console.log(`Generating ${pixel}...`);

  try {
    projection.aiSummary = await generateWithRetry(projection);
    await saveProgress();

    completed++;
    console.log(`Saved ${pixel} (${completed} new summaries)`);

    if (completed < entries.length) {
        await sleep(20000);
    }
  } catch (error) {
    console.error(`Failed at ${pixel}: ${error.message}`);
    console.error('Previously completed summaries are preserved.');
    process.exitCode = 1;
    break;
  }
}

console.log(`Generation finished. New summaries: ${completed}`);
