import type { AgentCandidateSummary, AgentDraft, AgentDraftValidation, AgentTurnRequest } from './contracts.js';
import type { SolverOutput, Stock } from '../types/index.js';
export interface AgentSolveResult {
    solverOutput: SolverOutput;
    candidates: AgentCandidateSummary[];
    stocks: Stock[];
}
export declare function validateAgentTurnRequest(input: Partial<AgentTurnRequest>): {
    valid: boolean;
    error?: string;
};
export declare function createRuleFallbackDraft(text: string): AgentDraft;
export declare function sanitizeAgentDraft(raw: any, accessibleStocks: Stock[]): AgentDraft;
export declare function validateRequirementDraft(draft: AgentDraft, accessibleStocks: Stock[]): AgentDraftValidation;
export declare function solveAndCompare(draft: AgentDraft, accessibleStocks: Stock[]): AgentSolveResult;
export declare function buildCutSummary(output: SolverOutput): {
    algorithmVersion: string;
    candidateId: string;
    stepsCount: number;
    sheetCount: number;
    placedCount: number;
};
