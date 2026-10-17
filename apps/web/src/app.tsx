import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, CalendarDays, ChevronRight, CircleHelp, Database, ExternalLink, FileText, Leaf, Map, MapPin, Navigation, ShieldCheck, Sprout, Waves } from 'lucide-react';
import { AnimatedSidebar, AnimatedSidebarProvider, AnimatedSidebarHeader, AnimatedSidebarContent, AnimatedSidebarFooter, AnimatedSidebarMenu, AnimatedSidebarMenuItem, AnimatedSidebarMenuButton, AnimatedSidebarTrigger, AnimatedSidebarInset } from '@/components/motion/animated-sidebar';
import { Button } from '@/components/motion/button';
import { Card, CardContent } from '@/components/motion/card';
import { Table, type TableColumn } from '@/components/motion/table';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { BottomSheet } from '@/components/motion/bottom-sheet';
import PilotMap from './pilot-map';
import RainCalendar from './rain-calendar';
import EnvironmentContext from './environment-context';
import ProjectionPanel from './projection-panel';
import { candidates, projectionFor, projectionSummary, containsPoint, dateLabel, fieldReport, irrigationLabel, loadSnapshot, monthLabel, plotAction, rainfallText, regionalGroups, type Candidate, type RainMonth, type Snapshot } from './data/live';
import { governmentRecommendations } from './ai/government-engine';
import { farmerRecommendations } from './ai/farmer-engine';

type Page = 'overview' | 'calendar' | 'crops' | 'sources' | 'report';
const pages = [{ id: 'overview', label: 'Peta', icon: Map }, { id: 'calendar', label: 'Kalender hujan', icon: CalendarDays }, { id: 'crops', label: 'Kandidat tanam', icon: Sprout }, { id: 'sources', label: 'Sumber & kualitas data', icon: Database }] as const;
const columns: TableColumn<RainMonth>[] = [
  { key: 'id', header: 'Bulan', width: '200px', cell: m => monthLabel(m.id) },
  { key: 'rain', header: 'Hujan CHIRPS', width: '160px', cell: m => rainfallText(m.rain) },
  { key: 'pixel', header: 'Piksel sumber', width: '160px' },
  { key: 'source', header: 'Bukti', width: '160px', cell: m => <a href={m.source} target="_blank" rel="noreferrer">Raster UCSB ↗</a> },
];

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
  if (!snapshot) return <main className="data-loading" role="status"><Waves size={36}/><h1>HYDRIX</h1><p>{error || 'Memuat data Kementan dan CHIRPS…'}</p>{error && <Button onClick={() => setAttempt(x => x + 1)}>Coba lagi</Button>}</main>;
  return <Application snapshot={snapshot}/>;
}

