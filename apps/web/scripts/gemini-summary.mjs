import { groundingIssues, isSafeAIText } from './analysis-contract.mjs';
/** Gemini may explain a projection; it never supplies or changes forecast numbers. */
export function validateSummary(value,months) {
 const allowed=['verify_water','inspect_drainage','consult_extension'];
 if(groundingIssues({farmerSummary:value?.summary}).length)throw new Error('Unsupported AI rainfall claims');
 if(!value||!isSafeAIText(value.summary,20,700))throw new Error('Invalid AI summary text');
 if(!Array.isArray(value.watchMonths)||!value.watchMonths.every(id=>months.some(m=>m.id===id)))throw new Error('Invalid AI forecast month');
 if(!Array.isArray(value.actions)||!value.actions.length||!value.actions.every(action=>allowed.includes(action)))throw new Error('Invalid AI action');
 return {summary:value.summary,watchMonths:[...new Set(value.watchMonths)],actions:[...new Set(value.actions)]};
}
