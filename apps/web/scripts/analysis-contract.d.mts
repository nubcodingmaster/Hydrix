import type { Snapshot, Plot } from '../src/data/live';
export const PROMPT_VERSION: string;
export const EVIDENCE_KEYS: string[];
export function currentMonth(): string;
export function fingerprint(value: unknown): Promise<string>;
export function buildAnalysisInput(snapshot: Snapshot, plot: Plot, referenceMonth?: string): { promptVersion: string; referenceMonth: string; rainfall: unknown; [key: string]: unknown };
export function validateAnalysis(value: unknown, input?: unknown): unknown;
export function isCurrentAnalysis(value: unknown, hash: string, model: string): boolean;

export function groundingIssues(value: unknown): string[];
