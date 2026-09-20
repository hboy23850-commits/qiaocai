import { SolverOptions, SolverOutput } from '../types/index.js';
/**
 * 构建第 04 节核心 A4 演示用例的输入参数
 * - 两张 A4: 210 x 297 mm
 * - 8 张展签: 105 x 70 mm
 * - 禁止旋转
 * - 裁切间隔: 2 mm
 * - 宽度最大允许缩小 2 mm，步长 1 mm
 */
export declare function createA4DemoOptions(): SolverOptions;
/**
 * 运行核心 A4 演示求解并完成独立校验
 */
export declare function runA4Demo(): {
    solverOutput: SolverOutput;
    validationReport: {
        baselineValid: boolean;
        baselineErrors: string[];
        bestValid: boolean;
        bestErrors: string[];
    };
};
