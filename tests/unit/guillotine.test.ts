import { describe, it, expect, beforeEach } from 'vitest';
import {
  canFitWithKerf,
  executeGuillotineSplit,
  resetNodeIdCounter,
} from '../../packages/core/src/solver/cut-tree.js';
import { CutTreeNode } from '../../packages/core/src/types/index.js';

describe('Guillotine Cut Tree and Kerf Behavior', () => {
  beforeEach(() => {
    resetNodeIdCounter();
  });

  it('恰好铺满时不需要分割，不扣除预留带', () => {
    const region: CutTreeNode = {
      id: 'root',
      type: 'OFFCUT',
      rect: { x: 0, y: 0, width: 1000, height: 1000 },
    };

    const res = executeGuillotineSplit(
      region,
      'stock_1',
      {
        instanceId: 'p1',
        groupId: 'g1',
        name: '刚好贴合',
        width: 1000,
        height: 1000,
        rotated: false,
      },
      'VERTICAL',
      20, // 2 mm kerf
      1
    );

    // 根节点直接作为零件节点，不产生切痕和步骤
    expect(res.splitNode.type).toBe('PART');
    expect(res.splitNode.rect).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
    expect(res.newOffcuts.length).toBe(0);
    expect(res.kerfNodes.length).toBe(0);
    expect(res.steps.length).toBe(0);
  });

  it('剩余空间不足裁切间隔时拒绝放置', () => {
    // 区域宽 105，零件宽 100，间隙 5；若 kerf 是 10，则 105 - 100 = 5 < 10，放不下
    expect(canFitWithKerf(1050, 1000, 1000, 500, 100)).toBe(false);
    // 若剩余空间恰好等于 kerf，则余区宽为 0，允许放置
    expect(canFitWithKerf(1100, 1000, 1000, 500, 100)).toBe(true);
  });

  it('先竖后横分割正确并保证严格面积守恒', () => {
    // 区域 2000 x 3000, 放入零件 800 x 600, kerf = 20 (2mm)
    const region: CutTreeNode = {
      id: 'root',
      type: 'OFFCUT',
      rect: { x: 100, y: 200, width: 2000, height: 3000 },
    };

    const res = executeGuillotineSplit(
      region,
      'stock_1',
      {
        instanceId: 'p1',
        groupId: 'g1',
        name: '零件1',
        width: 800,
        height: 600,
        rotated: false,
      },
      'VERTICAL',
      20,
      1
    );

    expect(res.steps.length).toBe(2);
    // 第一步：竖切
    expect(res.steps[0].direction).toBe('VERTICAL');
    expect(res.steps[0].cutPosition).toBe(100 + 800); // x = 900
    // 第二步：横切
    expect(res.steps[1].direction).toBe('HORIZONTAL');
    expect(res.steps[1].cutPosition).toBe(200 + 600); // y = 800

    // 检查余区
    // 先竖后横：右侧余区宽 = 2000 - 800 - 20 = 1180, 高 = 3000
    // 下侧余区宽 = 800, 高 = 3000 - 600 - 20 = 2380
    expect(res.newOffcuts.length).toBe(2);
    const rightOffcut = res.newOffcuts.find((n) => n.rect.x === 100 + 800 + 20);
    const bottomOffcut = res.newOffcuts.find((n) => n.rect.y === 200 + 600 + 20);

    expect(rightOffcut).toBeDefined();
    expect(rightOffcut!.rect.width).toBe(1180);
    expect(rightOffcut!.rect.height).toBe(3000);

    expect(bottomOffcut).toBeDefined();
    expect(bottomOffcut!.rect.width).toBe(800);
    expect(bottomOffcut!.rect.height).toBe(2380);

    // 验证严格面积守恒
    const partArea = 800 * 600;
    const rightArea = 1180 * 3000;
    const bottomArea = 800 * 2380;
    const kerfArea = res.kerfNodes.reduce((sum, n) => sum + n.rect.width * n.rect.height, 0);
    const totalArea = partArea + rightArea + bottomArea + kerfArea;

    expect(totalArea).toBe(2000 * 3000);
  });

  it('先横后竖分割正确并保证严格面积守恒', () => {
    // 区域 2000 x 3000, 放入零件 800 x 600, kerf = 20
    const region: CutTreeNode = {
      id: 'root',
      type: 'OFFCUT',
      rect: { x: 0, y: 0, width: 2000, height: 3000 },
    };

    const res = executeGuillotineSplit(
      region,
      'stock_1',
      {
        instanceId: 'p1',
        groupId: 'g1',
        name: '零件1',
        width: 800,
        height: 600,
        rotated: false,
      },
      'HORIZONTAL',
      20,
      1
    );

    expect(res.steps.length).toBe(2);
    expect(res.steps[0].direction).toBe('HORIZONTAL');
    expect(res.steps[1].direction).toBe('VERTICAL');

    // 先横后竖：下侧余区宽 2000, 高 = 3000 - 600 - 20 = 2380
    // 右侧余区宽 = 2000 - 800 - 20 = 1180, 高 = 600
    const bottomOffcut = res.newOffcuts.find((n) => n.rect.y === 620);
    const rightOffcut = res.newOffcuts.find((n) => n.rect.x === 820);

    expect(bottomOffcut!.rect.width).toBe(2000);
    expect(bottomOffcut!.rect.height).toBe(2380);
    expect(rightOffcut!.rect.width).toBe(1180);
    expect(rightOffcut!.rect.height).toBe(600);

    const partArea = 800 * 600;
    const bottomArea = 2000 * 2380;
    const rightArea = 1180 * 600;
    const kerfArea = res.kerfNodes.reduce((sum, n) => sum + n.rect.width * n.rect.height, 0);
    const totalArea = partArea + bottomArea + rightArea + kerfArea;

    expect(totalArea).toBe(2000 * 3000);
  });
});
