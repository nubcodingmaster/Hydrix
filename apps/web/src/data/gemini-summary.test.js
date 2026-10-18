import { test, expect } from 'vitest';
import { summarizeProjection, validateSummary } from '../../scripts/gemini-summary.mjs';
const months=[{id:'2026-11',rain:200,lower:100,upper:300}];
test('AI explanations cannot invent numbers, unknown months, or unsupported actions',()=>{
 expect(()=>validateSummary({summary:'Hujan diperkirakan pasti 900 mm.',watchMonths:[],actions:['verify_water']},months)).toThrow();
 expect(()=>validateSummary({summary:'Pola musim masih memiliki ketidakpastian.',watchMonths:['2030-01'],actions:['verify_water']},months)).toThrow();
 expect(()=>validateSummary({summary:'Pola musim masih memiliki ketidakpastian.',watchMonths:[],actions:['approve_aid']},months)).toThrow();
});
test('Gemini reads model facts without mutating projection values',async()=>{
 const projection={months,kind:'seasonal-projection',confidence:'low',validation:{},limitations:[]};const before=JSON.stringify(projection);
 const result=await summarizeProjection(projection,{key:'test-key',model:'test-model',fetcher:async(_url,request)=>{
  expect(request.headers['x-goog-api-key']).toBe('test-key');
  expect(JSON.parse(request.body).contents[0].parts[0].text).toContain('seasonal-projection');
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({summary:'Pola hujan bersifat musiman dan masih tidak pasti.',watchMonths:['2026-11'],actions:['verify_water']})}]}}]})};
 }});
 expect(result.provider).toBe('Gemini');expect(JSON.stringify(projection)).toBe(before);
});

test('rainfall summaries cannot invent seasonal irrigation flow',()=>{
 expect(()=>validateSummary({summary:'Seasonal flow diminishes severely in the driest quarter.',watchMonths:['2026-11'],actions:['verify_water']},months)).toThrow();
});
