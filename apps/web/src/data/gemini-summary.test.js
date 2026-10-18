import { test, expect } from 'vitest';
import { validateSummary } from '../../scripts/gemini-summary.mjs';
const months=[{id:'2026-11',rain:200,lower:100,upper:300}];
test('AI explanations cannot invent numbers, unknown months, or unsupported actions',()=>{
 expect(()=>validateSummary({summary:'Hujan diperkirakan pasti 900 mm.',watchMonths:[],actions:['verify_water']},months)).toThrow();
 expect(()=>validateSummary({summary:'Pola musim masih memiliki ketidakpastian.',watchMonths:['2030-01'],actions:['verify_water']},months)).toThrow();
 expect(()=>validateSummary({summary:'Pola musim masih memiliki ketidakpastian.',watchMonths:[],actions:['approve_aid']},months)).toThrow();
});
test('rainfall summaries cannot invent seasonal irrigation flow',()=>{
 expect(()=>validateSummary({summary:'Seasonal flow diminishes severely in the driest quarter.',watchMonths:['2026-11'],actions:['verify_water']},months)).toThrow();
});

test('rainfall text rejects HTML or instruction payloads',()=>{expect(()=>validateSummary({summary:'<img src=x onerror=alert(document.cookie)>',watchMonths:[],actions:['verify_water']},months)).toThrow();});
