import { supportRecommendations, type Agronomy } from './data/agronomy';
const valueText = (value: number | null | undefined, unit = '') => value == null ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
export default function AgronomyPanel({ data, farmer = false }: { data?: Agronomy; farmer?: boolean }) {
  const surface = (sample: Agronomy['ph']) => sample?.depths.find(depth => depth.depthCm === 10);
  return <section className="agronomy-panel" aria-label="Soil and crop protection">
    <h3>Soil & crop protection</h3>
    <div className="agronomy-grid">
      <div className="water-card"><span>Modeled soil pH · 10 cm</span><strong>{valueText(surface(data?.ph ?? null)?.value)}</strong></div>
      <div className="water-card"><span>Organic carbon · 10 cm</span><strong>{valueText(surface(data?.carbon ?? null)?.value, 'g/kg')}</strong></div>
      <div className="water-card"><span>Soil texture · 10 cm</span><strong>{surface(data?.texture ?? null)?.label ?? 'Unavailable'}</strong></div>
      <div className="water-card"><span>Recent air temperature</span><strong>{valueText(data?.weather?.temperatureC, '°C')}</strong></div>
      <div className="water-card"><span>Recent relative humidity</span><strong>{valueText(data?.weather?.relativeHumidityPct, '%')}</strong></div>
      <div className="water-card"><span>Cloud-masked vegetation · NDVI</span><strong>{valueText(data?.vegetation?.ndvi)}</strong>{data?.vegetation && <small>Valid coverage: {valueText(data.vegetation.validCoverage == null ? null : data.vegetation.validCoverage * 100, '%')}</small>}</div>
    </div>
    {data?.weather && <p className="water-caption">Weather coverage: {data.weather.hours}/{data.weather.expectedHours} hours ({(data.weather.hourlyCoverage * 100).toFixed(1)}%). Averages use available observations; missing hours are not filled.</p>}
    <div className="support-heading"><div><span className="support-eyebrow">NEXT STEPS</span><h3>{farmer ? 'Planning guidance' : 'Support proposals'}</h3></div><span className="badge gray">Data-based guidance</span></div>
    <div className="support-proposals">{supportRecommendations(data).map(recommendation => <article key={recommendation.id} className="support-card">
      <div className="support-title"><h4>{recommendation.title}</h4><span className={`badge ${recommendation.status === 'Review' ? 'green' : 'gray'}`}>{recommendation.status}</span></div>
      <p className="support-reason">{recommendation.reason}</p><div className="support-next-step"><span>Suggested action</span><p>{recommendation.action}</p></div>
    </article>)}</div>

  </section>;
}
