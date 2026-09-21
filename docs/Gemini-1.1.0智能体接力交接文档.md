# 《巧裁》1.1.0 DeepSeek 制作智能体——Gemini 接力交接文档

> 交接日期：2026-09-21  
> 工作目录：`D:\\Codex\\computerapp`  
> 仓库：`https://github.com/hboy23850-commits/qiaocai`  
> 分支：`main`  
> 当前 HEAD：`69b978fdaf5f62122ade75e5dabaf1132a832970`  
> AppID：`wx4024c822e432111f`  
> CloudBase 环境：`cloud1-d5gnrj8plf8520129`  
> 微信开发者工具 CLI：`D:\\微信web开发者工具\\cli.bat`  
> IDE 端口：`33560`；自动化端口：`ws://127.0.0.1:9527`

## 一、直接复制给 Gemini 的总指令

<role>
你是接手微信小程序《巧裁》的高级全栈工程师。你必须在现有仓库中继续实施、调试、测试、部署和记录，不能只给建议或重新规划。先读取本交接文档、AGENTS.md、相关技能文件和实际代码，以代码、线上配置和命令结果为准。
</role>

<objective>
完成《巧裁》1.1.0 AI 制作智能体的真实 DeepSeek V4.1 验收：自然语言需求经过多轮补全后，模型依次使用四个只读工具，确定性求解器返回至少一个 validationPassed=true 的候选；用户确认后重新查询库存并调用正式 solvePlan，进入方案比较和裁切页。随后同步文档，运行全量测试、构建、官方预览，提交并推送代码，最后上传微信开发版本。禁止提交审核或正式发布。
</objective>

<non_negotiable_rules>
1. 不得在源码、文档、测试、日志、命令输出、提交记录或聊天回复中显示 DeepSeek API 密钥。
2. 密钥已经配置在线上 api 云函数环境变量 QIAOCAI_DEEPSEEK_API_KEY。不要要求用户再次粘贴。需要重新部署时必须先保留该变量；跟踪文件 cloudbaserc.json 故意不包含密钥。
3. 用户曾在聊天中粘贴密钥。完成接入后提醒用户去 DeepSeek 控制台轮换密钥，并用新值更新线上环境变量。
4. 大模型仅负责理解、追问、调用工具和解释。利用率、材料张数、坐标和裁切步骤只能来自确定性求解器及独立校验器。
5. 四个工具保持只读：list_available_stocks、validate_requirement、solve_and_compare、build_cut_summary。模型不得保存工程、修改库存、确认候选或消耗材料。
6. 精确尺寸默认锁定。用户未明确授权时禁止缩放。只有 validationPassed=true 才能显示确认按钮。
7. 用户确认时必须重新查询库存并调用正式 solvePlan；不能把智能体草稿直接作为正式方案。
8. 不保存或展示模型隐藏推理。DeepSeek 请求保持 thinking.type=disabled。
9. 模型超时、限额、非法结构或不可用时必须进入 DEGRADED，草稿只能人工核对。
10. 实物实验、照片、误差和三名体验者结果必须由真人完成，不得伪造。
11. 不要执行 npm audit fix --force，不要发布正式版，不要提交微信审核。
</non_negotiable_rules>

<working_method>
- 先复现当前失败，再定位根因。
- 修改行为前先写会失败的测试；确认失败后实施最小修复，再运行相关测试。
- 每一步保留可核验输出。不要把降级链路记成真实 AI 成功。
- 遇到登录、扫码或真实实物操作时，先完成其余工作，再只向用户说明最小必要动作。
</working_method>

<acceptance>
- 真实返回 provider=deepseek、id=deepseek-flash、aiGenerated=true，并记录 Token 用量和响应时间。
- 一次完整轮次的工具证据包含四个只读工具，validate_requirement=true，solve_and_compare=true，build_cut_summary=true。
- 至少一个候选 validationPassed=true。
- 确认前不新建 plan/execution、不消耗 stock。
- 确认后重新查询库存并正式求解，进入 compare 和 cut-view；结案前材料仍为 AVAILABLE。
- 端到端脚本严格模式通过，控制台无未捕获异常，生成新的机器可读证据和截图。
- 全量测试、构建、官方 preview 通过。
- README、progress、设计文档只陈述真实结果。
- Git 无密钥，提交并推送 origin/main。
- 上传开发版；不提交审核、不发布正式版。
</acceptance>

## 二、已经完成并已在线生效的工作

### 1. 1.1.0 基线

