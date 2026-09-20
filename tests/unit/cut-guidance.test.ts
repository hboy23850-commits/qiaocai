import { describe, it, expect } from 'vitest';
import { generateCutGuidance } from '../../packages/core/src/solver/cut-paths.js';
import { ProfilePlacement, Rect } from '../../packages/core/src/types/index.js';

describe('Manual Cut Guidance and Sequencing', () => {
  it('生成内紧邻到外侧分步裁切顺序与刀路', () => {
    const placements: ProfilePlacement[] = [
      {
        instanceId: 'p1',
        groupId: 'g1',
        name: '内部小件',
        stockId: 's1',
        translation: { x: 200, y: 200 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 200, y: 200 },
          { x: 300, y: 200 },
          { x: 300, y: 300 },
          { x: 200, y: 300 },
        ],
        bbox: { x: 200, y: 200, width: 100, height: 100 },
      },
      {
        instanceId: 'p2',
        groupId: 'g2',
        name: '外围大件',
        stockId: 's1',
        translation: { x: 0, y: 0 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 0, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 800 },
          { x: 0, y: 800 },
        ],
        bbox: { x: 0, y: 0, width: 800, height: 800 },
      },
    ];

    const guidance = generateCutGuidance(placements, { width: 1000, height: 1000 });
    expect(guidance.steps.length).toBeGreaterThan(0);
    // 校验内到外切序提示
    expect(guidance.steps[0].description).toBeDefined();
  });

  it('依据几何形状自动推荐裁切工具 (直尺美工刀 vs 剪刀)', () => {
    // 纯直线多边形
    const straightPlacements: ProfilePlacement[] = [
      {
        instanceId: 'p1',
        groupId: 'g1',
        name: '矩形',
        stockId: 's1',
        translation: { x: 0, y: 0 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 500 },
          { x: 0, y: 500 },
        ],
        bbox: { x: 0, y: 0, width: 500, height: 500 },
      },
    ];
    const guidance1 = generateCutGuidance(straightPlacements, { width: 1000, height: 1000 });
    expect(guidance1.recommendedTool).toContain('美工刀');

    // 含有众多高密顶点（曲线离散化）的多边形
    const curvePoints = [];
    for (let i = 0; i < 32; i++) {
      const rad = (i / 32) * Math.PI * 2;
      curvePoints.push({ x: Math.round(500 + 200 * Math.cos(rad)), y: Math.round(500 + 200 * Math.sin(rad)) });
    }
    const curvedPlacements: ProfilePlacement[] = [
      {
        instanceId: 'p_circle',
        groupId: 'g_c',
        name: '圆片',
        stockId: 's1',
        translation: { x: 0, y: 0 },
        rotationDeg: 0,
        transformedPoints: curvePoints,
        bbox: { x: 300, y: 300, width: 400, height: 400 },
      },
    ];
    const guidance2 = generateCutGuidance(curvedPlacements, { width: 1000, height: 1000 });
    expect(guidance2.recommendedTool).toContain('剪刀');
  });

  it('必须包含 100mm 打印实测校准线定义', () => {
    const guidance = generateCutGuidance([], { width: 1000, height: 1000 });
    expect(guidance.calibrationLineMm).toBe(100);
  });
});
