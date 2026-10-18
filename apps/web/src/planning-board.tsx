import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock3, Droplets, Bug, Sprout, Sparkles } from 'lucide-react';
import { Button } from '@/components/motion/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { buildPlanning, type PlanItem, type PlanKind, planningSources } from './data/planning';
import { dateLabel, monthLabel, type Snapshot } from './data/live';
const categories={water:{label:'Water readiness',icon:Droplets},pest:{label:'Crop inspection',icon:Bug},soil:{label:'Soil & fertilizer support',icon:Sprout}};
const monthName=(month:string)=>new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(new Date(`2000-${month}-01T00:00:00Z`));
function PlanningCard({item,onSelect}:{item:PlanItem;onSelect:(id:string)=>void}){
 const category=categories[item.kind],Icon=category.icon;
 return <article className="planning-card">
  <div className="planning-card-top"><span className={`planning-kind kind-${item.kind}`}><Icon size={15}/>{category.label}</span><span className="planning-crop">{item.crop}</span></div>
  <h3>{item.title}</h3><p className="planning-location">{item.location} <span>· {item.district}</span></p>
  <span className="planning-check-label">{item.stage==='confirmed'?'Confirmed assistance':item.kind==='water'?'Seasonal preparation · verify recipients':item.kind==='soil'?'Soil test required before allocation':'Field verification required'}</span>
  <div className="planning-dates"><div><span><CalendarDays size={13}/>{item.eventMonth?'Signal window':'Observed window'}</span><strong>{item.eventMonth?`${monthLabel(item.eventMonth)}${item.eventEndMonth&&item.eventEndMonth!==item.eventMonth?` – ${monthLabel(item.eventEndMonth)}`:''}`:item.evidence[0]?.period}</strong></div><div><span><Clock3 size={13}/>Review by</span><strong>{monthLabel(item.actionMonth)}</strong></div></div>
  <p className="planning-outlook">{item.outlook}</p>
  <div className="planning-action"><span>{item.analysisProvider&&<Sparkles size={14} aria-label="AI-assisted"/>}Suggested support</span><p>{item.action}</p></div>
  <details className="planning-evidence"><summary>Why this check</summary><p>{item.basis}</p><p>{item.timingBasis}</p><p>{item.analysisProvider?`AI interpretation · ${item.analysisModel}. Eligibility is determined by the screening indicators.`:'Source-based screening · AI interpretation unavailable for this check.'}</p>{item.evidence.map((e,i)=><a key={i} href={e.source} target="_blank" rel="noreferrer"><span>{e.label}</span><strong>{e.value}</strong><small>{e.period}</small></a>)}</details>
  <Button variant="ghost" size="sm" className="planning-location-link" onClick={()=>onSelect(item.plotId)}>View on map <ArrowUpRight size={14}/></Button>
 </article>;
}
export default function PlanningBoard({snapshot,onSelect}:{snapshot:Snapshot;onSelect:(id:string)=>void}){
 const [reference]=useState(()=>new Date());
 const plan=useMemo(()=>buildPlanning(snapshot,reference),[snapshot,reference]);
 const [district,setDistrict]=useState('all'),[category,setCategory]=useState<PlanKind|'all'>('all');
 const [year,setYear]=useState('all'),[month,setMonth]=useState('all');
 const [stage,setStage]=useState<PlanItem['stage']>('verification');
 const [visible,setVisible]=useState<Record<string,number>>({});
 const districts=[...new Set(snapshot.plots.map(plot=>plot.district))].sort();
 const years=[...new Set(plan.months.map(id=>id.slice(0,4)))];
 const availableMonths=[...new Set(plan.months.filter(id=>year==='all'||id.startsWith(year)).map(id=>id.slice(5)))].sort();
 const months=plan.months.filter(id=>(year==='all'||id.startsWith(year))&&(month==='all'||id.slice(5)===month));
 const filtered=plan.items.filter(item=>(district==='all'||item.district===district)&&(category==='all'||item.kind===category)&&months.includes(item.actionMonth));
 const checks=filtered.filter(item=>item.stage==='verification'),confirmed=filtered.filter(item=>item.stage==='confirmed');
 const reset=()=>setVisible({});
 return <section className="planning-board" aria-label="Government support planning">
  <div className="planning-intro"><div><h2>Prepare targeted support before seasonal risks.</h2><p>All {snapshot.plots.length} locations · {monthLabel(plan.months[0])} – {monthLabel(plan.months.at(-1)!)} · Reference {dateLabel(plan.asOf)}</p></div></div>
  <div className="planning-summary">
   <div className="planning-stat"><span>Confirmed assistance</span><strong>{confirmed.length}</strong><small>Needs confirmed field evidence</small></div>
   <div className="planning-stat"><span>Support proposals</span><strong>{checks.length}</strong><small>Conditional preparation and checks</small></div>
   <div className="planning-stat"><span>Water readiness</span><strong>{checks.filter(item=>item.kind==='water').length}</strong><small>Projected consecutive dry months</small></div>
   <div className="planning-stat"><span>Soil & fertilizer</span><strong>{checks.filter(item=>item.kind==='soil').length}</strong><small>Flagged pH or organic carbon</small></div>
  </div>
  <details className="planning-criteria"><summary>What triggers a proposal?</summary><p>Water: at least two consecutive monthly point projections below 100 mm/month trigger irrigation preparation three months earlier. Low-confidence projections are included with their full intervals. One continuous dry run creates one proposal per location. This is not a BMKG season-onset or drought declaration.</p><p>Soil: modeled shallot pH below 5.6 or above 6.5, or organic carbon below 20 g/kg (2%), triggers targeted soil and fertilizer support. Confirm acidity before providing dolomite; confirm low carbon before providing mature compost or organic fertilizer. N, P and K soil testing determines fertilizer products and rates. Historical regional estimates do not establish current deficiency.</p><p>Vegetation: NDVI declines by at least 0.15 and 30% from a previous value of at least 0.3, with at least 80% valid coverage, three observations, and a window ending within thirty days. Harvest and crop stage can also change NDVI.</p><p>These proposals support preparation and field verification, not approved recipients. Confirm active crops, planting dates and unmet water or nutrient needs before allocation. No qualifying proposal does not prove the absence of risk.</p><p><a href={planningSources.rainfall} target="_blank" rel="noreferrer">BMKG rainfall classification context</a> · <a href={planningSources.shallot} target="_blank" rel="noreferrer">Kementan shallot guidance</a> · <a href={planningSources.fertilizer} target="_blank" rel="noreferrer">Soil-test fertilizer recommendations</a></p></details>
  <div className="planning-toolbar"><div className="planning-filters">
   <Select value={district} onValueChange={value=>{setDistrict(value);reset();}}><SelectTrigger aria-label="Planning district"><span>{district==='all'?'All districts':district}</span></SelectTrigger><SelectContent><SelectItem value="all">All districts</SelectItem>{districts.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
   <Select value={category} onValueChange={value=>{setCategory(value as PlanKind|'all');reset();}}><SelectTrigger aria-label="Support category"><span>{category==='all'?'All support types':categories[category].label}</span></SelectTrigger><SelectContent><SelectItem value="all">All support types</SelectItem>{Object.entries(categories).map(([key,value])=><SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent></Select>
   <Select value={year} onValueChange={value=>{setYear(value);if(month!=='all'&&!plan.months.some(id=>(value==='all'||id.startsWith(value))&&id.slice(5)===month))setMonth('all');reset();}}><SelectTrigger aria-label="Planning year"><span>{year==='all'?'All years':year}</span></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{years.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
   <Select value={month} onValueChange={value=>{setMonth(value);reset();}}><SelectTrigger aria-label="Planning month"><span>{month==='all'?'All months':monthName(month)}</span></SelectTrigger><SelectContent><SelectItem value="all">All months</SelectItem>{availableMonths.map(value=><SelectItem key={value} value={value}>{monthName(value)}</SelectItem>)}</SelectContent></Select>
  </div><span className="planning-basis">AI interpretations · {plan.aiLocations}/{snapshot.plots.length} locations · Farmer groups not linked</span></div>
  <div className="planning-views" role="group" aria-label="Planning evidence status"><Button size="sm" variant={stage==='verification'?'primary':'secondary'} aria-pressed={stage==='verification'} onClick={()=>setStage('verification')}>Support proposals ({checks.length})</Button><Button size="sm" variant={stage==='confirmed'?'primary':'secondary'} aria-pressed={stage==='confirmed'} onClick={()=>setStage('confirmed')}>Confirmed assistance ({confirmed.length})</Button></div>
  <p className="planning-scope">{stage==='verification'?'Conditional support proposals use rainfall projections, soil indicators and vegetation changes. Field verification determines recipients and actual allocation.':'No connected dataset currently confirms field damage, assistance eligibility or recipients.'}</p>
  {months.map(id=>{const items=filtered.filter(item=>item.stage===stage&&item.actionMonth===id),count=visible[id]??6;
   return <section key={id} className={`planning-section planning-month${items.length?'':' month-empty'}`} aria-label={`Planning for ${monthLabel(id)}`}>
    <div className="planning-section-heading"><div><h2>{monthLabel(id)} <span>{items.length}</span></h2></div></div>
    {items.length?<><div className="planning-cards">{items.slice(0,count).map(item=><PlanningCard key={item.id} item={item} onSelect={onSelect}/>)}</div>{items.length>count&&<Button variant="secondary" size="sm" className="planning-show-more" onClick={()=>setVisible(current=>({...current,[id]:count+6}))}>Show more proposals ({items.length-count} remaining)</Button>}</>:<p className="planning-empty">{stage==='verification'?'No qualifying support proposals scheduled.':'No confirmed assistance scheduled.'}</p>}
   </section>;
  })}
 </section>;
}
