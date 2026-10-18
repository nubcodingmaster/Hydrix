import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock3, Droplets, Bug, Sprout, Sparkles } from 'lucide-react';
import { Button } from '@/components/motion/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { buildPlanning, type PlanItem, type PlanKind } from './data/planning';
import { dateLabel, monthLabel, type Snapshot } from './data/live';
const categories={water:{label:'Water readiness',icon:Droplets},pest:{label:'Crop inspection',icon:Bug},soil:{label:'Soil assessment',icon:Sprout}};
const monthName=(month:string)=>new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(new Date(`2000-${month}-01T00:00:00Z`));
function PlanningCard({item,onSelect}:{item:PlanItem;onSelect:(id:string)=>void}){
 const category=categories[item.kind],Icon=category.icon;
 return <article className="planning-card">
  <div className="planning-card-top"><span className={`planning-kind kind-${item.kind}`}><Icon size={15}/>{category.label}</span><span className="planning-crop">{item.crop}</span></div>
  <h3>{item.title}</h3><p className="planning-location">{item.location} <span>· {item.district}</span></p>
  <span className="planning-check-label">{item.stage==='verification'?'Field verification required':'Confirmed assistance'}</span>
  <div className="planning-dates"><div><span><CalendarDays size={13}/>{item.eventMonth?'Signal window':'Observed window'}</span><strong>{item.eventMonth?monthLabel(item.eventMonth):item.evidence[0]?.period}</strong></div><div><span><Clock3 size={13}/>Review by</span><strong>{monthLabel(item.actionMonth)}</strong></div></div>
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
 const screened=snapshot.plots.filter(plot=>district==='all'||plot.district===district).length;
 const reset=()=>setVisible({});
 return <section className="planning-board" aria-label="Government support planning">
  <div className="planning-intro"><div><h2>Plan support where evidence warrants a check.</h2><p>All {snapshot.plots.length} locations · {monthLabel(plan.months[0])} – {monthLabel(plan.months.at(-1)!)} · Reference {dateLabel(plan.asOf)}</p></div></div>
  <div className="planning-summary">
   <div className="planning-stat"><span>Confirmed assistance</span><strong>{confirmed.length}</strong><small>Needs confirmed field evidence</small></div>
   <div className="planning-stat"><span>Field checks</span><strong>{checks.length}</strong><small>Signals passing screening</small></div>
   <div className="planning-stat"><span>Water signals</span><strong>{checks.filter(item=>item.kind==='water').length}</strong><small>Reliable consecutive rainfall signals</small></div>
   <div className="planning-stat"><span>Locations screened</span><strong>{screened}</strong><small>Historical survey locations</small></div>
  </div>
  <details className="planning-criteria"><summary>What triggers a check?</summary><p>Vegetation: NDVI declines by at least 0.15 and 30% from a previous value of at least 0.3. Both observation windows need at least 80% valid coverage, the minimum observation requirement is three, and the latest window must end within thirty days.</p><p>Water: medium or high model confidence, at least twenty historical same-month observations, and two consecutive monthly rainfall intervals entirely below 80% of their historical medians. Low-confidence projections cannot create water proposals.</p><p>These are pilot screening rules, not validated crop-damage thresholds. Harvest and crop stage can also change NDVI. Modeled soil and warm weather alone do not prove fertilizer need or a pest outbreak. Connected datasets do not establish confirmed aid recipients. No signal does not prove the absence of risk.</p><p><a href="https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/" target="_blank" rel="noreferrer">NASA vegetation context</a> · <a href="https://chc.ucsb.edu/data/chirps" target="_blank" rel="noreferrer">CHIRPS rainfall context</a></p></details>
  <div className="planning-toolbar"><div className="planning-filters">
   <Select value={district} onValueChange={value=>{setDistrict(value);reset();}}><SelectTrigger aria-label="Planning district"><span>{district==='all'?'All districts':district}</span></SelectTrigger><SelectContent><SelectItem value="all">All districts</SelectItem>{districts.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
   <Select value={category} onValueChange={value=>{setCategory(value as PlanKind|'all');reset();}}><SelectTrigger aria-label="Support category"><span>{category==='all'?'All support types':categories[category].label}</span></SelectTrigger><SelectContent><SelectItem value="all">All support types</SelectItem>{Object.entries(categories).map(([key,value])=><SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent></Select>
   <Select value={year} onValueChange={value=>{setYear(value);if(month!=='all'&&!plan.months.some(id=>(value==='all'||id.startsWith(value))&&id.slice(5)===month))setMonth('all');reset();}}><SelectTrigger aria-label="Planning year"><span>{year==='all'?'All years':year}</span></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{years.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
   <Select value={month} onValueChange={value=>{setMonth(value);reset();}}><SelectTrigger aria-label="Planning month"><span>{month==='all'?'All months':monthName(month)}</span></SelectTrigger><SelectContent><SelectItem value="all">All months</SelectItem>{availableMonths.map(value=><SelectItem key={value} value={value}>{monthName(value)}</SelectItem>)}</SelectContent></Select>
  </div><span className="planning-basis">AI interpretations · {plan.aiLocations}/{snapshot.plots.length} locations · Farmer groups not linked</span></div>
  <div className="planning-views" role="group" aria-label="Planning evidence status"><Button size="sm" variant={stage==='verification'?'primary':'secondary'} aria-pressed={stage==='verification'} onClick={()=>setStage('verification')}>Field checks ({checks.length})</Button><Button size="sm" variant={stage==='confirmed'?'primary':'secondary'} aria-pressed={stage==='confirmed'} onClick={()=>setStage('confirmed')}>Confirmed assistance ({confirmed.length})</Button></div>
  <p className="planning-scope">{stage==='verification'?'Field checks verify a signal before support is proposed. They are not confirmed threats or approved assistance.':'No connected dataset currently confirms field damage, assistance eligibility or recipients.'}</p>
  {months.map(id=>{const items=filtered.filter(item=>item.stage===stage&&item.actionMonth===id),count=visible[id]??6;
   return <section key={id} className={`planning-section planning-month${items.length?'':' month-empty'}`} aria-label={`Planning for ${monthLabel(id)}`}>
    <div className="planning-section-heading"><div><h2>{monthLabel(id)} <span>{items.length}</span></h2></div></div>
    {items.length?<><div className="planning-cards">{items.slice(0,count).map(item=><PlanningCard key={item.id} item={item} onSelect={onSelect}/>)}</div>{items.length>count&&<Button variant="secondary" size="sm" className="planning-show-more" onClick={()=>setVisible(current=>({...current,[id]:count+6}))}>Show more checks ({items.length-count} remaining)</Button>}</>:<p className="planning-empty">{stage==='verification'?'No qualifying field checks scheduled.':'No confirmed assistance scheduled.'}</p>}
   </section>;
  })}
 </section>;
}