上一稳定提交为 `69b978fdaf5f62122ade75e5dabaf1132a832970`，提交信息：

`feat: add guarded cloudbase cutting agent`

该基线已完成：

- 智能体契约、只读工具、CloudBase 会话和降级处理；
- 智能体工作台、结构化任务卡、工具证据和人工确认入口；
- 确认后重新调用正式 `solvePlan`；
- A/B/C 图形录入入口；
- 线上 `api` 云函数超时提升到 20 秒；
- 官方 preview 与微信开发版本 1.1.0 上传；
- 设计文档 PDF/DOCX 生成；
- 推送到 `origin/main`。

已上传的是开发版本，不是正式发布版本，也没有提交审核。

### 2. CloudBase AI+ 套餐阻塞已绕过

CloudBase 个人版不能启用托管文本模型，曾返回 `FailedOperation.PackageUnsupported`。现在采用云函数直连 DeepSeek 官方 API，不依赖 CloudBase AI+ 套餐。

线上 `api` 当前环境变量应为：

- `QIAOCAI_AGENT_PROVIDER=deepseek-direct`
- `QIAOCAI_AGENT_BASE_URL=https://api.deepseek.com`
- `QIAOCAI_AGENT_MODEL=deepseek-flash`
- `QIAOCAI_DEEPSEEK_API_KEY`：已设置，值不得读取、打印或写入仓库

官方接口最小探测已成功：

- HTTP：200
- 实际模型：`deepseek-flash`
- 最小探测 Token：18
- 日期：2026-09-21

### 3. 当前未提交的 DeepSeek 直连实现

当前工作树包含以下修改，不能丢弃：

- `cloudfunctions/api/deepseek-provider.js`：新增 OpenAI 兼容的 DeepSeek 工具调用循环，使用 Node HTTPS，15 秒请求超时。
- `cloudfunctions/api/agent.js`：按 `QIAOCAI_AGENT_PROVIDER` 选择 DeepSeek 直连或原 CloudBase 路径。
- `cloudbaserc.json`：非敏感配置切换到 `deepseek-direct`、`https://api.deepseek.com`、`deepseek-flash`。
- `packages/core/src/agent/contracts.ts`：模型 provider 支持 `deepseek`，模型元数据允许 usage、durationMs、degraded。
- `tests/unit/deepseek-provider.test.ts`：直连请求、工具白名单、工具次数、推理字段丢弃和只读缓存测试。
- `tests/unit/agent-orchestrator.test.ts`：工具 Schema 字段测试。
- `miniprogram/utils/core/agent/contracts.d.ts`：构建生成的类型同步。

直连实现已具备：

- `thinking: { type: 'disabled' }`；
- Authorization 只在云函数请求头中使用；
- 未把 `reasoning_content`写入消息或数据库；
- 未执行未知工具；
- 每轮最多实际执行四个工具；
- 同一个只读工具被模型重复请求时返回首次结果缓存，不重复执行业务函数；
- 另设模型循环上限，防止无限工具循环；
- 工具 Schema 明确使用 `targetWidth`、`targetHeight`、`quantity`、`allowRotation`，尺寸为 0.1mm 整数；
- 工具名仍带每次请求随机后缀，避免并发闭包冲突。

### 4. 已通过的测试

最近一次完整验证：

- 41 个测试文件通过；
- 268 项测试通过；
- `npm run build` 通过。

新增定向测试最近一次为 4 文件、17 项通过。任何后续修改必须保持这些测试通过，数量可以增加，不能减少或跳过失败项。

## 三、当前真实验收结果与唯一主要阻塞

微信开发者工具自动化已经真实调用线上 DeepSeek。最新完整到达第三轮的输出为：

- provider：`deepseek`
- model：`deepseek-flash`
- aiGenerated：`true`
- 第三轮 Token：prompt 7380、completion 518、total 7898
- 第三轮耗时：4793ms
- 用户条件：8 张、105×70mm、A4 卡纸、不旋转、间距 2mm、精确尺寸、不允许缩小
- 结构化任务卡：105×70mm、数量 8、禁止旋转、缩小 0mm
- 工具顺序：
  1. `list_available_stocks`：成功，查询到 2 块材料
  2. `validate_requirement`：成功
  3. `solve_and_compare`：失败，生成 1 个候选但没有通过独立校验
  4. `build_cut_summary`：失败，0 张材料、0 个裁切步骤
- 最终状态：`NEEDS_INPUT`
- 严格端到端验收失败，因为没有 `validationPassed=true` 的候选。

