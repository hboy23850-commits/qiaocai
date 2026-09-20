import { describe, it, expect } from 'vitest';
import { validateCandidate } from '../../packages/core/src/validator/index.js';
import { Candidate, PartGroup, Stock } from '../../packages/core/src/types/index.js';

describe('Independent Validator', () => {
  const stock: Stock = {
    id: 's1',
    code: 'S1',
    group: { material: '木板', thicknessMm: 2, color: '原色' },
    width: 2000,
    height: 2000,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
  };

  const group: PartGroup = {
    id: 'g1',
    name: '卡片',
    targetWidth: 500,
    targetHeight: 500,
    quantity: 1,
    allowRotation: false,
  };

  it('合法放置且面积守恒时通过校验', () => {
    const candidate: Candidate = {
      candidateId: 'c1',
      strategyName: 'test',
      isComplete: true,
      appliedDeltaMm: 0,
      targetParts: [{ groupId: 'g1', width: 500, height: 500 }],
      placedParts: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '卡片',
          stockId: 's1',
          x: 0,
          y: 0,
          width: 500,
          height: 500,
          rotated: false,
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
          cutTree: {
            id: 'root',
            type: 'SPLIT',
            rect: { x: 0, y: 0, width: 2000, height: 2000 },
            direction: 'VERTICAL',
            splitPos: 500,
            children: [
              {
                id: 'left_split',
                type: 'SPLIT',
                rect: { x: 0, y: 0, width: 500, height: 2000 },
                direction: 'HORIZONTAL',
                splitPos: 500,
                children: [
                  {
                    id: 'part_node',
                    type: 'PART',
                    rect: { x: 0, y: 0, width: 500, height: 500 },
                    partInstanceId: 'g1_1',
                    partGroupId: 'g1',
                    partName: '卡片',
                  },
                  {
                    id: 'bottom_offcut',
                    type: 'OFFCUT',
                    rect: { x: 0, y: 500, width: 500, height: 1500 },
                  },
                ],
              },
              {
                id: 'right_offcut',
                type: 'OFFCUT',
                rect: { x: 500, y: 0, width: 1500, height: 2000 },
              },
            ],
          },
          placedParts: [
            {
              instanceId: 'g1_1',
              groupId: 'g1',
              name: '卡片',
              stockId: 's1',
              x: 0,
              y: 0,
              width: 500,
              height: 500,
              rotated: false,
            },
          ],
          remainingOffcuts: [],
          steps: [],
        },
      ],
      metrics: {
        newSheetsUsed: 1,
        offcutsUsed: 0,
        totalInputArea: 4000000,
        partsArea: 250000,
        kerfArea: 0,
        offcutArea: 3750000,
        stepsCount: 2,
        utilizationRate: 250000 / 4000000,
      },
    };

    const res = validateCandidate(candidate, [group], [stock], 0);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('禁止旋转的零件被旋转时必须报错', () => {
    const candidate: Candidate = {
      candidateId: 'c2',
      strategyName: 'test',
      isComplete: true,
      appliedDeltaMm: 0,
      targetParts: [{ groupId: 'g1', width: 500, height: 500 }],
      placedParts: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '卡片',
          stockId: 's1',
          x: 0,
          y: 0,
          width: 500,
          height: 500,
          rotated: true, // 违背 allowRotation: false
        },
      ],
      unplacedPartIds: [],
      usedStocks: [],
      metrics: {} as any,
    };

    const res = validateCandidate(candidate, [group], [stock], 0);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('未授权旋转'))).toBe(true);
  });

  it('零件相互几何重叠时必须报错', () => {
    const twoPiecesGroup = { ...group, quantity: 2 };
    const candidate: Candidate = {
      candidateId: 'c3',
      strategyName: 'test',
      isComplete: true,
      appliedDeltaMm: 0,
      targetParts: [{ groupId: 'g1', width: 500, height: 500 }],
      placedParts: [
        {
          instanceId: 'g1_1',
          groupId: 'g1',
          name: '卡片1',
          stockId: 's1',
          x: 0,
          y: 0,
          width: 500,
          height: 500,
          rotated: false,
        },
        {
          instanceId: 'g1_2',
          groupId: 'g1',
          name: '卡片2',
          stockId: 's1',
          x: 200, // 与卡片1重叠！
          y: 200,
          width: 500,
          height: 500,
          rotated: false,
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
          cutTree: {
            id: 'root',
            type: 'OFFCUT',
            rect: { x: 0, y: 0, width: 2000, height: 2000 },
          },
          placedParts: [
            {
              instanceId: 'g1_1',
              groupId: 'g1',
              name: '卡片1',
              stockId: 's1',
              x: 0,
              y: 0,
              width: 500,
              height: 500,
              rotated: false,
            },
            {
              instanceId: 'g1_2',
              groupId: 'g1',
              name: '卡片2',
              stockId: 's1',
              x: 200,
              y: 200,
              width: 500,
              height: 500,
              rotated: false,
            },
          ],
          remainingOffcuts: [],
          steps: [],
        },
      ],
      metrics: {} as any,
    };

    const res = validateCandidate(candidate, [twoPiecesGroup], [stock], 0);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('发生几何重叠'))).toBe(true);
  });
});
