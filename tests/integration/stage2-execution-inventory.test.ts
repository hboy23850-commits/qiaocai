import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import Module from 'node:module';

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
    const doc = { ...data, _id };
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

  async remove() {
    const idx = this.col.docs.findIndex(d => d._id === this.id);
    if (idx >= 0) {
      this.col.docs.splice(idx, 1);
      return { stats: { removed: 1 } };
    }
    return { stats: { removed: 0 } };
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

let useTransactions = false;
let beforeTransaction: (() => void) | null = null;

let currentWxContext = {
  OPENID: 'test_student_campus',
  REQUESTID: 'req_002'
};

const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init: () => {},
  getWXContext: () => currentWxContext,
  database: () => {
    const database: any = {
      collection: (name: string) => mockDbInstance.getCollection(name),
      serverDate: () => new Date().toISOString(),
      command: {
        in: (arr: any[]) => ({ $in: arr }),
        inc: (val: number) => ({ $inc: val })
      }
    };
    if (useTransactions) {
      database.runTransaction = async (callback: (transaction: any) => Promise<any>) => {
        beforeTransaction?.();
        return callback({
          collection: database.collection,
          // 模拟某些事务实现：rollback 完成但不主动抛异常。
          rollback: async () => undefined
        });
      };
    }
    return database;
  }
};

const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === 'wx-server-sdk') {
    return mockSdk;
  }
  return originalRequire.apply(this, [id, ...args]);
};

