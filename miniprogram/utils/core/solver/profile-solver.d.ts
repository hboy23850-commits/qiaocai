import { Candidate, SolverOptions, SolverOutput } from '../types/index.js';
export declare const PROFILE_ALGORITHM_VERSION = "2.0.0-profile-nesting";
interface ProfileStrategy {
    id: string;
    name: string;
    partOrder: 'area-desc' | 'bbox-desc' | 'complexity-desc' | 'aspect-desc';
    stockOrder: 'offcut-first-small' | 'offcut-first-large' | 'smallest-area-first';
    archetype: 'MATERIAL_SAVING' | 'EASY_CUTTING' | 'BALANCED';
}
/**
 * 构建至少 12 种确定性异形排料策略
 */
export declare function buildProfileStrategies(): ProfileStrategy[];
/**
 * PROFILE 异形排料求解器主入口
 */
export declare function solveProfileCuttingPlan(options: SolverOptions): SolverOutput;
/**
 * 候选方案优劣比较器
 */
export declare function compareProfileCandidates(a: Candidate, b: Candidate): number;
export {};
