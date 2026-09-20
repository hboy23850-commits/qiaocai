import { describe, it, expect } from 'vitest';
import { runSingleStrategy } from '../../packages/core/src/solver/single-strategy';
import { Stock, PartInstance, StrategyConfig } from '../../packages/core/src/types/index';

describe('Defects handling', () => {
  it('should avoid defects and place parts correctly', () => {
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
        { x: 400, y: 400, width: 200, height: 200 }
      ]
    };

    const parts: PartInstance[] = [
      { instanceId: 'p1', groupId: 'g1', name: 'part1', width: 500, height: 500, allowRotation: false, shape: 'RECT' },
      { instanceId: 'p2', groupId: 'g1', name: 'part2', width: 500, height: 500, allowRotation: false, shape: 'RECT' }
    ];

    const strategy: StrategyConfig = {
      name: 'baseline',
      partOrder: 'area-desc',
      rectFit: 'best-area-fit',
      splitRule: 'vertical-first',
      stockOrder: 'area-asc'
    };

    const result = runSingleStrategy(strategy, [stock], parts, 0, 0, []);

    // Defect is at center. Part 1 takes top-left (0,0, 500x500). Part 2 cannot fit anywhere else if there is a defect at (400,400),
    // Wait, part1 takes 0,0 500x500. This overlaps with defect (400, 400)!
    // If defect logic works, part1 won't be placed at (0,0) if it overlaps with (400,400).
    // Let's see: 
    // Defect at 400,400, size 200x200.
    // Stock is 1000x1000.
    // Top free region: y < 400. Area: 1000x400.
    // Left free region: x < 400. Area: 400x1000.
    // Bottom free region: y > 600. Area: 1000x400.
    // Right free region: x > 600. Area: 400x1000.
    // A 500x500 part cannot fit in ANY of these free regions!
    // So both parts should remain unplaced if they are 500x500.

    expect(result.unplacedPartIds.length).toBe(2);

    // Let's add a smaller part that CAN fit.
    const parts2: PartInstance[] = [
      { instanceId: 'p3', groupId: 'g2', name: 'part3', width: 300, height: 300, allowRotation: false, shape: 'RECT' }
    ];
    const result2 = runSingleStrategy(strategy, [stock], parts2, 0, 0, []);
    
    // Should be placed.
    expect(result2.unplacedPartIds.length).toBe(0);
    expect(result2.placedParts.length).toBe(1);

    // Also check if defect node exists in tree.
    let defectFound = false;
    const traverse = (node: any) => {
      if (node.type === 'DEFECT') defectFound = true;
      if (node.children) {
        traverse(node.children[0]);
        traverse(node.children[1]);
      }
    };
    if (result2.usedStocks.length > 0) {
      traverse(result2.usedStocks[0].cutTree);
    }
    expect(defectFound).toBe(true);
  });
});
