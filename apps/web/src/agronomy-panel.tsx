import type { AIAnalysis } from './data/ai';
import { Sun, Droplets, Leaf, Sprout } from 'lucide-react';
import { supportRecommendations, type Agronomy } from './data/agronomy';
const valueText = (value: number | null | undefined, unit = '') => value == null ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
export default function AgronomyPanel({ data, analysis, farmer = false }: { data?: Agronomy; analysis?: AIAnalysis; farmer?: boolean }) {
  const surface = (sample: Agronomy['ph']) => sample?.depths.find(depth => depth.depthCm === 10);
  const water = analysis?.support.find(support => support.kind === 'water');
  const recommendations = [...(water ? [{id:'water-planning',title:'Water & seasonal readiness',status:'Review',reason:water.reason,action:farmer ? water.farmerAction : water.governmentAction,evidence:water.evidence}] : []), ...supportRecommendations(data)];
  return <section className="agronomy-panel" aria-label="Soil and crop protection">
    <h3>Soil & crop protection</h3>
    <div className="agronomy-overview">
      <div className="agronomy-weather">
        <div className="agronomy-weather-heading"><div><span>RECENT WEATHER</span><p>Recent air temperature</p></div><span className="agronomy-weather-icon"><Sun size={28} strokeWidth={1.5}/></span></div>
        <strong className="agronomy-temperature">{valueText(data?.weather?.temperatureC, '°C')}</strong>
        <div className="agronomy-weather-footer"><Droplets size={17}/><span>Recent relative humidity</span><strong>{valueText(data?.weather?.relativeHumidityPct, '%')}</strong></div>
      </div>
      <div className="agronomy-grid">
        <div className="agronomy-stat"><span><Sprout size={15}/>Modeled soil pH · 10 cm</span><strong>{valueText(surface(data?.ph ?? null)?.value)}</strong></div>
        <div className="agronomy-stat"><span>Organic carbon · 10 cm</span><strong>{valueText(surface(data?.carbon ?? null)?.value, 'g/kg')}</strong></div>
        <div className="agronomy-stat"><span>Soil texture · 10 cm</span><strong>{surface(data?.texture ?? null)?.label ?? 'Unavailable'}</strong></div>
        <div className="agronomy-stat"><span><Leaf size={15}/>Cloud-masked vegetation · NDVI</span><strong>{valueText(data?.vegetation?.ndvi)}</strong>{data?.vegetation && <small>Valid coverage: {valueText(data.vegetation.validCoverage == null ? null : data.vegetation.validCoverage * 100, '%')}</small>}</div>
      </div>
    </div>
    {data?.weather && <p className="water-caption">Weather coverage: {data.weather.hours}/{data.weather.expectedHours} hours ({(data.weather.hourlyCoverage * 100).toFixed(1)}%). Averages use available observations; missing hours are not filled.</p>}
    <div className="support-heading"><h3>{farmer ? 'Planning guidance' : 'Support proposals'}</h3></div>
    <p className="ai-attribution">{analysis ? `Gemini · ${analysis.model} · ${new Date(analysis.generatedAt).toLocaleDateString('en-US')}` : 'Gemini analysis unavailable. The drafts below use data-based rules.'}</p>
    <div className="support-proposals">{recommendations.map(recommendation => {
      const advice = analysis?.support.find(support => support.kind === (recommendation.id === 'water-planning' ? 'water' : recommendation.id === 'nutrient-planning' ? 'soil' : 'pest'));
      return <article key={recommendation.id} className="support-card">
      <div className="support-title"><h4>{recommendation.title}</h4><span className={`badge ${recommendation.status === 'Review' ? 'green' : 'gray'}`}>{recommendation.status}</span></div>
      <p className="support-reason">{advice?.reason ?? recommendation.reason}</p><div className="support-next-step"><span>Suggested action</span><p>{advice ? farmer ? advice.farmerAction : advice.governmentAction : recommendation.action}</p></div>
    </article>;})}</div>

  </section>;
}
