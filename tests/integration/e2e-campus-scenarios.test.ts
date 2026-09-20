import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import Module from 'node:module';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import { SolverOptions } from '../../packages/core/src/types/index.js';

interface DocRecord {
  _id: string;
  [key: string]: any;
}

class MockCollection {
  name: string;
  docs: DocRecord[] = [];

  constructor(name: string) {
    this.name = name;
  }

  where(query: any) {
    return new MockQuery(this, query);
  }

  doc(id: string) {
    return new MockDocRef(this, id);
  }

  async add({ data }: { data: any }) {
    const _id = data._id || `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const doc = { ...data, _id, id: _id };
    this.docs.push(doc);
    return { _id };
  }
}

class MockQuery {
  col: MockCollection;
  query: any;

  constructor(col: MockCollection, query: any) {
    this.col = col;
    this.query = query;
  }

  orderBy() {
    return this;
  }

  limit() {
    return this;
  }

  private matches(doc: any): boolean {
    for (const key of Object.keys(this.query)) {
      const qVal = this.query[key];
      if (qVal && typeof qVal === 'object' && qVal.$in) {
        if (!qVal.$in.includes(doc[key])) return false;
      } else if (doc[key] !== qVal) {
        return false;
      }
    }
    return true;
  }

  async get() {
    const matched = this.col.docs.filter(d => this.matches(d));
    return { data: JSON.parse(JSON.stringify(matched)) };
  }

  async update({ data }: { data: any }) {
    let updated = 0;
    for (const doc of this.col.docs) {
      if (this.matches(doc)) {
        Object.assign(doc, data);
        updated++;
      }
    }
    return { stats: { updated } };
  }
}

class MockDocRef {
  col: MockCollection;
  id: string;

  constructor(col: MockCollection, id: string) {
    this.col = col;
    this.id = id;
  }

  async get() {
    const found = this.col.docs.find(d => d._id === this.id);
    if (!found) {
      throw new Error(`Doc ${this.id} not found`);
    }
    return { data: JSON.parse(JSON.stringify(found)) };
  }

  async update({ data }: { data: any }) {
    const doc = this.col.docs.find(d => d._id === this.id);
    if (!doc) return { stats: { updated: 0 } };
    Object.assign(doc, data);
    return { stats: { updated: 1 } };
  }
}

const mockDbInstance = {
  collections: new Map<string, MockCollection>(),
  getCollection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(name));
    }
    return this.collections.get(name)!;
  },
  reset() {
    this.collections.clear();
  }
};

let currentWxContext = {
  OPENID: 'student_maker_001',
  REQUESTID: 'req_scenario'
};

const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init: () => {},
  getWXContext: () => currentWxContext,
  database: () => ({
    collection: (name: string) => mockDbInstance.getCollection(name),
    serverDate: () => new Date().toISOString(),
    command: {
      in: (arr: any[]) => ({ $in: arr }),
      inc: (val: number) => ({ $inc: val })
    }
  })
};

const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === 'wx-server-sdk') {
    return mockSdk;
  }
  return originalRequire.apply(this, [id, ...args]);
};

describe('Stage 4: End-to-End Campus Scenarios & Verification Evidence', () => {
  let mainHandler: any;

  beforeEach(() => {
    mockDbInstance.reset();
    currentWxContext = { OPENID: 'student_maker_001', REQUESTID: 'req_scenario' };

    const modulePath = path.resolve(__dirname, '../../cloudfunctions/api/index.js');
    delete require.cache[require.resolve(modulePath)];
    const apiModule = require(modulePath);
    mainHandler = apiModule.main;
  });

  // --------------------------------------------------------------------------
  // Scenario 1: A4 展签尺寸协商（原尺寸用2张 vs 缩小1mm用1张，且仅扣减1张）
  // --------------------------------------------------------------------------
  it('Scenario 1: A4 Badge Size Negotiation & Single Stock Consumption', async () => {
    // 1. 登记两张 210 × 297 mm 的 A4 卡纸
    const saveRes = await mainHandler({
      action: 'saveStocks',
      payload: {
        stocks: [
          {
            code: 'A4-Sheet-1',
            width: 2100, // 210.0 mm
            height: 2970, // 297.0 mm
            isOffcut: false,
            group: { material: '白卡纸', thicknessMm: 0.3, color: '米白' }
          },
          {
            code: 'A4-Sheet-2',
            width: 2100,
            height: 2970,
            isOffcut: false,
            group: { material: '白卡纸', thicknessMm: 0.3, color: '米白' }
          }
        ]
      }
    }, {});
    expect(saveRes.code).toBe(200);

    const listRes = await mainHandler({ action: 'listStocks', payload: {} }, {});
    const [s1, s2] = listRes.data;
    expect(s1.status).toBe('AVAILABLE');
    expect(s2.status).toBe('AVAILABLE');

    // 2. 需求：8个 105 × 70 mm 展签卡片，禁止旋转，刀缝 2 mm
    // 允许该组宽度最多缩小 2 mm (步长 1 mm)
    const solveRes = await mainHandler({
      action: 'solvePlan',
      payload: {
        partGroups: [
          {
            id: 'g_badges',
            name: '社团展签卡片',
            targetWidth: 1050, // 105.0 mm
            targetHeight: 700,  // 70.0 mm
            quantity: 8,
            allowRotation: false, // 严格禁止旋转
            flexibleRange: { maxShrinkMm: 2, stepMm: 1 }
          }
        ],
        kerfMm: 2,
        stockIds: [s1._id, s2._id]
      }
    }, {});

    expect(solveRes.code).toBe(200);
    const planId = solveRes.data.planId;
    const candidates = solveRes.data.solverOutput.candidates;

    // 3. 方案对比验证：
    // - 原尺寸方案 (appliedDeltaMm = 0): 需要 2 张 A4
    const originalCand = candidates.find((c: any) => c.appliedDeltaMm === 0);
    expect(originalCand).toBeDefined();
    expect(originalCand.isComplete).toBe(true);
    expect(originalCand.usedStocks.length).toBe(2);

    // - 微调方案 (appliedDeltaMm = 1, 宽度微缩至 104.0 mm): 仅需 1 张 A4 即可切下全部 8 个！
    const shrinkCand = candidates.find((c: any) => c.appliedDeltaMm === 1);
    expect(shrinkCand).toBeDefined();
    expect(shrinkCand.isComplete).toBe(true);
    expect(shrinkCand.usedStocks.length).toBe(1);
    expect(shrinkCand.usedStocks[0].stockId).toBe(s1._id);

    // 4. 明确接受微调候选方案 (selectPlan)
    const selectRes = await mainHandler({
      action: 'selectPlan',
      payload: {
        planId,
        candidateId: shrinkCand.candidateId
      }
    }, {});
    expect(selectRes.code).toBe(200);

    // 5. 制作完成并提交实测余料 (commitExecution)
    const commitRes = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId,
        candidateId: shrinkCand.candidateId,
        idempotencyKey: 'idemp_scenario_1',
        actualOffcuts: [
          {
            sourceStockId: s1._id,
            predictedOffcutIndex: 0,
            width: 2000, // 200.0 mm
            height: 80    // 8.0 mm，位于算法实际预测的 210×9 mm 余条内
          }
        ]
      }
    }, {});
    expect(commitRes.code).toBe(200);

    // 6. 核验库存扣减：
    // s1 被消耗 (CONSUMED)
    const updatedS1 = mockDbInstance.getCollection('stocks').docs.find(d => d._id === s1._id);
    expect(updatedS1.status).toBe('CONSUMED');

    // s2 依然可用 (AVAILABLE) —— 绝不误扣未使用的原料！
    const updatedS2 = mockDbInstance.getCollection('stocks').docs.find(d => d._id === s2._id);
    expect(updatedS2.status).toBe('AVAILABLE');

    // 实测余料成功入库，且继承了白卡纸材质属性
    const createdOffcuts = mockDbInstance.getCollection('stocks').docs.filter(d => d.isOffcut === true);
    expect(createdOffcuts.length).toBe(1);
    expect(createdOffcuts[0].status).toBe('AVAILABLE');
    expect(createdOffcuts[0].width).toBe(2000);
    expect(createdOffcuts[0].height).toBe(80);
    expect(createdOffcuts[0].group.material).toBe('白卡纸');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: 锁定模型主面板 与 可微调装饰件
  // --------------------------------------------------------------------------
  it('Scenario 2: Locked Structure Panel & Flexible Decorative Parts', () => {
    const options: SolverOptions = {
      stocks: [
        {
          id: 's_wood_1',
          code: 'WOOD-01',
          width: 3000, // 300 mm
          height: 3000, // 300 mm
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
          group: { material: '椴木层板', thicknessMm: 2.0, color: '原木色' }
        }
      ],
      partGroups: [
        {
          id: 'g_main_panel',
          name: '精准模型底座(锁定)',
          targetWidth: 1500, // 150.0 mm
          targetHeight: 1200, // 120.0 mm
          quantity: 1,
          allowRotation: false
        },
        {
          id: 'g_decor_parts',
          name: '装饰隔条(允许微调)',
          targetWidth: 1000, // 100.0 mm
          targetHeight: 400,  // 40.0 mm
          quantity: 2,
          allowRotation: false,
          flexibleRange: { maxShrinkMm: 2, stepMm: 1 }
        }
      ],
      kerfMm: 2
    };

    const output = solveCuttingPlan(options);
    expect(output.candidates.length).toBeGreaterThan(0);

    // 严格核查：底座主面板在所有候选方案中尺寸保持绝对不变
    for (const cand of output.candidates) {
      const panelDef = cand.targetParts.find(p => p.groupId === 'g_main_panel');
      expect(panelDef?.width).toBe(1500); // 150.0 mm
      expect(panelDef?.height).toBe(1200); // 120.0 mm

      const placedPanel = cand.placedParts.find(p => p.groupId === 'g_main_panel');
      expect(placedPanel?.width).toBe(1500);
      expect(placedPanel?.height).toBe(1200);
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 3: 上次任务留存的实测余料在下次任务中成功复用
  // --------------------------------------------------------------------------
  it('Scenario 3: Reusing Measured Offcut from Previous Task for Next Craft Project', async () => {
    // 假设材料库中有一张之前制作留存的实测余料 (200 × 80 mm 白卡纸)
    mockDbInstance.getCollection('stocks').docs.push({
      _id: 'offcut_stock_prev',
      code: 'OFC-REUSE',
      width: 2000, // 200 mm
      height: 800,  // 80 mm
      isOffcut: true,
      status: 'AVAILABLE',
      version: 1,
      ownerId: 'student_maker_001',
      group: { material: '白卡纸', thicknessMm: 0.3, color: '米白' }
    });

    // 新任务：制作 2 张 60 × 40 mm 的便签书签
    const nextSolve = await mainHandler({
      action: 'solvePlan',
      payload: {
        partGroups: [
          {
            id: 'g_bookmarks',
            name: '手工书签',
            targetWidth: 600, // 60.0 mm
            targetHeight: 400, // 40.0 mm
            quantity: 2,
            allowRotation: false
          }
        ],
        kerfMm: 2,
        stockIds: ['offcut_stock_prev']
      }
    }, {});

    expect(nextSolve.code).toBe(200);
    const candidate = nextSolve.data.solverOutput.candidates[0];
    expect(candidate.isComplete).toBe(true);
    expect(candidate.usedStocks.length).toBe(1);
    expect(candidate.usedStocks[0].stockId).toBe('offcut_stock_prev');
    expect(candidate.placedParts.length).toBe(2);

    // 明确接受该方案后再执行，该余料才可被消耗
    const selectRes = await mainHandler({
      action: 'selectPlan',
      payload: {
        planId: nextSolve.data.planId,
        candidateId: candidate.candidateId
      }
    }, {});
    expect(selectRes.code).toBe(200);

    const commitRes = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId: nextSolve.data.planId,
        candidateId: candidate.candidateId,
        idempotencyKey: 'idemp_reuse_task',
        actualOffcuts: []
      }
    }, {});
    expect(commitRes.code).toBe(200);

    const reusedStock = mockDbInstance.getCollection('stocks').docs.find(d => d._id === 'offcut_stock_prev');
    expect(reusedStock.status).toBe('CONSUMED');
  });
});
