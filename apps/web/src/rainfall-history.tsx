import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { Table, type TableColumn } from '@/components/motion/table';
import RainCalendar from './rain-calendar';
import { monthLabel, rainfallHistory, rainfallText, type Plot, type RainMonth, type Snapshot } from './data/live';

const columns: TableColumn<RainMonth>[] = [
  { key: 'id', header: 'Month', width: '210px', cell: month => monthLabel(month.id) },
  { key: 'rain', header: 'CHIRPS rainfall', width: '180px', cell: month => rainfallText(month.rain) },
  { key: 'pixel', header: 'Source pixel', width: '160px' },
];

export default function RainfallHistory({ plot, snapshot }: { plot: Plot; snapshot: Snapshot }) {
  const history = rainfallHistory(plot, snapshot);
  const years = [...new Set(history.map(month => month.id.slice(0, 4)))].sort().reverse();
  const [selectedYear, setYear] = useState(years[0] ?? '');
  const year = years.includes(selectedYear) ? selectedYear : years[0];
  const observations = history.filter(month => month.id.startsWith(`${year}-`));
  // Include all calendar months so missing observations remain visible as empty cells and rows.
  const months: RainMonth[] = Array.from({length: 12}, (_, index) => {
    const id = `${year}-${String(index + 1).padStart(2, '0')}`;
    return observations.find(month => month.id === id) ?? { id, rain: null, pixel: '', source: '' };
  });
  if (!history.length) return <p className="empty-data">Rainfall history unavailable.</p>;
  return <section className="rainfall-history" aria-label="Long-term CHIRPS history">
    <div className="history-controls">
      <div><strong>{history[0].id.slice(0, 4)}–{history.at(-1)!.id.slice(0, 4)}</strong><p>{history.filter(month => month.rain !== null).length} observed months · {observations.filter(month => month.rain !== null).length}/12 available in {year}</p></div>
      <Select value={year} onValueChange={setYear}><SelectTrigger aria-label="Historical year"><span>{year}</span></SelectTrigger><SelectContent>{years.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="calendar-heatmap"><RainCalendar months={months}/></div>
    <div className="data-table"><Table data={months} columns={columns} getRowId={month => month.id} height={535} rowHeight={40}/></div>
  </section>;
}
