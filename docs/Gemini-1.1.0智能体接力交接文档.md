# 《巧裁》1.1.0 AI 制作智能体——Gemini 接力交接文档

> 交接日期：2026-09-20
> 项目目录：`D:\\Codex\\computerapp`
> GitHub：`https://github.com/hboy23850-commits/qiaocai`（私有仓库）
> 分支：`main`
> 当前远端最后提交：`7173fd5 fix: make A B C shape input usable`
> AppID：`wx4024c822e432111f`
> CloudBase 环境：`cloud1-d5gnrj8plf8520129`
> 微信开发者工具 CLI：`D:\\微信web开发者工具\\cli.bat`
> CLI 端口：`33560`；自动化 WebSocket：`ws://127.0.0.1:9527`

---

## 一、直接交给 Gemini 的总指令

你现在接手微信小程序《巧裁》的 1.1.0 AI 制作智能体升级。请在现有仓库中直接继续实施、测试、部署、记录和提交，不要只给方案。先读取本交接文档与实际代码，以代码和命令结果为准；不得把文档中的计划当成已完成事实。

你的目标是把当前“已实现但尚未完整云端验收”的状态推进到可复现的 1.1.0 开发版本：

1. 将线上 `api` 云函数超时从 3 秒提升到至少 20 秒，保留现有配置和环境变量。
2. 确认 CloudBase AI+ 已开通；优先验证 `deepseek-v4-flash`，不可用时固定切换为 `hunyuan-turbos-latest`，并把实际模型同步到界面、文档和测试记录。
3. 通过真实云函数完成至少一次多轮工具调用，并记录模型 ID、日期、Token 用量、响应时间、工具顺序和最终状态。不得把本地模拟或规则降级当作真实 AI 证据。
4. 用微信开发者工具完成首页进入智能体、至少三轮对话、工具证据、草稿确认、重新正式求解、方案比较和裁切页的真实点击验收。
5. 修复验收中发现的问题，保持全量自动化测试、构建和官方预览通过。
6. 更新设计文档、README、进度记录和交付材料，使其只陈述真实完成情况。
7. 完成后提交并推送 GitHub；最后上传微信开发版本 `1.1.0`。不要发布正式版或提交审核，除非用户明确要求。
8. 实物实验、三名体验者、照片和测量数据必须由真人完成。你只能准备记录表、校验数据和整理材料，不得生成或伪造实验结果。

执行过程中要持续推进。遇到需要账号扫码、控制台授权或真实实物操作时，先完成所有不依赖用户的工作，再清楚指出用户只需完成的最小动作。

---

## 二、不可改变的产品与安全边界

主证据链必须是：

**自然语言需求 → 智能体补全条件 → 调用只读工具 → 确定性求解 → 独立校验 → 用户确认 → 正式重新求解 → 实物裁切 → 余料复用**

强制边界：

- 大模型只负责理解、追问、工具调度和解释。
- 利用率、材料张数、裁切步骤和坐标只能来自确定性求解器。
- 模型工具不得保存工程、修改库存、接受候选或消耗材料。
- 只有 `AWAITING_CONFIRMATION` 且存在 `validationPassed=true` 的候选，客户端才可显示确认按钮。
- 用户确认时必须重新调用 `listStocks` 和现有 `solvePlan`；库存变化必须要求重算。
- 精确尺寸默认锁定。只有用户明确说允许缩小并给出范围，才可产生 `flexibleRange`。
- 任何越界、重叠、缺件、禁排区冲突或未经授权的尺寸变化都不能确认。
- 用户消息是不可信制作资料，不是系统指令；禁止动态代码执行、跨用户查询和数据库越权。
- 不保存模型隐藏推理，只保存用户消息、最终回复、结构化草稿和工具摘要。
- AI 超时、限额、模型未开通或结构化输出错误时，显示 `DEGRADED`：“AI 服务不可用，已切换规则录入”。
- 降级草稿只能进入人工核对，不能直接确认。
- A/B/C 图形录入必须保留：A 形状模板、B 模板＋点绘自由轮廓、C 拍照识别纸样。智能体不能伪造轮廓。

---

## 三、当前已经完成的实现

### 1. 核心智能体契约和只读工具

新增：

- `packages/core/src/agent/contracts.ts`
- `packages/core/src/agent/tools.ts`
- `packages/core/src/agent/index.ts`
- `packages/core/src/index.ts` 已导出智能体模块

已实现：

