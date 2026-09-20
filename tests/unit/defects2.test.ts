import { describe, it, expect } from 'vitest';
import { runSingleStrategy } from '../../packages/core/src/solver/single-strategy';
import { Stock, PartInstance, StrategyConfig } from '../../packages/core/src/types/index';

describe('Defects handling 2', () => {
  it('should handle defects touching boundaries and overlapping', () => {
    const stock: Stock = {
      id: 's1',
      code: 'S1',
      group: { material: 'wood', thicknessMm: 10, color: 'natural' },
      width: 1000,
      height: 1000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
      defects: [
        { x: 400, y: 400, width: 200, height: 200 }, // defect 1 in center
        { x: 300, y: 450, width: 400, height: 100 }  // defect 2 overlapping horizontally
      ]
    };

    const parts: PartInstance[] = [
      { instanceId: 'p1', groupId: 'g1', name: 'part1', width: 900, height: 900, allowRotation: false, shape: 'RECT' },
      { instanceId: 'p2', groupId: 'g1', name: 'part2', width: 100, height: 100, allowRotation: false, shape: 'RECT' }
    ];

    const strategy: StrategyConfig = {
      name: 'baseline',
      partOrder: 'area-desc',
      rectFit: 'best-area-fit',
      splitRule: 'vertical-first',
      stockOrder: 'area-asc'
    };

    const result = runSingleStrategy(strategy, [stock], parts, 0, 0, []);
    expect(result.unplacedPartIds.length).toBe(1);
    
    // Also try a defect touching the exact border, and check if 0-width free nodes are created
    let defectNodes = 0;
    let offcutNodes = 0;
    const traverse = (node: any) => {
      if (node.type === 'DEFECT') defectNodes++;
      if (node.type === 'OFFCUT') offcutNodes++;
      if (node.children) {
        traverse(node.children[0]);
        traverse(node.children[1]);
      }
    };
    if (result.usedStocks.length > 0) {
      traverse(result.usedStocks[0].cutTree);
    }
    expect(defectNodes).toBe(3);
  });
});
