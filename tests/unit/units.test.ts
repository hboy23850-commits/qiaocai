import { describe, it, expect } from 'vitest';
import {
  toInternalDimension,
  fromInternalDimension,
  formatInternal,
  formatArea,
  INTERNAL_SCALE,
} from '../../packages/core/src/utils/units.js';
import { validateSolverInput } from '../../packages/core/src/utils/validation.js';
import { Stock, PartGroup } from '../../packages/core/src/types/index.js';

describe('Unit Conversion and Input Precision', () => {
  it('应当正确转换 mm 和 cm 到内部 0.1 mm 整数', () => {
    expect(toInternalDimension(104, 'mm')).toBe(1040);
    expect(toInternalDimension(10.5, 'cm')).toBe(1050);
    expect(toInternalDimension(0.1, 'mm')).toBe(1);
    expect(toInternalDimension(210, 'mm')).toBe(2100);
    expect(toInternalDimension(29.7, 'cm')).toBe(2970);
  });

  it('应当将内部整数正确转回显示浮点数', () => {
    expect(fromInternalDimension(1040, 'mm')).toBe(104);
    expect(fromInternalDimension(1050, 'cm')).toBe(10.5);
    expect(formatInternal(1040, 'mm')).toBe('104 mm');
    expect(formatInternal(1050, 'cm')).toBe('10.5 cm');
  });

  it('超过 0.1 mm 精度时必须明确拒绝，禁止静默四舍五入', () => {
    expect(() => toInternalDimension(10.05, 'mm')).toThrow('超过了支持的 0.1 mm 精度');
    expect(() => toInternalDimension(10.001, 'mm')).toThrow('超过了支持的 0.1 mm 精度');
    expect(() => toInternalDimension(1.234, 'cm')).toThrow('超过了支持的 0.1 mm 精度');
  });

  it('非法输入（负数、0、非有限数）必须被拒绝', () => {
    expect(() => toInternalDimension(0, 'mm')).toThrow('尺寸必须为正数');
    expect(() => toInternalDimension(-5, 'mm')).toThrow('尺寸必须为正数');
    expect(() => toInternalDimension(NaN, 'mm')).toThrow('输入必须是有限数值');
    expect(() => toInternalDimension(Infinity, 'mm')).toThrow('输入必须是有限数值');
  });

  it('面积格式化计算正确', () => {
    // 100 mm * 100 mm = 1000 * 1000 = 1,000,000 internal units
    // 1,000,000 / 100 = 10,000 mm²
    expect(formatArea(1000 * 1000)).toBe('10000.0 mm²');
  });
});

describe('Solver Input Boundary Validation', () => {
  const sampleStock: Stock = {
    id: 's1',
    code: 'S1',
    group: { material: '木板', thicknessMm: 2, color: '原木' },
    width: 2000,
    height: 3000,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
  };

  const sampleGroup: PartGroup = {
    id: 'g1',
    name: '展签',
    targetWidth: 500,
    targetHeight: 500,
    quantity: 4,
    allowRotation: false,
  };

  it('空材料或空零件必须被拒绝', () => {
    expect(() =>
      validateSolverInput({ stocks: [], partGroups: [sampleGroup], kerfMm: 0 })
    ).toThrow('未选择任何可用材料');

    expect(() =>
      validateSolverInput({ stocks: [sampleStock], partGroups: [], kerfMm: 0 })
    ).toThrow('未输入任何零件需求');
  });

  it('材料超过 20 张或零件超过 20 个实例必须被拒绝', () => {
    const manyStocks = Array.from({ length: 21 }, (_, i) => ({
      ...sampleStock,
      id: `s_${i}`,
      code: `S${i}`,
    }));
    expect(() =>
      validateSolverInput({ stocks: manyStocks, partGroups: [sampleGroup], kerfMm: 0 })
    ).toThrow('单次任务最多选用 20 张材料');

    const largeGroup: PartGroup = { ...sampleGroup, quantity: 21 };
    expect(() =>
      validateSolverInput({ stocks: [sampleStock], partGroups: [largeGroup], kerfMm: 0 })
    ).toThrow('单任务最多容纳 20 个零件实例');
  });

  it('不同材料组的材料不能混排', () => {
    const stockA = { ...sampleStock, id: 'sa', group: { material: '椴木', thicknessMm: 2, color: '原色' } };
    const stockB = { ...sampleStock, id: 'sb', group: { material: '亚克力', thicknessMm: 2, color: '透明' } };
    expect(() =>
      validateSolverInput({ stocks: [stockA, stockB], partGroups: [sampleGroup], kerfMm: 0 })
    ).toThrow('单次排料仅支持同一材料组');
  });

  it('裁切间隔超过 5 mm 或精度超过 0.1 mm 时拒绝', () => {
    expect(() =>
      validateSolverInput({ stocks: [sampleStock], partGroups: [sampleGroup], kerfMm: 6 })
    ).toThrow('裁切间隔必须在 0 到 5 mm 之间');

    expect(() =>
      validateSolverInput({ stocks: [sampleStock], partGroups: [sampleGroup], kerfMm: 2.15 })
    ).toThrow('裁切间隔精度不能超过 0.1 mm');
  });

  it('最多只允许一个零件组开启柔性尺寸调整', () => {
    const g1: PartGroup = {
      ...sampleGroup,
      id: 'g1',
      flexibleRange: { maxShrinkMm: 1, stepMm: 1 },
    };
    const g2: PartGroup = {
      ...sampleGroup,
      id: 'g2',
      flexibleRange: { maxShrinkMm: 2, stepMm: 1 },
    };
    expect(() =>
      validateSolverInput({ stocks: [sampleStock], partGroups: [g1, g2], kerfMm: 0 })
    ).toThrow('最多只允许一个零件组开启尺寸协商与调整');
  });
});
