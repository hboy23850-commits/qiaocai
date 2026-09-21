import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('智能体工作台静态验收', () => {
  it('首页提供自由输入和两个仅预填的演示入口', () => {
    const page = read('miniprogram/pages/index/index.wxml');
    expect(page).toContain('home-agent-start');
    expect(page).toContain('data-demo="a4"');
    expect(page).toContain('data-demo="kt"');
    expect(page).not.toContain('利用率 100');
  });

  it('工作台展示五阶段、工具证据和人工确认边界', () => {
    const page = read('miniprogram/pages/agent/agent.wxml');
    for (const label of ['理解需求', '补全条件', '调用排料', '独立校验', '等待确认']) {
      expect(page).toContain(label);
    }
    expect(page).toContain('可核验工具证据');
    expect(page).toContain('agent-confirm');
    expect(page).toContain('智能体不会保存工程');
  });

  it('客户端只在待确认且存在校验通过候选时开放确认', () => {
    const logic = read('miniprogram/pages/agent/agent.ts');
    expect(logic).toContain("data.status === 'AWAITING_CONFIRMATION'");
    expect(logic).toContain('safeCandidates.length > 0');
    expect(logic).toContain("callCloudFunction('listStocks'");
    expect(logic).toContain("callCloudFunction('solvePlan'");
  });

  it('端到端凭证将降级链路与真实 AI 验收分开', () => {
    const script = read('scripts/verify-agent-automator.cjs');
    expect(script).toContain("QIAOCAI_REQUIRE_REAL_AI !== '0'");
    expect(script).toContain("'DEGRADED_FALLBACK_VERIFIED'");
    expect(script).toContain('realModelVerified');
    expect(script).toContain('requiredToolNames.every');
    expect(script).toContain('candidateValidated');
  });
});
