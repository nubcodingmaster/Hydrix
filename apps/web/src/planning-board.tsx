import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock3, Droplets, Bug, Sprout } from 'lucide-react';
import { Button } from '@/components/motion/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { buildPlanning, priorityLabels, type PlanItem, type PlanKind, type Priority } from './data/planning';
import { dateLabel, monthLabel, type Snapshot } from './data/live';

const sections: { id: Priority; description: string }[] = [
  { id: 'urgent', description: 'Prepare this month or next month' },
  { id: 'mid', description: 'Prepare within two to three months' },
  { id: 'long', description: 'Plan at least four months ahead' },
  { id: 'data', description: 'Complete the evidence before scheduling' },
];
const categories = { water: { label: 'Water support', icon: Droplets }, pest: { label: 'Crop protection', icon: Bug }, soil: { label: 'Nutrient planning', icon: Sprout } };

function PlanningCard({ item, onSelect }: { item: PlanItem; onSelect: (id: string) => void }) {
  const category = categories[item.kind], Icon = category.icon;
  return <article className={`planning-card planning-${item.priority}`}>
    <div className="planning-card-top"><span className={`planning-kind kind-${item.kind}`}><Icon size={15}/>{category.label}</span><span className="planning-crop">{item.crop}</span></div>
    <h3>{item.title}</h3><p className="planning-location">{item.location} <span>· {item.district}</span></p>
    <div className="planning-dates"><div><span><CalendarDays size={13}/>{item.kind === 'water' ? 'Drier window' : 'Risk window'}</span><strong>{item.eventMonth ? monthLabel(item.eventMonth) : 'Not established'}</strong></div><div><span><Clock3 size={13}/>Prepare by</span><strong>{item.actionMonth ? monthLabel(item.actionMonth) : 'Pending data'}</strong></div></div>
    <p className="planning-outlook">{item.outlook}</p>
    <div className="planning-action"><span>{item.analysisProvider === 'Gemini' ? 'Gemini · suggested support' : 'Rule-based draft · AI unavailable'}</span><p>{item.action}</p></div>
    <details className="planning-evidence"><summary>Why this proposal</summary><p>{item.basis}</p><p>{item.timingBasis}</p>{item.evidence.map((evidence, index) => <a key={index} href={evidence.source} target="_blank" rel="noreferrer"><span>{evidence.label}</span><strong>{evidence.value}</strong><small>{evidence.period}</small></a>)}</details>
    <Button variant="ghost" size="sm" className="planning-location-link" onClick={() => onSelect(item.plotId)}>View on map <ArrowUpRight size={14}/></Button>
  </article>;
}

export default function PlanningBoard({ snapshot, onSelect }: { snapshot: Snapshot; onSelect: (id: string) => void }) {
  const [reference] = useState(() => new Date());
  const plan = useMemo(() => buildPlanning(snapshot, reference), [snapshot, reference]);
  const [district, setDistrict] = useState('all');
  const [category, setCategory] = useState<PlanKind | 'all'>('all');
  const [visible, setVisible] = useState<Record<Priority, number>>({ urgent: 6, mid: 6, long: 6, data: 6 });
  const districts = [...new Set(snapshot.plots.map(plot => plot.district))].sort();
  const filtered = plan.items.filter(item => (district === 'all' || item.district === district) && (category === 'all' || item.kind === category));
  function reset() { setVisible({ urgent: 6, mid: 6, long: 6, data: 6 }); }
  return <section className="planning-board" aria-label="Government support planning">
    <div className="planning-intro"><div><h2>Prepare support before the season changes.</h2><p>All {snapshot.plots.length} locations · {districts.length} districts · Reference {dateLabel(plan.asOf)}</p></div></div>
    <div className="planning-summary">{sections.map(section => <div className={`planning-stat stat-${section.id}`} key={section.id}><span>{priorityLabels[section.id]}</span><strong>{filtered.filter(item => item.priority === section.id).length}</strong><small>{section.description}</small></div>)}</div>
    <div className="planning-toolbar"><div className="planning-filters"><Select value={district} onValueChange={value => {setDistrict(value);reset();}}><SelectTrigger aria-label="Planning district"><span>{district === 'all' ? 'All districts' : district}</span></SelectTrigger><SelectContent><SelectItem value="all">All districts</SelectItem>{districts.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select value={category} onValueChange={value => {setCategory(value as PlanKind | 'all');reset();}}><SelectTrigger aria-label="Support category"><span>{category === 'all' ? 'All support types' : categories[category].label}</span></SelectTrigger><SelectContent><SelectItem value="all">All support types</SelectItem>{Object.entries(categories).map(([key, value]) => <SelectItem value={key} key={key}>{value.label}</SelectItem>)}</SelectContent></Select></div><span className="planning-basis">{plan.aiLocations ? `Gemini analyses · ${plan.aiLocations}/${snapshot.plots.length} locations · Farmer groups not linked` : 'Rule-based drafts · AI unavailable · Farmer groups not linked'}</span></div>
    {sections.map(section => {
      const items = filtered.filter(item => item.priority === section.id);
      return <section className={`planning-section section-${section.id}`} key={section.id} aria-label={`${priorityLabels[section.id]} proposals`}>
        <div className="planning-section-heading"><div><h2>{priorityLabels[section.id]} <span>{items.length}</span></h2><p>{section.description}</p></div></div>
        {items.length ? <><div className="planning-cards">{items.slice(0, visible[section.id]).map(item => <PlanningCard key={item.id} item={item} onSelect={onSelect}/>)}</div>{items.length > visible[section.id] && <Button className="planning-show-more" variant="secondary" size="sm" onClick={() => setVisible(current => ({...current, [section.id]:current[section.id] + 6}))}>Show more {priorityLabels[section.id].toLowerCase()} proposals ({items.length - visible[section.id]} remaining)</Button>}</> : <p className="planning-empty">No proposals in this time window.</p>}
      </section>;
    })}
  </section>;
}
