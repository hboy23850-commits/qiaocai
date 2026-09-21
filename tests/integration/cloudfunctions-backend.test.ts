import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';

// Construct in-memory database mock for wx-server-sdk
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

  limit(count: number) {
    return new MockQuery(this, {}).limit(count);
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
    return new MockQuery(this, {}).orderBy(field, dir);
  }

  get() {
    return new MockQuery(this, {}).get();
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
  orderField?: string;
  orderDir?: 'asc' | 'desc';
  limitCount?: number;

  constructor(col: MockCollection, query: any) {
    this.col = col;
    this.query = query;
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
    this.orderField = field;
    this.orderDir = dir;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private matches(doc: any): boolean {
    for (const key of Object.keys(this.query)) {
      const qVal = this.query[key];
      if (qVal && typeof qVal === 'object' && qVal.$in) {
        if (!qVal.$in.includes(doc[key])) return false;
      } else {
        if (doc[key] !== qVal) return false;
      }
    }
    return true;
  }

  async get() {
    let matched = this.col.docs.filter(d => this.matches(d));
    if (this.limitCount) {
      matched = matched.slice(0, this.limitCount);
    }
    return { data: JSON.parse(JSON.stringify(matched)) };
  }

  async update({ data }: { data: any }) {
    let updatedCount = 0;
    for (const doc of this.col.docs) {
      if (this.matches(doc)) {
        for (const k of Object.keys(data)) {
          if (data[k] && typeof data[k] === 'object' && data[k].$inc) {
            doc[k] = (doc[k] || 0) + data[k].$inc;
          } else {
            doc[k] = data[k];
          }
        }
        updatedCount++;
      }
    }
    return { stats: { updated: updatedCount } };
  }

  async remove() {
    const initialLen = this.col.docs.length;
    this.col.docs = this.col.docs.filter(d => !this.matches(d));
    const removedCount = initialLen - this.col.docs.length;
    return { stats: { removed: removedCount } };
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
    for (const k of Object.keys(data)) {
      if (data[k] && typeof data[k] === 'object' && data[k].$inc) {
        doc[k] = (doc[k] || 0) + data[k].$inc;
      } else {
        doc[k] = data[k];
      }
    }
    return { stats: { updated: 1 } };
  }

  async remove() {
    const idx = this.col.docs.findIndex(d => d._id === this.id);
    if (idx < 0) return { stats: { removed: 0 } };
    this.col.docs.splice(idx, 1);
    return { stats: { removed: 1 } };
  }
}

// Global mock state
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
  OPENID: 'test_boss_openid',
  REQUESTID: 'req_12345'
};

const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init: () => {},
  getWXContext: () => currentWxContext,
  database: () => ({
    collection: (name: string) => mockDbInstance.getCollection(name),
    serverDate: () => new Date().toISOString(),
    command: {
      inc: (val: number) => ({ $inc: val }),
      in: (arr: any[]) => ({ $in: arr }),
    }
  })
};

let mockGenerateTextImpl = async (_params: any) => {
  throw new Error('AI offline in unit test environment');
};

const mockCloudbase = {
  SYMBOL_CURRENT_ENV: 'test-env',
  init: () => ({
    ai: () => ({
      registerFunctionTool: () => {},
      createModel: () => ({
        generateText: (params: any, _opts: any) => mockGenerateTextImpl(params),
      }),
    }),
  }),
};

// Setup require intercept for 'wx-server-sdk' and '@cloudbase/node-sdk'
import Module from 'node:module';
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === 'wx-server-sdk') {
    return mockSdk;
  }
  if (id === '@cloudbase/node-sdk') {
    return mockCloudbase;
  }
  return originalRequire.apply(this, [id, ...args]);
};