function Application({ snapshot }: { snapshot: Snapshot }) {
  const [page, setPage] = useState<Page>('overview');
  const [mode, setMode] = useState(new URLSearchParams(location.search).get('view') === 'petani' ? 'farmer' : 'gov');
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
  const profiles = candidates(snapshot);
  const groups = regionalGroups(snapshot);
  const governmentAI = governmentRecommendations(plot, snapshot);
  const farmerAI = farmerRecommendations(plot, snapshot);
  const period = `${monthLabel(snapshot.period.start)} – ${monthLabel(snapshot.period.end)}`;
  const surveyYears = [...new Set(snapshot.plots.flatMap(p => p.surveyDate ? [p.surveyDate.slice(0, 4)] : []))].sort().join(', ');
  function selectPlot(id: string) {
    if (!snapshot.plots.some(p => p.id === id)) return;
    locationSequence.current++;
    setLocationStatus('Lokasi survei dipilih. Batas ini berasal dari Kementan.');
    setPlotId(id); setPopupOpen(true);
  }
  function changeMode() {
    locationSequence.current++;
    setMode(mode === 'gov' ? 'farmer' : 'gov');
    const url = new URL(location.href);
    mode === 'gov' ? url.searchParams.set('view', 'petani') : url.searchParams.delete('view');
    history.replaceState(null, '', url);
  }
  function download() {
    const regional = page === 'report';
    const data = regional ? { title: 'HYDRIX — perencanaan verifikasi wilayah', fetched_at: snapshot.fetchedAt, sources: snapshot.sources, quality: snapshot.quality, districts: groups.map(g => ({ district: g.district, missing_attributes: g.missing, locations: g.plots.map(p => fieldReport(p, snapshot)) })), budget: null, aid_recipients: null } : fieldReport(plot, snapshot);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `hydrix-${regional ? 'majalengka-rencana' : plot.id}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function locate() {
    const request = ++locationSequence.current;
    setLocationStatus('Mendeteksi lokasi…');
    if (!navigator.geolocation) { setLocationStatus('Browser tidak mendukung lokasi. Pilih lokasi survei.'); return; }
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationSequence.current) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (accuracy > 100) { setLocationStatus('Akurasi GPS belum cukup. Pilih lokasi survei secara manual.'); return; }
      const match = snapshot.plots.find(p => containsPoint(p, [longitude, latitude]));
      if (!match) { setLocationStatus('Lokasi belum tercakup poligon survei. Data kebunmu belum tersedia.'); return; }
      setPlotId(match.id);
      setLocationStatus(`Lokasi masuk batas survei ${match.name}. Kondisi kebun terkini tetap perlu diverifikasi.`);
    }, () => { if (request === locationSequence.current) setLocationStatus('Lokasi tidak tersedia atau izin ditolak. Pilih lokasi survei.'); }, { timeout: 10000, maximumAge: 0 });
  }
  const cropCards = <div className="crop-grid">{profiles.map(crop => <Card key={crop.id} className="crop-card"><CardContent>
    <div className="crop-top"><span className="crop-symbol"><Sprout size={24}/></span><span className="badge gray">{crop.status}</span></div>
    <h3>{crop.name}</h3><p className="crop-note">{crop.note}</p><div className="crop-unknown"><CircleHelp size={14}/><span>Perlu data: {crop.unknown}</span></div>
    <Button variant="ghost" size="sm" className="crop-link" onClick={() => setSelectedCandidate(crop)}>Lihat pertimbangan <ArrowRight size={14}/></Button>
  </CardContent></Card>)}</div>;
  const selector = <div className="location-select"><MapPin size={17}/><Select value={plotId} onValueChange={selectPlot}><SelectTrigger aria-label="Pilih lahan"><span>{plot.name} · {plot.district}</span></SelectTrigger><SelectContent>{snapshot.plots.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {p.district}</SelectItem>)}</SelectContent></Select></div>;
  const forecastNotice = <div className="unavailable-data"><CalendarDays size={18}/><div><strong>{projection ? 'Proyeksi musiman dengan rentang ketidakpastian' : 'Proyeksi belum tersedia'}</strong><p>{projection ? 'Angka masa depan dihitung dari model pola hujan multi-tahun. Riwayat pengamatan tetap tersedia terpisah.' : 'Menunggu data latih dan hasil uji model. Riwayat tetap dapat dibuka.'}</p></div></div>;
  const candidateSheet = <BottomSheet open={selectedCandidate !== null} onOpenChange={open => { if (!open) setSelectedCandidate(null); }} snapPoints={[.65, .9]} title={selectedCandidate?.name || 'Pertimbangan tanam'} description="Bukti survei dan kebutuhan verifikasi"><div className="sheet-body"><p>{selectedCandidate?.note}</p><p>Periksa {selectedCandidate?.unknown.toLowerCase()}.</p><div className="rotation-note"><ShieldCheck size={20}/><p>Ketiga komoditas termasuk Allium. Pergiliran sesama famili tidak otomatis memutus siklus hama.</p></div><Button onClick={() => setSelectedCandidate(null)}>Mengerti</Button></div></BottomSheet>;

  if (mode === 'farmer') return <main className="farmer-page">
    <header className="farmer-top"><a className="farmer-brand" href="?view=petani"><span className="brand-logo"><Waves size={22}/></span><strong>HYDRIX</strong></a><button className="plain-link" onClick={changeMode}>Peta wilayah</button></header>
    <div className="farmer-content"><section className="farmer-hero"><div className="eyebrow">LAHAN & MUSIM · MAJALENGKA</div><h1>Kondisi lahanmu, singkat dan jelas.</h1><p>Bukti survei dan hujan historis untuk membantu meninjau pilihan tanam.</p><Button variant="secondary" onClick={locate}><Navigation size={15}/>Gunakan lokasi saya</Button>{locationStatus && <p className="location-status" role="status">{locationStatus}</p>}</section>
      {selector}<section className="surface farmer-summary"><div className="section-header"><div><div className="eyebrow">RINGKASAN LOKASI SURVEI</div><h2>{plot.name} · {plot.district}</h2><p>{plot.crop} · catatan lahan Kementan</p></div></div>
        <p className="farmer-summary-text">{plotAction(plot)} Hujan terakhir yang tersedia: {rainfallText(latest.rain)} pada {monthLabel(latest.id)}. Data hujan berskala regional ±5,6 km.</p>
      </section>{forecastNotice}<section className="surface farmer-forecast"><div className="section-header"><div><h2>Proyeksi hujan 12 bulan mendatang</h2><p>Pola musiman untuk meninjau rencana tanam.</p></div></div><div className="farmer-rain"><ProjectionPanel projection={projection}/><EnvironmentContext environment={environment}/></div></section>
      <section className="surface farmer-ai">
        <div className="section-header">
          <div>
            <div className="eyebrow">PANDUAN BERBASIS DATA</div>
            <h2>Panduan Kondisi Musim</h2>
            <p>
              Panduan awal berdasarkan data lahan dan proyeksi hujan.
              Tetap perlu verifikasi penyuluh.
            </p>
          </div>
        </div>

        <div className="farmer-ai-list">
          {farmerAI.recommendations.filter(item => !item.id.includes('-crop-')).map(item => (
            <Card key={item.id} className="crop-card">
              <CardContent>
                <div className="crop-top">
                  <span className="crop-symbol">
                    {item.id.includes('-crop-') ? <Sprout size={20} /> : <CalendarDays size={20} />}
                  </span>
                  <span className="badge gray">
                    {item.id.includes('-crop-') ? 'Kandidat tanam' : 'Panduan musim'}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p className="crop-note">{item.reason}</p>
                <p><strong>Saran:</strong> {item.action}</p>
                {item.suggestedPeriod && (<p><strong>Periode:</strong> {item.suggestedPeriod}</p>)}
                <details>
                  <summary>Bukti dan kebutuhan verifikasi</summary>
                  <ul>
                    {item.evidence.map((evidence, index) => (
                      <li key={index}>
                        {evidence.source}: {evidence.description}
                      </li>
                    ))}
                  </ul>
                  <strong>Data yang masih dibutuhkan:</strong>
                  <ul>
                    {item.missingData.map(data => (
                      <li key={data}>{data}</li>
                    ))}
                  </ul>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="farmer-disclaimer">
          Informasi ini bukan penetapan kesesuaian tanaman atau
          peringatan cuaca resmi. Pantau informasi BMKG dan
          konsultasikan keputusan tanam dengan penyuluh.
        </p>
      </section>

      <section className="farmer-candidates"><div className="section-header"><div><div className="eyebrow">KANDIDAT UNTUK DITINJAU</div><h2>Bandingkan bukti komoditas.</h2><p>Suhu, tanah, dan air terkini belum lengkap.</p></div></div>{cropCards}</section>
      <footer className="farmer-disclaimer">Sumber: Kementan dan CHIRPS UCSB. Data diambil {dateLabel(snapshot.fetchedAt)}. Survei historis tidak membuktikan kondisi kebun saat ini.</footer>
    </div>{candidateSheet}</main>;

  return <AnimatedSidebarProvider className="app-shell" defaultOpen>
    <AnimatedSidebar className="hydrix-sidebar" panelClassName="sidebar-panel" ariaLabel="Navigasi HYDRIX" collapsible="icon">
      <AnimatedSidebarHeader className="brand-header"><div className="brand"><span className="brand-logo"><Waves size={24}/></span><div><strong>HYDRIX</strong><small>GROW WITH FORESIGHT</small></div></div></AnimatedSidebarHeader>
      <AnimatedSidebarContent className="sidebar-content"><div className="nav-label">PERENCANAAN</div><AnimatedSidebarMenu>{pages.map(item => <AnimatedSidebarMenuItem key={item.id}><AnimatedSidebarMenuButton icon={<item.icon size={18}/>} isActive={page === item.id} onSelect={() => { setPage(item.id); setPopupOpen(false); }} className="nav-item">{item.label}</AnimatedSidebarMenuButton></AnimatedSidebarMenuItem>)}</AnimatedSidebarMenu></AnimatedSidebarContent>

    </AnimatedSidebar>
    <AnimatedSidebarInset className="main-shell"><header className="topbar"><div className="breadcrumbs"><AnimatedSidebarTrigger className="mobile-menu"/><span>Wilayah</span><ChevronRight size={13}/><strong>Majalengka</strong></div><div className="topbar-right"><button className="plain-link farmer-access" onClick={changeMode}>Halaman petani</button><button className="help-button" aria-label="Sumber data" onClick={() => setPage('sources')}><CircleHelp size={18}/></button></div></header>
    <main className={`page-main ${page === 'overview' ? 'map-page' : ''}`}>
      {page !== 'overview' && <><div className="page-heading"><div><div className="eyebrow">PERTANIAN, SELANGKAH LEBIH SIAP</div><h1>{page === 'report' ? 'Perencanaan wilayah' : pages.find(p => p.id === page)?.label}</h1><p>Survei Kementan dan hujan CHIRPS. Data diambil {dateLabel(snapshot.fetchedAt)}.</p></div></div>
      {page !== 'report' && page !== 'sources' && <div className="filter-bar">{selector}<span className="filter-meta">Catatan lahan Kementan</span><div className="filter-actions"><Button variant="secondary" size="sm" onClick={download}><ArrowDownToLine size={14}/>Ekspor data lokasi</Button></div></div>}</>}
      {page === 'overview' && <div className="overview-grid government-overview"><section className="surface map-section"><PilotMap plots={snapshot.plots} selected={popupOpen ? plot : null} onSelect={selectPlot} onDismiss={() => setPopupOpen(false)}/>
        {popupOpen && <aside className="map-data-popover" aria-label={`Ringkasan ${plot.name}`}><button className="popover-close" aria-label="Tutup ringkasan" onClick={() => setPopupOpen(false)}>×</button>
          <div className="eyebrow">SURVEI KEMENTAN</div><h2>{plot.name}</h2><p className="popover-subtitle">{plot.district}</p>
          <div className="survey-facts"><span>{plot.crop}</span><span>{irrigationLabel(plot.irrigation)}</span><span>{plot.area.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ha · luas geometri</span></div>
          <div className="popover-weather"><strong>{rainfallText(projection?.months[0]?.rain ?? latest.rain)}</strong><span>{projection ? `Proyeksi ${monthLabel(projection.months[0].id)} · rentang ${projection.months[0].lower}–${projection.months[0].upper} mm` : `Hujan historis · ${monthLabel(latest.id)}`}</span></div><h3>Proyeksi hujan · 12 bulan mendatang</h3><ProjectionPanel projection={projection}/><EnvironmentContext environment={environment}/>
          <h3>Kandidat komoditas</h3>{profiles.map(c => <div className="popover-row" key={c.id}><span>{c.name}</span><span className="badge gray">{c.status}</span></div>)}

          <h3>AI — Rekomendasi Intervensi</h3>

          <div className="government-ai-recommendations">
            {governmentAI.recommendations.map(item => (
              <div className="popover-advice" key={item.id}>
                <div className="popover-row">
                  <strong>{item.title}</strong>
                  <span className="badge gray">
                    {item.priority === 'high' ? 'Verifikasi tinggi' : 'Verifikasi rutin'}
                  </span>
                </div>

                <p>{item.reason}</p>
                <p><strong>Tindakan:</strong> {item.action}</p>

                {item.suggestedPeriod && (
                  <p>
                    <strong>Periode peninjauan:</strong>{' '}
                    {item.suggestedPeriod}
                  </p>
                )}

                <details>
                  <summary>Bukti dan data yang dibutuhkan</summary>

                  <ul>
                    {item.evidence.map((evidence, index) => (
                      <li key={index}>
                        {evidence.source}: {evidence.description}
                      </li>
                    ))}
                  </ul>

                  <strong>Perlu diverifikasi:</strong>
                  <ul>
                    {item.missingData.map(data => (
                      <li key={data}>{data}</li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}

            <p className="popover-advice">
              Rekomendasi ini mendukung peninjauan penyuluh,
              bukan keputusan otomatis penerima bantuan.
            </p>
          </div>

          <p className="popover-advice">Kelembapan tanah dan NDVI belum tersedia.</p>
          <div className="popover-actions"><button className="popover-calendar" onClick={() => setPage('calendar')}>Lihat data bulanan <ArrowRight size={14}/></button><Button size="sm" variant="secondary" onClick={() => setPage('report')}>Rencanakan semua lokasi</Button></div>

        </aside>}
      </section></div>}
      {page === 'calendar' && <>{forecastNotice}<div className="calendar-view-tabs"><Button size="sm" variant={calendarView==='projection'?'primary':'secondary'} onClick={()=>setCalendarView('projection')}>Proyeksi mendatang</Button><Button size="sm" variant={calendarView==='historical'?'primary':'secondary'} onClick={()=>setCalendarView('historical')}>Riwayat CHIRPS</Button></div><section className="surface full-section"><div className="section-header"><div><h2>{calendarView==='projection'?'Proyeksi hujan 12 bulan':'Hujan historis CHIRPS'}</h2><p>{plot.name} · {calendarView==='historical'?period:'Estimasi pola musim dengan ketidakpastian'}</p></div></div>{calendarView==='projection'?<div className="calendar-heatmap"><ProjectionPanel projection={projection}/></div>:<><div className="calendar-heatmap"><RainCalendar months={months}/></div><div className="data-table"><Table data={months} columns={columns} getRowId={m=>m.id} height={535} rowHeight={40}/></div></>}<div className="calendar-environment"><EnvironmentContext environment={environment}/></div><p className="fineprint">Data regional pada pusat batas lahan. Lokasi dalam piksel yang sama berbagi nilai; kelembapan tanah belum tersedia.</p></section></>}
      {page === 'crops' && <section className="candidates-section"><div className="section-header"><div><h2>Tiga profil monokotil</h2><p>Catatan survei mendukung peninjauan; kesesuaian lahan saat ini belum ditetapkan.</p></div></div>{cropCards}<div className="rotation-note"><ShieldCheck size={20}/><p>Pergiliran sesama Allium tidak otomatis memutus hama. Verifikasi air, tanah, elevasi, suhu, dan riwayat OPT sebelum memilih.</p></div></section>}
      {page === 'sources' && <section className="surface full-section"><div className="section-header"><div><h2>Sumber & cakupan</h2><p>Diambil {dateLabel(snapshot.fetchedAt)} · {snapshot.plots.length} poligon · {snapshot.quality.rejected.length} record disisihkan</p></div></div><div className="source-list">{snapshot.sources.map(source => <a key={source.name} href={source.url} target="_blank" rel="noreferrer"><span className="source-icon"><Database size={20}/></span><div><strong>{source.name}</strong><p>{source.purpose}</p></div><span className={`badge ${source.status === 'connected' ? 'green' : 'gray'}`}>{source.status === 'connected' ? 'Data tersedia' : 'Belum tersedia'}</span><ExternalLink size={15}/></a>)}</div><div className="rotation-note"><CircleHelp size={20}/><div><strong>Umur dan skala data menentukan penggunaannya.</strong><p>Survei bertanggal berasal dari {surveyYears || 'tahun yang belum tercatat'}. Hujan tersedia {period}; tidak dipakai sebagai prakiraan. Record bawang putih berisi atribut uji dan tidak dipakai. Luas dihitung dari geometri, karena satuan luas tanam pada layanan bawang merah tidak jelas.</p></div></div><div className="quality-list">{projection && <p>Proyeksi lokal: {projection.training.observations} observasi bulanan, model {projection.method}, galat uji {projection.validation.maeMm} mm/bulan. Parameter dan tanggal survei tetap tersimpan dalam ekspor data.</p>}{snapshot.quality.rejected.map(r => <p key={r.id}>{r.id}: {r.reason}</p>)}</div></section>}
      {page === 'report' && <section className="surface full-section report-section"><div className="section-header"><div><h2>Rencana verifikasi Majalengka</h2><p>Seluruh {snapshot.plots.length} lokasi · {groups.length} kecamatan · hujan {period}</p></div><Button variant="ghost" size="sm" onClick={() => setPage('overview')}>Kembali ke peta</Button></div><div className="report-intro"><FileText size={30}/><div><h3>Lengkapi bukti sebelum menetapkan intervensi.</h3><p>Urutan verifikasi mendahulukan kecamatan dengan atribut survei belum lengkap, lalu jumlah lokasi. Anggaran dan penerima bantuan belum ditetapkan. Hujan terendah berikut adalah riwayat, bukan risiko musim mendatang.</p></div></div>
        {groups.map((group, index) => <div className="region-priority" key={group.district}><span className="priority-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{group.district}</h3><p>{group.plots.length} poligon · {group.missing} lokasi tanpa tanggal survei atau irigasi lengkap.</p><p><strong>Hujan bulanan terendah dalam periode:</strong> {rainfallText(group.minimumRain)}.</p><p><strong>Tindakan:</strong> Perbarui survei lahan, verifikasi sarana air, lalu tinjau kebutuhan bantuan dan kandidat tanam bersama penyuluh.</p><p>{projectionSummary(projectionFor(group.plots[0],snapshot))}</p><p><strong>Bukti komoditas:</strong> {[...new Set(group.plots.map(p => p.crop))].join(', ')}.</p><span className="badge gray">Perlu verifikasi lapangan</span></div><Button variant="ghost" size="sm" onClick={() => { selectPlot(group.plots[0].id); setPage('overview'); }}>Lihat lokasi</Button></div>)}
        <div className="report-actions"><Button onClick={download}><ArrowDownToLine size={15}/>Unduh seluruh data rencana</Button><Button variant="secondary" onClick={() => window.print()}>Cetak rencana</Button></div></section>}
      {page !== 'overview' && <footer className="page-footer"><span><Waves size={14}/>HYDRIX · Kementan & CHIRPS UCSB</span><span>Survei historis · verifikasi sebelum bertindak</span></footer>}
    </main></AnimatedSidebarInset>{candidateSheet}
  </AnimatedSidebarProvider>;
}
