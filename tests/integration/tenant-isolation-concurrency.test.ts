import { describe, it, expect, beforeEach } from 'vitest';
import {
  callCloudFunction,
  setSimulatedOpenId,
  getSimulatedOpenId,
  resetMockDatabase,
  mockDatabase
} from '../../miniprogram/utils/cloud-adapter.ts';

describe('Milestone 1 Empirical Challenge: Tenant Isolation & Concurrency', () => {

  beforeEach(() => {
    resetMockDatabase();
  });

  // =========================================================================
  // SUITE 1: Invite Code Generation, Format & Collision Analysis
  // =========================================================================
  describe('Suite 1: Invite Code Uniqueness & Format', () => {
    it('1.1 should generate 6-character alphanumeric invite codes conforming to charset', async () => {
      setSimulatedOpenId('boss_test_01');
      const res = await callCloudFunction('createFactory', { name: 'Test Factory 1' });
      expect(res.result.code).toBe(200);
      const inviteCode = res.result.data.factory.inviteCode;

      // Must be exactly 6 characters
      expect(inviteCode).toBeDefined();
      expect(inviteCode.length).toBe(6);
      
      // Charset check: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (excludes I, O, 0, 1 for visual clarity)
      expect(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(inviteCode)).toBe(true);
    });

    it('1.2 should evaluate invite code collision rate across 50,000 samples', () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const sampleSize = 50000;
      const seen = new Set<string>();
      let collisions = 0;

      for (let i = 0; i < sampleSize; i++) {
        let code = '';
        for (let j = 0; j < 6; j++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (seen.has(code)) {
          collisions++;
        } else {
          seen.add(code);
        }
      }

      // 32^6 = 1,073,741,824 combinations
      // Theoretical collisions for 50,000: ~ 50000^2 / (2 * 32^6) = 2.5 * 10^9 / 2.147 * 10^9 ≈ 1.16
      // In 50,000 random samples, collisions should be very few (< 15)
      expect(collisions).toBeLessThan(15);
      expect(seen.size).toBeGreaterThanOrEqual(sampleSize - 15);
    });

    it('1.3 should handle case-insensitivity when workers join using lowercase invite code', async () => {
      setSimulatedOpenId('boss_alpha');
      const createRes = await callCloudFunction('createFactory', { name: 'Alpha Factory' });
      const inviteCode = createRes.result.data.factory.inviteCode;

      // Worker joins using lowercase
      setSimulatedOpenId('worker_alpha_1');
      const joinRes = await callCloudFunction('joinFactory', { inviteCode: inviteCode.toLowerCase() });
      expect(joinRes.result.code).toBe(200);
      expect(joinRes.result.data.success).toBe(true);
      expect(joinRes.result.data.factory.name).toBe('Alpha Factory');
    });

    it('1.4 should reject non-existent invite codes', async () => {
      setSimulatedOpenId('worker_rogue');
      const joinRes = await callCloudFunction('joinFactory', { inviteCode: 'ZZZZZZ' });
      expect(joinRes.result.code).toBe(404);
      expect(joinRes.result.data?.success).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 2: Multi-Tenant Data Isolation & Cross-Tenant Leakage Prevention
  // =========================================================================
  describe('Suite 2: Multi-Tenant Isolation & Security Boundaries', () => {
    let factoryAId: string;
    let inviteCodeA: string;
    let factoryBId: string;
    let inviteCodeB: string;

    beforeEach(async () => {
      // 1. Boss A creates Factory Alpha
      setSimulatedOpenId('boss_a');
      const resA = await callCloudFunction('createFactory', { name: 'Alpha Wood' });
      factoryAId = resA.result.data.factory.id;
      inviteCodeA = resA.result.data.factory.inviteCode;

      // 2. Worker A joins Factory Alpha
      setSimulatedOpenId('worker_a');
      await callCloudFunction('joinFactory', { inviteCode: inviteCodeA });

      // 3. Boss B creates Factory Beta
      setSimulatedOpenId('boss_b');
      const resB = await callCloudFunction('createFactory', { name: 'Beta Metal' });
      factoryBId = resB.result.data.factory.id;
      inviteCodeB = resB.result.data.factory.inviteCode;

      // 4. Worker B joins Factory Beta
      setSimulatedOpenId('worker_b');
      await callCloudFunction('joinFactory', { inviteCode: inviteCodeB });
    });

    it('2.1 should strictly isolate stocks between Factory Alpha and Factory Beta', async () => {
      // Boss A adds 2 stocks to Factory Alpha
      setSimulatedOpenId('boss_a');
      const stockA1 = await callCloudFunction('addStock', {
        code: 'S-A1',
        width: 12000,
        height: 24000
      });
      const stockA2 = await callCloudFunction('addStock', {
        code: 'S-A2',
        width: 10000,
        height: 20000
      });

      // Boss B adds 1 stock to Factory Beta
      setSimulatedOpenId('boss_b');
      const stockB1 = await callCloudFunction('addStock', {
        code: 'S-B1',
        width: 15000,
        height: 30000
      });

      // Worker A queries factory stocks: MUST see only S-A1, S-A2
      setSimulatedOpenId('worker_a');
      const workerAStocks = await callCloudFunction('getFactoryStocks');
      expect(workerAStocks.result.code).toBe(200);
      const workerAStockCodes = workerAStocks.result.data.stocks.map((s: any) => s.code);
      expect(workerAStockCodes).toContain('S-A1');
      expect(workerAStockCodes).toContain('S-A2');
      expect(workerAStockCodes).not.toContain('S-B1');

      // Worker B queries factory stocks: MUST see only S-B1
      setSimulatedOpenId('worker_b');
      const workerBStocks = await callCloudFunction('getFactoryStocks');
      expect(workerBStocks.result.code).toBe(200);
      const workerBStockCodes = workerBStocks.result.data.stocks.map((s: any) => s.code);
      expect(workerBStockCodes).toEqual(['S-B1']);
    });

    it('2.2 should prevent IDOR / parameter pollution: client cannot query another tenant by passing factoryId in payload', async () => {
      // Add stock to Beta
      setSimulatedOpenId('boss_b');
      await callCloudFunction('addStock', { code: 'S-B-SECRET', width: 10000, height: 10000 });

      // Worker A attempts to pass { factoryId: factoryBId } in getFactoryStocks payload
      setSimulatedOpenId('worker_a');
      const breachAttempt = await callCloudFunction('getFactoryStocks', { factoryId: factoryBId } as any);
      const returnedCodes = breachAttempt.result.data.stocks.map((s: any) => s.code);
      
      // Must NOT leak S-B-SECRET
      expect(returnedCodes).not.toContain('S-B-SECRET');
    });

    it('2.3 should reject cross-tenant stock deduction (Worker A cannot deduct Factory Beta stock)', async () => {
      // Boss B adds stock
      setSimulatedOpenId('boss_b');
      const stockB = await callCloudFunction('addStock', { code: 'S-B-TARGET', width: 10000, height: 10000 });
      const stockBId = stockB.result.data.stockId;

      // Worker A tries to deduct stock from Factory B
      setSimulatedOpenId('worker_a');
      const deductRes = await callCloudFunction('deductStock', {
        stockId: stockBId,
        usedLength: 5000,
        usedWidth: 5000
      });

      // Must be forbidden (403)
      expect(deductRes.result.code).toBe(403);

      // Verify stock in Factory B remains AVAILABLE
      setSimulatedOpenId('boss_b');
      const checkStocks = await callCloudFunction('getFactoryStocks');
      const target = checkStocks.result.data.stocks.find((s: any) => s.id === stockBId || s._id === stockBId);
      expect(target.status).toBe('AVAILABLE');
    });

    it('2.4 should enforce RBAC: inviteCode is hidden from WORKER in getFactory', async () => {
      // Boss A checks factory info
      setSimulatedOpenId('boss_a');
      const bossFac = await callCloudFunction('getFactory');
      expect(bossFac.result.data.inFactory).toBe(true);
      expect(bossFac.result.data.factory.role).toBe('BOSS');
      expect(bossFac.result.data.factory.inviteCode).toBe(inviteCodeA);

      // Worker A checks factory info
      setSimulatedOpenId('worker_a');
      const workerFac = await callCloudFunction('getFactory');
      expect(workerFac.result.data.inFactory).toBe(true);
      expect(workerFac.result.data.factory.role).toBe('WORKER');
      // inviteCode MUST NOT be leaked to WORKER
      expect(workerFac.result.data.factory.inviteCode).toBeUndefined();
    });

    it('2.5 should isolate ERP quotes between tenants', async () => {
      // Worker A saves quote in Factory A
      setSimulatedOpenId('worker_a');
      await callCloudFunction('saveQuote', {
        projectName: 'Alpha Cabinets',
        materialCost: 450,
        totalPrice: 600
      });

      // Worker B saves quote in Factory B
      setSimulatedOpenId('worker_b');
      await callCloudFunction('saveQuote', {
        projectName: 'Beta Rails',
        materialCost: 800,
        totalPrice: 1100
      });

      // Worker A queries quotes: MUST NOT see Beta's quote
      setSimulatedOpenId('worker_a');
      const quotesA = await callCloudFunction('getQuotes');
      const projectNamesA = quotesA.result.data.quotes.map((q: any) => q.projectName);
      expect(projectNamesA).toContain('Alpha Cabinets');
      expect(projectNamesA).not.toContain('Beta Rails');

      // Worker B queries quotes: MUST NOT see Alpha's quote
      setSimulatedOpenId('worker_b');
      const quotesB = await callCloudFunction('getQuotes');
      const projectNamesB = quotesB.result.data.quotes.map((q: any) => q.projectName);
      expect(projectNamesB).toContain('Beta Rails');
      expect(projectNamesB).not.toContain('Alpha Cabinets');
    });

    it('2.6 should prevent clearUserData by Boss A from affecting Factory Beta', async () => {
      // Populate stocks in both factories
      setSimulatedOpenId('boss_a');
      await callCloudFunction('addStock', { code: 'A-STK', width: 1000, height: 1000 });
      setSimulatedOpenId('boss_b');
      await callCloudFunction('addStock', { code: 'B-STK', width: 2000, height: 2000 });

      // Boss A clears Factory A data
      setSimulatedOpenId('boss_a');
      await callCloudFunction('clearUserData');

      // Factory A stocks should be gone
      const stocksA = await callCloudFunction('getFactoryStocks');
      expect(stocksA.result.data.stocks.length).toBe(0);

      // Factory B stocks MUST remain intact
      setSimulatedOpenId('boss_b');
      const stocksB = await callCloudFunction('getFactoryStocks');
      expect(stocksB.result.data.stocks.length).toBe(1);
      expect(stocksB.result.data.stocks[0].code).toBe('B-STK');
    });
  });

  // =========================================================================
  // SUITE 3: Stock Concurrency & Race Condition Stress Testing
  // =========================================================================
  describe('Suite 3: Deduct Stock Concurrency & Race Conditions', () => {
    it('3.1 should allow single deduction and reject double-deduction on same stock', async () => {
      setSimulatedOpenId('boss_conc');
      await callCloudFunction('createFactory', { name: 'Conc Factory' });
      const stockRes = await callCloudFunction('addStock', { code: 'S-CONC-1', width: 20000, height: 10000 });
      const stockId = stockRes.result.data.stockId;

      // First deduction: SUCCESS
      const deduct1 = await callCloudFunction('deductStock', {
        stockId,
        usedLength: 10000,
        usedWidth: 5000
      });
      expect(deduct1.result.code).toBe(200);
      expect(deduct1.result.data.success).toBe(true);
      expect(deduct1.result.data.stock.status).toBe('CONSUMED');
      expect(deduct1.result.data.stock.version).toBe(2);

      // Second deduction on same stock: MUST FAIL
      const deduct2 = await callCloudFunction('deductStock', {
        stockId,
        usedLength: 5000,
        usedWidth: 5000
      });
      expect(deduct2.result.code).not.toBe(200);
    });

    it('3.2 should handle 10 concurrent deduction requests on the same stock: EXACTLY ONE succeeds', async () => {
      setSimulatedOpenId('boss_race');
      await callCloudFunction('createFactory', { name: 'Race Factory' });
      const stockRes = await callCloudFunction('addStock', { code: 'S-RACE-TARGET', width: 24400, height: 12200 });
      const stockId = stockRes.result.data.stockId;

      // Spawn 10 simultaneous deduction calls via Promise.all
      const attempts = Array.from({ length: 10 }, (_, idx) =>
        callCloudFunction('deductStock', {
          stockId,
          usedLength: 1000 * (idx + 1),
          usedWidth: 1000
        })
      );

      const results = await Promise.all(attempts);

      // Tally successes vs failures
      const successes = results.filter(r => r.result.code === 200);
      const failures = results.filter(r => r.result.code !== 200);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(9);

      // Verify the stock in DB was consumed exactly once and version incremented to 2
      const checkRes = await callCloudFunction('getFactoryStocks');
      // When consumed, getFactoryStocks default returns all or available?
      const inDb = mockDatabase.stocks.find(s => s._id === stockId);
      expect(inDb.status).toBe('CONSUMED');
      expect(inDb.version).toBe(2);
    });

    it('3.3 should handle rapid interleaved deductions across multiple stocks without cross-contamination', async () => {
      setSimulatedOpenId('boss_multi');
      await callCloudFunction('createFactory', { name: 'Multi Race' });

      // Create 5 distinct stocks
      const stockIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const res = await callCloudFunction('addStock', { code: `S-MULTI-${i}`, width: 10000, height: 10000 });
        stockIds.push(res.result.data.stockId);
      }

      // 5 workers attempt to deduct their corresponding stock simultaneously
      const deductCalls = stockIds.map((id, index) => {
        return callCloudFunction('deductStock', {
          stockId: id,
          usedLength: 5000 + index,
          usedWidth: 5000 + index
        });
      });

      const results = await Promise.all(deductCalls);
      // All 5 distinct stocks must succeed
      for (const res of results) {
        expect(res.result.code).toBe(200);
      }

      // Verify all 5 stocks are now CONSUMED with version 2
      for (const id of stockIds) {
        const stk = mockDatabase.stocks.find(s => s._id === id);
        expect(stk.status).toBe('CONSUMED');
        expect(stk.version).toBe(2);
      }
    });
  });

  // =========================================================================
  // SUITE 4: Adversarial Edge Cases & Vulnerability Probing
  // =========================================================================
  describe('Suite 4: Adversarial Vulnerability Probing', () => {

    it('4.1 PROBE: can an unjoined user deduct another user\'s personal stock in cloud-adapter?', async () => {
      // User X creates personal stock (unjoined)
      setSimulatedOpenId('user_x');
      const addRes = await callCloudFunction('addStock', { code: 'S-PERSONAL-X', width: 5000, height: 5000 });
      const stockXId = addRes.result.data.stockId;

      // User Y (unjoined, different user) attempts to deduct User X's stock
      setSimulatedOpenId('user_y');
      const deductRes = await callCloudFunction('deductStock', { stockId: stockXId });
      
      // Should be 403 Forbidden!
      expect(deductRes.result.code).toBe(403);
    });

    it('4.2 PROBE: can a factory member deduct an unjoined user\'s personal stock?', async () => {
      // User X has personal stock
      setSimulatedOpenId('user_personal');
      const addRes = await callCloudFunction('addStock', { code: 'S-ALONE', width: 5000, height: 5000 });
      const stockId = addRes.result.data.stockId;

      // Boss Z creates Factory Z
      setSimulatedOpenId('boss_z');
      await callCloudFunction('createFactory', { name: 'Factory Z' });

      // Worker Z joins Factory Z
      setSimulatedOpenId('worker_z');
      const joinRes = await callCloudFunction('joinFactory', { inviteCode: mockDatabase.factories[0].inviteCode });

      // Worker Z attempts to deduct User Personal's stock!
      // VULNERABILITY CHECK: If stock.factoryId is undefined, does check pass?
      // In cloud-adapter.ts:
      // if (user && user.factoryId) {
      //   if (stock.factoryId && stock.factoryId !== user.factoryId) { return 403; }
      // }
      // When stock.factoryId is undefined, `stock.factoryId && ...` is FALSE!
      const breachAttempt = await callCloudFunction('deductStock', { stockId });
      
      // An isolated system MUST reject this (403)!
      // Let's record whether cloud-adapter allows this unauthorized deduction:
      const vulnerabilityDetected = breachAttempt.result.code === 200;
      // We expect the system to be secure (code 403), but we assert to document behavior
      if (vulnerabilityDetected) {
        console.warn('[VULNERABILITY CONFIRMED 4.2]: Worker Z successfully deducted User Personal stock because stock.factoryId was undefined!');
      }
      expect(breachAttempt.result.code).toBe(403);
    });

    it('4.3 PROBE: can any caller delete any stock via deleteStock in cloud-adapter?', async () => {
      // Boss A creates factory and stock
      setSimulatedOpenId('boss_owner');
      await callCloudFunction('createFactory', { name: 'Owner Factory' });
      const addRes = await callCloudFunction('addStock', { code: 'S-PRECIOUS', width: 10000, height: 10000 });
      const stockId = addRes.result.data.stockId;

      // Malicious User Hacker (not in factory) calls deleteStock
      setSimulatedOpenId('malicious_hacker');
      const delRes = await callCloudFunction('deleteStock', { stockId });

      // In a secure system, malicious hacker should be rejected (403)
      // In cloud-adapter.ts line 399:
      // mockDatabase.stocks = mockDatabase.stocks.filter(s => (s._id !== payload.stockId && s.id !== payload.stockId));
      // It executes without checking tenant or ownership!
      const vulnerabilityDetected = delRes.result.code === 200 && !mockDatabase.stocks.some(s => s._id === stockId);
      if (vulnerabilityDetected) {
        console.warn('[VULNERABILITY CONFIRMED 4.3]: deleteStock in cloud-adapter.ts deleted stock without checking ownerId or factoryId!');
      }
      expect(delRes.result.code).toBe(403);
    });
  });
});