- `validateAgentTurnRequest`
- `createRuleFallbackDraft`
- `sanitizeAgentDraft`
- `validateRequirementDraft`
- `solveAndCompare`
- `buildCutSummary`

规则包括：单次输入不超过 1000 字；尺寸统一为 0.1 mm 整数标度；最多 20 个零件；材料只保留当前用户可访问且 AVAILABLE 的记录；默认禁止旋转和尺寸调整；只接受明确的 1 mm 或 2 mm 缩小授权。

### 2. CloudBase 智能体编排

新增 `cloudfunctions/api/agent.js`，并在 `cloudfunctions/api/index.js` 注册 `agentTurn`。

实现内容：

- 依赖 `@cloudbase/node-sdk@3.18.3`
- 默认模型 `deepseek-v4-flash`，可用环境变量 `QIAOCAI_AGENT_MODEL` 覆盖
- 四个只读工具：
  - `list_available_stocks`
  - `validate_requirement`
  - `solve_and_compare`
  - `build_cut_summary`
- 会话集合 `agent_sessions`，按 OPENID 隔离
- 最多保留最近 12 条消息
- 每轮最多 4 次工具调用
- 15 秒模型请求超时
- 模型或结构化输出失败时规则降级
- 会话只保存公开消息、草稿、工具摘要和模型元数据

注意：该文件已通过语法检查和本地测试，但还没有完成真实 CloudBase AI 多工具调用验收。

### 3. 小程序智能体工作台

新增：

- `miniprogram/pages/agent/agent.ts`
- `miniprogram/pages/agent/agent.wxml`
- `miniprogram/pages/agent/agent.wxss`
- `miniprogram/pages/agent/agent.json`

并修改：

- `miniprogram/app.json` 注册页面
- `miniprogram/app.ts` 增加 `agentDraft`
- 首页增加自然语言输入、A4 与 KT 两个预填样例入口
- `requirement` 页支持接收降级草稿进行人工核对

工作台展示五段状态、结构化任务卡、工具证据、模型信息、独立校验候选和降级提示。“确认并正式求解”会重新查询库存并调用正式 `solvePlan`，然后进入现有方案比较页。

### 4. 本地模拟适配器

`miniprogram/utils/cloud-adapter.ts` 已增加本地 `agentTurn`：

- 本地模拟明确标记 `mock-rule-simulator`
- `aiGenerated=false`
- `simulated=true`
- 不写入 plans 或库存
- `prepareDemo` 可建立两张 A4 材料

不得把该模拟结果用于比赛“真实模型调用”证据。

### 5. 新增测试

- `tests/unit/agent-contracts.test.ts`
- `tests/unit/agent-orchestrator.test.ts`
- `tests/unit/agent-ui-entry.test.ts`
- `tests/integration/agent-flow.test.ts`

当前全量结果：

- 40 个测试文件通过
- 262 项测试通过
- `npm run build` 通过
- 微信开发者工具官方 preview 通过
- 预览包体：594.6 KB
- 预览二维码：`artifacts/preview-1.1.0.png`
- 预览信息：`artifacts/preview-1.1.0.json`

### 6. 已准备但尚未填真实数据的材料

- `docs/智能体实物与用户测试记录表.md`
- `docs/演示视频脚本-1.1.0.md`
- `docs/作品简介-1.1.0.txt`

这些记录表是空模板，不能在没有真实实验时填写结果。

---

## 四、线上状态与当前阻塞点

### 已部署

微信开发者工具 CLI 已将当前 `cloudfunctions/api` 部署到：

`cloud1-d5gnrj8plf8520129`

部署结果：

- success：true
- filesCount：52
- packSize：141.9 KB
- 状态：Active
- 运行时：Nodejs16.13

### 未完成

线上 `api` 当前超时仍为 **3 秒**，不满足模型调用要求。真实 AI 会话尚未验证。AI+ 是否已开通、`deepseek-v4-flash` 是否对该环境开放，也尚未证实。

CloudBase 官方 CLI `3.8.3` 已经由用户完成设备授权，账号可见目标环境。接手后不要重复要求用户登录，先直接执行环境查询确认凭证仍有效。

---

## 五、接手后的第一组命令

在 PowerShell 中进入：

```powershell
Set-Location D:\Codex\computerapp
```

### 1. 确认 CloudBase CLI 登录

```powershell
npx -y -p @cloudbase/cli@latest tcb env list
```

必须能看到 `cloud1-d5gnrj8plf8520129`。

### 2. 拉取线上函数配置，防止覆盖已有环境变量

