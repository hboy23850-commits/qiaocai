import { describe, it, expect } from 'vitest';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import { build24Strategies } from '../../packages/core/src/solver/strategies.js';
import { Stock, PartGroup, SolverOptions } from '../../packages/core/src/types/index.js';
import { validateCandidate } from '../../packages/core/src/validator/index.js';

describe('24 Deterministic Strategies and Consistency', () => {
  it('应当恰好构建 24 种不同组合策略，且首个为基线策略', () => {
    const strategies = build24Strategies();
    expect(strategies.length).toBe(24);
    expect(strategies[0].isBaseline).toBe(true);
    expect(strategies[0].partOrder).toBe('area-desc');
    expect(strategies[0].stockOrder).toBe('offcut-first');
    expect(strategies[0].rectFit).toBe('best-area-fit');
    expect(strategies[0].splitRule).toBe('vertical-first');
  });

  it('同一输入重复运行两次，结果必须完全一致（确定性保证）', () => {
    const options: SolverOptions = {
      stocks: [
        {
          id: 's1',
          code: 'S1',
          group: { material: '木板', thicknessMm: 3, color: '原木' },
          width: 2000,
          height: 1500,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
        },
        {
          id: 's2',
          code: 'S2',
          group: { material: '木板', thicknessMm: 3, color: '原木' },
          width: 1000,
          height: 800,
          isOffcut: true, // 余料
          status: 'AVAILABLE',
          version: 1,
        },
      ],
      partGroups: [
        {
          id: 'p1',
          name: '隔板',
          targetWidth: 400,
          targetHeight: 300,
          quantity: 3,
          allowRotation: true,
        },
        {
          id: 'p2',
          name: '小盒',
          targetWidth: 200,
          targetHeight: 200,
          quantity: 2,
          allowRotation: false,
        },
      ],
      kerfMm: 1.0,
    };

    const run1 = solveCuttingPlan(options);
    const run2 = solveCuttingPlan(options);

    expect(run1.candidates.length).toBe(run2.candidates.length);
    expect(run1.bestCompleteCandidate?.candidateId).toBe(run2.bestCompleteCandidate?.candidateId);
    expect(run1.bestCompleteCandidate?.metrics).toEqual(run2.bestCompleteCandidate?.metrics);
    expect(run1.bestCompleteCandidate?.placedParts).toEqual(run2.bestCompleteCandidate?.placedParts);
  });

  it('优先使用余料测试：较小尺寸需求应优先使用余料而非开整张', () => {
    const options: SolverOptions = {
      stocks: [
        {
          id: 'new_sheet_1',
          code: '整板-1',
          group: { material: '亚克力', thicknessMm: 2, color: '透明' },
          width: 3000,
          height: 3000,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
        },
        {
          id: 'offcut_1',
          code: '余料-1',
          group: { material: '亚克力', thicknessMm: 2, color: '透明' },
          width: 800,
          height: 600,
          isOffcut: true,
          status: 'AVAILABLE',
          version: 1,
        },
      ],
      partGroups: [
        {
          id: 'g1',
          name: '小挡板',
          targetWidth: 300,
          targetHeight: 200,
          quantity: 1,
          allowRotation: false,
        },
      ],
      kerfMm: 0,
    };

    const result = solveCuttingPlan(options);
    expect(result.bestCompleteCandidate).toBeDefined();
    // 应该优先使用余料，新整板使用数为 0
    expect(result.bestCompleteCandidate!.metrics.offcutsUsed).toBe(1);
    expect(result.bestCompleteCandidate!.metrics.newSheetsUsed).toBe(0);
    expect(result.bestCompleteCandidate!.usedStocks[0].stockId).toBe('offcut_1');
  });

  it('材料不足时未完成方案必须如实报告未放置清单', () => {
    const options: SolverOptions = {
      stocks: [
        {
          id: 'tiny_offcut',
          code: '碎料',
          group: { material: '纸板', thicknessMm: 1, color: '灰' },
          width: 100,
          height: 100,
          isOffcut: true,
          status: 'AVAILABLE',
          version: 1,
        },
      ],
      partGroups: [
        {
          id: 'huge_part',
          name: '大箱面',
          targetWidth: 500,
          targetHeight: 500,
          quantity: 1,
          allowRotation: false,
        },
      ],
      kerfMm: 0,
    };

    const result = solveCuttingPlan(options);
    expect(result.bestCompleteCandidate).toBeNull(); // 无完整方案
    expect(result.candidates[0].isComplete).toBe(false);
    expect(result.candidates[0].unplacedPartIds).toContain('huge_part_1');
  });
});