这不是模型接入失败。真实模型、Token、耗时和四工具调用已经出现。当前需要定位确定性求解为何认为“两张 A4 卡纸无法放置 8 个 105×70mm、间距 2mm、不旋转的矩形”。

理论上每张 A4 可纵向放 4 个：`4×70 + 3×2 = 286mm ≤ 297mm`，两张可放 8 个；宽度为 `105mm ≤ 210mm`。因此当前结果很可能来自线上库存尺寸标度、材料字段、求解输入或候选校验不一致，而不是需求本身不可行。

注意：`artifacts/agent-e2e-evidence.json` 仍是较早一次降级验收生成的旧证据。最新严格运行在候选失败处退出，没有覆盖该文件。不得引用旧文件证明最新结果。

## 四、下一步必须按顺序执行

### 步骤 1：保护当前现场

运行：

```powershell
Set-Location D:\Codex\computerapp
git status --short
git diff --check
```

不要 reset、checkout 或清理当前未提交修改。不要运行任何会打印线上环境变量完整值的命令。

### 步骤 2：先复现本地数学场景

为 `solveAndCompare` 增加一个明确测试：

- 两块 stock；
- 每块 `width=2100`、`height=2970`；
- 8 个零件；
- `targetWidth=1050`、`targetHeight=700`；
- `allowRotation=false`；
- `kerfMm=2`；
- 无 `flexibleRange`；
- 期望至少一个完整候选且 `validationPassed=true`；
- 期望尺寸未改变。

先观察测试是否通过。如果本地失败，修求解器或校验器；如果本地通过，问题在云端材料数据或模型传参。

### 步骤 3：只读核对线上材料

安全读取当前 OPENID 可访问的两张材料，只输出以下脱敏字段：

- id 的短哈希或末四位；
- width、height；
- status；
- version；
- owner/factory 匹配结果。

禁止输出用户身份信息和密钥。重点确认 A4 是否存成 `2100×2970`。如果是 `210×297`，说明数据库沿用了毫米值而求解器要求 0.1mm 标度。

修复策略优先级：

1. 若只有演示数据单位错误，修 `prepareDemo` 或演示数据迁移，并重新生成两张正确的 A4 材料。
2. 不要在求解器中猜测单位。
3. 不要静默改写真实用户材料。
4. 如需迁移，只处理能明确识别为旧演示数据的记录，并记录变更前后数量。
5. 确认前后材料都保持 `AVAILABLE`。

### 步骤 4：记录候选校验失败原因

当前 `solve_and_compare` 只摘要“生成 1 个候选”，缺少独立校验失败原因。扩展内部诊断：

- 服务端日志或测试证据记录 `isComplete`、`unplacedPartIds.length` 和独立校验错误摘要；
- UI 不显示敏感数据；
- 不接受模型提供的校验结论；
- 不改动候选通过标准。

如果 `validateCandidate` 只返回 valid 而错误详情在其他字段，按实际结构记录。为该诊断增加测试。

### 步骤 5：处理模型最终 JSON 的稳定性

早期真实运行曾出现一次“模型未返回结构化JSON”并正确降级。保持降级边界，同时提高成功率：

- 检查 DeepSeek 官方 `response_format: { type: 'json_object' }` 与 tools 同用的兼容性；
- 只有官方接口支持时才加入；
- System Prompt 必须显式包含“json”并给出最终对象字段；
- 工具调用阶段不得把自然语言当成正式结构；
- 结构错误仍然 DEGRADED，禁止宽松解析成可确认方案；
- 为非法 JSON、工具调用后最终 JSON、空 content 增加测试。

### 步骤 6：重新部署时保护密钥

跟踪文件 `cloudbaserc.json` 不包含密钥。直接用它部署可能覆盖线上环境变量，所以部署前必须：

1. 读取现有线上变量名并脱敏确认密钥变量仍存在；
2. 使用进程环境中的安全值生成 `tmp/cloudbaserc.deepseek.json`；
3. 临时配置包含全部非敏感变量和密钥变量；
4. 使用 `--config-file tmp/cloudbaserc.deepseek.json` 部署；
5. 无论成功失败都删除临时文件和进程环境变量；
6. 检查 `tmp/cloudbaserc.deepseek.json` 不存在；
7. 执行 Git 密钥扫描。

不要把密钥复制到本交接文档、`.env.example`、测试夹具或命令日志。若当前进程没有安全密钥值，优先保留线上变量并只更新代码；不要让用户在普通聊天里再次粘贴。

### 步骤 7：重新执行严格端到端验收

确保开发者工具自动化端口开启：

