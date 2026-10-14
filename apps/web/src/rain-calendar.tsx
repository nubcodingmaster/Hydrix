import { HeatCalendar, HeatCalendarGrid, HeatCalendarTooltip } from '@/components/charts/heat-calendar';
import { addDays, mondayOf } from '@/components/charts/heat-calendar/utils';
import { monthLabel, type RainMonth } from './data/live';
const colors = ['#dc514d', '#ef9b47', '#f1cd4d', '#8abac7', '#2676bc'];
type CalendarMonth = Pick<RainMonth, 'id' | 'rain'> & { lower?: number; upper?: number };
export default function RainCalendar({ months, kind = 'historical' }: { months: CalendarMonth[]; kind?: 'historical' | 'projection' }) {
  if (!months.length) return <p className="empty-data">Curah hujan belum tersedia.</p>;
  const first = new Date(`${months[0].id}-01T00:00:00Z`);
  const last = new Date(`${months.at(-1)!.id}-01T00:00:00Z`);
  const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0));
  const weeks = Math.round((mondayOf(end).getTime() - mondayOf(first).getTime()) / 604800000) + 1;
  const start = mondayOf(first);
  const maximum = Math.max(1, ...months.flatMap(m => m.rain === null ? [] : [m.rain]));
  const values = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = addDays(start, w * 7 + d);
    const value = months.find(m => m.id === date.toISOString().slice(0, 7))?.rain;
    return value === null || value === undefined ? 0 : value / maximum;
  }));
  return <div className="rain-heat-calendar"><div className="rain-heat-period"><p>{monthLabel(months[0].id)} – {monthLabel(months.at(-1)!.id)}</p>
    <HeatCalendar weeks={weeks} maxCount={maximum} unit="mm/bulan" values={values} endDate={end} colors={colors} isDateAvailable={date => months.some(m => m.id === date.toISOString().slice(0, 7) && m.rain !== null)}>
      <HeatCalendarGrid><HeatCalendarTooltip>{tip => {
        const sample = months.find(m => m.id === tip.date.toISOString().slice(0, 7));
        return <span>{monthLabel(tip.date.toISOString().slice(0, 7))}: {sample?.rain === null || sample?.rain === undefined ? 'Belum tersedia' : `${sample.rain} mm/bulan${sample.lower !== undefined ? ` · rentang ${sample.lower}–${sample.upper} mm` : ''}`}</span>;
      }}</HeatCalendarTooltip></HeatCalendarGrid>
    </HeatCalendar></div>
    <div className="rain-scale" aria-label="Curah hujan: rendah merah, sedang kuning, tinggi biru"><div className="rain-scale-bar"/><div className="rain-scale-labels"><span>0 mm</span><span>{Math.round(maximum / 2)} mm</span><span>{Math.round(maximum)} mm</span></div></div>
    <p className="rain-heat-caption">{kind === 'projection' ? 'Proyeksi total hujan bulanan, bukan cuaca harian. Ketuk sel untuk rentang ketidakpastian.' : 'CHIRPS historis · warna mengikuti total hujan bulanan, bukan hujan harian. Skala relatif lokasi; bukan kategori risiko.'}</p>
  </div>;
}
