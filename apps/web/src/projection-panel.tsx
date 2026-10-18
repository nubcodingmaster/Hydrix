import RainCalendar from './rain-calendar';
import { projectionSummary, type Projection } from './data/live';
export default function ProjectionPanel({ projection }: { projection: Projection | null }) {
  if(!projection) return <div className="unavailable-data"><p>Projection unavailable. No future values are generated without a model.</p></div>;
  return <section className="projection-panel" aria-label="12-month rainfall projection"><p className="projection-summary"><strong>{projection.aiSummary?.provider === 'Gemini' ? 'Gemini seasonal analysis · ' : 'Statistical summary · '}</strong>{projection.aiSummary?.summary || projectionSummary(projection)}</p><RainCalendar months={projection.months}/>

  </section>;
}
