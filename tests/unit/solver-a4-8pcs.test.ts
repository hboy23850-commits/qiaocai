/**
 * Step 2 验证：两张 A4 卡纸放置 8 个 105×70mm 展签（不旋转，间距 2mm）
 *
 * 理论计算：
 *   纵向：4×700 + 3×20 = 2860 ≤ 2970（A4 高）  → 每张可放 4 个
 *   横向：105mm = 1050 ≤ 2100（A4 宽）
 *   两张合计放 8 个：完全可行
 *
 * 若本地测试失败，说明问题在求解器或校验器（而非线上材料单位）。
 * 若本地通过，则说明线上材料 width/height 可能存为毫米而非 0.1mm 整数。
 */

import { describe, it, expect } from 'vitest';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import { validateCandidate } from '../../packages/core/src/validator/index.js';
import type { SolverOptions, Stock, PartGroup } from '../../packages/core/src/types/index.js';

/** A4 卡纸（内部单位：0.1mm 整数，A4 = 210mm × 297mm） */
const A4_WIDTH = 2100;   // 210mm × 10
const A4_HEIGHT = 2970;  // 297mm × 10

/** 展签尺寸（内部单位：0.1mm 整数） */
const BADGE_W = 1050;  // 105mm
const BADGE_H = 700;   // 70mm

const stocks: Stock[] = [
  {
    id: 'a4-stock-1',
    code: 'A4-1',
    group: { material: '卡纸', thicknessMm: 0.3, color: '白色' },
    width: A4_WIDTH,
    height: A4_HEIGHT,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
  },
  {
    id: 'a4-stock-2',
    code: 'A4-2',
    group: { material: '卡纸', thicknessMm: 0.3, color: '白色' },
    width: A4_WIDTH,
    height: A4_HEIGHT,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
  },
];

const partGroups: PartGroup[] = [
  {
    id: 'badge-group',
    name: '展签',
    targetWidth: BADGE_W,
    targetHeight: BADGE_H,
    quantity: 8,
    allowRotation: false,
  },
];

const options: SolverOptions = {
  stocks,
  partGroups,
  kerfMm: 2,
};

describe('Step2 本地数学验证：2张A4 + 8个105×70展签，间距2mm，不旋转', () => {
  it('应返回至少一个完整候选（isComplete=true）', () => {
    const output = solveCuttingPlan(options);

    // 诊断输出
    console.log('[Step2-Diag] allExploredCount:', output.allExploredCount);
    console.log('[Step2-Diag] candidates count:', output.candidates.length);
    console.log('[Step2-Diag] bestCompleteCandidate:', output.bestCompleteCandidate
      ? `candidateId=${output.bestCompleteCandidate.candidateId}, usedStocks=${output.bestCompleteCandidate.usedStocks.length}, placedParts=${output.bestCompleteCandidate.placedParts.length}`
      : 'null');
    for (const cand of output.candidates) {
      console.log(`[Step2-Diag] candidate ${cand.candidateId}: isComplete=${cand.isComplete}, placed=${cand.placedParts.length}, unplaced=${JSON.stringify(cand.unplacedPartIds)}, sheets=${cand.usedStocks.length}`);
    }

    expect(output.bestCompleteCandidate).not.toBeNull();
    expect(output.bestCompleteCandidate!.isComplete).toBe(true);
    expect(output.bestCompleteCandidate!.placedParts.length).toBe(8);
  });

  it('最优完整候选应通过独立几何校验（validationPassed=true）', () => {
    const output = solveCuttingPlan(options);
    expect(output.bestCompleteCandidate).not.toBeNull();

    const candidate = output.bestCompleteCandidate!;
    const checked = validateCandidate(candidate, partGroups, stocks, 2);

    // 详细诊断
    console.log('[Step2-Diag] validateCandidate.valid:', checked.valid);
    console.log('[Step2-Diag] validateCandidate.errors:', JSON.stringify(checked.errors));

    const validationPassed = checked.valid && candidate.isComplete;
    expect(validationPassed).toBe(true);
  });

  it('所有候选均不应违反旋转约束（allowRotation=false）', () => {
    const output = solveCuttingPlan(options);
    for (const cand of output.candidates) {
      for (const placed of cand.placedParts) {
        expect(placed.rotated).toBe(false);
      }
    }
  });

  it('展签尺寸在所有候选中保持不变（精确锁定）', () => {
    const output = solveCuttingPlan(options);
    for (const cand of output.candidates) {
      for (const placed of cand.placedParts) {
        // 因为 allowRotation=false，width/height 不应互换
        expect(placed.width).toBe(BADGE_W);
        expect(placed.height).toBe(BADGE_H);
      }
    }
  });

  it('使用的材料最多 2 张（2 张 A4 足够）', () => {
    const output = solveCuttingPlan(options);
    if (output.bestCompleteCandidate) {
      expect(output.bestCompleteCandidate.usedStocks.length).toBeLessThanOrEqual(2);
    }
  });

  it('材料单位误用诊断：若 A4 以毫米存储（210×297）则求解应失败', () => {
    // 这个测试反向验证：使用错误单位（mm 而非 0.1mm）时，求解应该得不到完整方案
    const wrongUnitStocks: Stock[] = stocks.map((s) => ({
      ...s,
      width: 210,   // 错误：毫米值，非 0.1mm 整数
      height: 297,
    }));
    const wrongOutput = solveCuttingPlan({ stocks: wrongUnitStocks, partGroups, kerfMm: 2 });
    console.log('[Step2-Diag] 错误单位时 bestCompleteCandidate:', wrongOutput.bestCompleteCandidate ? 'NOT NULL（意外）' : 'null（预期）');
    // 错误单位时，零件（1050×700）远大于材料（210×297），应无法完整放置
    expect(wrongOutput.bestCompleteCandidate).toBeNull();
  });
});