describe('Stage 2: Execution, Inventory Consumption & Offcut Transaction', () => {
  let mainHandler: any;

  beforeEach(() => {
    mockDbInstance.reset();
    useTransactions = false;
    beforeTransaction = null;
    currentWxContext = { OPENID: 'test_student_campus', REQUESTID: 'req_002' };

    const modulePath = path.resolve(__dirname, '../../cloudfunctions/api/index.js');
    delete require.cache[require.resolve(modulePath)];
    const apiModule = require(modulePath);
    mainHandler = apiModule.main;
  });

  it('reports a transaction conflict as failure even when rollback itself resolves', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useTransactions = true;
    const modulePath = path.resolve(__dirname, '../../cloudfunctions/api/index.js');
    delete require.cache[require.resolve(modulePath)];
    mainHandler = require(modulePath).main;
    const stock = {
      _id: 'stock_transaction_race',
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '卡纸', thicknessMm: 1, color: '白色' }
    };
    mockDbInstance.getCollection('stocks').docs.push(stock);
    mockDbInstance.getCollection('plans').docs.push({
      _id: 'plan_transaction_race',
      ownerId: 'test_student_campus',
      status: 'ACCEPTED',
      selectedCandidateId: 'candidate_transaction_race',
      stockVersions: [{ id: stock._id, version: 1 }],
      solverOutput: {
        candidates: [{
          candidateId: 'candidate_transaction_race',
          isComplete: true,
          placedParts: [{ instanceId: 'p1' }],
          usedStocks: [{ stockId: stock._id, remainingOffcuts: [] }]
        }]
      }
    });
    beforeTransaction = () => {
      stock.status = 'CONSUMED';
      stock.version = 2;
    };

    const res = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId: 'plan_transaction_race',
        candidateId: 'candidate_transaction_race',
        idempotencyKey: 'transaction_race_key',
        actualOffcuts: []
      }
    }, {});
    errorSpy.mockRestore();

    expect(res.code).toBe(409);
    expect(res.msg).toContain('材料状态冲突');
    expect(mockDbInstance.getCollection('executions').docs).toHaveLength(0);
  });

  it('rejects execution until the exact candidate has been accepted', async () => {
    mockDbInstance.getCollection('stocks').docs.push({
      _id: 'stock_requires_acceptance',
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '卡纸', thicknessMm: 1, color: '白色' }
    });
    mockDbInstance.getCollection('plans').docs.push({
      _id: 'plan_requires_acceptance',
      ownerId: 'test_student_campus',
      status: 'DRAFT',
      stockVersions: [{ id: 'stock_requires_acceptance', version: 1 }],
      solverOutput: {
        candidates: [{
          candidateId: 'candidate_requires_acceptance',
          isComplete: true,
          placedParts: [{ instanceId: 'p1' }],
          usedStocks: [{ stockId: 'stock_requires_acceptance' }]
        }]
      }
    });

    const res = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId: 'plan_requires_acceptance',
        candidateId: 'candidate_requires_acceptance',
        idempotencyKey: 'acceptance_required_key',
        actualOffcuts: []
      }
    }, {});

    expect(res.code).toBe(409);
    expect(res.msg).toContain('尚未确认');
    const stock = mockDbInstance.getCollection('stocks').docs[0];
    expect(stock.status).toBe('AVAILABLE');
  });

  it('rejects a candidate that references stock missing from the plan snapshot', async () => {
    mockDbInstance.getCollection('stocks').docs.push({
      _id: 'stock_not_in_snapshot',
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '卡纸', thicknessMm: 1, color: '白色' }
    });
    mockDbInstance.getCollection('plans').docs.push({
      _id: 'plan_missing_snapshot',
      ownerId: 'test_student_campus',
      status: 'ACCEPTED',
      selectedCandidateId: 'candidate_missing_snapshot',
      stockVersions: [],
      solverOutput: {
        candidates: [{
          candidateId: 'candidate_missing_snapshot',
          isComplete: true,
          placedParts: [{ instanceId: 'p1' }],
          usedStocks: [{ stockId: 'stock_not_in_snapshot' }]
        }]
      }
    });

    const res = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId: 'plan_missing_snapshot',
        candidateId: 'candidate_missing_snapshot',
        idempotencyKey: 'missing_snapshot_key',
        actualOffcuts: []
      }
    }, {});

    expect(res.code).toBe(409);
    expect(res.msg).toContain('材料快照');
    expect(mockDbInstance.getCollection('executions').docs).toHaveLength(0);
  });

  it('Problem 3: Consumes ONLY used stocks and keeps unused stocks AVAILABLE', async () => {
    // 1. Seed two A4 stock sheets
    const s1 = {
      _id: 'stock_a4_01',
      code: 'A4-01',
      width: 2100,
      height: 2970,
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '白卡纸', thicknessMm: 0.5, color: '白色' }
    };
    const s2 = {
      _id: 'stock_a4_02',
      code: 'A4-02',
      width: 2100,
      height: 2970,
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '白卡纸', thicknessMm: 0.5, color: '白色' }
    };
    mockDbInstance.getCollection('stocks').docs.push(s1, s2);

    // 2. Seed a plan that ONLY used stock_a4_01
    const planId = 'plan_a4_104mm';
    const candidateId = 'cand_104mm';
    mockDbInstance.getCollection('plans').docs.push({
      _id: planId,
      ownerId: 'test_student_campus',
      status: 'ACCEPTED',
      selectedCandidateId: candidateId,
      stockVersions: [
        { id: 'stock_a4_01', version: 1 },
        { id: 'stock_a4_02', version: 1 }
      ],
      solverOutput: {
        candidates: [
          {
            candidateId,
            isComplete: true,
            appliedDeltaMm: 1,
            placedParts: [{ instanceId: 'p1' }, { instanceId: 'p2' }],
            usedStocks: [
              {
                stockId: 'stock_a4_01',
                stockCode: 'A4-01',
                width: 2100,
                height: 2970,
                remainingOffcuts: [{ width: 2100, height: 870 }]
              }
            ]
          }
        ]
      }
    });

    // 3. Commit execution with 1 measured offcut
    const res = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId,
        candidateId,
        idempotencyKey: 'idemp_key_001',
        actualOffcuts: [
          {
            sourceStockId: 'stock_a4_01',
            predictedOffcutIndex: 0,
            predictedWidth: 2100,
            predictedHeight: 870,
            width: 2050, // 205.0 mm (within 210.0 mm bound)
            height: 850   // 85.0 mm (within 87.0 mm bound)
          }
        ]
      }
    }, {});

    expect(res.code).toBe(200);

    // 4. CRITICAL VERIFICATION:
    // stock_a4_01 MUST be CONSUMED
    const stock1 = mockDbInstance.getCollection('stocks').docs.find(d => d._id === 'stock_a4_01');
    expect(stock1.status).toBe('CONSUMED');

    // stock_a4_02 MUST STILL BE AVAILABLE!
    const stock2 = mockDbInstance.getCollection('stocks').docs.find(d => d._id === 'stock_a4_02');
    expect(stock2.status).toBe('AVAILABLE');
    expect(stock2.version).toBe(1);

    // 5. Offcut verification:
    // An offcut record must be created with inherited properties from stock_a4_01
    const offcuts = mockDbInstance.getCollection('stocks').docs.filter(d => d.isOffcut === true);
    expect(offcuts.length).toBe(1);
    expect(offcuts[0].status).toBe('AVAILABLE');
    expect(offcuts[0].width).toBe(2050);
    expect(offcuts[0].height).toBe(850);
    expect(offcuts[0].group.material).toBe('白卡纸');
    expect(offcuts[0].group.thicknessMm).toBe(0.5);
    expect(offcuts[0].group.color).toBe('白色');
  });

  it('Problem 5: Idempotent retry returns original success without duplicate execution', async () => {
    const s1 = {
      _id: 'stock_s1',
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '木板', thicknessMm: 3, color: '原木' }
    };
    mockDbInstance.getCollection('stocks').docs.push(s1);

    const planId = 'plan_idemp_test';
    const candidateId = 'cand_idemp';
    mockDbInstance.getCollection('plans').docs.push({
      _id: planId,
      ownerId: 'test_student_campus',
      status: 'ACCEPTED',
      selectedCandidateId: candidateId,
      stockVersions: [{ id: 'stock_s1', version: 1 }],
      solverOutput: {
        candidates: [
          {
            candidateId,
            isComplete: true,
            placedParts: [{ instanceId: 'p1' }],
            usedStocks: [{ stockId: 'stock_s1' }]
          }
        ]
      }
    });

    const payload = {
      planId,
      candidateId,
      idempotencyKey: 'same_key_123',
      actualOffcuts: []
    };

    // First call: succeeds
    const res1 = await mainHandler({ action: 'commitExecution', payload }, {});
    expect(res1.code).toBe(200);

    // Second call with same key: returns success idempotently
    const res2 = await mainHandler({ action: 'commitExecution', payload }, {});
    expect(res2.code).toBe(200);
    expect(res2.data.planId).toBe(planId);

    // Only 1 execution record in DB
    const execs = mockDbInstance.getCollection('executions').docs.filter(e => e.idempotencyKey === 'same_key_123');
    expect(execs.length).toBe(1);

    // Third call: Same key with different payload -> rejected
    const conflictRes = await mainHandler({
      action: 'commitExecution',
      payload: { ...payload, planId: 'different_plan' }
    }, {});
    expect(conflictRes.code).toBe(409);
    expect(conflictRes.msg).toContain('幂等键冲突');
  });

  it('Problem 6: Rejects measured offcut dimensions exceeding predicted bounds', async () => {
    const s1 = {
      _id: 'stock_bound_check',
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '卡纸', thicknessMm: 1, color: '黑' }
    };
    mockDbInstance.getCollection('stocks').docs.push(s1);

    const planId = 'plan_bound_check';
    const candidateId = 'cand_bound';
    mockDbInstance.getCollection('plans').docs.push({
      _id: planId,
      ownerId: 'test_student_campus',
      status: 'ACCEPTED',
      selectedCandidateId: candidateId,
      stockVersions: [{ id: 'stock_bound_check', version: 1 }],
      solverOutput: {
        candidates: [
          {
            candidateId,
            isComplete: true,
            placedParts: [{ instanceId: 'p1' }],
            usedStocks: [{
              stockId: 'stock_bound_check',
              remainingOffcuts: [{ x: 0, y: 0, width: 1000, height: 500 }]
            }]
          }
        ]
      }
    });

    // Offcut predicted: 100x50 mm (1000x500 in 0.1mm)
    // User claims measured: 150x50 mm (1500x500 in 0.1mm) -> EXCEEDS!
    const res = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId,
        candidateId,
        idempotencyKey: 'key_exceed_001',
        actualOffcuts: [
          {
            sourceStockId: 'stock_bound_check',
            predictedOffcutIndex: 0,
            predictedWidth: 1000,
            predictedHeight: 500,
            width: 1500,
            height: 500
          }
        ]
      }
    }, {});

    expect(res.code).toBe(400);
    expect(res.msg).toContain('超出预测可用区域');
  });

  it('does not trust client-supplied predicted offcut bounds', async () => {
    mockDbInstance.getCollection('stocks').docs.push({
      _id: 'stock_server_bound',
      version: 1,
      status: 'AVAILABLE',
      ownerId: 'test_student_campus',
      group: { material: '卡纸', thicknessMm: 1, color: '白色' }
    });
    mockDbInstance.getCollection('plans').docs.push({
      _id: 'plan_server_bound',
      ownerId: 'test_student_campus',
      status: 'ACCEPTED',
      selectedCandidateId: 'candidate_server_bound',
      stockVersions: [{ id: 'stock_server_bound', version: 1 }],
      solverOutput: {
        candidates: [{
          candidateId: 'candidate_server_bound',
          isComplete: true,
          placedParts: [{ instanceId: 'p1' }],
          usedStocks: [{
            stockId: 'stock_server_bound',
            remainingOffcuts: [{ x: 0, y: 0, width: 1000, height: 500 }]
          }]
        }]
      }
    });

    const res = await mainHandler({
      action: 'commitExecution',
      payload: {
        planId: 'plan_server_bound',
        candidateId: 'candidate_server_bound',
        idempotencyKey: 'server_bound_key',
        actualOffcuts: [{
          sourceStockId: 'stock_server_bound',
          predictedOffcutIndex: 0,
          predictedWidth: 99999,
          predictedHeight: 99999,
          width: 1500,
          height: 500
        }]
      }
    }, {});

    expect(res.code).toBe(400);
    expect(res.msg).toContain('超出预测可用区域');
    expect(mockDbInstance.getCollection('stocks').docs[0].status).toBe('AVAILABLE');
  });
});
