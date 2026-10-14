import { dateLabel, type Environment } from './data/live';
export default function EnvironmentContext({ environment }: { environment?: Environment }) {
  return <section className="environment-context" aria-label="Konteks air dan lahan"><h3>Air & konteks lahan</h3>
    <div className="water-grid">{(['aeti','ret'] as const).map(key=>{
      const sample=environment?.[key];
      return <div className="water-card" key={key}><span>{key==='aeti'?'ET aktual':'ET referensi'}</span><strong>{sample?.value === null || sample?.value === undefined ? 'Belum tersedia' : `${sample.value.toLocaleString('id-ID')} mm/hari`}</strong><small>{sample ? `${dateLabel(sample.period.start)}${sample.period.end!==sample.period.start?` – ${dateLabel(sample.period.end)}`:''}` : 'WaPOR belum dimuat'}</small></div>;
    })}</div>
    <p className="water-caption">WaPOR: ET aktual rata-rata harian dalam dekad, ET referensi harian regional. Keduanya bukan pengukuran kelembapan tanah.</p>
    {environment?.cropland && <p className="cropland-context">WorldCereal {environment.cropland.year}: {environment.cropland.classification===100?'piksel terklasifikasi tanaman semusim':environment.cropland.classification===0?'piksel tidak terklasifikasi tanaman semusim':'klasifikasi tidak tersedia'}. {environment.cropland.confidence!==null&&`Confidence kelas ${environment.cropland.confidence}%.`} Konteks historis, bukan penetapan jenis bawang.</p>}
  </section>;
}
