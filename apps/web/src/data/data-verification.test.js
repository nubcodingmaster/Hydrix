import {readFileSync} from 'node:fs';
import {test,expect} from 'vitest';
import {verifySnapshots} from '../../scripts/verify-data.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../../public/data/${name}.json`,import.meta.url),'utf8'));
const fixture=()=>Object.fromEntries(['majalengka','agronomy','environment','projections','analysis'].map(name=>[name,read(name)]));
test('source snapshots must match, cover all locations and retain valid rainfall intervals',async()=>{
 const data=fixture();expect((await verifySnapshots(data)).locations).toBe(106);
 data.agronomy.baseFetchedAt='old';await expect(verifySnapshots(data)).rejects.toThrow('Mismatched agronomy');
 const missing=fixture();delete missing.environment.byPlot[missing.majalengka.plots[0].id];await expect(verifySnapshots(missing)).rejects.toThrow('Missing environment');
 const invalid=fixture();Object.values(invalid.projections.byPixel)[0].months[0].lower=-1;await expect(verifySnapshots(invalid)).rejects.toThrow('Invalid rainfall');
});
test('publication gate rejects incomplete or stale AI without claiming a generated fallback is AI',async()=>{
 const data=fixture();data.analysis.byPlot={};
 await expect(verifySnapshots(data,{requireAI:true})).rejects.toThrow('Incomplete current AI');
 const report=await verifySnapshots(data);expect(report.aiLocations).toBe(0);
});
