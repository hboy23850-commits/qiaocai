import { beforeEach, describe, expect, it } from 'vitest';
import {
  callCloudFunction,
  mockDatabase,
  resetMockDatabase,
} from '../../miniprogram/utils/cloud-adapter.ts';

describe('AI 制作智能体本地验收流', () => {
  beforeEach(() => resetMockDatabase());

  it('智能体只生成可确认草稿，不写入方案或库存', async () => {
    await callCloudFunction('prepareDemo', {});
    const response = await callCloudFunction('agentTurn', {
      message: '用现有A4卡纸制作8张105x70mm展签，间距2mm，不旋转，允许宽度最多缩小1mm',
      reset: true,
    });
    expect(response.result.code).toBe(200);
    expect(response.result.data.status).toBe('AWAITING_CONFIRMATION');
    expect(response.result.data.draft.partGroups[0].flexibleRange.maxShrinkMm).toBe(1);
    expect(response.result.data.candidateSummary.length).toBeGreaterThan(0);
    expect(response.result.data.toolRuns.map((run: any) => run.tool)).toEqual([
      'list_available_stocks',
      'validate_requirement',
      'solve_and_compare',
      'build_cut_summary',
    ]);
    expect(mockDatabase.plans).toHaveLength(0);
    expect(mockDatabase.stocks.every((stock) => stock.status === 'AVAILABLE')).toBe(true);
  });

  it('缺少尺寸时只追问，不调用求解器', async () => {
    await callCloudFunction('prepareDemo', {});
    const response = await callCloudFunction('agentTurn', {
      message: '我要做一批活动展签',
      reset: true,
    });
    expect(response.result.data.status).toBe('NEEDS_INPUT');
    expect(response.result.data.clarification.field).toBe('partGroups');
    expect(response.result.data.toolRuns.some((run: any) => run.tool === 'solve_and_compare')).toBe(false);
  });

  it('确认后由正式求解接口重新求解并创建方案', async () => {
    const prepared = await callCloudFunction('prepareDemo', {});
    const response = await callCloudFunction('agentTurn', {
      message: '8张105x70mm展签，间距2mm，不旋转',
      reset: true,
    });
    const draft = response.result.data.draft;
    const solved = await callCloudFunction('solvePlan', {
      partGroups: draft.partGroups,
      kerfMm: draft.kerfMm,
      stockIds: prepared.result.data.stocks.map((stock: any) => stock.id || stock._id),
    });
    expect(solved.result.code).toBe(200);
    expect(mockDatabase.plans).toHaveLength(1);
  });
});