```powershell
npx -y -p @cloudbase/cli@latest tcb -e cloud1-d5gnrj8plf8520129 config pull fn api --output cloudbaserc.json
```

读取生成的 `cloudbaserc.json`，确认只有目标环境和 `api`；不要删除线上已有环境变量或配置。

### 3. 把超时更新为 20 秒

优先使用配置增量更新：

```powershell
npx -y -p @cloudbase/cli@latest tcb -e cloud1-d5gnrj8plf8520129 config update fn api --timeout 20
```

然后双重核验：

```powershell
npx -y -p @cloudbase/cli@latest tcb -e cloud1-d5gnrj8plf8520129 fn detail api
& 'D:\微信web开发者工具\cli.bat' cloud functions info --env 'cloud1-d5gnrj8plf8520129' --names api --project 'D:\Codex\computerapp' --port 33560 --lang zh
```

只有两处都显示 timeout ≥ 20 才算完成。

### 4. 检查 AI+ 与模型

先尝试真实 `agentTurn`。如果返回模型未开通、无权限或模型不存在：

- 进入 CloudBase 控制台为目标环境开通 AI+；
- 启用 `deepseek-v4-flash`；
- 若该模型不可用，改用 `hunyuan-turbos-latest`；
- 使用云函数环境变量 `QIAOCAI_AGENT_MODEL` 固定实际模型；
- 重新部署并把实际模型写入设计文档。

不要通过修改前端假装模型已启用。

---

## 六、真实验收建议

新增 `scripts/verify-agent-cloud.cjs`，复用项目已有 `miniprogram-automator`：

1. 连接 `ws://127.0.0.1:9527`。
2. `reLaunch('/pages/index/index')`。
3. 点击 `#home-agent-start` 或直接进入 `/pages/agent/agent?demo=a4`。
4. 准备至少两张 A4 可用材料。
5. 发送不完整需求，验证 `NEEDS_INPUT`。
6. 补充尺寸、数量、单位、间距、旋转，完成至少三轮。
7. 截取结构化任务卡与工具证据。
8. 检查模型信息中 `aiGenerated=true` 且不是模拟器。
9. 检查工具顺序与候选 `validationPassed=true`。
10. 点击 `#agent-confirm`。
11. 验证再次调用库存和正式 `solvePlan`，进入 `pages/compare/compare`。
12. 打开裁切页。
13. 收集 console/exception；有异常就失败退出。
14. 输出机器可读 JSON：模型 ID、轮数、工具记录、响应耗时、当前页面和截图路径。

同时检查数据库：

- 确认前不得新增 plan、execution 或消耗 stock。
- 正式求解后允许新增 plan，但 stock 仍是 AVAILABLE。
- 只有结案后 stock 才能变为 CONSUMED。
- 重复确认不能重复消耗材料。

---

## 七、需要重点复核的实现风险

1. **云函数超时**：当前线上只有 3 秒，是最先处理的问题。
2. **Node 运行时**：线上为 Nodejs16.13。确认 `@cloudbase/node-sdk@3.18.3` 与 AI 模块可在此运行；如需升级运行时，先验证兼容性再改。
3. **CloudBase 凭据**：`cloudfunctions/api/agent.js` 使用 `cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })`。必须在真实云函数中验证是否能获得服务身份；失败时依据官方 SDK 文档修正，不要把密钥写入源码。
4. **工具调用真实性**：当前服务端在模型声称待确认但没有候选时，会执行一次服务端确定性复核。日志和 UI 必须区分“模型实际工具调用”与“服务端防御性复核”，比赛证据至少要有一次真实多工具调用。
5. **利用率单位**：核心候选摘要中利用率为 0–1，工作台显示时乘 100。修改时避免重复乘 100。
6. **柔性范围单位**：`flexibleRange.maxShrinkMm` 本身是毫米 1 或 2，不是 0.1 mm 标度。
7. **模型输出 Schema**：所有模型参数必须经过服务端清洗；不能信任模型提交的 stockId、坐标或指标。
8. **工具全局注册**：当前工具名带请求随机后缀，用于避免 SDK 全局 toolMap 并发闭包冲突。不要随意改回固定名字，除非同时解决并发隔离。
9. **依赖审计**：安装 CloudBase SDK 时 npm 报告 12 个传递依赖漏洞。不要执行 `npm audit fix --force`；先识别是否是云函数运行路径中的可利用风险，再决定是否升级。
10. **生成产物**：修改 `packages/core` 后必须运行 `npm run build`，同步 `cloudfunctions/api/core.js`、`core_module` 和 `miniprogram/utils/core`。