```powershell
& 'D:\微信web开发者工具\cli.bat' auto --project 'D:\Codex\computerapp' --port 33560 --auto-port 9527 --trust-project
```

执行：

```powershell
node scripts/verify-agent-automator.cjs
```

必须严格通过，不能设置允许降级的开关。成功证据至少包含：

- 三轮对话；
- `provider=deepseek`；
- `id=deepseek-flash`；
- `aiGenerated=true`；
- Token 用量；
- 每轮响应时间；
- 四工具顺序；
- `validationPassed=true`；
- 确认按钮出现；
- 确认后正式重新求解；
- compare 与 cut-view 页面；
- 0 个未捕获异常；
- 新截图和新的 `artifacts/agent-e2e-evidence.json`。

### 步骤 8：完整质量门禁

```powershell
npx vitest run tests/unit/deepseek-provider.test.ts tests/unit/agent-orchestrator.test.ts tests/unit/agent-contracts.test.ts tests/integration/agent-flow.test.ts
npm test
npm run build
```

然后执行微信官方 preview。记录 preview 包体、二维码和 JSON 信息。若小程序端代码或版本元数据发生变化，上传下一个开发版本；不要覆盖证据或声称旧上传包包含新代码。

### 步骤 9：同步文档

真实严格验收通过后更新：

- `README.md`
- `docs/progress.md`
- `docs/设计文档-2026年.md`
- 本交接文档中的状态
- 设计文档 DOCX/PDF

统一写明：

- 模型供应商：DeepSeek 官方 API；
- 实际模型 ID：`deepseek-flash`；
- CloudBase 作用：云函数、数据库、会话与小程序后端；
- 当前未使用 CloudBase AI+ 托管模型；
- 实测 Token、耗时、工具顺序和验证日期；
- 人工确认与确定性复算边界。

实物实验、照片和三名体验者结果继续标记“待真人执行”，除非用户提供真实材料。

### 步骤 10：安全检查、提交、推送、开发版上传

提交前检查：

```powershell
git diff --check
git status --short
git diff --cached --name-only
```

对跟踪文件扫描密钥模式，结果必须为零。不要打印匹配内容，只输出匹配文件数量。建议提交信息：

`feat: add verified deepseek cutting agent`

推送到 `origin/main`。若生成 PR，附加到任务；若直接推送则记录提交哈希。

最后用微信开发者工具 CLI 上传开发版本。禁止提交审核或正式发布。

## 五、关键文件

- 智能体编排：`cloudfunctions/api/agent.js`
- DeepSeek 直连：`cloudfunctions/api/deepseek-provider.js`
- 云函数入口：`cloudfunctions/api/index.js`
- 智能体核心工具：`packages/core/src/agent/tools.ts`
- 智能体契约：`packages/core/src/agent/contracts.ts`
- 求解器：`packages/core/src/solver/index.ts`
- 独立校验器：`packages/core/src/validator/index.ts`
- 智能体页面：`miniprogram/pages/agent/agent.ts`
- 云适配器：`miniprogram/utils/cloud-adapter.ts`
- 严格自动化：`scripts/verify-agent-automator.cjs`
- DeepSeek 测试：`tests/unit/deepseek-provider.test.ts`
- 编排测试：`tests/unit/agent-orchestrator.test.ts`
- 当前设计文档：`docs/设计文档-2026年.md`
- 进度记录：`docs/progress.md`

## 六、当前 Git 状态

交接时未提交修改：

```text
 M cloudbaserc.json
 M cloudfunctions/api/agent.js
 M miniprogram/utils/core/agent/contracts.d.ts
 M packages/core/src/agent/contracts.ts
 M tests/unit/agent-orchestrator.test.ts
?? cloudfunctions/api/deepseek-provider.js
?? tests/unit/deepseek-provider.test.ts
```

这些文件属于正在进行的 DeepSeek 接入，必须审查后继续，不能覆盖或丢弃。

## 七、禁止误报

以下说法在严格验收通过前都不能写入 README、设计文档、比赛材料或最终回复：

- “真实智能体端到端验收已通过”；
- “候选已通过独立校验”；
- “1.1.0 上传包已经包含 DeepSeek 直连实现”；
- “实物实验已经完成”；
- “三名体验者测试已经完成”；
- “一定能获奖”。

可以准确陈述的是：DeepSeek 官方接口和线上云函数直连已经成功；真实模型已返回 Token、耗时并完成四个只读工具调用；当前确定性候选未通过独立校验，正在定位线上材料标度或求解输入问题。
