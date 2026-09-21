import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createToolDefinitions, parseModelEnvelope, SYSTEM_PROMPT } = require('../../cloudfunctions/api/agent.js');

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

  it('工具 Schema 明确使用求解器的 0.1mm 零件字段', () => {
    const tools = createToolDefinitions('schema-test', { stocks: [], toolRuns: [], draft: null, solverOutput: null, candidates: [] });
    const validateTool = tools.find((tool: any) => tool.name.startsWith('validate_requirement_'));
    const partSchema = validateTool.parameters.properties.draft.properties.partGroups.items;
    expect(partSchema.required).toEqual(expect.arrayContaining(['targetWidth', 'targetHeight', 'quantity', 'allowRotation']));
    expect(partSchema.properties.targetWidth.description).toContain('1050');
    expect(partSchema.properties.widthMm).toBeUndefined();
  });

  it('系统提示限制写入、越权和自行编造指标', () => {
    expect(SYSTEM_PROMPT).toContain('不得执行代码');
    expect(SYSTEM_PROMPT).toContain('读取其他用户数据');
    expect(SYSTEM_PROMPT).toContain('不得自己计算利用率');
    expect(SYSTEM_PROMPT).toContain('无权最终确认或写入方案');
  });
});
