import { describe, it, expect } from 'vitest';
import { calculateQuote } from '../../packages/core/src/utils/quote.js';
import {
  QuoteCalculationInput,
  QuoteCalculationResult,
  Stock,
  PartGroup,
  SolverOptions
} from '../../packages/core/src/types/index.js';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import { build24Strategies } from '../../packages/core/src/solver/strategies.js';

describe('Adversarial Challenge: Quote Precision, Boundaries & Core Isolation', () => {

  describe('1. Input Fuzzing and Type Coercion Resilience', () => {
    it('应当对 null、undefined 及空对象鲁棒返回全零结果而不抛出异常', () => {
      // @ts-expect-error 测试运行时非预期参数
      const nullRes = calculateQuote(null);
      expect(nullRes).toEqual({ materialCost: 0, processingFee: 0, miscFee: 0, totalPrice: 0 });

      // @ts-expect-error 测试未传参
      const undefRes = calculateQuote(undefined);
      expect(undefRes).toEqual({ materialCost: 0, processingFee: 0, miscFee: 0, totalPrice: 0 });

      // @ts-expect-error 测试空对象
      const emptyRes = calculateQuote({});
      expect(emptyRes).toEqual({ materialCost: 0, processingFee: 0, miscFee: 0, totalPrice: 0 });
    });

    it('应当正确处理前端输入框传入的字符串数值与带空格字符串', () => {
      const stringInput = {
        totalInputAreaSqm: ' 4.5 ' as any,
        pricePerSqm: '80.00' as any,
        processingFee: '120.5' as any,
        miscFee: ' 30.25 ' as any,
      };

      const res = calculateQuote(stringInput);
      // 4.5 * 80 = 360
      expect(res.materialCost).toBe(360.0);
      expect(res.processingFee).toBe(120.5);
      expect(res.miscFee).toBe(30.25);
      expect(res.totalPrice).toBe(510.75);
    });

    it('应当对非法非数字字符串和 NaN 回退为 0', () => {
      const invalidInput = {
        totalInputAreaSqm: 'abc' as any,
        pricePerSqm: NaN,
        processingFee: '￥50' as any,
        miscFee: undefined as any,
      };

      const res = calculateQuote(invalidInput);
      expect(res.materialCost).toBe(0);
      expect(res.processingFee).toBe(0);
      expect(res.miscFee).toBe(0);
      expect(res.totalPrice).toBe(0);
    });

    it('应当正确处理负值费用（如优惠或折让抵扣）', () => {
      const discountInput: QuoteCalculationInput = {
        totalInputAreaSqm: 2,
        pricePerSqm: 100, // material = 200
        processingFee: 50,
        miscFee: -30, // 优惠 30 元
      };

      const res = calculateQuote(discountInput);
      expect(res.materialCost).toBe(200);
      expect(res.processingFee).toBe(50);
      expect(res.miscFee).toBe(-30);
      expect(res.totalPrice).toBe(220);
    });
  });

  describe('2. Floating Point Precision & Exact Cent Accounting', () => {
    it('经典二进制浮点误差案例 (0.1 + 0.2) 必须保持两位小数精确', () => {
      const res = calculateQuote({
        totalInputAreaSqm: 0.1,
        pricePerSqm: 0.2,
        processingFee: 0.1,
        miscFee: 0.2,
      });

      // 0.1 * 0.2 = 0.02
      expect(res.materialCost).toBe(0.02);
      expect(res.processingFee).toBe(0.1);
      expect(res.miscFee).toBe(0.2);
      expect(res.totalPrice).toBe(0.32);
    });

    it('微小金额舍入边界测试（低于半分不计，达到半分进位）', () => {
      // 0.0049 * 1 = 0.0049 -> 0
      const subHalf = calculateQuote({ totalInputAreaSqm: 0.0049, pricePerSqm: 1, processingFee: 0, miscFee: 0 });
      expect(subHalf.materialCost).toBe(0);

      // 0.0051 * 1 = 0.0051 -> 0.01
      const aboveHalf = calculateQuote({ totalInputAreaSqm: 0.0051, pricePerSqm: 1, processingFee: 0, miscFee: 0 });
      expect(aboveHalf.materialCost).toBe(0.01);
    });

    it('5,000 次随机数值压力验证：单项金额四舍五入后之和必须精确恒等于总价（分级对账一致性）', () => {
      for (let i = 0; i < 5000; i++) {
        const area = Math.random() * 500;
        const price = Math.random() * 200;
        const proc = Math.random() * 1000;
        const misc = Math.random() * 200;

        const res = calculateQuote({
          totalInputAreaSqm: area,
          pricePerSqm: price,
          processingFee: proc,
          miscFee: misc,
        });

        // 验证每项均在分（0.01）级别精准
        const matCent = Math.round(res.materialCost * 100);
        const procCent = Math.round(res.processingFee * 100);
        const miscCent = Math.round(res.miscFee * 100);
        const totalCent = Math.round(res.totalPrice * 100);

        expect(totalCent).toBe(matCent + procCent + miscCent);
      }
    });
  });

  describe('3. Industrial Scale & Extreme Large Order Stress', () => {
    it('应当在超大规模板材与千万元级订单下保持高精度与安全整数', () => {
      // 100,000 平方米板材，单价 850.75 元/平米，加工费 500,000 元，杂费 25,000 元
      const largeOrder: QuoteCalculationInput = {
        totalInputAreaSqm: 100000,
        pricePerSqm: 850.75,
        processingFee: 500000,
        miscFee: 25000,
      };

      const res = calculateQuote(largeOrder);
      // 100,000 * 850.75 = 85,075,000
      expect(res.materialCost).toBe(85075000);
      expect(res.processingFee).toBe(500000);
      expect(res.miscFee).toBe(25000);
      expect(res.totalPrice).toBe(85600000);
      expect(Number.isSafeInteger(res.totalPrice)).toBe(true);
    });

    it('极小非零面积（如 0.0001 平米模型小零件）计算正常', () => {
      const tinyPart: QuoteCalculationInput = {
        totalInputAreaSqm: 0.0001,
        pricePerSqm: 50, // 0.0001 * 50 = 0.005 -> 0.01 元
        processingFee: 5.0,
        miscFee: 1.0,
      };

      const res = calculateQuote(tinyPart);
      expect(res.materialCost).toBe(0.01);
      expect(res.totalPrice).toBe(6.01);
    });
  });

  describe('4. Guillotine Cutting & 24 Deterministic Strategies Non-Regression Oracle', () => {
    it('24 种排料组合策略定义必须保持不变', () => {
      const strategies = build24Strategies();
      expect(strategies).toHaveLength(24);
      expect(strategies.filter(s => s.isBaseline)).toHaveLength(1);
    });

    it('带有 factoryId 租户字段的板料输入必须与无 factoryId 的输入产生 100% 相同排料解', () => {
      const baseStock: Stock = {
        id: 's_std_1',
        code: 'ST-01',
        group: { material: '木板', thicknessMm: 3, color: '原木' },
        width: 24400,
        height: 12200,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      const tenantStock: Stock = {
        ...baseStock,
        factoryId: 'factory_corp_9999',
        ownerId: 'wx_user_boss_1',
      };

      const partGroups: PartGroup[] = [
        {
          id: 'pg_1',
          name: '桌面板',
          targetWidth: 10000,
          targetHeight: 6000,
          quantity: 2,
          allowRotation: true,
        },
        {
          id: 'pg_2',
          name: '抽屉前板',
          targetWidth: 4000,
          targetHeight: 2500,
          quantity: 3,
          allowRotation: false,
        },
      ];

      const optBase: SolverOptions = {
        stocks: [baseStock],
        partGroups,
        kerfMm: 2.0,
      };

      const optTenant: SolverOptions = {
        stocks: [tenantStock],
        partGroups,
        kerfMm: 2.0,
      };

      const resBase = solveCuttingPlan(optBase);
      const resTenant = solveCuttingPlan(optTenant);

      expect(resBase.candidates.length).toBe(resTenant.candidates.length);
      expect(resBase.bestCompleteCandidate?.strategyName).toBe(resTenant.bestCompleteCandidate?.strategyName);
      expect(resBase.bestCompleteCandidate?.metrics).toEqual(resTenant.bestCompleteCandidate?.metrics);
      expect(resBase.bestCompleteCandidate?.placedParts).toEqual(resTenant.bestCompleteCandidate?.placedParts);
      expect(resBase.bestCompleteCandidate?.usedStocks[0].steps).toEqual(resTenant.bestCompleteCandidate?.usedStocks[0].steps);
    });

    it('复杂多余料与瑕疵排料场景下，factoryId 不破坏余料优先与面积守恒律', () => {
      const stocksWithTenant: Stock[] = [
        {
          id: 's_offcut_1',
          code: 'OFF-01',
          factoryId: 'fac_multi_01',
          group: { material: '椴木板', thicknessMm: 3, color: '原木' },
          width: 8000,
          height: 6000,
          isOffcut: true,
          status: 'AVAILABLE',
          version: 1,
        },
        {
          id: 's_full_1',
          code: 'FULL-01',
          factoryId: 'fac_multi_01',
          group: { material: '椴木板', thicknessMm: 3, color: '原木' },
          width: 24400,
          height: 12200,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
          defects: [{ x: 2000, y: 2000, width: 1000, height: 1000 }],
        },
      ];

      const parts: PartGroup[] = [
        {
          id: 'p_small',
          name: '小木盒面板',
          targetWidth: 2000,
          targetHeight: 1500,
          quantity: 4,
          allowRotation: true,
        },
      ];

      const plan = solveCuttingPlan({ stocks: stocksWithTenant, partGroups: parts, kerfMm: 1.0 });

      expect(plan.bestCompleteCandidate).toBeDefined();
      // 余料应当被优先使用
      expect(plan.bestCompleteCandidate!.metrics.offcutsUsed).toBe(1);
      expect(plan.bestCompleteCandidate!.metrics.newSheetsUsed).toBe(0);

      // 面积守恒验证
      const usedStock = plan.bestCompleteCandidate!.usedStocks[0];
      const stockArea = usedStock.width * usedStock.height;
      const partsArea = usedStock.placedParts.reduce((sum, p) => sum + p.width * p.height, 0);
      const remainingOffcutArea = usedStock.remainingOffcuts.reduce((sum, r) => sum + r.width * r.height, 0);
      // partsArea + offcutArea + kerfArea 必须 <= stockArea
      expect(partsArea + remainingOffcutArea).toBeLessThanOrEqual(stockArea);
    });
  });
});
