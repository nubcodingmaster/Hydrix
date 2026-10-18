import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, CircleHelp, Database, ExternalLink, ClipboardList, Map, MapPin, Navigation, ShieldCheck, Sprout, Waves } from 'lucide-react';
import { AnimatedSidebar, AnimatedSidebarProvider, AnimatedSidebarHeader, AnimatedSidebarContent, AnimatedSidebarFooter, AnimatedSidebarMenu, AnimatedSidebarMenuItem, AnimatedSidebarMenuButton, AnimatedSidebarTrigger, AnimatedSidebarInset } from '@/components/motion/animated-sidebar';
import { Button } from '@/components/motion/button';
import { Card, CardContent } from '@/components/motion/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { BottomSheet } from '@/components/motion/bottom-sheet';
import PilotMap from './pilot-map';
import RainfallHistory from './rainfall-history';
import EnvironmentContext from './environment-context';
import ProjectionPanel from './projection-panel';
import AgronomyPanel from './agronomy-panel';
import PlanningBoard from './planning-board';
import { cropLabel, candidates, projectionFor, containsPoint, dateLabel, irrigationLabel, loadSnapshot, monthLabel, rainfallHistory, rainfallText, type Candidate, type Snapshot } from './data/live';

type Page = 'overview' | 'calendar' | 'crops' | 'sources' | 'report';
const pages = [{ id: 'overview', label: 'Map', icon: Map }, { id: 'report', label: 'Planning', icon: ClipboardList }, { id: 'calendar', label: 'Rain calendar', icon: CalendarDays }, { id: 'crops', label: 'Crop candidates', icon: Sprout }, { id: 'sources', label: 'Sources & data quality', icon: Database }] as const;

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    loadSnapshot(controller.signal).then(setSnapshot).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  if (!snapshot) return <main className="data-loading" role="status"><Waves size={36}/><h1>HYDRIX</h1><p>{error || 'Loading Kementan and CHIRPS data…'}</p>{error && <Button onClick={() => setAttempt(x => x + 1)}>Retry</Button>}</main>;
  return <Application snapshot={snapshot}/>;
}