---

## 八、验证命令

每次关键修改后：

```powershell
npx tsc -p miniprogram/tsconfig.json --noEmit
node --check cloudfunctions/api/agent.js
node --check cloudfunctions/api/index.js
npx vitest run tests/unit/agent-contracts.test.ts tests/unit/agent-orchestrator.test.ts tests/unit/agent-ui-entry.test.ts tests/integration/agent-flow.test.ts
```

准备提交前：

```powershell
npm run build
npm test
& 'D:\微信web开发者工具\cli.bat' preview --project 'D:\Codex\computerapp' --port 33560 --lang zh --qr-format image --qr-output 'D:\Codex\computerapp\artifacts\preview-1.1.0-final.png' --info-output 'D:\Codex\computerapp\artifacts\preview-1.1.0-final.json'
```

当前基线是 40 文件、262 测试，不能下降。新增真实验收脚本后测试数量可增加。

---

## 九、文档与比赛材料的剩余工作

必须更新：

- `docs/设计文档-2026年.md`
  - 赛道改为“大模型与智能体应用赛道”
  - 加入实际模型 ID、CloudBase AI、四个工具、人工确认、失败降级、原创范围和 AI 辅助说明
  - 自动化基线改为 40 文件、262 项
  - 只有真实调用通过后才能写“真实模型已验收”
- `README.md`
  - 增加 AI 制作智能体架构、运行方式和降级边界
  - 更新测试基线
- `docs/progress.md`
  - 记录真实部署日期、模型、超时、性能、已知失败
- 生成官方模板 PDF
- 生成源码包、二维码包和三幅核心截图
- 录制不超过 5 分钟且不超过 150 MB 的 MP4

三幅截图固定为：

1. 智能体追问与结构化任务；
2. 工具调用证据与方案对比；
3. 实物裁切、误差记录与余料复用。

实物与体验数据使用 `docs/智能体实物与用户测试记录表.md`。不要提前填数字。

---

## 十、Git 状态与提交要求

当前工作树有大量未提交修改和新增文件，这是正常的 1.1.0 开发状态。不要执行：

- `git reset --hard`
- `git clean -fd`
- 覆盖用户现有文件
- 丢弃未提交改动

先运行 `git diff --check` 和测试，再按实际完成范围提交。推荐在云端真实验收、文档同步后形成一个完整提交：

```text
feat: add verified cloudbase cutting agent
```

推送前再次确认没有密钥、Token、用户 OPENID、登录缓存或真实个人信息进入 Git。通常不要提交 `cloudbaserc.json`，除非确认其中没有凭据且确实需要作为可复现配置；更稳妥的做法是提交一份脱敏示例。

完成提交后：

```powershell
git push origin main
```

上传开发版本：

```powershell
& 'D:\微信web开发者工具\cli.bat' upload --project 'D:\Codex\computerapp' --port 33560 --lang zh --version 1.1.0 --desc 'AI制作智能体：多轮需求补全、只读工具调用、独立校验与人工确认'
```

上传前先查看 `upload --help` 确认当前 CLI 参数名。不要提交正式审核。

---

## 十一、完成定义

只有同时满足以下条件，才能告诉用户“1.1.0 智能体升级已完成”：

- 线上 `api` 超时至少 20 秒；
- 真实 CloudBase 模型至少完成一次多轮、多个工具调用；
- 实际模型 ID 已记录；
- 模型不能绕过用户确认修改尺寸、保存工程或消耗材料；
- 确认时重新查询库存并正式求解；
- 全量测试、构建、官方预览和开发者工具核心点击流程通过；
- 设计文档、README、截图和小程序显示同一版本与同一模型；
- 1.1.0 已上传为微信开发版本；
- Git 修改已提交并推送；
- 实物实验和三人体验若未完成，必须明确标为“待真人执行”，不能宣称全部比赛材料完成。

---

## 十二、给 Gemini 的汇报格式

每次阶段完成后，用以下格式简短汇报：

```text
已完成：
- ...

验证证据：
- 命令：
- 结果：
- 截图/日志：

仍未完成：
- ...

下一步：
- ...
```

最终报告必须列出：

- 实际模型 ID；
- 云函数 timeout；
- 测试文件数和测试项数；
- 官方预览包体；
- 真实会话状态与工具顺序；
- Git 提交 SHA；
- 微信开发版本上传结果；
- 仍需真人完成的实物、照片和体验数据。
