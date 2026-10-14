import RainCalendar from './rain-calendar';
import { projectionSummary, type Projection } from './data/live';
export default function ProjectionPanel({ projection }: { projection: Projection | null }) {
  if(!projection) return <div className="unavailable-data"><p>Proyeksi belum tersedia. Data masa depan tidak diisi tanpa model.</p></div>;
  return <section className="projection-panel" aria-label="Proyeksi hujan 12 bulan"><p className="projection-summary">{projection.aiSummary && <strong>Ringkasan AI · </strong>}{projection.aiSummary?.summary || projectionSummary(projection)}</p><RainCalendar months={projection.months} kind="projection"/>
    <details className="projection-method"><summary>Metode & ketidakpastian</summary><p>{projection.method==='harmonic-ridge'?'Regresi harmonik teratur':'Pola median bulanan'} · {projection.training.observations} observasi bulanan dari {projection.training.start} sampai {projection.training.end}.</p><p>Target rentang {projection.interval.nominalCoverage}%. Pada uji {projection.validation.evaluationYears}, cakupan aktual {projection.validation.intervalCoverage}% dan galat absolut rata-rata {projection.validation.maeMm} mm/bulan.</p><p>Keandalan terbatas. Model memakai musim historis, tanpa prediksi atmosfer atau ENSO mendatang. Bukan ramalan cuaca harian atau produk resmi BMKG.</p></details>
  </section>;
}
