
import type { Plot, Projection, Snapshot } from '../data/live';
import {
    candidates,
    monthLabel,
    projectionFor,
} from '../data/live';
import type {
    AIRecommendation,
    RecommendationResult,
} from './types';

function createRecommendation(plot: Plot, id: string, title: string, action: string, reason: string, evidence: AIRecommendation['evidence'], missingData: string[], suggestedPeriod: string | null = null): AIRecommendation {
    return {
        id: `${plot.id}-${id}`,
        audience: 'farmer',
        locationId: plot.id,
        title,
        action,
        reason,
        priority: null,
        suggestedPeriod,
        evidence,
        missingData,
        requiresVerification: true,
    };
}

function cropAdvisory(plot: Plot, snapshot: Snapshot): AIRecommendation[] {
    return candidates(snapshot).map(candidate => {
        const recorded = candidate.count > 0;

        return createRecommendation(
            plot,
            `crop-${candidate.id}`,
            `Evaluasi kandidat ${candidate.name}`,
            recorded
                ? `Diskusikan kesesuaian ${candidate.name} dengan penyuluh berdasarkan kondisi tanah, air, varietas, dan musim tanam.`
                : `Jangan menetapkan ${candidate.name} sebagai tanaman yang sesuai sebelum tersedia bukti agronomi dan pemeriksaan lapangan.`,
            recorded
                ? `${candidate.name} tercatat pada ${candidate.count} poligon survei historis di wilayah pilot. Catatan ini bukan bukti kesesuaian untuk lahan yang dipilih.`
                : `Belum tersedia bukti survei yang memadai untuk mendukung kesesuaian ${candidate.name} pada lokasi ini.`,
            [
                {
                    source: 'Survei lahan Kementan',
                    description: candidate.note,
                    observedAt: plot.surveyDate ?? undefined,
                },
            ],
            [
                'Karakteristik tanah dan pH',
                'Elevasi dan suhu lokasi',
                'Ketersediaan air aktual',
                'Varietas dan riwayat OPT',
                'Verifikasi penyuluh',
            ],
        );
    });
}


function climateAdvisory(plot: Plot, projection: Projection): AIRecommendation[] {
    const months = projection.months.filter(
        month => Number.isFinite(month.rain) && Number.isFinite(month.lower) && Number.isFinite(month.upper) &&
            month.anomaly && month.anomaly.status !== 'insufficient-data' && month.anomaly.deviationPercent !== null,
    );

    if (months.length === 0) return [];

    const strongest = [...months].sort(
        (a, b) => Math.abs(b.anomaly!.deviationPercent!) - Math.abs(a.anomaly!.deviationPercent!),
    )[0];

    const anomaly = strongest.anomaly!;
    const period = monthLabel(strongest.id);
    const statusText = {
        'below-normal': 'lebih rendah dari median historis',
        'near-normal': 'mendekati median historis',
        'above-normal': 'lebih tinggi dari median historis',
        'insufficient-data': 'data belum memadai',
    }[anomaly.status];
    const signalConfirmed = anomaly.signal === 'below-normal' || anomaly.signal === 'above-normal';
    const title = signalConfirmed ? 'Indikasi anomali hujan musiman' : 'Pemantauan pola hujan musiman';
    const action = signalConfirmed ? anomaly.signal === 'below-normal'
            ? 'Periksa ketersediaan air dan konsultasikan kebutuhan irigasi dengan penyuluh sebelum menentukan waktu tanam.'
            : 'Periksa drainase lahan dan pantau informasi cuaca resmi sebelum menentukan aktivitas tanam.'
            : 'Gunakan proyeksi sebagai informasi perencanaan awal. Pantau prakiraan resmi dan verifikasi kondisi air di lahan.';

    const reason = `Pada ${period}, proyeksi hujan ${strongest.rain} mm ` + `(${anomaly.deviationPercent}% terhadap median historis), ` + `dengan klasifikasi ${statusText}. ` +
            (signalConfirmed ? 'Seluruh interval proyeksi berada di luar ambang screening ±20%. Ini tetap bukan peringatan resmi.' : 'Interval proyeksi belum mendukung kesimpulan anomali yang meyakinkan.');

    return [
        createRecommendation(
            plot,
            'climate-anomaly-screening',
            title,
            action,
            reason,
            [
                {
                    source: 'CHIRPS — model statistik musiman lokal',
                    description: `Proyeksi ${strongest.rain} mm; ` + `interval ${strongest.lower}–${strongest.upper} mm. ` + `Sinyal: ${anomaly.signal}.`,
                    observedAt: projection.issuedAt,
                },
            ],
            [
                'Kondisi air dan drainase aktual',
                'Kebutuhan air berdasarkan fase tanaman',
                'Prakiraan dan peringatan resmi terkini',
            ],
            period,
        ),
    ];
}


export function farmerRecommendations(plot: Plot, snapshot: Snapshot): RecommendationResult {
    const recommendations = cropAdvisory(plot, snapshot);
    const projection = projectionFor(plot, snapshot);

    if (projection) {
        recommendations.push(...climateAdvisory(plot, projection));
    }

    return {
        recommendations,
        limitations: [
            'Kandidat komoditas belum merupakan rekomendasi kesesuaian lahan final.',
            'Data survei historis tidak menggambarkan seluruh kondisi terkini.',
            'Screening anomali membandingkan proyeksi dengan median historis periode pelatihan menggunakan ambang ±20% eksperimental, bukan standar resmi BMKG.',
            'Model statistik terutama merepresentasikan pola musiman historis dan belum memprediksi perubahan kondisi iklim masa depan seperti ENSO.',
            'Interval proyeksi menunjukkan ketidakpastian dan tidak menjamin kondisi hujan aktual.',
            'Proyeksi statistik bulanan bukan prakiraan cuaca harian atau peringatan resmi BMKG.',
            'Keputusan tanam memerlukan pemeriksaan kondisi lahan dan konsultasi penyuluh.',
        ],
        generatedAt: new Date().toISOString(),
    };
}
