import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { parseModelEnvelope, SYSTEM_PROMPT } = require('../../cloudfunctions/api/agent.js');

describe('CloudBase 智能体编排边界', () => {
  it('接受带代码围栏的结构化模型响应', () => {
    const parsed = parseModelEnvelope('前言\n\`\`\`json\n{"status":"NEEDS_INPUT","assistantMessage":"请补充单位"}\n\`\`\`');
    expect(parsed.status).toBe('NEEDS_INPUT');
    expect(parsed.assistantMessage).toBe('请补充单位');
  });

  it('拒绝非 JSON 或缺少用户回复的响应', () => {
    expect(() => parseModelEnvelope('随便说一句')).toThrow('结构化JSON');
    expect(() => parseModelEnvelope('{"status":"SOLVED"}')).toThrow('结构不完整');
  });

  it('系统提示限制写入、越权和自行编造指标', () => {
    expect(SYSTEM_PROMPT).toContain('不得执行代码');
    expect(SYSTEM_PROMPT).toContain('读取其他用户数据');
    expect(SYSTEM_PROMPT).toContain('不得自己计算利用率');
    expect(SYSTEM_PROMPT).toContain('无权最终确认或写入方案');
  });
});
