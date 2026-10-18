export const planningPolicy: {ndviDrop:number;ndviRelativeDrop:number;previousNdvi:number;validCoverage:number;recentDays:number;dryMonthMm:number;dryRunMonths:number;waterLeadMonths:number;shallotMinPh:number;shallotMaxPh:number;lowCarbonGKg:number};
export function shiftMonth(month:string,count:number):string;
export function dryRuns(projection:{months:{id:string;rain:number;lower:number;upper:number}[]}|null|undefined,currentMonth:string):{id:string;rain:number;lower:number;upper:number}[][];
