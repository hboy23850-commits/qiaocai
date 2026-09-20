import { SolverOptions, SolverOutput, Stock, PartGroup } from '../types/index.js';
import { solveCuttingPlan } from '../solver/index.js';
import { validateCandidate } from '../validator/index.js';
import { toInternalDimension } from '../utils/units.js';

/**
 * 构建第 04 节核心 A4 演示用例的输入参数
 * - 两张 A4: 210 x 297 mm
 * - 8 张展签: 105 x 70 mm
 * - 禁止旋转
 * - 裁切间隔: 2 mm
 * - 宽度最大允许缩小 2 mm，步长 1 mm
 */
export function createA4DemoOptions(): SolverOptions {
  const commonGroup = {
    material: '标准白卡纸',
    thicknessMm: 0.3,
    color: '白色',
  };

  const stocks: Stock[] = [
    {
      id: 'demo_a4_1',
      code: 'A4-01',
      group: commonGroup,
      width: toInternalDimension(210, 'mm'), // 2100
      height: toInternalDimension(297, 'mm'), // 2970
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    },
    {
      id: 'demo_a4_2',
      code: 'A4-02',
      group: commonGroup,
      width: toInternalDimension(210, 'mm'), // 2100
      height: toInternalDimension(297, 'mm'), // 2970
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    },
  ];

  const partGroups: PartGroup[] = [
    {
      id: 'demo_badges',
      name: '展签',
      targetWidth: toInternalDimension(105, 'mm'), // 1050
      targetHeight: toInternalDimension(70, 'mm'), // 700
      quantity: 8,
      allowRotation: false, // 严格禁止旋转
      flexibleRange: {
        maxShrinkMm: 2,
        stepMm: 1,
      },
    },
  ];

  return {
    stocks,
    partGroups,
    kerfMm: 2.0, // 2 mm 裁切预留间隔
  };
}

/**
 * 运行核心 A4 演示求解并完成独立校验
 */
export function runA4Demo(): {
  solverOutput: SolverOutput;
  validationReport: {
    baselineValid: boolean;
    baselineErrors: string[];
    bestValid: boolean;
    bestErrors: string[];
  };
} {
  const options = createA4DemoOptions();
  const result = solveCuttingPlan(options);

  // 独立校验 baseline 方案
  let baselineValid = false;
  let baselineErrors: string[] = [];
  if (result.baselineCandidate) {
    const v = validateCandidate(
      result.baselineCandidate,
      options.partGroups,
      options.stocks,
      options.kerfMm
    );
    baselineValid = v.valid;
    baselineErrors = v.errors;
  }

  // 独立校验 best complete 方案
  let bestValid = false;
  let bestErrors: string[] = [];
  if (result.bestCompleteCandidate) {
    const v = validateCandidate(
      result.bestCompleteCandidate,
      options.partGroups,
      options.stocks,
      options.kerfMm
    );
    bestValid = v.valid;
    bestErrors = v.errors;
  }

  return {
    solverOutput: result,
    validationReport: {
      baselineValid,
      baselineErrors,
      bestValid,
      bestErrors,
    },
  };
}
