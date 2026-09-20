import { describe, it, expect } from 'vitest';
import { calculateQuote } from '../../packages/core/src/utils/quote.js';
import {
  QuoteCalculationInput,
  QuoteCalculationResult,
  Stock,
  FactoryRole,
  FactoryTenant,
  FactoryMember,
  QuoteRecord,
  QuoteItem
} from '../../packages/core/src/types/index.js';
import { calculateQuote as calculateQuoteFromRoot } from '../../packages/core/src/index.js';

describe('Quote Calculation Engine', () => {
  it('应当正确计算标准输入下的材料费与总价', () => {
    const input: QuoteCalculationInput = {
      totalInputAreaSqm: 2.5,
      pricePerSqm: 60,
      processingFee: 80,
      miscFee: 20,
    };

    const result: QuoteCalculationResult = calculateQuote(input);

    expect(result.materialCost).toBe(150.0);
    expect(result.processingFee).toBe(80.0);
    expect(result.miscFee).toBe(20.0);
    expect(result.totalPrice).toBe(250.0);
  });

  it('应当准确处理浮点数精度舍入并保留两位小数', () => {
    // 5.9536 sqm * 65 元/sqm = 386.984 -> 386.98
    const input: QuoteCalculationInput = {
      totalInputAreaSqm: 5.9536,
      pricePerSqm: 65,
      processingFee: 50,
      miscFee: 15,
    };

    const result = calculateQuote(input);

    expect(result.materialCost).toBe(386.98);
    expect(result.processingFee).toBe(50);
    expect(result.miscFee).toBe(15);
    expect(result.totalPrice).toBe(451.98);
  });

  it('应当处理零费用和零面积等边界情况', () => {
    const zeroInput: QuoteCalculationInput = {
      totalInputAreaSqm: 0,
      pricePerSqm: 45,
      processingFee: 0,
      miscFee: 0,
    };

    const result = calculateQuote(zeroInput);
    expect(result.materialCost).toBe(0);
    expect(result.processingFee).toBe(0);
    expect(result.miscFee).toBe(0);
    expect(result.totalPrice).toBe(0);
  });

  it('应当正确支持纯加工费模式（零材料消耗）', () => {
    const serviceOnly: QuoteCalculationInput = {
      totalInputAreaSqm: 0,
      pricePerSqm: 0,
      processingFee: 120.5,
      miscFee: 30.2,
    };

    const result = calculateQuote(serviceOnly);
    expect(result.materialCost).toBe(0);
    expect(result.processingFee).toBe(120.5);
    expect(result.miscFee).toBe(30.2);
    expect(result.totalPrice).toBe(150.7);
  });

  it('应当正确支持纯材料成本模式（无额外加工费与杂费）', () => {
    const materialOnly: QuoteCalculationInput = {
      totalInputAreaSqm: 3.125,
      pricePerSqm: 88.5,
      processingFee: 0,
      miscFee: 0,
    };

    const result = calculateQuote(materialOnly);
    // 3.125 * 88.5 = 276.5625 -> 276.56
    expect(result.materialCost).toBe(276.56);
    expect(result.processingFee).toBe(0);
    expect(result.miscFee).toBe(0);
    expect(result.totalPrice).toBe(276.56);
  });

  it('应支持从核心包入口导出 calculateQuote 且计算结果一致', () => {
    const res = calculateQuoteFromRoot({
      totalInputAreaSqm: 1,
      pricePerSqm: 100,
      processingFee: 10,
      miscFee: 5,
    });
    expect(res.materialCost).toBe(100);
    expect(res.totalPrice).toBe(115);
  });
});

describe('SaaS Multi-Tenant and ERP Quote Type Contracts', () => {
  it('Stock 接口支持可选的 factoryId 租户隔离字段，并保持向后兼容', () => {
    const legacyStock: Stock = {
      id: 'legacy_001',
      code: 'LEG-100',
      ownerId: 'wx_user_old',
      group: { material: '白卡纸', thicknessMm: 1, color: '白色' },
      width: 1000,
      height: 1000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };
    expect(legacyStock.factoryId).toBeUndefined();

    const tenantStock: Stock = {
      id: 'tenant_001',
      code: 'STD-120401',
      ownerId: 'wx_boss_01',
      factoryId: 'fac_9988',
      group: { material: '椴木板', thicknessMm: 3, color: '原木色' },
      width: 24400,
      height: 12200,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };
    expect(tenantStock.factoryId).toBe('fac_9988');
  });

  it('FactoryRole 严格限定为 BOSS 或 WORKER', () => {
    const bossRole: FactoryRole = 'BOSS';
    const workerRole: FactoryRole = 'WORKER';
    expect(bossRole).toBe('BOSS');
    expect(workerRole).toBe('WORKER');
  });

  it('FactoryTenant 模型完整定义工厂企业元数据', () => {
    const tenant: FactoryTenant = {
      id: 'fac_test_101',
      name: '巧裁演示旗舰厂',
      inviteCode: 'QC8899',
      ownerOpenId: 'wx_openid_boss_1',
      createdAt: 1726750000000,
      memberCount: 5,
    };

    expect(tenant.id).toBe('fac_test_101');
    expect(tenant.name).toBe('巧裁演示旗舰厂');
    expect(tenant.inviteCode).toBe('QC8899');
    expect(tenant.ownerOpenId).toBe('wx_openid_boss_1');
    expect(tenant.memberCount).toBe(5);
  });

  it('FactoryMember 模型完整定义工厂成员与角色归属', () => {
    const member: FactoryMember = {
      id: 'mem_001',
      factoryId: 'fac_test_101',
      openId: 'wx_openid_worker_1',
      role: 'WORKER',
      nickName: '张师傅',
      joinedAt: 1726751000000,
    };

    expect(member.factoryId).toBe('fac_test_101');
    expect(member.openId).toBe('wx_openid_worker_1');
    expect(member.role).toBe('WORKER');
    expect(member.nickName).toBe('张师傅');
  });

  it('QuoteRecord 和 QuoteItem 完整承载商业报价单明细与汇总数据', () => {
    const item1: QuoteItem = {
      name: '桌面板',
      widthMm: 1200,
      heightMm: 600,
      quantity: 2,
      material: '椴木板',
    };
    const item2: QuoteItem = {
      name: '桌腿支撑板',
      widthMm: 700,
      heightMm: 150,
      quantity: 4,
      material: '椴木板',
    };

    const quoteRecord: QuoteRecord = {
      id: 'quote_001',
      quoteNo: 'QT-202609-001',
      factoryId: 'fac_test_101',
      operatorId: 'wx_openid_worker_1',
      creatorRole: 'BOSS',
      customerName: '精艺家具定制',
      projectName: '会议桌制作',
      materialCost: 200,
      processingFee: 100,
      miscFee: 30,
      totalPrice: 330,
      totalInputAreaSqm: 3.5,
      pricePerSqm: 57.14,
      items: [item1, item2],
      createdAt: 1726752000000,
    };

    expect(quoteRecord.quoteNo).toBe('QT-202609-001');
    expect(quoteRecord.items).toHaveLength(2);
    expect(quoteRecord.items?.[0].name).toBe('桌面板');
    expect(quoteRecord.items?.[1].name).toBe('桌腿支撑板');
    expect(quoteRecord.totalPrice).toBe(330);
  });
});
