import { describe, it, expect } from 'vitest';
import { validateCandidate } from '../../packages/core/src/validator/index.js';
import { Candidate, PartGroup, Stock, Point } from '../../packages/core/src/types/index.js';
import { generateTemplatePolygon } from '../../packages/core/src/geometry/templates.js';

describe('PROFILE Validator (Single-vote Veto)', () => {
  const stock: Stock = {
    id: 's1',
    code: 'S1',
    group: { material: '木板', thicknessMm: 2, color: '原色' },
    width: 2000,
    height: 2000,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
    defects: [{ x: 1000, y: 1000, width: 200, height: 200 }],
  };

  const triangleGeo = generateTemplatePolygon('TRIANGLE', { base: 400, height: 300 });
  const triangleGroup: PartGroup = {
    id: 'g1',
    name: '三角件',
    targetWidth: 400,
    targetHeight: 300,
    quantity: 1,
    rotationPolicy: 'LOCKED',
    geometry: triangleGeo,
  };

  it('PROFILE 合法排布通过校验', () => {
    const candidate: Candidate = {
      candidateId: 'cand_prof_1',
      strategyName: '节省材料',
      isComplete: true,
      appliedDeltaMm: 0,
      layoutMode: 'PROFILE',
      targetParts: [{ groupId: 'g1', width: 400, height: 300 }],
      placedParts: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '三角件',
          stockId: 's1',
          x: 100,
          y: 100,
          width: 400,
          height: 300,
          rotated: false,
        },
      ],
      profilePlacements: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '三角件',
          stockId: 's1',
          translation: { x: 100, y: 100 },
          rotationDeg: 0,
          transformedPoints: [
            { x: 100, y: 100 },
            { x: 500, y: 100 },
            { x: 100, y: 400 },
          ],
          bbox: { x: 100, y: 100, width: 400, height: 300 },
        },
      ],
      unplacedPartIds: [],
      usedStocks: [
        {
          stockId: 's1',
          stockCode: 'S1',
          isOffcut: false,
          width: 2000,
          height: 2000,
          cutTree: { id: 'root', type: 'PART', rect: { x: 0, y: 0, width: 2000, height: 2000 } },
          placedParts: [],
          remainingOffcuts: [],
          steps: [],
        },
      ],
      metrics: {
        newSheetsUsed: 1,
        offcutsUsed: 0,
        totalInputArea: 4000000,
        partsArea: 60000,
        kerfArea: 0,
        offcutArea: 3940000,
        stepsCount: 1,
        utilizationRate: 60000 / 4000000,
      },
    };

    const res = validateCandidate(candidate, [triangleGroup], [stock], 0);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('PROFILE 多边形相互重叠时一票否决', () => {
    const twoGroup = { ...triangleGroup, quantity: 2 };
    const candidate: Candidate = {
      candidateId: 'cand_prof_overlap',
      strategyName: '重叠测试',
      isComplete: true,
      appliedDeltaMm: 0,
      layoutMode: 'PROFILE',
      targetParts: [{ groupId: 'g1', width: 400, height: 300 }],
      placedParts: [],
      profilePlacements: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '三角件1',
          stockId: 's1',
          translation: { x: 100, y: 100 },
          rotationDeg: 0,
          transformedPoints: [
            { x: 100, y: 100 },
            { x: 500, y: 100 },
            { x: 100, y: 400 },
          ],
          bbox: { x: 100, y: 100, width: 400, height: 300 },
        },
        {
          instanceId: 'g1_2',
          groupId: 'g1',
          name: '三角件2',
          stockId: 's1',
          translation: { x: 200, y: 200 }, // 与三角件1内部重叠
          rotationDeg: 0,
          transformedPoints: [
            { x: 200, y: 200 },
            { x: 600, y: 200 },
            { x: 200, y: 500 },
          ],
          bbox: { x: 200, y: 200, width: 400, height: 300 },
        },
      ],
      unplacedPartIds: [],
      usedStocks: [{ stockId: 's1', stockCode: 'S1', isOffcut: false, width: 2000, height: 2000, cutTree: {} as any, placedParts: [], remainingOffcuts: [], steps: [] }],
      metrics: {} as any,
    };

    const res = validateCandidate(candidate, [twoGroup], [stock], 0);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('重叠'))).toBe(true);
  });

  it('PROFILE 触碰材料缺陷禁排区时一票否决', () => {
    const candidate: Candidate = {
      candidateId: 'cand_prof_defect',
      strategyName: '触碰缺陷测试',
      isComplete: true,
      appliedDeltaMm: 0,
      layoutMode: 'PROFILE',
      targetParts: [{ groupId: 'g1', width: 400, height: 300 }],
      placedParts: [],
      profilePlacements: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '三角件1',
          stockId: 's1',
          translation: { x: 900, y: 900 },
          rotationDeg: 0,
          transformedPoints: [
            { x: 900, y: 900 },
            { x: 1300, y: 900 }, // 穿入 (1000, 1000, 200, 200)
            { x: 900, y: 1200 },
          ],
          bbox: { x: 900, y: 900, width: 400, height: 300 },
        },
      ],
      unplacedPartIds: [],
      usedStocks: [{ stockId: 's1', stockCode: 'S1', isOffcut: false, width: 2000, height: 2000, cutTree: {} as any, placedParts: [], remainingOffcuts: [], steps: [] }],
      metrics: {} as any,
    };

    const res = validateCandidate(candidate, [triangleGroup], [stock], 0);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('缺陷') || e.includes('禁排'))).toBe(true);
  });

  it('PROFILE 未授权旋转时一票否决', () => {
    const candidate: Candidate = {
      candidateId: 'cand_prof_rot',
      strategyName: '未授权旋转测试',
      isComplete: true,
      appliedDeltaMm: 0,
      layoutMode: 'PROFILE',
      targetParts: [{ groupId: 'g1', width: 400, height: 300 }],
      placedParts: [],
      profilePlacements: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '三角件1',
          stockId: 's1',
          translation: { x: 100, y: 100 },
          rotationDeg: 90, // group.rotationPolicy === 'LOCKED'
          transformedPoints: [
            { x: 100, y: 100 },
            { x: 100, y: 500 },
            { x: 400, y: 100 },
          ],
          bbox: { x: 100, y: 100, width: 300, height: 400 },
        },
      ],
      unplacedPartIds: [],
      usedStocks: [{ stockId: 's1', stockCode: 'S1', isOffcut: false, width: 2000, height: 2000, cutTree: {} as any, placedParts: [], remainingOffcuts: [], steps: [] }],
      metrics: {} as any,
    };

    const res = validateCandidate(candidate, [triangleGroup], [stock], 0);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('旋转'))).toBe(true);
  });
});
