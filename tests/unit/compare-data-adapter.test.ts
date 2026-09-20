import { describe, it, expect } from 'vitest';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import { SolverOptions } from '../../packages/core/src/types/index.js';
import { validateSolverInput } from '../../packages/core/src/utils/validation.js';

describe('Problem 1: Compare Page Data Adapter & UsedStock Structure', () => {
  it('reproduces that UsedStockPlan has width/height directly, not under a stock property', () => {
    const options: SolverOptions = {
      stocks: [
        {
          id: 's1',
          code: 'S1',
          width: 2100, // 210mm
          height: 2970, // 297mm
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
          group: { material: '白卡纸', thicknessMm: 0.5, color: '白色' }
        }
      ],
      partGroups: [
        {
          id: 'g1',
          name: '展签A',
          targetWidth: 1000,
          targetHeight: 500,
          quantity: 2,
          allowRotation: false
        }
      ],
      kerfMm: 2
    };

    const result = solveCuttingPlan(options);
    expect(result.candidates.length).toBeGreaterThan(0);
    const cand = result.candidates[0];

    // Check usedStocks structure
    expect(cand.usedStocks.length).toBeGreaterThan(0);
    const us = cand.usedStocks[0];

    // Problem 1 verification:
    // us.stock is undefined in the real solver output!
    // Reading us.stock.width throws a TypeError if attempted directly.
    expect((us as any).stock).toBeUndefined();
    expect(typeof us.width).toBe('number');
    expect(typeof us.height).toBe('number');
    expect(us.width).toBe(2100);
    expect(us.height).toBe(2970);

    // Safe adapter calculation function
    const calculateTotalAreaSqm = (usedStocks: typeof cand.usedStocks) => {
      let totalAreaSqm = 0;
      usedStocks.forEach((u) => {
        totalAreaSqm += (u.width / 10000) * (u.height / 10000);
      });
      return totalAreaSqm;
    };

    const area = calculateTotalAreaSqm(cand.usedStocks);
    expect(area).toBeCloseTo(0.06237, 4);
  });
});

describe('Problem 9: Single Flexible Group Enforcement', () => {
  it('throws an error if more than one group has flexibleRange with maxShrinkMm > 0', () => {
    const options: SolverOptions = {
      stocks: [
        {
          id: 's1',
          code: 'S1',
          width: 2100,
          height: 2970,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
          group: { material: '白卡纸', thicknessMm: 0.5, color: '白色' }
        }
      ],
      partGroups: [
        {
          id: 'g1',
          name: '展签A',
          targetWidth: 1000,
          targetHeight: 500,
          quantity: 2,
          allowRotation: false,
          flexibleRange: { maxShrinkMm: 1, stepMm: 1 }
        },
        {
          id: 'g2',
          name: '模型面板B',
          targetWidth: 800,
          targetHeight: 400,
          quantity: 1,
          allowRotation: false,
          flexibleRange: { maxShrinkMm: 2, stepMm: 1 }
        }
      ],
      kerfMm: 2
    };

    expect(() => validateSolverInput(options)).toThrow('最多只允许一个零件组开启尺寸协商与调整');
  });

  it('succeeds when exactly one group is flexible and other groups are locked', () => {
    const options: SolverOptions = {
      stocks: [
        {
          id: 's1',
          code: 'S1',
          width: 2100,
          height: 2970,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
          group: { material: '白卡纸', thicknessMm: 0.5, color: '白色' }
        }
      ],
      partGroups: [
        {
          id: 'g1',
          name: '展签A(允许微调)',
          targetWidth: 1050,
          targetHeight: 700,
          quantity: 2,
          allowRotation: false,
          flexibleRange: { maxShrinkMm: 2, stepMm: 1 }
        },
        {
          id: 'g2',
          name: '模型面板B(锁定)',
          targetWidth: 800,
          targetHeight: 400,
          quantity: 1,
          allowRotation: false
        }
      ],
      kerfMm: 2
    };

    expect(() => validateSolverInput(options)).not.toThrow();
    const result = solveCuttingPlan(options);
    expect(result.candidates.length).toBeGreaterThan(0);

    // Verify locked group g2 never shrank in any candidate
    for (const cand of result.candidates) {
      const g2Def = cand.targetParts.find((p) => p.groupId === 'g2');
      expect(g2Def?.width).toBe(800);
      expect(g2Def?.height).toBe(400);
    }
  });
});
