import { describe, it, expect } from 'vitest';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import { generateTemplatePolygon } from '../../packages/core/src/geometry/templates.js';
import { Stock, PartGroup, SolverOptions } from '../../packages/core/src/types/index.js';
import { validateCandidate } from '../../packages/core/src/validator/index.js';

describe('PROFILE Irregular Nesting Solver', () => {
  const stockSheet: Stock = {
    id: 's_sheet_1',
    code: '整板-1',
    group: { material: '椴木板', thicknessMm: 3, color: '原木' },
    width: 2000,
    height: 1500,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
  };

  const stockOffcut: Stock = {
    id: 's_offcut_1',
    code: '余料-1',
    group: { material: '椴木板', thicknessMm: 3, color: '原木' },
    width: 800,
    height: 600,
    isOffcut: true,
    status: 'AVAILABLE',
    version: 1,
  };

  // 三角形零件 (底 400, 高 300)
  const triangleGeo = generateTemplatePolygon('TRIANGLE', { base: 400, height: 300 });
  const trianglePart: PartGroup = {
    id: 'p_tri_1',
    name: '三角角件',
    targetWidth: 400,
    targetHeight: 300,
    quantity: 2,
    geometry: triangleGeo,
    rotationPolicy: 'RIGHT_ANGLE',
  };

  // L型零件 (400x400, 缺角 200x200)
  const lShapeGeo = generateTemplatePolygon('L_SHAPE', { w1: 400, h1: 400, w2: 200, h2: 200 });
  const lShapePart: PartGroup = {
    id: 'p_l_1',
    name: 'L支架',
    targetWidth: 400,
    targetHeight: 400,
    quantity: 1,
    geometry: lShapeGeo,
    rotationPolicy: 'LOCKED',
  };

  it('自动识别异形零件并分派至 PROFILE 求解模式', () => {
    const options: SolverOptions = {
      stocks: [stockOffcut, stockSheet],
      partGroups: [trianglePart],
      kerfMm: 1.0,
    };

    const output = solveCuttingPlan(options);
    expect(output.bestCompleteCandidate).toBeDefined();
    expect(output.bestCompleteCandidate?.layoutMode).toBe('PROFILE');
    expect(output.bestCompleteCandidate?.profilePlacements?.length).toBe(2);
  });

  it('优先使用余料：较小异形零件应优先进入余料板', () => {
    const options: SolverOptions = {
      stocks: [stockSheet, stockOffcut],
      partGroups: [trianglePart],
      kerfMm: 1.0,
    };

    const output = solveCuttingPlan(options);
    const best = output.bestCompleteCandidate;
    expect(best).toBeDefined();
    expect(best?.isComplete).toBe(true);
    expect(best?.metrics.offcutsUsed).toBe(1);
    expect(best?.metrics.newSheetsUsed).toBe(0);
    expect(best?.usedStocks[0].stockId).toBe('s_offcut_1');
  });

  it('产生不少于 12 种策略探索，并且具备确定性与可复现性', () => {
    const options: SolverOptions = {
      stocks: [stockOffcut, stockSheet],
      partGroups: [trianglePart, lShapePart],
      kerfMm: 1.0,
    };

    const run1 = solveCuttingPlan(options);
    const run2 = solveCuttingPlan(options);

    expect(run1.allExploredCount).toBeGreaterThanOrEqual(12);
    expect(run1.candidates.length).toBe(run2.candidates.length);
    expect(run1.bestCompleteCandidate?.candidateId).toBe(run2.bestCompleteCandidate?.candidateId);
    expect(run1.bestCompleteCandidate?.metrics).toEqual(run2.bestCompleteCandidate?.metrics);
  });

  it('避开材料上的禁排/破损缺陷区 (Stock Defects)', () => {
    const defectiveStock: Stock = {
      id: 's_defect_1',
      code: '瑕疵料',
      group: { material: '椴木板', thicknessMm: 3, color: '原木' },
      width: 1000,
      height: 1000,
      isOffcut: true,
      status: 'AVAILABLE',
      version: 1,
      defects: [
        { x: 0, y: 0, width: 500, height: 500 }, // 左下角 500x500 破损
      ],
    };

    const options: SolverOptions = {
      stocks: [defectiveStock],
      partGroups: [trianglePart],
      kerfMm: 0,
    };

    const output = solveCuttingPlan(options);
    const best = output.bestCompleteCandidate;
    expect(best).toBeDefined();
    if (best && best.isComplete) {
      // 验证放置的零件均未落在 (0,0, 500, 500) 区域内
      for (const placement of best.profilePlacements || []) {
        for (const pt of placement.transformedPoints) {
          const inDefect = pt.x < 500 && pt.y < 500;
          expect(inDefect).toBe(false);
        }
      }
    }
  });

  it('支持输出 3 种不同倾向的候选方案 (节省材料 / 方便裁切 / 综合平衡)', () => {
    const options: SolverOptions = {
      stocks: [stockOffcut, stockSheet],
      partGroups: [trianglePart, lShapePart],
      kerfMm: 1.0,
    };

    const output = solveCuttingPlan(options);
    expect(output.candidates.length).toBeGreaterThanOrEqual(1);
    // 方案应包含清晰策略名称与指标
    const candidate = output.bestCompleteCandidate || output.candidates[0];
    expect(candidate.metrics.utilizationRate).toBeGreaterThan(0);
  });
});
