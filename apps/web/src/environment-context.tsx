import { dateLabel, type Environment } from './data/live';
export default function EnvironmentContext({ environment }: { environment?: Environment }) {
  return <section className="environment-context" aria-label="Water and land context"><h3>Water & land context</h3>
    <div className="water-grid">{(['aeti','ret'] as const).map(key=>{
      const sample=environment?.[key];
      return <div className="water-card" key={key}><span>{key==='aeti'?'Actual ET':'Reference ET'}</span><strong>{sample?.value === null || sample?.value === undefined ? 'Unavailable' : `${sample.value.toLocaleString('en-US')} mm/day`}</strong><small>{sample ? `${dateLabel(sample.period.start)}${sample.period.end!==sample.period.start?` – ${dateLabel(sample.period.end)}`:''}` : 'WaPOR not loaded'}</small></div>;
    })}</div>
    <p className="water-caption">WaPOR: actual ET averaged over a ten-day period; reference ET is daily and regional. Neither measures soil moisture.</p>
    {environment?.cropland && <p className="cropland-context">WorldCereal {environment.cropland.year}: {environment.cropland.classification===100?'pixel classified as temporary cropland':environment.cropland.classification===0?'pixel not classified as temporary cropland':'classification unavailable'}. {environment.cropland.confidence!==null&&`Class confidence ${environment.cropland.confidence}%.`} Historical context; does not identify an Allium crop.</p>}
  </section>;
}
