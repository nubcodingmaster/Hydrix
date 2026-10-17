
import { describe, expect, it } from 'vitest';
import type { Plot, Projection, Snapshot } from '../data/live';
import { governmentRecommendations } from './government-engine';

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
        excludedGarlic: '',
        rainfallMethod: 'CHIRPS',
    },
};

describe('Government Recommendation Engine', () => {
    it('recommends field verification when irrigation data is missing', () => {
        const incompletePlot: Plot = {
            ...plot,
            irrigation: null,
        };
        const result = governmentRecommendations(incompletePlot, snapshot);

        expect(result.recommendations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'test-plot-01-field-verification',
                priority: 'high',
                requiresVerification: true,
            }),
        ]));
    });

    it('identifies missing survey and irrigation evidence without determining aid eligibility', () => {
        const incompletePlot: Plot = {
            ...plot,
            surveyDate: null,
            irrigation: null,
        };

        const result = governmentRecommendations(incompletePlot, snapshot);
        const verification = result.recommendations.find(item => item.id === 'test-plot-01-field-verification');

        expect(verification).toBeDefined();
        expect(verification?.priority).toBe('high');
        expect(verification?.requiresVerification).toBe(true);
        expect(verification?.missingData).toContain('Tanggal survei');
        expect(verification?.missingData).toContain('Kondisi irigasi');
        expect(verification?.reason).toContain('belum tercatat');
        expect(result.limitations).toContain('Tidak ada penetapan penerima bantuan otomatis.');
    });

    it('recommends updating historical survey data', () => {
        const result = governmentRecommendations(plot, snapshot);

        expect(result.recommendations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'test-plot-01-survey-refresh',
                priority: 'medium',
            }),
        ]));
    });

    it('recommends seasonal water review when projection exists', () => {
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
                },
                {
                    id: '2026-12',
                    rain: 60,
                    lower: 20,
                    upper: 100,
                },
            ],
            limitations: [],
        };

        const withProjection: Snapshot = {
            ...snapshot,
            projections: {
                issuedAt: '2026-10-01',
                provider: 'local',
                byPixel: {
                    'pixel-01': projection,
                },
            },
        };

        const result = governmentRecommendations(plot, withProjection);
        const waterReview = result.recommendations.find(item => item.id === 'test-plot-01-water-planning');

        expect(waterReview).toBeDefined();
        expect(waterReview?.suggestedPeriod).toBe('Desember 2026');
        expect(waterReview?.evidence[0].description).toContain('60 mm');
        expect(waterReview?.requiresVerification).toBe(true);
    });
});
