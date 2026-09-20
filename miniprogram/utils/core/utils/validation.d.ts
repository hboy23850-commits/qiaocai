import { SolverOptions } from '../types/index.js';
export declare const MAX_PART_INSTANCES = 20;
export declare const MAX_STOCKS = 20;
export declare const MAX_KERF_MM = 5;
/**
 * 校验求解器整体输入约束
 */
export declare function validateSolverInput(options: SolverOptions): void;
