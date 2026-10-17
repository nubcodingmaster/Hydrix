
import type { Plot, Snapshot, Projection } from '../data/live';
import { projectionFor, monthLabel } from '../data/live';
import type { AIRecommendation, RecommendationResult } from './types';

function recommendation(plot: Plot, id: string, title: string, action: string, reason: string, priority: AIRecommendation['priority'], evidence: AIRecommendation['evidence'], missingData: string[], suggestedPeriod: string | null = null): AIRecommendation {
    return {
        id: `${plot.id}-${id}`,
        audience: 'government',
        locationId: plot.id,
        title,
        action,
        reason,
        priority,
        suggestedPeriod,
        evidence,
        missingData,
        requiresVerification: true,
    };
}

function rainfallReview(plot: Plot, projection: Projection): AIRecommendation | null {
    if (!projection.months.length) return null;

    const sorted = [...projection.months].filter(month =>
        Number.isFinite(month.rain) && Number.isFinite(month.lower) && Number.isFinite(month.upper)
    ).sort((a, b) => a.rain - b.rain);

    if (!sorted.length) return null;

    const driest = sorted[0];
    const anomaly = driest.anomaly;
    const climateContext = anomaly ? `Dibandingkan median historis bulan yang sama, deviasi proyeksi sebesar ${anomaly.deviationPercent ?? 'tidak tersedia'}%. ` +
                    (anomaly.signal === 'uncertain' ? 'Interval proyeksi belum mendukung kesimpulan anomali yang meyakinkan.' : 'Terdapat indikasi anomali berdasarkan screening statistik eksperimental, bukan peringatan resmi.')
                    : 'Perbandingan dengan median historis belum tersedia.';


    return recommendation(
        plot,
        'water-planning',
        'Peninjauan kebutuhan air musiman',
        'Koordinasikan verifikasi sumber air, kondisi irigasi, dan kebutuhan air tanaman bersama penyuluh sebelum periode yang diproyeksikan lebih kering.',
        `Model statistik menunjukkan ${monthLabel(driest.id)} sebagai bulan dengan median hujan terendah dalam periode proyeksi. ${climateContext} Kondisi ini belum membuktikan kekeringan atau kekurangan air di lahan.`,
        'medium',
        [
            {
                source: 'CHIRPS — model statistik lokal',
                description: `Proyeksi median ${driest.rain} mm, rentang ${driest.lower}–${driest.upper} mm. Confidence model: ${projection.confidence}.`,
                observedAt: projection.issuedAt,
            },
        ],
        [
            'Ketersediaan air irigasi aktual',
            'Kebutuhan air tanaman dan fase pertumbuhan',
            'Kondisi tanah dan hasil observasi lapangan',
        ],
        monthLabel(driest.id),
    );
}

export function governmentRecommendations(plot: Plot, snapshot: Snapshot,): RecommendationResult {
    const recommendations: AIRecommendation[] = [];
    const missingSurvey = !plot.surveyDate || !plot.irrigation;

    if (missingSurvey) {
        recommendations.push(
            recommendation(
                plot,
                'field-verification',
                'Verifikasi data lahan',
                'Jadwalkan survei lapangan untuk memperbarui kondisi lahan, irigasi, dan informasi komoditas.',
                'Sebagian atribut penting belum tercatat dalam snapshot survei.',
                'high',
                [
                    {
                        source: plot.source,
                        description: `Survei: ${plot.surveyDate ?? 'tanggal tidak tersedia'}; irigasi: ${plot.irrigation ?? 'belum tercatat'}.`,
                        observedAt: plot.surveyDate ?? undefined,
                    },
                ],
                [
                    ...(!plot.surveyDate ? ['Tanggal survei'] : []),
                    ...(!plot.irrigation ? ['Kondisi irigasi'] : []),
                    'Validasi kondisi lahan terkini',
                ],
            ),
        );
    } else {
        recommendations.push(
        recommendation(
            plot,
            'survey-refresh',
            'Pembaruan survei historis',
            'Konfirmasi kondisi lahan dan irigasi terkini sebelum menetapkan rencana intervensi.',
            'Atribut survei historis tidak menjamin kondisi lapangan masih sama.',
            'medium',
            [
            {
                source: plot.source,
                description: `Tanggal survei tercatat: ${plot.surveyDate}.`,
                observedAt: plot.surveyDate ?? undefined,
            },
            ],
            ['Validasi kondisi lahan terkini'],
        ),
        );
    }

    const projection = projectionFor(plot, snapshot);

    if (projection) {
        const waterReview = rainfallReview(plot, projection);
        if (waterReview) recommendations.push(waterReview);
    }

    return {
        recommendations,
        limitations: [
            'Prioritas menunjukkan kebutuhan verifikasi, bukan kelayakan menerima bantuan.',
            'Data survei bersifat historis dan memerlukan konfirmasi lapangan.',
            'Proyeksi hujan bersifat statistik bulanan, bukan peringatan cuaca harian.',
            'Tidak ada penetapan penerima bantuan otomatis.',
            'Screening anomali menggunakan median historis dan ambang eksperimental, bukan prakiraan atau peringatan resmi BMKG.',
        ],
        generatedAt: new Date().toISOString(),
    };
}
