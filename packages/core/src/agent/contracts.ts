import type { PartGroup } from '../types/index.js';

export type AgentStatus = 'NEEDS_INPUT' | 'AWAITING_CONFIRMATION' | 'SOLVED' | 'DEGRADED' | 'FAILED';
export type AgentOptimizationGoal = 'BALANCED' | 'SAVE_MATERIAL' | 'EASY_CUT';

export interface AgentTurnRequest { sessionId?: string; message: string; projectId?: string; reset?: boolean; }
export interface AgentDraft { stockIds: string[]; partGroups: PartGroup[]; kerfMm: number; optimizationGoal: AgentOptimizationGoal; }
export interface AgentCandidateSummary { candidateId: string; sheetCount: number; utilization: number; wasteRate: number; cutComplexity: number; validationPassed: boolean; appliedDeltaMm: number; strategyName: string; }
export interface AgentToolRun { tool: 'list_available_stocks' | 'validate_requirement' | 'solve_and_compare' | 'build_cut_summary'; ok: boolean; summary: string; }
export interface AgentTurnResponse {
  sessionId: string; status: AgentStatus; assistantMessage: string; draft?: AgentDraft;
  clarification?: { field: string; question: string }; candidateSummary?: AgentCandidateSummary[];
  toolRuns: AgentToolRun[]; model: { provider: 'cloudbase' | 'deepseek'; id: string; aiGenerated: boolean; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; durationMs?: number; degraded?: boolean }; draftVersion: number;
}
export interface AgentDraftValidation { valid: boolean; missingFields: string[]; errors: string[]; }
