import { SolverOptions, SolverOutput } from '../types/index.js';
export declare const ALGORITHM_VERSION = "1.0.0-guillotine24";
/**
 * 巧裁二维矩形与真异形多策略排料求解器主入口
 */
export declare function solveCuttingPlan(options: SolverOptions): SolverOutput;