function Application({ snapshot }: { snapshot: Snapshot }) {
  const [page, setPage] = useState<Page>('overview');
  const [mode, setMode] = useState(['farmer', 'petani'].includes(new URLSearchParams(location.search).get('view') || '') ? 'farmer' : 'gov');
  const [plotId, setPlotId] = useState(snapshot.plots[0].id);
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [calendarView, setCalendarView] = useState<'projection'|'historical'>('projection');
  const locationSequence = useRef(0);
  useEffect(() => () => { locationSequence.current++; }, []);
  const plot = snapshot.plots.find(p => p.id === plotId)!;
  const months = plot.rainfall;
  const latest = months.at(-1)!;
  const projection = projectionFor(plot,snapshot);
  const environment = snapshot.environment?.byPlot[plot.id];
  const agronomy = snapshot.agronomy?.byPlot[plot.id];
  const analysis = snapshot.analysis?.byPlot[plot.id];
  const observedHistory = rainfallHistory(plot, snapshot);
  const historyPeriod = observedHistory.length ? `${monthLabel(observedHistory[0].id)} – ${monthLabel(observedHistory.at(-1)!.id)}` : '';
  const profiles = candidates(snapshot);
  const period = `${monthLabel(snapshot.period.start)} – ${monthLabel(snapshot.period.end)}`;
  const surveyYears = [...new Set(snapshot.plots.flatMap(p => p.surveyDate ? [p.surveyDate.slice(0, 4)] : []))].sort().join(', ');
  function selectPlot(id: string) {
    if (!snapshot.plots.some(p => p.id === id)) return;
    locationSequence.current++;
    setLocationStatus('Survey location selected. Boundaries come from Kementan.');
    setPlotId(id); setPopupOpen(true);
  }
  function changeMode() {
    locationSequence.current++;
    setMode(mode === 'gov' ? 'farmer' : 'gov');
    const url = new URL(location.href);
    mode === 'gov' ? url.searchParams.set('view', 'farmer') : url.searchParams.delete('view');
    history.replaceState(null, '', url);
  }
  function locate() {
    const request = ++locationSequence.current;
    setLocationStatus('Finding your location…');
    if (!navigator.geolocation) { setLocationStatus('This browser does not support location. Select a survey location.'); return; }
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationSequence.current) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (accuracy > 100) { setLocationStatus('GPS accuracy is insufficient. Select a survey location.'); return; }
      const match = snapshot.plots.find(p => containsPoint(p, [longitude, latitude]));
      if (!match) { setLocationStatus('Your location is outside the survey boundaries. Farm data is unavailable.'); return; }
      setPlotId(match.id);
      setLocationStatus(`Your location falls within survey ${match.name}. Current farm conditions remain unconfirmed.`);
    }, () => { if (request === locationSequence.current) setLocationStatus('Location unavailable or permission denied. Select a survey location.'); }, { timeout: 10000, maximumAge: 0 });
  }
  const cropCards = <div className="crop-grid">{profiles.map(crop => <Card key={crop.id} className="crop-card"><CardContent>
    <div className="crop-top"><img className="crop-illustration" src={`/images/crops/${['shallot', 'spring-onion', 'garlic'][Number(crop.id)]}.png`} alt={`3D illustration of ${crop.name.toLowerCase()}`} /><span className="badge gray">{crop.status}</span></div>
    <h3>{crop.name}</h3><p className="crop-note">{analysis?.crops.find(candidate => candidate.cropId === crop.id)?.assessment ?? 'Gemini crop assessment unavailable for this location.'}</p><p className="crop-survey-fact">{crop.count} historical survey polygons · {analysis ? 'Gemini assessment' : 'Survey evidence only'}</p><div className="crop-unknown"><CircleHelp size={14}/><span>Missing data: {crop.unknown}</span></div>
    <Button variant="ghost" size="sm" className="crop-link" onClick={() => setSelectedCandidate(crop)}>View considerations <ArrowRight size={14}/></Button>
  </CardContent></Card>)}</div>;
  const selector = <div className="location-select"><MapPin size={17}/><Select value={plotId} onValueChange={selectPlot}><SelectTrigger aria-label="Select a field"><span>{plot.name} · {plot.district}</span></SelectTrigger><SelectContent>{snapshot.plots.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {p.district}</SelectItem>)}</SelectContent></Select></div>;
  const candidateSheet = <BottomSheet open={selectedCandidate !== null} onOpenChange={open => { if (!open) setSelectedCandidate(null); }} snapPoints={[.65, .9]} title={selectedCandidate?.name || 'Planting considerations'} description="Survey evidence and remaining uncertainties"><div className="sheet-body"><p>{analysis?.crops.find(candidate => candidate.cropId === selectedCandidate?.id)?.assessment ?? 'Gemini crop assessment unavailable.'}</p><p>{selectedCandidate?.note}</p><p>Review {selectedCandidate?.unknown.toLowerCase()}.</p><div className="rotation-note"><ShieldCheck size={20}/><p>All three crops belong to Allium. Rotation within the same family does not automatically break pest cycles.</p></div><Button onClick={() => setSelectedCandidate(null)}>Understood</Button></div></BottomSheet>;

  if (mode === 'farmer') return <main className="farmer-page">
    <header className="farmer-top"><a className="farmer-brand" href="?view=farmer"><span className="brand-logo"><Waves size={22}/></span><strong>HYDRIX</strong></a><button className="plain-link" onClick={changeMode}>Regional map</button></header>
    <div className="farmer-content"><section className="farmer-hero"><div className="eyebrow">LAND & SEASONS · MAJALENGKA</div><h1>Your land and seasons, clearly explained.</h1><p>Survey evidence and seasonal rainfall to help you review planting options.</p><Button variant="secondary" onClick={locate}><Navigation size={15}/>Use my location</Button>{locationStatus && <p className="location-status" role="status">{locationStatus}</p>}</section>
      {selector}<section className="surface farmer-summary"><div className="section-header"><div><div className="eyebrow">SURVEY LOCATION SUMMARY</div><h2>{plot.name} · {plot.district}</h2><p>{cropLabel(plot.crop)} · Kementan land survey</p></div></div>
        <p className="farmer-summary-text">{analysis?.farmerSummary ?? 'Gemini analysis unavailable for this location. Review source observations with an extension adviser.'} Latest available rainfall: {rainfallText(latest.rain)} in {monthLabel(latest.id)}. Rainfall data uses a regional grid of approximately 5.6 km.</p>
      </section><section className="surface farmer-forecast"><div className="section-header"><div><h2>Rainfall outlook for the next 12 months</h2></div></div><div className="farmer-rain"><ProjectionPanel projection={projection}/><EnvironmentContext environment={environment}/><AgronomyPanel data={agronomy} analysis={analysis} farmer/></div></section>
      <section className="farmer-candidates"><div className="section-header"><div><div className="eyebrow">CANDIDATES TO REVIEW</div><h2>Compare crop evidence.</h2><p>Review available soil, climate and water evidence.</p></div></div>{cropCards}</section>
      <footer className="farmer-disclaimer">Sources: Kementan and CHIRPS UCSB. Retrieved {dateLabel(snapshot.fetchedAt)}. Historical surveys do not establish current farm conditions.</footer>
    </div>{candidateSheet}</main>;

  return <AnimatedSidebarProvider className="app-shell" defaultOpen>
    <AnimatedSidebar className="hydrix-sidebar" panelClassName="sidebar-panel" ariaLabel="HYDRIX navigation" collapsible="icon">
      <AnimatedSidebarHeader className="brand-header"><div className="brand"><span className="brand-logo"><Waves size={24}/></span><div><strong>HYDRIX</strong><small>GROW WITH FORESIGHT</small></div></div></AnimatedSidebarHeader>
      <AnimatedSidebarContent className="sidebar-content"><AnimatedSidebarMenu>{pages.map(item => <AnimatedSidebarMenuItem key={item.id}><AnimatedSidebarMenuButton icon={<item.icon size={18}/>} isActive={page === item.id} onSelect={() => { setPage(item.id); setPopupOpen(false); }} className="nav-item">{item.label}</AnimatedSidebarMenuButton></AnimatedSidebarMenuItem>)}</AnimatedSidebarMenu></AnimatedSidebarContent>

    </AnimatedSidebar>
    <AnimatedSidebarInset className="main-shell"><header className="topbar"><div className="breadcrumbs"><AnimatedSidebarTrigger className="mobile-menu"/><span>Region</span><ChevronRight size={13}/><strong>Majalengka</strong></div><div className="topbar-right"><button className="plain-link farmer-access" onClick={changeMode}>Farmer page</button><button className="help-button" aria-label="Data sources" onClick={() => setPage('sources')}><CircleHelp size={18}/></button></div></header>
    <main className={`page-main ${page === 'overview' ? 'map-page' : ''}`}>
      {page !== 'overview' && <><div className="page-heading"><div><h1>{page === 'report' ? 'Planning' : pages.find(p => p.id === page)?.label}</h1><p>Kementan surveys and CHIRPS rainfall. Retrieved {dateLabel(snapshot.fetchedAt)}.</p></div></div>
      {page !== 'report' && page !== 'sources' && <div className="filter-bar">{selector}</div>}</>}
      {page === 'overview' && <div className="overview-grid government-overview"><section className="surface map-section"><PilotMap plots={snapshot.plots} selected={popupOpen ? plot : null} onSelect={selectPlot} onDismiss={() => setPopupOpen(false)}/>
        {popupOpen && <aside className="map-data-popover" aria-label={`Summary for ${plot.name}`}><button className="popover-close" aria-label="Close summary" onClick={() => setPopupOpen(false)}>×</button>
          <h2>{plot.name}</h2><p className="popover-subtitle">{plot.district}</p>
          <div className="survey-facts"><span>{cropLabel(plot.crop)}</span><span>{irrigationLabel(plot.irrigation)}</span><span>{plot.area.toLocaleString('en-US', { maximumFractionDigits: 4 })} ha · geometry area</span></div>
          <div className="popover-weather"><strong>{rainfallText(projection?.months[0]?.rain ?? latest.rain)}</strong><span>{projection ? `Projection for ${monthLabel(projection.months[0].id)} · range ${projection.months[0].lower}–${projection.months[0].upper} mm` : `Historical rainfall · ${monthLabel(latest.id)}`}</span></div><h3>Rainfall outlook · next 12 months</h3><ProjectionPanel projection={projection}/><EnvironmentContext environment={environment}/>
          <h3>Crop candidates</h3>{profiles.map(c => <div className="popover-row" key={c.id}><span>{c.name}</span><span className="badge gray">{c.status}</span></div>)}
          <h3>Location planning guidance</h3><p className="popover-advice">{analysis?.governmentSummary ?? 'Gemini analysis unavailable for this location. The support drafts below use data-based rules.'}</p>
          <AgronomyPanel data={agronomy} analysis={analysis}/>
          <div className="popover-actions"><button className="popover-calendar" onClick={() => setPage('calendar')}>View monthly data <ArrowRight size={14}/></button><Button size="sm" variant="secondary" onClick={() => setPage('report')}>Plan all locations</Button></div>

        </aside>}
      </section></div>}
      {page === 'calendar' && <><div className="calendar-view-tabs"><Button size="sm" variant={calendarView==='projection'?'primary':'secondary'} onClick={()=>setCalendarView('projection')}>Future outlook</Button><Button size="sm" variant={calendarView==='historical'?'primary':'secondary'} onClick={()=>setCalendarView('historical')}>CHIRPS history</Button></div><section className="surface full-section"><div className="section-header"><div><h2>{calendarView==='projection'?'12-month rainfall projection':'Historical CHIRPS rainfall'}</h2><p>{plot.name} · {calendarView==='historical'?historyPeriod:'Seasonal estimates with uncertainty'}</p></div></div>{calendarView==='projection'?<div className="calendar-heatmap"><ProjectionPanel projection={projection}/></div>:<RainfallHistory plot={plot} snapshot={snapshot}/>}<div className="calendar-environment"><EnvironmentContext environment={environment}/><AgronomyPanel data={agronomy} analysis={analysis}/></div></section></>}
      {page === 'crops' && <section className="candidates-section"><div className="section-header"><div><h2>Three Allium crop profiles</h2><p>Survey records support review; current crop suitability has not been established.</p></div></div>{cropCards}</section>}
      {page === 'sources' && <section className="surface full-section"><div className="section-header"><div><h2>Sources & coverage</h2><p>Retrieved {dateLabel(snapshot.fetchedAt)} · {snapshot.plots.length} polygons · {snapshot.quality.rejected.length} records excluded</p></div></div><div className="source-list">{snapshot.sources.map(source => <a key={source.name} href={source.url} target="_blank" rel="noreferrer"><span className="source-icon"><Database size={20}/></span><div><strong>{source.name}</strong><p>{source.purpose}</p></div><span className={`badge ${source.status !== 'unavailable' ? 'green' : 'gray'}`}>{source.status === 'cached' ? 'Cached' : source.status === 'connected' ? 'Available' : 'Unavailable'}</span><ExternalLink size={15}/></a>)}</div><div className="rotation-note"><CircleHelp size={20}/><div><strong>Data age and scale determine its use.</strong><p>Dated surveys come from {surveyYears || 'an unrecorded year'}. Observed rainfall covers {period}; observations are separate from projections. Garlic test records are excluded. Area is calculated from geometry because the reported planting-area units are unclear.</p></div></div><div className="quality-list">{projection && <p>Local projection: {projection.training.observations} monthly observations, model {projection.method}, test MAE {projection.validation.maeMm} mm/month. Model parameters and survey dates are included in exports.</p>}{snapshot.quality.rejected.map(r => <p key={r.id}>{r.id}: {r.reason === 'Komoditas tidak terverifikasi' ? 'Unverified crop attribute' : r.reason === 'Koordinat di luar batas pemeriksaan Majalengka' ? 'Coordinates outside the Majalengka screening bounds' : r.reason}</p>)}</div></section>}
      {page === 'report' && <PlanningBoard snapshot={snapshot} onSelect={id => { selectPlot(id); setPage('overview'); }}/>}
    </main></AnimatedSidebarInset>{candidateSheet}
  </AnimatedSidebarProvider>;
}
