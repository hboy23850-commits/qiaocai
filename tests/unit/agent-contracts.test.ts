import { describe, expect, it } from 'vitest';
import {
  buildCutSummary,
  createRuleFallbackDraft,
  enrichDraftStockIds,
  sanitizeAgentDraft,
  solveAndCompare,
  validateAgentTurnRequest,
  validateRequirementDraft,
} from '../../packages/core/src/agent/index.js';
import type { AgentDraft, Stock } from '../../packages/core/src/index.js';

const a4Stocks: Stock[] = [
  {
    id: 'a4-1',
    code: 'A4-1',
    group: { material: '卡纸', thicknessMm: 0.3, color: '白色' },
    width: 2100,
    height: 2970,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
  },
  {
    id: 'a4-2',
    code: 'A4-2',
    group: { material: '卡纸', thicknessMm: 0.3, color: '白色' },
    width: 2100,
    height: 2970,
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
  },
];

describe('AI 制作智能体契约与只读工具', () => {
  it('拒绝空消息和超过 1000 字的输入', () => {
    expect(validateAgentTurnRequest({ message: '' }).valid).toBe(false);
    expect(validateAgentTurnRequest({ message: 'a'.repeat(1001) }).valid).toBe(false);
    expect(validateAgentTurnRequest({ message: '制作 8 张展签' }).valid).toBe(true);
  });

  it('规则降级只提取明确尺寸，不擅自允许旋转或缩小', () => {
    const parsed = createRuleFallbackDraft('制作8张105x70mm展签，间距2mm，不旋转');
    expect(parsed.partGroups).toHaveLength(1);
    expect(parsed.partGroups[0]).toMatchObject({
      targetWidth: 1050,
      targetHeight: 700,
      quantity: 8,
      allowRotation: false,
    });
    expect(parsed.partGroups[0].flexibleRange).toBeUndefined();
    expect(parsed.kerfMm).toBe(2);
  });

  it('只有明确授权时才记录尺寸缩小范围', () => {
    const parsed = createRuleFallbackDraft('8张105x70mm展签，允许宽度最多缩小1mm');
    expect(parsed.partGroups[0].flexibleRange).toEqual({ maxShrinkMm: 1, stepMm: 1 });
  });

  it('规则降级正确处理标点分隔需求并精确锁定尺寸', () => {
    const parsed = createRuleFallbackDraft('做一批展签；做8张，尺寸是105x70mm，用A4卡纸；不旋转，间距2mm，尺寸精确锁定不允许缩小');
    expect(parsed.partGroups).toHaveLength(1);
    expect(parsed.partGroups[0]).toMatchObject({
      targetWidth: 1050,
      targetHeight: 700,
      quantity: 8,
      allowRotation: false,
    });
    expect(parsed.partGroups[0].flexibleRange).toBeUndefined();
    expect(parsed.kerfMm).toBe(2);
  });

  it('校验缺失材料、非法尺寸和数量上限', () => {
    const invalid: AgentDraft = {
      stockIds: [],
      partGroups: [{ id: 'g1', name: '零件', targetWidth: 0, targetHeight: 700, quantity: 21, allowRotation: false }],
      kerfMm: 2,
      optimizationGoal: 'BALANCED',
    };
    const result = validateRequirementDraft(invalid, a4Stocks);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('stockIds');
    expect(result.errors.join(' ')).toContain('尺寸');
    expect(result.errors.join(' ')).toContain('20');
  });

  it('清洗模型草稿时只保留当前用户可访问材料', () => {
    const raw = {
      stockIds: ['a4-1', 'someone-else'],
      partGroups: [{ id: 'g1', name: '展签', targetWidth: 1050, targetHeight: 700, quantity: 8, allowRotation: false }],
      kerfMm: 2,
      optimizationGoal: 'SAVE_MATERIAL',
    };
    const safe = sanitizeAgentDraft(raw, a4Stocks);
    expect(safe.stockIds).toEqual(['a4-1']);
  });

  it('同材质同规格可用材料自动补齐至 stockIds，支持跨张排料', () => {
    const draft: AgentDraft = {
      stockIds: ['a4-1'],
      partGroups: [{ id: 'g1', name: '展签', targetWidth: 1050, targetHeight: 700, quantity: 8, allowRotation: false }],
      kerfMm: 2,
      optimizationGoal: 'BALANCED',
    };
    const enriched = enrichDraftStockIds(draft, a4Stocks);
    expect(enriched.stockIds).toEqual(['a4-1', 'a4-2']);
  });

  it('只读求解返回经过独立校验的候选摘要和裁切证据', () => {
    const draft: AgentDraft = {
      stockIds: ['a4-1', 'a4-2'],
      partGroups: [{
        id: 'g1',
        name: '展签',
        targetWidth: 1050,
        targetHeight: 700,
        quantity: 8,
        allowRotation: false,
        flexibleRange: { maxShrinkMm: 1, stepMm: 1 },
      }],
      kerfMm: 2,
      optimizationGoal: 'SAVE_MATERIAL',
    };
    const result = solveAndCompare(draft, a4Stocks);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((item) => item.validationPassed)).toBe(true);
    const summary = buildCutSummary(result.solverOutput);
    expect(summary.algorithmVersion).toBeTruthy();
    expect(summary.stepsCount).toBeGreaterThan(0);
  });
});
