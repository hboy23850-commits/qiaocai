const https = require('node:https');

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_TIMEOUT_MS = 15000;

function postJson({ url, headers, body, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = JSON.stringify(body);
    const request = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
      timeout: timeoutMs,
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch (_) {
          reject(new Error(`DeepSeek 返回了无效 JSON（HTTP ${response.statusCode || 0}）`));
          return;
        }
        if ((response.statusCode || 500) < 200 || response.statusCode >= 300) {
          const message = parsed?.error?.message || `HTTP ${response.statusCode}`;
          reject(new Error(`DeepSeek 请求失败：${String(message).slice(0, 200)}`));
          return;
        }
        resolve(parsed);
      });
    });
    request.on('timeout', () => request.destroy(new Error('DeepSeek 请求超时')));
    request.on('error', reject);
    request.end(payload);
  });
}

function addUsage(total, usage) {
  if (!usage || typeof usage !== 'object') return total;
  for (const field of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    total[field] = (total[field] || 0) + (Number(usage[field]) || 0);
  }
  return total;
}

function safeAssistantMessage(message) {
  return {
    role: 'assistant',
    content: message.content == null ? null : String(message.content),
    ...(Array.isArray(message.tool_calls) ? { tool_calls: message.tool_calls } : {}),
  };
}

async function runDeepSeekAgent(options) {
  const {
    apiKey,
    modelId = 'deepseek-flash',
    baseUrl = DEFAULT_BASE_URL,
    messages = [],
    tools = [],
    maxToolCalls = 4,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    requestJson = postJson,
  } = options || {};
  if (!apiKey) throw new Error('缺少 QIAOCAI_DEEPSEEK_API_KEY');
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const apiTools = tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
  const conversation = messages.map((message) => ({ role: message.role, content: message.content }));
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let toolCallCount = 0;
  const executedTools = new Set();
  const toolResults = new Map();
  let modelStepCount = 0;

  while (toolCallCount <= maxToolCalls) {
    modelStepCount += 1;
    if (modelStepCount > maxToolCalls + 4) throw new Error('模型工具循环超过上限');
    const availableTools = apiTools.filter((item) => !executedTools.has(item.function.name));
    const data = await requestJson({
      url: `${String(baseUrl).replace(/\/$/, '')}/chat/completions`,
      headers: { Authorization: `Bearer ${apiKey}` },
      timeoutMs,
      body: {
        model: modelId,
        messages: conversation,
        ...(availableTools.length ? { tools: availableTools, tool_choice: 'auto' } : {}),
        thinking: { type: 'disabled' },
        temperature: 0.1,
        max_tokens: 1200,
      },
    });
    addUsage(usage, data.usage);
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error('DeepSeek 返回结构不完整');
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (calls.length === 0) {
      return { text: String(message.content || ''), usage };
    }
    if (toolCallCount + calls.length > maxToolCalls) throw new Error('工具调用次数超过上限');
    conversation.push(safeAssistantMessage(message));
    for (const call of calls) {
      const toolName = call?.function?.name;
      const tool = toolMap.get(toolName);
      if (!tool) throw new Error(`模型请求了未知工具：${String(toolName || '')}`);
      let args;
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch (_) {
        throw new Error(`工具 ${toolName} 的参数不是有效 JSON`);
      }
      let result;
      if (executedTools.has(toolName)) {
        result = toolResults.get(toolName);
      } else {
        toolCallCount += 1;
        executedTools.add(toolName);
        result = await tool.fn(args);
        toolResults.set(toolName, result);
      }
      conversation.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
  throw new Error('工具调用次数超过上限');
}

module.exports = { runDeepSeekAgent };
