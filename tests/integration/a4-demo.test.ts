import { describe, it, expect } from 'vitest';
import { runA4Demo, createA4DemoOptions } from '../../packages/core/src/demo/a4-demo.js';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import { validateCandidate } from '../../packages/core/src/validator/index.js';

describe('A4 Core Demo Benchmark Case (Section 04 & Section 03)', () => {
  it('通用算法应真实计算产生预期结果，绝无硬编码', () => {
    const demo = runA4Demo();
    const { solverOutput, validationReport } = demo;

    // 1. 基线/原尺寸 (105 x 70 mm, delta = 0) 方案验证
    const baseline = solverOutput.baselineCandidate;
    expect(baseline).toBeDefined();
    expect(baseline!.isComplete).toBe(true);
    expect(baseline!.appliedDeltaMm).toBe(0);

    // 原尺寸必须使用 2 张 A4（因为 105 + 2 + 105 = 212 mm > 210 mm，单张最多放 4 个）
    expect(baseline!.metrics.newSheetsUsed).toBe(2);
    expect(baseline!.placedParts.length).toBe(8);
    // 独立校验通过
    expect(validationReport.baselineValid).toBe(true);
    expect(validationReport.baselineErrors).toEqual([]);

    // 2. 候选尺寸方案列表验证
    const candidates = solverOutput.candidates;
    // 应该包含 delta = 0 (105mm), delta = 1 (104mm), delta = 2 (103mm)
    const cand105 = candidates.find((c) => c.appliedDeltaMm === 0);
    const cand104 = candidates.find((c) => c.appliedDeltaMm === 1);
    const cand103 = candidates.find((c) => c.appliedDeltaMm === 2);

    expect(cand105).toBeDefined();
    expect(cand104).toBeDefined();
    expect(cand103).toBeDefined();

    // 105 mm 下需要 2 张
    expect(cand105!.isComplete).toBe(true);
    expect(cand105!.metrics.newSheetsUsed).toBe(2);

    // 104 mm 下（2列 104+2+104=210mm，4行 4*70+3*2=286mm）只需 1 张 A4！
    expect(cand104!.isComplete).toBe(true);
    expect(cand104!.metrics.newSheetsUsed).toBe(1);
    expect(cand104!.placedParts.length).toBe(8);

    // 103 mm 下也只需 1 张 A4
    expect(cand103!.isComplete).toBe(true);
    expect(cand103!.metrics.newSheetsUsed).toBe(1);

    // 3. 全局最佳完整候选推荐：必须推荐 104 mm (delta = 1 mm)
    // 因为在材料用量相同（均为 1 张）时，尺寸变化最小优先 (1 mm < 2 mm)
    const best = solverOutput.bestCompleteCandidate;
    expect(best).toBeDefined();
    expect(best!.appliedDeltaMm).toBe(1);
    expect(best!.metrics.newSheetsUsed).toBe(1);
    expect(validationReport.bestValid).toBe(true);
    expect(validationReport.bestErrors).toEqual([]);

    // 4. 验证零件尺寸是否精确改变
    for (const part of best!.placedParts) {
      expect(part.width).toBe(1040); // 104 mm
      expect(part.height).toBe(700); // 70 mm
      expect(part.rotated).toBe(false); // 禁止旋转
    }
  });

  it('如果用户不允许缩小尺寸 (maxShrinkMm = 0)，则只输出原尺寸方案', () => {
    const options = createA4DemoOptions();
    options.partGroups[0].flexibleRange = {
      maxShrinkMm: 0,
      stepMm: 1,
    };

    const result = solveCuttingPlan(options);
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].appliedDeltaMm).toBe(0);
    expect(result.candidates[0].metrics.newSheetsUsed).toBe(2);
    expect(result.bestCompleteCandidate!.metrics.newSheetsUsed).toBe(2);
  });

  it('如果用户允许旋转，算法必须重新求解', () => {
    const options = createA4DemoOptions();
    options.partGroups[0].allowRotation = true;

    const result = solveCuttingPlan(options);
    expect(result.bestCompleteCandidate).toBeDefined();
    // 允许旋转后方案应当有效且通过独立校验
    const v = validateCandidate(
      result.bestCompleteCandidate!,
      options.partGroups,
      options.stocks,
      options.kerfMm
    );
    expect(v.valid).toBe(true);
  });
});
