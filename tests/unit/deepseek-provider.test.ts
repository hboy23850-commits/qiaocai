import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { runDeepSeekAgent } = require('../../cloudfunctions/api/deepseek-provider.js');

const tools = [
  {
    name: 'list_available_stocks_test',
    description: '列出材料',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    fn: vi.fn(async () => [{ id: 'stock-1', width: 2100, height: 2970 }]),
  },
];

describe('DeepSeek 直连智能体提供器', () => {
  it('使用 V4.1 正式模型、关闭思考并执行只读工具循环', async () => {
    const responses = [
      {
        choices: [{ message: { role: 'assistant', content: null, reasoning_content: '不得保存', tool_calls: [{ id: 'call-1', type: 'function', function: { name: tools[0].name, arguments: '{}' } }] } }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      {
        choices: [{ message: { role: 'assistant', content: '{"status":"NEEDS_INPUT","assistantMessage":"请补充尺寸"}', reasoning_content: '不得保存' } }],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
      },
    ];
    const requestJson = vi.fn(async () => responses.shift());

    const result = await runDeepSeekAgent({
      apiKey: 'test-secret',
      baseUrl: 'https://api.deepseek.com',
      modelId: 'deepseek-flash',
      messages: [{ role: 'user', content: '我要做展签' }],
      tools,
      maxToolCalls: 4,
      requestJson,
    });

    expect(tools[0].fn).toHaveBeenCalledWith({});
    expect(requestJson).toHaveBeenCalledTimes(2);
    const firstRequest = requestJson.mock.calls[0][0];
    expect(firstRequest.url).toBe('https://api.deepseek.com/chat/completions');
    expect(firstRequest.headers.Authorization).toBe('Bearer test-secret');
    expect(firstRequest.body.model).toBe('deepseek-flash');
    expect(firstRequest.body.thinking).toEqual({ type: 'disabled' });
    expect(firstRequest.body.tools[0].function.name).toBe(tools[0].name);
    const secondMessages = requestJson.mock.calls[1][0].body.messages;
    expect(secondMessages.some((message: any) => message.role === 'tool' && message.tool_call_id === 'call-1')).toBe(true);
    expect(requestJson.mock.calls[1][0].body.tools).toBeUndefined();
    expect(JSON.stringify(secondMessages)).not.toContain('不得保存');
    expect(result.text).toContain('请补充尺寸');
    expect(result.usage).toEqual({ prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 });
  });

  it('重复请求只读工具时返回缓存且不重复执行', async () => {
    const cachedTool = { ...tools[0], fn: vi.fn(async () => [{ id: 'stock-1' }]) };
    const repeatedCall = { id: 'call-repeat', type: 'function', function: { name: cachedTool.name, arguments: '{}' } };
    const responses = [
      { choices: [{ message: { role: 'assistant', tool_calls: [{ ...repeatedCall, id: 'call-1' }] } }] },
      { choices: [{ message: { role: 'assistant', tool_calls: [repeatedCall] } }] },
      { choices: [{ message: { role: 'assistant', content: '{"status":"NEEDS_INPUT","assistantMessage":"请补充尺寸"}' } }] },
    ];
    const requestJson = vi.fn(async () => responses.shift());
    const result = await runDeepSeekAgent({ apiKey: 'test-secret', modelId: 'deepseek-flash', messages: [], tools: [cachedTool], requestJson });
    expect(cachedTool.fn).toHaveBeenCalledTimes(1);
    expect(requestJson).toHaveBeenCalledTimes(3);
    expect(result.text).toContain('请补充尺寸');
  });

  it('拒绝未知工具和超过工具调用上限', async () => {
    const unknownRequest = vi.fn(async () => ({
      choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'x', type: 'function', function: { name: 'delete_stock', arguments: '{}' } }] } }],
    }));
    await expect(runDeepSeekAgent({ apiKey: 'test-secret', modelId: 'deepseek-flash', messages: [], tools, requestJson: unknownRequest })).rejects.toThrow('未知工具');

    const tooManyRequest = vi.fn(async () => ({
      choices: [{ message: { role: 'assistant', tool_calls: [
        { id: '1', type: 'function', function: { name: tools[0].name, arguments: '{}' } },
        { id: '2', type: 'function', function: { name: tools[0].name, arguments: '{}' } },
      ] } }],
    }));
    await expect(runDeepSeekAgent({ apiKey: 'test-secret', modelId: 'deepseek-flash', messages: [], tools, maxToolCalls: 1, requestJson: tooManyRequest })).rejects.toThrow('工具调用次数');
  });
});

describe('Step5 JSON 稳定性：最终内容边界场景', () => {
  it('模型返回空 content 时应返回空字符串文本（调用层负责降级）', async () => {
    const requestJson = vi.fn(async () => ({
      choices: [{ message: { role: 'assistant', content: null } }],
      usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
    }));
    const result = await runDeepSeekAgent({ apiKey: 'test-secret', modelId: 'deepseek-flash', messages: [], tools: [], requestJson });
    expect(result.text).toBe('');
  });

  it('模型返回自然语言（非 JSON）时 runDeepSeekAgent 应正常返回原文', async () => {
    const requestJson = vi.fn(async () => ({
      choices: [{ message: { role: 'assistant', content: '很高兴帮您！请告诉我展签尺寸。' } }],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
    }));
    const result = await runDeepSeekAgent({ apiKey: 'test-secret', modelId: 'deepseek-flash', messages: [], tools: [], requestJson });
    // provider 层只负责透传，不负责解析 JSON；解析由 agent.js 的 parseModelEnvelope 负责
    expect(result.text).toBe('很高兴帮您！请告诉我展签尺寸。');
  });

  it('模型用 Markdown 代码块包裹 JSON 时 provider 应返回原始文本', async () => {
    const jsonContent = '```json\n{"status":"NEEDS_INPUT","assistantMessage":"请补充"}\n```';
    const requestJson = vi.fn(async () => ({
      choices: [{ message: { role: 'assistant', content: jsonContent } }],
      usage: { prompt_tokens: 5, completion_tokens: 15, total_tokens: 20 },
    }));
    const result = await runDeepSeekAgent({ apiKey: 'test-secret', modelId: 'deepseek-flash', messages: [], tools: [], requestJson });
    expect(result.text).toBe(jsonContent);
  });

  it('工具调用后最终 content 为有效 JSON 时正常返回', async () => {
    const toolFn = vi.fn(async () => [{ id: 's1', width: 2100, height: 2970 }]);
    const singleTool = [{ name: 'list_test', description: '列材料', parameters: { type: 'object', properties: {} }, fn: toolFn }];
    const validFinalJson = '{"status":"AWAITING_CONFIRMATION","assistantMessage":"方案已生成","draft":{"stockIds":["s1"],"partGroups":[],"kerfMm":2,"optimizationGoal":"BALANCED"}}';
    const responses = [
      {
        choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call-t1', type: 'function', function: { name: 'list_test', arguments: '{}' } }] } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
      {
        choices: [{ message: { role: 'assistant', content: validFinalJson } }],
        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
      },
    ];
    const requestJson = vi.fn(async () => responses.shift());
    const result = await runDeepSeekAgent({ apiKey: 'test-secret', modelId: 'deepseek-flash', messages: [], tools: singleTool, requestJson });
    expect(result.text).toBe(validFinalJson);
    expect(toolFn).toHaveBeenCalledTimes(1);
  });
});

