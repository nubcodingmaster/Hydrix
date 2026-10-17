
import { describe, expect, it } from 'vitest';
import type { Plot, Projection, Snapshot } from '../data/live';
import { farmerRecommendations } from './farmer-engine';

const plot: Plot = {
    id: 'test-plot-01',
    objectId: 1,
    name: 'Lahan Uji',
    district: 'Majalengka',
    village: 'Desa Uji',
    crop: 'Bawang merah',
    area: 1.5,
    areaMethod: 'survey',
    center: [108.2, -6.8],
    geometry: {
        type: 'Polygon',
        coordinates: [[
            [108.2, -6.8],
            [108.21, -6.8],
            [108.21, -6.81],
            [108.2, -6.8],
        ]],
    },
    surveyDate: '2019-06-01',
    irrigation: 'irigasi',
    source: 'Kementan',
    rainfall: [
        {
            id: '2026-09',
            rain: 100,
            pixel: 'pixel-01',
            source: 'CHIRPS',
        },
    ],
};

const projection: Projection = {
    pixel: 'pixel-01',
    issuedAt: '2026-10-01',
    kind: 'seasonal-projection',
    method: 'statistical',
    training: {
        start: '2000-01',
        end: '2025-12',
        observations: 312,
    },
    validation: {
        selectionYears: '',
        calibrationYears: '',
        evaluationYears: '',
        maeMm: 30,
        baselineMaeMm: 35,
        intervalCoverage: 0.8,
        evaluatedMonths: 24,
    },
    interval: {
        nominalCoverage: 0.8,
        radiusMm: 40,
        method: 'calibrated',
    },
    confidence: 'low',
    months: [
        {
            id: '2026-11',
            rain: 120,
            lower: 80,
            upper: 160,
            anomaly: {
                status: 'near-normal',
                deviationPercent: 0,
                signal: 'uncertain',
            },
        },
        {
            id: '2026-12',
            rain: 60,
            lower: 20,
            upper: 100,
            anomaly: {
                status: 'below-normal',
                deviationPercent: -40,
                signal: 'uncertain',
            },
        },
        {
            id: '2027-01',
            rain: 220,
            lower: 150,
            upper: 290,
            anomaly: {
                status: 'above-normal',
                deviationPercent: 30,
                signal: 'uncertain',
            },
        },
    ],
    limitations: [],
};

const snapshot: Snapshot = {
    schemaVersion: 1,
    fetchedAt: '2026-10-01',
    period: {
        start: '2025-10',
        end: '2026-09',
        kind: 'historical',
    },
    plots: [plot],
    sources: [],
    quality: {
        accepted: 1,
        rejected: [],
        excludedGarlic: 'Belum tersedia bukti yang cukup.',
        rainfallMethod: 'CHIRPS',
    },
    projections: {
        issuedAt: '2026-10-01',
        provider: 'local',
        byPixel: {
            'pixel-01': projection,
        },
    },
};

describe('Farmer Recommendation Engine', () => {
    it('returns all three crop candidates without claiming suitability', () => {
        const result = farmerRecommendations(plot, snapshot);
        const cropRecommendations = result.recommendations.filter(item => item.id.includes('-crop-'));

        expect(cropRecommendations).toHaveLength(3);
        expect(cropRecommendations.map(item => item.title)).toEqual([
            'Evaluasi kandidat Bawang merah',
            'Evaluasi kandidat Bawang daun',
            'Evaluasi kandidat Bawang putih',
        ]);
        expect(cropRecommendations.every(item => item.requiresVerification)).toBe(true);
    });

    it('uses historical anomaly data without overstating uncertainty', () => {
        const result = farmerRecommendations(plot, snapshot);
        const climate = result.recommendations.find(item => item.id.endsWith('-climate-anomaly-screening'));

        expect(climate).toBeDefined();
        expect(climate?.suggestedPeriod).toBe('Desember 2026');
        expect(climate?.title).toBe('Pemantauan pola hujan musiman');
        expect(climate?.reason).toContain('-40%');
        expect(climate?.reason).toContain('belum mendukung kesimpulan anomali yang meyakinkan');
        expect(climate?.requiresVerification).toBe(true);
    });

    it('does not generate climate advice without a projection', () => {
        const withoutProjection: Snapshot = {
            ...snapshot,
            projections: undefined,
        };
        const result = farmerRecommendations(plot, withoutProjection);

        expect(result.recommendations).toHaveLength(3);
        expect(result.recommendations.some(item => item.id.endsWith('-climate-anomaly-screening'))).toBe(false);
    });

    it('includes limitations and missing agronomic evidence', () => {
        const result = farmerRecommendations(plot, snapshot);

        expect(result.limitations.length).toBeGreaterThan(0);
        expect(result.recommendations.every(item => item.missingData.length > 0 && item.requiresVerification)).toBe(true);
    });

    it('provides water planning advice for a supported below-normal signal', () => {
        const strongProjection: Projection = {
            ...projection,
            months: [
                {
                    id: '2026-12',
                    rain: 50,
                    lower: 30,
                    upper: 65,
                    anomaly: {
                        status: 'below-normal',
                        deviationPercent: -50,
                        signal: 'below-normal',
                    },
                },
            ],
        };

        const strongSnapshot: Snapshot = {
            ...snapshot,
            projections: {
                ...snapshot.projections!,
                byPixel: {
                    'pixel-01': strongProjection,
                },
            },
        };

        const result = farmerRecommendations(plot, strongSnapshot);
        const climate = result.recommendations.find(item => item.id.endsWith('-climate-anomaly-screening'));

        expect(climate?.title).toBe('Indikasi anomali hujan musiman');
        expect(climate?.action).toContain('irigasi');
        expect(climate?.reason).toContain('bukan peringatan resmi');
        expect(climate?.requiresVerification).toBe(true);
    });
});
