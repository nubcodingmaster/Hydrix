
export type RecommendationAudience = 'government' | 'farmer';

export type RecommendationPriority = 'high' | 'medium' | 'low';

export type RecommendationEvidence = {
    source: string;
    description: string;
    observedAt?: string;
};

export type AIRecommendation = {
    id: string;
    audience: RecommendationAudience;
    locationId: string;
    title: string;
    action: string;
    reason: string;
    priority: RecommendationPriority | null;
    suggestedPeriod: string | null;
    evidence: RecommendationEvidence[];
    missingData: string[];
    requiresVerification: boolean;
};

export type RecommendationResult = {
    recommendations: AIRecommendation[];
    limitations: string[];
    generatedAt: string;
};
