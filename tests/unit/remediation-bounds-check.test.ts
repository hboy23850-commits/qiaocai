import { describe, it, expect, beforeEach } from 'vitest';
import {
  callCloudFunction,
  setSimulatedOpenId,
  resetMockDatabase,
  mockDatabase
} from '../../miniprogram/utils/cloud-adapter.ts';

describe('Milestone 1 Remediation: DeductStock Bounds & Isolation Unit Tests', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('rejects deductStock with negative usedLength or usedWidth', async () => {
    setSimulatedOpenId('worker_bounds_1');
    const addRes = await callCloudFunction('addStock', { width: 10000, height: 10000 });
    const stockId = addRes.result.data.stockId;

    const negLen = await callCloudFunction('deductStock', { stockId, usedLength: -500, usedWidth: 2000 });
    expect(negLen.result.code).toBe(400);
    expect(negLen.result.msg).toContain('boundaries');

    const negWid = await callCloudFunction('deductStock', { stockId, usedLength: 2000, usedWidth: -100 });
    expect(negWid.result.code).toBe(400);
    expect(negWid.result.msg).toContain('boundaries');
  });

  it('rejects deductStock with zero usedLength or usedWidth', async () => {
    setSimulatedOpenId('worker_bounds_2');
    const addRes = await callCloudFunction('addStock', { width: 10000, height: 10000 });
    const stockId = addRes.result.data.stockId;

    const zeroLen = await callCloudFunction('deductStock', { stockId, usedLength: 0, usedWidth: 2000 });
    expect(zeroLen.result.code).toBe(400);

    const zeroWid = await callCloudFunction('deductStock', { stockId, usedLength: 2000, usedWidth: 0 });
    expect(zeroWid.result.code).toBe(400);
  });

  it('rejects deductStock when usedLength or usedWidth exceeds stock boundaries', async () => {
    setSimulatedOpenId('worker_bounds_3');
    const addRes = await callCloudFunction('addStock', { width: 10000, height: 5000 });
    const stockId = addRes.result.data.stockId;

    const overflowLen = await callCloudFunction('deductStock', { stockId, usedLength: 10001, usedWidth: 4000 });
    expect(overflowLen.result.code).toBe(400);

    const overflowWid = await callCloudFunction('deductStock', { stockId, usedLength: 8000, usedWidth: 5001 });
    expect(overflowWid.result.code).toBe(400);
  });

  it('accepts deductStock with valid dimensions within boundaries', async () => {
    setSimulatedOpenId('worker_bounds_4');
    const addRes = await callCloudFunction('addStock', { width: 10000, height: 5000 });
    const stockId = addRes.result.data.stockId;

    const validDeduct = await callCloudFunction('deductStock', { stockId, usedLength: 8000, usedWidth: 4000 });
    expect(validDeduct.result.code).toBe(200);
    expect(validDeduct.result.data.stock.status).toBe('CONSUMED');
    expect(validDeduct.result.data.stock.usedLength).toBe(8000);
    expect(validDeduct.result.data.stock.usedWidth).toBe(4000);
  });

  it('returns 404 for deleteStock when stockId does not exist', async () => {
    setSimulatedOpenId('worker_del_1');
    const res = await callCloudFunction('deleteStock', { stockId: 'non_existent_stock_id' });
    expect(res.result.code).toBe(404);
  });

  it('strips factoryId on saveStocks and saveQuote when user is unjoined', async () => {
    setSimulatedOpenId('unjoined_user_injection_test');
    // Attempt to inject stock into target_factory
    await callCloudFunction('saveStocks', {
      stocks: [{ code: 'ATTEMPT-INJECT', width: 2000, height: 2000, factoryId: 'target_fac_123' }]
    });
    const injectedStock = mockDatabase.stocks.find(s => s.code === 'ATTEMPT-INJECT');
    expect(injectedStock).toBeDefined();
    expect(injectedStock.factoryId).toBeUndefined();

    // Attempt to inject quote into target_factory
    const quoteRes = await callCloudFunction('saveQuote', {
      projectName: 'MALICIOUS',
      totalPrice: 1000,
      factoryId: 'target_fac_123'
    });
    const injectedQuote = mockDatabase.quotes.find(q => q._id === quoteRes.result.data.quoteId);
    expect(injectedQuote).toBeDefined();
    expect(injectedQuote.factoryId).toBeNull();
  });
});
