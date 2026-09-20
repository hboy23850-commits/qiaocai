import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import Module from 'node:module';
import { createA4DemoOptions } from '../../packages/core/src/demo/a4-demo.js';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';

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
  OPENID: 'test_campus_user_01',
  REQUESTID: 'req_001'
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

describe('Problem 4: selectPlan Candidate Acceptance & Server-side Validation', () => {
  let mainHandler: any;

  function seedValidPlan(planId: string) {
    const options = createA4DemoOptions();
    const solverOutput = solveCuttingPlan(options);
    const candidate = solverOutput.bestCompleteCandidate!;
    for (const stock of options.stocks) {
      mockDbInstance.getCollection('stocks').docs.push({
        ...stock,
        _id: stock.id,
        ownerId: 'test_campus_user_01'
      });
    }
    mockDbInstance.getCollection('plans').docs.push({
      _id: planId,
      ownerId: 'test_campus_user_01',
      inputSnapshot: {
        partGroups: options.partGroups,
        kerfMm: options.kerfMm
      },
      stockVersions: options.stocks.map(stock => ({ id: stock.id, version: stock.version })),
      solverOutput
    });
    return candidate;
  }

  beforeEach(() => {
    mockDbInstance.reset();
    currentWxContext = { OPENID: 'test_campus_user_01', REQUESTID: 'req_001' };

    const modulePath = path.resolve(__dirname, '../../cloudfunctions/api/index.js');
    delete require.cache[require.resolve(modulePath)];
    const apiModule = require(modulePath);
    mainHandler = apiModule.main;
  });

  it('selectPlan successfully accepts a complete candidate and updates plan status', async () => {
    const planId = 'plan_test_001';
    const candidateId = seedValidPlan(planId).candidateId;

    // 2. Execute selectPlan
    const res = await mainHandler({
      action: 'selectPlan',
      payload: { planId, candidateId }
    }, {});

    expect(res.code).toBe(200);
    expect(res.data.selectedCandidateId).toBe(candidateId);

    // 3. Verify plan state in DB
    const planDoc = mockDbInstance.getCollection('plans').docs.find(d => d._id === planId);
    expect(planDoc.status).toBe('ACCEPTED');
    expect(planDoc.selectedCandidateId).toBe(candidateId);
    expect(planDoc.selectedCandidate).toBeDefined();
    expect(planDoc.selectedAt).toBeDefined();
  });

  it('selectPlan rejects a candidate whose geometry was tampered with', async () => {
    const planId = 'plan_tampered_geometry';
    const candidate = seedValidPlan(planId);
    candidate.placedParts[0].width += 10;
    candidate.usedStocks[0].placedParts[0].width += 10;

    const res = await mainHandler({
      action: 'selectPlan',
      payload: { planId, candidateId: candidate.candidateId }
    }, {});

    expect(res.code).toBe(400);
    expect(res.msg).toContain('校验失败');
    const planDoc = mockDbInstance.getCollection('plans').docs.find(d => d._id === planId);
    expect(planDoc.status).not.toBe('ACCEPTED');
  });

  it('selectPlan rejects when planId or candidateId is missing', async () => {
    const res = await mainHandler({
      action: 'selectPlan',
      payload: { planId: 'plan_test_001' }
    }, {});
    expect(res.code).toBe(400);
  });

  it('selectPlan rejects selection of an incomplete candidate', async () => {
    const planId = 'plan_incomplete';
    mockDbInstance.getCollection('plans').docs.push({
      _id: planId,
      ownerId: 'test_campus_user_01',
      solverOutput: {
        candidates: [
          {
            candidateId: 'cand_fail',
            isComplete: false
          }
        ]
      }
    });

    const res = await mainHandler({
      action: 'selectPlan',
      payload: { planId, candidateId: 'cand_fail' }
    }, {});
    expect(res.code).toBe(400);
    expect(res.msg).toContain('不可接受未完整放置');
  });

  it('selectPlan rejects cross-user plan access', async () => {
    const planId = 'plan_other_user';
    mockDbInstance.getCollection('plans').docs.push({
      _id: planId,
      ownerId: 'other_student_999',
      solverOutput: {
        candidates: [
          {
            candidateId: 'cand_ok',
            isComplete: true
          }
        ]
      }
    });

    const res = await mainHandler({
      action: 'selectPlan',
      payload: { planId, candidateId: 'cand_ok' }
    }, {});
    expect(res.code).toBe(403);
  });
});