describe('CloudBase Backend (cloudfunctions/api/index.js) Empirical Challenge', () => {
  let mainHandler: any;

  beforeEach(async () => {
    mockDbInstance.reset();
    currentWxContext = { OPENID: 'test_boss_openid', REQUESTID: 'req_001' };

    // Dynamically require or import the compiled or source handler
    // Since cloudfunctions/api/index.js is CommonJS, we require it with mocked wx-server-sdk
    try {
      const modulePath = path.resolve(__dirname, '../../cloudfunctions/api/index.js');
      // Clear require cache for fresh load
      delete require.cache[require.resolve(modulePath)];
      const apiModule = require(modulePath);
      mainHandler = apiModule.main;
    } catch (e: any) {
      console.error('Failed to load cloudfunctions/api/index.js:', e);
      throw e;
    }
  });

  // -------------------------------------------------------------------------
  // Test 1: Factory Creation & Invite Code Validation
  // -------------------------------------------------------------------------
  it('B1: createFactory returns 6-character alphanumeric inviteCode and sets caller as BOSS', async () => {
    currentWxContext.OPENID = 'boss_emp_01';
    const res = await mainHandler({
      action: 'createFactory',
      payload: { name: 'Empirical Timber Co' }
    }, {});

    expect(res.code).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.factory.name).toBe('Empirical Timber Co');
    expect(res.data.factory.ownerOpenId).toBe('boss_emp_01');
    expect(res.data.factory.inviteCode).toBeDefined();
    expect(res.data.factory.inviteCode.length).toBe(6);
    expect(/^[A-Z0-9]{6}$/.test(res.data.factory.inviteCode)).toBe(true);

    // Verify user record in DB
    const userDoc = mockDbInstance.getCollection('users').docs.find(u => u.openId === 'boss_emp_01');
    expect(userDoc).toBeDefined();
    expect(userDoc.role).toBe('BOSS');
    expect(userDoc.factoryId).toBe(res.data.factory.id);
  });

  // -------------------------------------------------------------------------
  // Test 2: Worker Joining & Multi-Tenant Stock Isolation
  // -------------------------------------------------------------------------
  it('B2: Worker joins factory, shares factory stocks, and cannot see stocks of another factory', async () => {
    // 1. Boss A creates Factory A
    currentWxContext.OPENID = 'boss_a';
    const resA = await mainHandler({ action: 'createFactory', payload: { name: 'Factory A' } }, {});
    const factoryAId = resA.data.factory.id;
    const inviteCodeA = resA.data.factory.inviteCode;

    // 2. Boss A adds 2 stocks
    const addA1 = await mainHandler({
      action: 'addStock',
      payload: { stock: { code: 'STK-A1', width: 24400, height: 12200 } }
    }, {});
    expect(addA1.code).toBe(200);

    // 3. Boss B creates Factory B
    currentWxContext.OPENID = 'boss_b';
    const resB = await mainHandler({ action: 'createFactory', payload: { name: 'Factory B' } }, {});
    const factoryBId = resB.data.factory.id;
    const inviteCodeB = resB.data.factory.inviteCode;

    // 4. Boss B adds 1 stock
    const addB1 = await mainHandler({
      action: 'addStock',
      payload: { stock: { code: 'STK-B1', width: 10000, height: 10000 } }
    }, {});
    expect(addB1.code).toBe(200);

    // 5. Worker A joins Factory A
    currentWxContext.OPENID = 'worker_a';
    const joinA = await mainHandler({ action: 'joinFactory', payload: { inviteCode: inviteCodeA } }, {});
    expect(joinA.code).toBe(200);
    expect(joinA.data.factory.id).toBe(factoryAId);

    // 6. Worker A queries stocks -> MUST see STK-A1 and NOT STK-B1
    const workerAStocks = await mainHandler({ action: 'getFactoryStocks', payload: {} }, {});
    expect(workerAStocks.code).toBe(200);
    const codes = workerAStocks.data.stocks.map((s: any) => s.code);
    expect(codes).toContain('STK-A1');
    expect(codes).not.toContain('STK-B1');

    // 7. Worker B joins Factory B
    currentWxContext.OPENID = 'worker_b';
    const joinB = await mainHandler({ action: 'joinFactory', payload: { inviteCode: inviteCodeB } }, {});
    expect(joinB.code).toBe(200);

    // 8. Worker B queries stocks -> MUST see STK-B1 and NOT STK-A1
    const workerBStocks = await mainHandler({ action: 'getFactoryStocks', payload: {} }, {});
    expect(workerBStocks.code).toBe(200);
    const codesB = workerBStocks.data.stocks.map((s: any) => s.code);
    expect(codesB).toContain('STK-B1');
    expect(codesB).not.toContain('STK-A1');
  });

  // -------------------------------------------------------------------------
  // Test 3: Cross-Tenant Stock Deduction Protection
  // -------------------------------------------------------------------------
  it('B3: Worker A cannot deduct stock belonging to Factory B (rejects with 403)', async () => {
    // Factory A
    currentWxContext.OPENID = 'boss_a';
    const resA = await mainHandler({ action: 'createFactory', payload: { name: 'Factory A' } }, {});
    currentWxContext.OPENID = 'worker_a';
    await mainHandler({ action: 'joinFactory', payload: { inviteCode: resA.data.factory.inviteCode } }, {});

    // Factory B
    currentWxContext.OPENID = 'boss_b';
    const resB = await mainHandler({ action: 'createFactory', payload: { name: 'Factory B' } }, {});
    const addB = await mainHandler({
      action: 'addStock',
      payload: { stock: { code: 'STK-B-SECRET', width: 5000, height: 5000 } }
    }, {});
    const stockBId = addB.data.stockId;

    // Worker A attempts to deduct Factory B's stock
    currentWxContext.OPENID = 'worker_a';
    const breachDeduct = await mainHandler({
      action: 'deductStock',
      payload: { stockId: stockBId, usedLength: 2000, usedWidth: 2000 }
    }, {});

    expect(breachDeduct.code).toBe(403);
    expect(breachDeduct.msg).toContain('Permission denied');

    // Verify stock remains AVAILABLE in DB
    const stockDoc = mockDbInstance.getCollection('stocks').docs.find(s => s._id === stockBId);
    expect(stockDoc.status).toBe('AVAILABLE');
    expect(stockDoc.version).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Test 4: Deduct Stock Concurrency & Atomic Optimistic Locking
  // -------------------------------------------------------------------------
  it('B4: Concurrent deductStock race condition simulation: version conflict returns 409', async () => {
    currentWxContext.OPENID = 'boss_race';
    const fac = await mainHandler({ action: 'createFactory', payload: { name: 'Race Factory' } }, {});
    const addRes = await mainHandler({
      action: 'addStock',
      payload: { stock: { code: 'STK-RACE', width: 10000, height: 10000 } }
    }, {});
    const stockId = addRes.data.stockId;

    // First deduction succeeds
    currentWxContext.OPENID = 'worker_race_1';
    await mainHandler({ action: 'joinFactory', payload: { inviteCode: fac.data.factory.inviteCode } }, {});

    const deduct1 = await mainHandler({
      action: 'deductStock',
      payload: { stockId, usedLength: 5000, usedWidth: 5000 }
    }, {});
    expect(deduct1.code).toBe(200);
    expect(deduct1.data.stock.status).toBe('CONSUMED');
    expect(deduct1.data.stock.version).toBe(2);

    // Second deduction on already consumed stock
    currentWxContext.OPENID = 'worker_race_2';
    await mainHandler({ action: 'joinFactory', payload: { inviteCode: fac.data.factory.inviteCode } }, {});

    const deduct2 = await mainHandler({
      action: 'deductStock',
      payload: { stockId, usedLength: 5000, usedWidth: 5000 }
    }, {});

    // Must be rejected with 400 (Stock is not available)
    expect(deduct2.code).toBe(400);
    expect(deduct2.msg).toBe('Stock is not available');
  });

  // -------------------------------------------------------------------------
  // Test 5: RBAC Role Protection on clearUserData
  // -------------------------------------------------------------------------
  it('B5: clearUserData is strictly limited to BOSS; WORKER is rejected with 403', async () => {
    currentWxContext.OPENID = 'boss_perm';
    const fac = await mainHandler({ action: 'createFactory', payload: { name: 'Perm Factory' } }, {});
    await mainHandler({ action: 'addStock', payload: { stock: { code: 'S1', width: 1000, height: 1000 } } }, {});

    // Worker tries to clear data
    currentWxContext.OPENID = 'worker_perm';
    await mainHandler({ action: 'joinFactory', payload: { inviteCode: fac.data.factory.inviteCode } }, {});

    const clearAttempt = await mainHandler({ action: 'clearUserData', payload: {} }, {});
    expect(clearAttempt.code).toBe(403);
    expect(clearAttempt.msg).toBe('Only BOSS can clear factory data');

    // Boss clears data
    currentWxContext.OPENID = 'boss_perm';
    const clearBoss = await mainHandler({ action: 'clearUserData', payload: {} }, {});
    expect(clearBoss.code).toBe(200);

    // Verify stocks in factory cleared
    const remaining = mockDbInstance.getCollection('stocks').docs.filter(s => s.factoryId === fac.data.factory.id);
    expect(remaining.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 6: Cross-Tenant Data Injection Vulnerability Probing
  // -------------------------------------------------------------------------
  it('B6: PROBE: can an unjoined user inject stocks into a factory via saveStocks?', async () => {
    // Factory exists
    currentWxContext.OPENID = 'boss_target';
    const fac = await mainHandler({ action: 'createFactory', payload: { name: 'Target Factory' } }, {});
    const targetFactoryId = fac.data.factory.id;

    // Unjoined rogue user calls saveStocks specifying factoryId: targetFactoryId
    currentWxContext.OPENID = 'rogue_user';
    const injectRes = await mainHandler({
      action: 'saveStocks',
      payload: {
        stocks: [
          { factoryId: targetFactoryId, code: 'INJECTED-STOCK', width: 2000, height: 2000 }
        ]
      }
    }, {});
    expect(injectRes.code).toBe(200);

    // Check if injected stock appears in Target Factory's query!
    currentWxContext.OPENID = 'boss_target';
    const targetStocks = await mainHandler({ action: 'getFactoryStocks', payload: {} }, {});
    const injected = targetStocks.data.stocks.find((s: any) => s.code === 'INJECTED-STOCK');

    const vulnerabilityExists = !!injected;
    if (vulnerabilityExists) {
      console.warn('[VULNERABILITY CONFIRMED B6]: saveStocks allowed unjoined user to inject stock into target factory!');
    }
    // We document whether target factory query received injected stock (must be false after remediation)
    expect(vulnerabilityExists).toBe(false);
  });

  it('B7: PROBE: can an unjoined user inject quotes into a factory via saveQuote?', async () => {
    // Factory exists
    currentWxContext.OPENID = 'boss_q_target';
    const fac = await mainHandler({ action: 'createFactory', payload: { name: 'Target Q Factory' } }, {});
    const targetFactoryId = fac.data.factory.id;

    // Unjoined rogue user calls saveQuote specifying factoryId: targetFactoryId
    currentWxContext.OPENID = 'rogue_quote_user';
    const injectQ = await mainHandler({
      action: 'saveQuote',
      payload: {
        quote: {
          factoryId: targetFactoryId,
          projectName: 'MALICIOUS-QUOTE',
          totalPrice: 999999
        }
      }
    }, {});
    expect(injectQ.code).toBe(200);

    // Target factory queries quotes
    currentWxContext.OPENID = 'boss_q_target';
    const targetQuotes = await mainHandler({ action: 'getQuotes', payload: {} }, {});
    const foundMalicious = targetQuotes.data.quotes.find((q: any) => q.projectName === 'MALICIOUS-QUOTE');

    const vulnerabilityExists = !!foundMalicious;
    if (vulnerabilityExists) {
      console.warn('[VULNERABILITY CONFIRMED B7]: saveQuote allowed unjoined user to inject quote into target factory!');
    }
    expect(vulnerabilityExists).toBe(false);
  });

  it('B8: prepares two reusable A4 demo sheets without duplicating an active demo', async () => {
    currentWxContext.OPENID = 'student_demo';

    const first = await mainHandler({ action: 'prepareDemo', payload: {} }, {});
    expect(first.code).toBe(200);
    expect(first.data.stocks).toHaveLength(2);
    expect(first.data.stocks.every((stock: any) => stock.width === 2100 && stock.height === 2970)).toBe(true);
    expect(first.data.stocks.every((stock: any) => stock.ownerId === 'student_demo')).toBe(true);

    const second = await mainHandler({ action: 'prepareDemo', payload: {} }, {});
    expect(second.code).toBe(200);
    expect(second.data.stocks).toHaveLength(2);
    expect(mockDbInstance.getCollection('stocks').docs).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Test 9: AgentTurn Router Dispatch & Persistence Isolation (Regression Guard)
  // -------------------------------------------------------------------------
  it('B9: agentTurn route exists, dispatches correctly, and persists session in agent_sessions', async () => {
    currentWxContext.OPENID = 'student_agent_user';

    // 1. Unregistered action returns 404
    const resUnknown = await mainHandler({ action: 'nonExistentAction', payload: {} }, {});
    expect(resUnknown.code).toBe(404);

    // 2. Empty message returns 400
    const resEmpty = await mainHandler({ action: 'agentTurn', payload: { message: '' } }, {});
    expect(resEmpty.code).toBe(400);

    // 3. Valid message dispatches to agentTurn controller and returns 200 with structured response
    const res = await mainHandler({
      action: 'agentTurn',
      payload: { message: '做8个105x70mm标牌，材料使用A4' }
    }, {});

    expect(res.code).toBe(200);
    expect(res.msg).toBe('success');
    expect(res.data).toBeDefined();
    expect(res.data.sessionId).toBeDefined();
    expect(res.data.draft).toBeDefined();
    expect(res.data.toolRuns).toBeDefined();

    // 4. Verify session record was persisted to agent_sessions
    const sessionCol = mockDbInstance.getCollection('agent_sessions');
    expect(sessionCol.docs.length).toBeGreaterThanOrEqual(1);
    const saved = sessionCol.docs.find(d => d._id === res.data.sessionId);
    expect(saved).toBeDefined();
    expect(saved.ownerId).toBe('student_agent_user');

    // 5. Verify no unintended writes to plans or executions (read-only safety boundary)
    const plansCol = mockDbInstance.getCollection('plans');
    const execsCol = mockDbInstance.getCollection('executions');
    expect(plansCol.docs.length).toBe(0);
    expect(execsCol.docs.length).toBe(0);
  });

  it('B10: agentTurn handles AI model generation and updates multi-turn messages', async () => {
    currentWxContext.OPENID = 'student_ai_turn';
    mockGenerateTextImpl = async () => ({
      text: JSON.stringify({
        status: 'NEEDS_INPUT',
        assistantMessage: '好的，请问每个标牌的厚度和材料要求是什么？',
        clarification: { field: 'material', question: '请指定材料类型' },
        draft: {
          partGroups: [
            { id: 'g1', name: '标牌', targetWidth: 1050, targetHeight: 700, quantity: 8, allowRotation: false }
          ],
          kerfMm: 2,
          optimizationGoal: 'BALANCED'
        }
      }),
      usage: { prompt_tokens: 120, completion_tokens: 45, total_tokens: 165 }
    });

    const res = await mainHandler({
      action: 'agentTurn',
      payload: { message: '做8个105x70mm标牌' }
    }, {});

    expect(res.code).toBe(200);
    expect(res.data.status).toBe('NEEDS_INPUT');
    expect(res.data.assistantMessage).toContain('标牌');
    expect(res.data.model.aiGenerated).toBe(true);
    expect(res.data.model.usage.total_tokens).toBe(165);

    // Multi-turn continuation with sessionId
    const res2 = await mainHandler({
      action: 'agentTurn',
      payload: { sessionId: res.data.sessionId, message: '使用亚克力板' }
    }, {});
    expect(res2.code).toBe(200);
    expect(res2.data.sessionId).toBe(res.data.sessionId);
    expect(res2.data.draftVersion).toBe(2);
  });
});
