/** Screening policies support preparation, not confirmed damage or aid eligibility. */
export const planningPolicy = {ndviDrop:.15,ndviRelativeDrop:.3,previousNdvi:.3,validCoverage:.8,recentDays:30,dryMonthMm:100,dryRunMonths:2,waterLeadMonths:3,shallotMinPh:5.6,shallotMaxPh:6.5,lowCarbonGKg:20};
export function shiftMonth(month,count){const value=Number(month.slice(0,4))*12+Number(month.slice(5,7))-1+count;return `${Math.floor(value/12)}-${String(((value%12)+12)%12+1).padStart(2,'0')}`;}
export function dryRuns(projection,currentMonth){
 const months=[...new Map((projection?.months??[]).filter(m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m.id)&&m.id>=currentMonth).map(m=>[m.id,m])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 const runs=[];
 const dry=m=>[m.rain,m.lower,m.upper].every(Number.isFinite)&&m.lower>=0&&m.lower<=m.rain&&m.rain<=m.upper&&m.rain<planningPolicy.dryMonthMm;
 for(let i=0;i<months.length;i++){
  if(!dry(months[i]))continue;const run=[months[i]];
  while(i+1<months.length&&dry(months[i+1])&&shiftMonth(months[i].id,1)===months[i+1].id)run.push(months[++i]);
  if(run.length>=planningPolicy.dryRunMonths)runs.push(run);
 }
 return runs;
}
