# 《巧裁》项目开发进度与技术决策记录

## 1. 项目基本信息
- **作品全称**：巧裁——面向校园手工与模型制作的余料复用及可调整尺寸排料助手
- **核心定位**：输入材料与制作需求，在用户明确允许的范围内比较尺寸和用料方案，按照分割步骤制作，再将实测余料留给下一次任务。
- **技术栈**：微信原生小程序（TypeScript、WXML、WXSS、TDesign、Canvas 2D）、微信云开发（Node.js 云函数、云数据库、事务操作）。
- **开发约束**：
  - 内部长度统一采用 0.1 mm 整数（如 104 mm 存储为 1040），禁止浮点几何运算与静默四舍五入。
  - 二维矩形排料采用自编 24 策略确定性直线分割（Guillotine Cut Tree）。
  - 核心求解器为纯函数无网络依赖，与独立几何校验器（Validator）严格解耦。
  - 演示案例与算法真实计算产生，绝无硬编码。
  - 首版收缩专注校园手工场景，不堆砌未闭环的工业制造与商业 ERP 噱头。

---

## 2. 阶段完成情况

### 阶段 1：修复输入到方案展示（已完成）
- [x] **比较页字段结构统一**：修复 `compare.ts` 与 `cut-view.ts` 中错误的 `us.stock.width` 访问，统一直接读取 `UsedStockPlan` 内部的 `us.width` 与 `us.height`，杜绝运行时异常。
- [x] **单柔性组约束与微调交互**：重构 `flex.ts` 与 `flex.wxml`，默认所有零件组锁定，最多允许指定一个组进行宽度微缩（0, 1, 2 mm），高度与数量保持锁定。
- [x] **产品范围收缩**：撤下模拟语音录制、拍照 OCR、封边配置、SaaS 工厂横幅、CNC G-Code、AutoCAD DXF 及电子印章。早期未闭环的非矩形入口曾暂时撤下；在阶段 5 完成真实模板、自由绘制、图片轮廓提取、PROFILE 排料与独立校验后，异形能力重新进入正式主流程。
- [x] **服务端方案候选确认 (`selectPlan`)**：云端实现方案接受状态持久化与完整性独立校验。

### 阶段 2：修复库存与余料（本地实现及模拟集成测试完成）
- [x] **严格仅消耗实际使用材料**：`commitExecution` 仅扣减选中候选方案中 `usedStocks` 所包含的材料，输入库存池中未使用的材料保持可用，绝不误扣。
- [x] **稳定幂等机制**：以 `idemp_{planId}_{candidateId}` 为键，抵御网络重试与重复点击，防并发争用。
- [x] **实测余料登记与属性继承**：`finish.ts` 提供用户用直尺量取后的实际长宽输入，校验实测值不超过预测可用区域，自动从来源板材继承材质、厚度与颜色。
- [x] **事务安全与补偿保护**：生产路径使用 `db.runTransaction`；本地模拟环境验证了库存扣减、余料创建与执行记录的一致性。真实云环境的事务冲突与回滚仍需部署后验证。
- [x] **服务端余料边界**：客户端只提交预测余料区域编号和实测尺寸；服务端从已保存候选读取真实预测范围，拒绝篡改范围或重复引用。

### 阶段 3：产品收缩完成，正式云环境已部署
- [x] **真实模式与模拟模式严格隔离**：`cloud-adapter.ts` 在检测到真实 `wx.cloud` 调用失败时，严格向前端抛出真实网络/云端异常，禁止静默转入内存假数据。
- [x] **删除默认假数据冒充**：彻底移除 88.5%、89.2% 等无依据默认指标，所有利用率、零件数均来自实际方案。
- [x] **规则辅助文本提取**：文本提取标明“规则辅助解析”，遵守单位与规范，默认关闭零件旋转。
- [x] **服务端冗余动作冻结**：已退出首版的工业接口在云端明确停用或保留隔离，不干扰核心手工排料主流程。
- [x] **首版打包边界**：工厂模拟及缺陷标注页面已从 `app.json` 移除，材料库和裁切向导不再展示 SaaS、CNC 或 DXF。当前正式主流程保留面向校园手工的规则模板、自由绘制、图片辅助和 SVG 图形录入。
- [x] **正式环境配置**：AppID `wx4024c822e432111f`，云环境 `cloud1-d5gnrj8plf8520129`；`api` 云函数已部署并处于 Active 状态（Nodejs16.13）。
- [x] **核心数据库集合已创建**：`users`、`stocks`、`plans`、`executions` 均已建立，并设置为仅允许云函数管理数据。
- [x] **真实云端主流程联调**：开发者工具自动化已通过真实 `wx.cloud.callFunction` 完成演示材料准备、需求载入、尺寸微调、云端求解、方案比较、服务端方案确认及裁切图导航；真实事务冲突、两部真机公网访问仍待人工验收。
- [x] **部署包兼容修复**：核心算法打包为云函数根目录 `core.js`，解决 Nodejs16.13 运行时找不到 `@qiaocai/core` 与嵌套构建文件的问题。
- [x] **首次使用体验重构**：首页改为“登记材料—填写零件—比较方案”三步引导，并提供会自动准备 A4 材料的快速案例。

### 阶段 4：本地证据完成，真机与实物证据待补
- [x] **三大本地模拟集成场景验证**：
  1. *A4 展签尺寸协商*：两张 A4、8 个 105×70 展签，原尺寸用 2 张，宽度微缩 1 mm（104×70）仅用 1 张；执行后精准扣减 1 张，另一张完好保留；实测余料成功入库。
  2. *模型面板锁定与装饰件微调*：底座主面板在所有候选方案中长宽严格不变，装饰件按设定范围微调。
  3. *实测余料二次复用*：前序任务存入的实测余料，在下次新制作任务中作为原料成功被选出并切出新零件。
- [x] **阶段性自动化回归**：当时 21 个测试文件、110 项单元/集成测试全部通过；此数字为历史基线。阶段 5 扩展后，当前基线为 34 个测试文件、233 项测试通过。测试通过率不代表代码覆盖率或全部真机验收。
- [x] **TypeScript 类型安全**：全局 `npx tsc` 0 报错。

---

## 3. 测试覆盖与验收记录
- **测试框架**：Vitest v2.1.9
- **测试文件总数**：40 passed (40)
- **用例总数**：266 passed (266)
- **已执行用例通过率**：100% (266/266)
- **真实云端自动化证据**：A4 案例已在正式云环境进入方案比较页，并选择 1 张材料方案进入 9 步裁切图；控制台无运行错误。
- **证据边界**：真实 CloudBase 事务冲突、两部真机公网访问和实物裁切效果仍需人工验收。
- **重点套件**：
  - `tests/integration/e2e-campus-scenarios.test.ts`：三大手工场景的本地模拟完整流程。
  - `tests/integration/stage2-execution-inventory.test.ts`：库存单一消耗、实测余料超限拦截、幂等重试及事务并发冲突校验。
  - `tests/integration/select-plan.test.ts`：方案接受与服务端独立核验。
  - `tests/unit/compare-data-adapter.test.ts`：比较页真实字段访问与单柔性组规则拦截。
  - `tests/unit/compare-selection-flow.test.ts`：云端确认失败时禁止进入执行流程。
  - `tests/unit/campus-scope-boundary.test.ts`：首版不打包已冻结的工业与工厂页面。

---

## 4. 上线前剩余事项
1. **开发版本**：修复版 `1.0.4` 已上传微信后台（2026-09-20）；提交审核和最终发布仍需在微信公众平台完成。
2. **人工验收**：两部真机、不同公网网络、三组实物制作及评委访问方式仍需完成并留证。

---

## 5. 2026-09-20 接力修复记录（阶段 5）

- [x] **恢复官方编译**：修复 `history.ts` 语法错误；此前 Vitest 与根级 TypeScript 检查没有覆盖小程序页面，导致微信开发者工具无法注册页面。现在根级 `typecheck` 会额外检查全部小程序 TypeScript，`build` 会重新生成页面 JavaScript。
- [x] **图形工作台真实可用**：参数模板和自由绘制已通过开发者工具自动化；修复触控坐标与画布缩放不一致的问题，节点拖动按当前视图变换回真实几何坐标。
- [x] **图片辅助录入去除占位实现**：删除选择任意图片后返回固定五边形的演示代码，改为读取真实像素、依据边缘背景与阈值生成二值图、提取轮廓、按用户输入的主体实际宽度换算尺寸，再进入节点微调。
- [x] **项目保存闭环**：新建或打开工程后，需求页会载入对应零件；尺寸、数量、旋转和新增异形零件变更会自动保存到云端，失败时保留本地草稿并显示同步状态。
- [x] **私人项目隔离**：项目查询、读取、保存、复制、重命名和删除均以当前 `OPENID` 校验所有权，不再按团队字段共享私人项目。
- [x] **正式云环境修复**：`api` 云函数已重新部署并恢复 `wx-server-sdk`；首次创建工程时可自动初始化缺失的 `projects` 集合。真实云端自动化已验证“创建工程—编辑零件—自动保存—重新读取—删除测试数据”。
- [x] **阶段 5 自动化基线**：当时 34 个测试文件、233 项测试全部通过；构建、页面类型检查、官方预览编译、真实云端演示求解、候选确认、裁切导航和异形工作台均通过。阶段 6 扩展后为 35 个测试文件、244 项测试。

仍需人工完成：在真机相册分别选择高对比纸样和复杂背景图片，记录轮廓提取效果并微调阈值；使用两部手机和不同网络完成公网访问测试；完成至少三组实物裁切并留存照片、耗材测量和异常案例。

---

## 6. 2026-09-20 最终接力执行与版本发布记录（阶段 6）

### （一）核心修复与能力增强
- [x] **工作台多边形自相交与退化拦截**：在 `workbench.ts` 的 `confirmShape` 方法中增加 `isPolygonSelfIntersecting` 与 `area <= 0` 严格前置校验，杜绝自相交（Bowtie）或退化图形存入零件清单，并在 UI 触发清晰拦截提示。
- [x] **未完成图片提取与SVG解析拦截强化**：显式拦截在 `photo` 或 `svg` Tab 下未完成解析直接确认的情况，杜绝残留点与占位点非法混入零件库。
- [x] **窗口信息 API 更新**：在 `workbench.ts` 与 `cut-view.ts` 中优先使用 `wx.getWindowInfo`，仅为旧基础库保留 `wx.getSystemInfoSync` 兼容回退；当前基础库路径不再触发弃用警告。
- [x] **图形录入三模态核心测试全量覆盖**：在 `tests/unit/workbench-modes-verification.test.ts` 中全面覆盖 9 种模板几何参数（矩形、圆形、L形、圆角矩形、椭圆、三角形、正多边形、拱门、星形）、自由绘制（吸附、增点、撤销重做、自交拦截）及图片二值化真实轮廓与物理换算逻辑。全量测试扩展至 35 个测试套件、244 项测试 100% 通过。
- [x] **端到端自动化脚本健壮性重构**：修复 `verify-irregular-automator.cjs` 与 `verify-full-flow-cloud.cjs` 中由于路由栈异步切换、`pageMap` 缓存旧 Page 实例及页面重载引起的时序竞争与超时问题，全面采用动态路由侦听与上下文刷新。
- [x] **隐私合规与图片本地化核查**：确认 `wx.chooseMedia` 仅在 `workbench.ts` 中通过 Canvas 2D 进行纯本地像素读取与轮廓解析，全工程无图片上传云端接口，符合“图片仅用于本地轮廓提取，不上传原图”的审核指引。

### （二）自动化与云端回归证据
1. **微信开发者工具官方编译与预览**：
   - 预览命令：`cli.bat preview`（退出码 0，主包体积 563.6 KB / 577114 Byte）
   - 证据文件：`artifacts/antigravity-preview.png`、`artifacts/antigravity-preview-info.json`
2. **真实 CloudBase 四大脚本自动化**：
   - `scripts/verify-demo-cloud.cjs`：A4 展签 1 mm 柔性协商（2 张 -> 1 张材料，利用率 92.48%）通过。
   - `scripts/verify-select-cloud.cjs`：云端方案确认并进入 8 步裁切指导通过。
   - `scripts/verify-project-cloud.cjs`：云端工程自动保存、零件重新读取与测试数据清理通过。
   - `scripts/verify-irregular-automator.cjs`：L 形模板 PROFILE 异形排料与分步裁切指导全部通过（退出码 0）。
3. **工作台交互与全流程端到端自动化**：
   - `scripts/verify-workbench-automator.cjs`：参数模板切换、自相交多边形拦截、撤销重做交互全部通过（退出码 0）。
   - `scripts/verify-full-flow-cloud.cjs`：首次用户视角“首页演示 -> 需求 -> 微调 -> 求解 -> 方案选择 -> 裁切指导 -> 实测余料登记”完整闭环通过（退出码 0）。
   - 证据截图：`artifacts/flow-01-index.png` 至 `flow-06-finish.png`、`artifacts/workbench-01-initial.png` 至 `workbench-07-projects.png`。

### （三）版本发布状态
- **开发版本**：已上传 `1.0.4`（版本描述：“修复A/B/C图形录入入口、模板点绘和拍照纸样识别”，退出码 0，体积 1600797 Byte / 1.5 MB）。
- **上传记录证据**：`artifacts/upload-1.0.4.json`。
- **发布状态界定**：
  - `已上传开发版`：`1.0.4`（已完成）
  - `已提交审核`：待微信公众平台后台点击提交
  - `审核通过`：待平台审核结果
  - `已发布`：待发布上线

### （四）遗留人工项
1. 在微信公众平台后台将开发版本 `1.0.4` 提交审核，类目建议选择最接近的“工具/效率”项，隐私说明填写“仅用于本地轮廓提取，不上传原图”。
2. 真机相册实拍验证：分别选择高对比纸样和复杂背景实物图测试，体验节点拖拽校正。
3. 真实双机网络访问与实物纸板/木板裁切验证。

---

## 7. 2026-09-20 全量真实验收与版本发布准备结论（Milestones M1 - M4）

### （一）Milestone M1：核心构建、基线测试与产物同步 (R1)
- **类型检查**：`npm run typecheck` 退出码 0，包含根级与 `miniprogram/tsconfig.json` 全量检查，0 错误 0 警告。
- **单元与集成测试**：`npm test` 全量通过（36 个测试套件，247 项用例全部绿灯，用时 7.18s），覆盖边界、几何逆向应力、单柔性微调、SaaS 租户隔离并发与真实手工场景。
- **构建与产物同步**：`npm run build` 执行成功，`packages/core` 编译生成并完整同步至 `miniprogram/utils/core/` 与 `cloudfunctions/api/core_module/`（含 `cloudfunctions/api/core.js` CommonJS 打包）。
- **零硬编码审计**：排料求解器（Guillotine 24 策略与 PROFILE 栅格启发式）、API 及前端页面完全基于实际数学计算，无假数据冒充，无任何硬编码利用率（如 92.48% 系 296x209 裁切 1220x2440 板材的真实计算结果）、板材数或排料坐标。

### （二）Milestone M2：开发者工具官方预览与云端自动化端到端回归 (R2, R3)
- **DevTools CLI 官方编译预览**：
  - 执行命令：`& "D:\微信web开发者工具\cli.bat" preview --project "D:\Codex\computerapp" --info-output "D:\Codex\computerapp\artifacts\antigravity-preview-info.json" --qr-output "D:\Codex\computerapp\artifacts\antigravity-preview.png"`
  - 退出码：0
  - 产出物：`artifacts/antigravity-preview.png`（46,179 字节，有效二维码）与 `artifacts/antigravity-preview-info.json`（主包体积 563.6 KB / 577,114 Byte）。
- **四大自动化回归脚本顺序执行存证**：
  1. `node scripts/verify-demo-cloud.cjs`：A4 展签微调 1mm 协商（2 张板材优化为 1 张，真实利用率 92.48%，10 步直线分割，放置 8 个展签），退出码 0，生成 `artifacts/debug-demo-result.png`。
  2. `node scripts/verify-select-cloud.cjs`：云端方案确认，持久化至 plans 集合，进入裁切指导（8 步裁切工序，生成 2100×90mm 实测余料预测，工具提示“钢直尺 + 重型美工刀”），退出码 0，生成 `artifacts/debug-cut-view.png`。
  3. `node scripts/verify-project-cloud.cjs`：云端工程新建、防抖自动保存（`saveState: "已自动保存到云端"`）、尺寸持久化（880×420 0.1mm 整数）与测试数据清理闭环，退出码 0。
  4. `node scripts/verify-irregular-automator.cjs`：工作台 L 形模板参数录入、自由绘制吸附与画板交互、进入 PROFILE 启发式排料及裁切步骤，退出码 0，生成 `artifacts/workbench-01-initial.png` 至 `workbench-07-projects.png`。

### （三）Milestone M3：三种图形录入、UI全流程交互走查与隐私审核合规 (R4, R5)
- **三种图形录入模式**：
  - 参数模板：支持 9 种几何形状（RECT, CIRCLE, L_SHAPE 等），Canvas 2D 实时预览，尺寸/面积与顶点数严格同步。
  - 自由点绘：支持 45° 角度吸附、撤销/重做历史栈、节点拖拽及实时自相交（isPolygonSelfIntersecting）拦截提示。
  - 图片辅助：纯前端 Canvas ImageData 提取二值像素与 Moore 邻域轮廓，输入主体物理宽度按比例换算并 Douglas-Peucker 精简，进入节点校准。
- **六步主链路闭环走查**：
  - 完整闭环：“登记材料 → 录入零件 → 比较方案 → 选择方案 → 裁切指导 → 登记实测余料”。
  - 证据留存：`artifacts/flow-01-index.png` 至 `flow-06-finish.png`。
- **隐私审核合规**：
  - 全工程代码审计：业务代码中 `wx.uploadFile` 与 `wx.cloud.uploadFile` 调用次数为 0。
  - 图片文件仅在本地内存与临时文件中处理，完全不上传原图至任何服务器或云存储。

### （四）Milestone M4：版本发布与交付物归档 (R6)
- **开发版上传**：
  - 执行命令：`& "D:\微信web开发者工具\cli.bat" upload --project "D:\Codex\computerapp" -v 1.0.4 -d "修复A/B/C图形录入入口、模板点绘和拍照纸样识别" --info-output "D:\Codex\computerapp\artifacts\upload-1.0.3.json"`
  - 退出码：0
  - 上传产物：`artifacts/upload-1.0.4.json`（总体积 1,600,797 Byte / 1.5 MB）。
- **发布状态**：
  - 已上传开发版：`1.0.4`（已完成）
# 《巧裁》项目开发进度与技术决策记录

## 1. 项目基本信息
- **作品全称**：巧裁——面向校园手工与模型制作的余料复用及可调整尺寸排料助手
- **核心定位**：输入材料与制作需求，在用户明确允许的范围内比较尺寸和用料方案，按照分割步骤制作，再将实测余料留给下一次任务。
- **技术栈**：微信原生小程序（TypeScript、WXML、WXSS、TDesign、Canvas 2D）、微信云开发（Node.js 云函数、云数据库、事务操作）。
- **开发约束**：
  - 内部长度统一采用 0.1 mm 整数（如 104 mm 存储为 1040），禁止浮点几何运算与静默四舍五入。
  - 二维矩形排料采用自编 24 策略确定性直线分割（Guillotine Cut Tree）。
  - 核心求解器为纯函数无网络依赖，与独立几何校验器（Validator）严格解耦。
  - 演示案例与算法真实计算产生，绝无硬编码。
  - 首版收缩专注校园手工场景，不堆砌未闭环的工业制造与商业 ERP 噱头。

---

## 2. 阶段完成情况

### 阶段 1：修复输入到方案展示（已完成）
- [x] **比较页字段结构统一**：修复 `compare.ts` 与 `cut-view.ts` 中错误的 `us.stock.width` 访问，统一直接读取 `UsedStockPlan` 内部的 `us.width` 与 `us.height`，杜绝运行时异常。
- [x] **单柔性组约束与微调交互**：重构 `flex.ts` 与 `flex.wxml`，默认所有零件组锁定，最多允许指定一个组进行宽度微缩（0, 1, 2 mm），高度与数量保持锁定。
- [x] **产品范围收缩**：撤下模拟语音录制、拍照 OCR、封边配置、SaaS 工厂横幅、CNC G-Code、AutoCAD DXF 及电子印章。早期未闭环的非矩形入口曾暂时撤下；在阶段 5 完成真实模板、自由绘制、图片轮廓提取、PROFILE 排料与独立校验后，异形能力重新进入正式主流程。
- [x] **服务端方案候选确认 (`selectPlan`)**：云端实现方案接受状态持久化与完整性独立校验。

### 阶段 2：修复库存与余料（本地实现及模拟集成测试完成）
- [x] **严格仅消耗实际使用材料**：`commitExecution` 仅扣减选中候选方案中 `usedStocks` 所包含的材料，输入库存池中未使用的材料保持可用，绝不误扣。
- [x] **稳定幂等机制**：以 `idemp_{planId}_{candidateId}` 为键，抵御网络重试与重复点击，防并发争用。
- [x] **实测余料登记与属性继承**：`finish.ts` 提供用户用直尺量取后的实际长宽输入，校验实测值不超过预测可用区域，自动从来源板材继承材质、厚度与颜色。
- [x] **事务安全与补偿保护**：生产路径使用 `db.runTransaction`；本地模拟环境验证了库存扣减、余料创建与执行记录的一致性。真实云环境的事务冲突与回滚仍需部署后验证。
- [x] **服务端余料边界**：客户端只提交预测余料区域编号和实测尺寸；服务端从已保存候选读取真实预测范围，拒绝篡改范围或重复引用。

### 阶段 3：产品收缩完成，正式云环境已部署
- [x] **真实模式与模拟模式严格隔离**：`cloud-adapter.ts` 在检测到真实 `wx.cloud` 调用失败时，严格向前端抛出真实网络/云端异常，禁止静默转入内存假数据。
- [x] **删除默认假数据冒充**：彻底移除 88.5%、89.2% 等无依据默认指标，所有利用率、零件数均来自实际方案。
- [x] **规则辅助文本提取**：文本提取标明“规则辅助解析”，遵守单位与规范，默认关闭零件旋转。
- [x] **服务端冗余动作冻结**：已退出首版的工业接口在云端明确停用或保留隔离，不干扰核心手工排料主流程。
- [x] **首版打包边界**：工厂模拟及缺陷标注页面已从 `app.json` 移除，材料库和裁切向导不再展示 SaaS、CNC 或 DXF。当前正式主流程保留面向校园手工的规则模板、自由绘制、图片辅助和 SVG 图形录入。
- [x] **正式环境配置**：AppID `wx4024c822e432111f`，云环境 `cloud1-d5gnrj8plf8520129`；`api` 云函数已部署并处于 Active 状态（Nodejs16.13）。
- [x] **核心数据库集合已创建**：`users`、`stocks`、`plans`、`executions` 均已建立，并设置为仅允许云函数管理数据。
- [x] **真实云端主流程联调**：开发者工具自动化已通过真实 `wx.cloud.callFunction` 完成演示材料准备、需求载入、尺寸微调、云端求解、方案比较、服务端方案确认及裁切图导航；真实事务冲突、两部真机公网访问仍待人工验收。
- [x] **部署包兼容修复**：核心算法打包为云函数根目录 `core.js`，解决 Nodejs16.13 运行时找不到 `@qiaocai/core` 与嵌套构建文件的问题。
- [x] **首次使用体验重构**：首页改为“登记材料—填写零件—比较方案”三步引导，并提供会自动准备 A4 材料的快速案例。

### 阶段 4：本地证据完成，真机与实物证据待补
- [x] **三大本地模拟集成场景验证**：
  1. *A4 展签尺寸协商*：两张 A4、8 个 105×70 展签，原尺寸用 2 张，宽度微缩 1 mm（104×70）仅用 1 张；执行后精准扣减 1 张，另一张完好保留；实测余料成功入库。
  2. *模型面板锁定与装饰件微调*：底座主面板在所有候选方案中长宽严格不变，装饰件按设定范围微调。
  3. *实测余料二次复用*：前序任务存入的实测余料，在下次新制作任务中作为原料成功被选出并切出新零件。
- [x] **阶段性自动化回归**：当时 21 个测试文件、110 项单元/集成测试全部通过；此数字为历史基线。阶段 5 扩展后，当前基线为 34 个测试文件、233 项测试通过。测试通过率不代表代码覆盖率或全部真机验收。
- [x] **TypeScript 类型安全**：全局 `npx tsc` 0 报错。

---

## 3. 测试覆盖与验收记录
- **测试框架**：Vitest v2.1.9
- **测试文件总数**：40 passed (40)
- **用例总数**：266 passed (266)
- **已执行用例通过率**：100% (266/266)
- **真实云端自动化证据**：A4 案例已在正式云环境进入方案比较页，并选择 1 张材料方案进入 9 步裁切图；控制台无运行错误。
- **证据边界**：真实 CloudBase 事务冲突、两部真机公网访问和实物裁切效果仍需人工验收。
- **重点套件**：
  - `tests/integration/e2e-campus-scenarios.test.ts`：三大手工场景的本地模拟完整流程。
  - `tests/integration/stage2-execution-inventory.test.ts`：库存单一消耗、实测余料超限拦截、幂等重试及事务并发冲突校验。
  - `tests/integration/select-plan.test.ts`：方案接受与服务端独立核验。
  - `tests/unit/compare-data-adapter.test.ts`：比较页真实字段访问与单柔性组规则拦截。
  - `tests/unit/compare-selection-flow.test.ts`：云端确认失败时禁止进入执行流程。
  - `tests/unit/campus-scope-boundary.test.ts`：首版不打包已冻结的工业与工厂页面。

---

## 4. 上线前剩余事项
1. **开发版本**：修复版 `1.0.4` 已上传微信后台（2026-09-20）；提交审核和最终发布仍需在微信公众平台完成。
2. **人工验收**：两部真机、不同公网网络、三组实物制作及评委访问方式仍需完成并留证。

---

## 5. 2026-09-20 接力修复记录（阶段 5）

- [x] **恢复官方编译**：修复 `history.ts` 语法错误；此前 Vitest 与根级 TypeScript 检查没有覆盖小程序页面，导致微信开发者工具无法注册页面。现在根级 `typecheck` 会额外检查全部小程序 TypeScript，`build` 会重新生成页面 JavaScript。
- [x] **图形工作台真实可用**：参数模板和自由绘制已通过开发者工具自动化；修复触控坐标与画布缩放不一致的问题，节点拖动按当前视图变换回真实几何坐标。
- [x] **图片辅助录入去除占位实现**：删除选择任意图片后返回固定五边形的演示代码，改为读取真实像素、依据边缘背景与阈值生成二值图、提取轮廓、按用户输入的主体实际宽度换算尺寸，再进入节点微调。
- [x] **项目保存闭环**：新建或打开工程后，需求页会载入对应零件；尺寸、数量、旋转和新增异形零件变更会自动保存到云端，失败时保留本地草稿并显示同步状态。
- [x] **私人项目隔离**：项目查询、读取、保存、复制、重命名和删除均以当前 `OPENID` 校验所有权，不再按团队字段共享私人项目。
- [x] **正式云环境修复**：`api` 云函数已重新部署并恢复 `wx-server-sdk`；首次创建工程时可自动初始化缺失的 `projects` 集合。真实云端自动化已验证“创建工程—编辑零件—自动保存—重新读取—删除测试数据”。
- [x] **阶段 5 自动化基线**：当时 34 个测试文件、233 项测试全部通过；构建、页面类型检查、官方预览编译、真实云端演示求解、候选确认、裁切导航和异形工作台均通过。阶段 6 扩展后为 35 个测试文件、244 项测试。

仍需人工完成：在真机相册分别选择高对比纸样和复杂背景图片，记录轮廓提取效果并微调阈值；使用两部手机和不同网络完成公网访问测试；完成至少三组实物裁切并留存照片、耗材测量和异常案例。

---

## 6. 2026-09-20 最终接力执行与版本发布记录（阶段 6）

### （一）核心修复与能力增强
- [x] **工作台多边形自相交与退化拦截**：在 `workbench.ts` 的 `confirmShape` 方法中增加 `isPolygonSelfIntersecting` 与 `area <= 0` 严格前置校验，杜绝自相交（Bowtie）或退化图形存入零件清单，并在 UI 触发清晰拦截提示。
- [x] **未完成图片提取与SVG解析拦截强化**：显式拦截在 `photo` 或 `svg` Tab 下未完成解析直接确认的情况，杜绝残留点与占位点非法混入零件库。
- [x] **窗口信息 API 更新**：在 `workbench.ts` 与 `cut-view.ts` 中优先使用 `wx.getWindowInfo`，仅为旧基础库保留 `wx.getSystemInfoSync` 兼容回退；当前基础库路径不再触发弃用警告。
- [x] **图形录入三模态核心测试全量覆盖**：在 `tests/unit/workbench-modes-verification.test.ts` 中全面覆盖 9 种模板几何参数（矩形、圆形、L形、圆角矩形、椭圆、三角形、正多边形、拱门、星形）、自由绘制（吸附、增点、撤销重做、自交拦截）及图片二值化真实轮廓与物理换算逻辑。全量测试扩展至 35 个测试套件、244 项测试 100% 通过。
- [x] **端到端自动化脚本健壮性重构**：修复 `verify-irregular-automator.cjs` 与 `verify-full-flow-cloud.cjs` 中由于路由栈异步切换、`pageMap` 缓存旧 Page 实例及页面重载引起的时序竞争与超时问题，全面采用动态路由侦听与上下文刷新。
- [x] **隐私合规与图片本地化核查**：确认 `wx.chooseMedia` 仅在 `workbench.ts` 中通过 Canvas 2D 进行纯本地像素读取与轮廓解析，全工程无图片上传云端接口，符合“图片仅用于本地轮廓提取，不上传原图”的审核指引。

### （二）自动化与云端回归证据
1. **微信开发者工具官方编译与预览**：
   - 预览命令：`cli.bat preview`（退出码 0，主包体积 563.6 KB / 577114 Byte）
   - 证据文件：`artifacts/antigravity-preview.png`、`artifacts/antigravity-preview-info.json`
2. **真实 CloudBase 四大脚本自动化**：
   - `scripts/verify-demo-cloud.cjs`：A4 展签 1 mm 柔性协商（2 张 -> 1 张材料，利用率 92.48%）通过。
   - `scripts/verify-select-cloud.cjs`：云端方案确认并进入 8 步裁切指导通过。
   - `scripts/verify-project-cloud.cjs`：云端工程自动保存、零件重新读取与测试数据清理通过。
   - `scripts/verify-irregular-automator.cjs`：L 形模板 PROFILE 异形排料与分步裁切指导全部通过（退出码 0）。
3. **工作台交互与全流程端到端自动化**：
   - `scripts/verify-workbench-automator.cjs`：参数模板切换、自相交多边形拦截、撤销重做交互全部通过（退出码 0）。
   - `scripts/verify-full-flow-cloud.cjs`：首次用户视角“首页演示 -> 需求 -> 微调 -> 求解 -> 方案选择 -> 裁切指导 -> 实测余料登记”完整闭环通过（退出码 0）。
   - 证据截图：`artifacts/flow-01-index.png` 至 `flow-06-finish.png`、`artifacts/workbench-01-initial.png` 至 `workbench-07-projects.png`。

### （三）版本发布状态
- **开发版本**：已上传 `1.0.4`（版本描述：“修复A/B/C图形录入入口、模板点绘和拍照纸样识别”，退出码 0，体积 1600797 Byte / 1.5 MB）。
- **上传记录证据**：`artifacts/upload-1.0.4.json`。
- **发布状态界定**：
  - `已上传开发版`：`1.0.4`（已完成）
  - `已提交审核`：待微信公众平台后台点击提交
  - `审核通过`：待平台审核结果
  - `已发布`：待发布上线

### （四）遗留人工项
1. 在微信公众平台后台将开发版本 `1.0.4` 提交审核，类目建议选择最接近的“工具/效率”项，隐私说明填写“仅用于本地轮廓提取，不上传原图”。
2. 真机相册实拍验证：分别选择高对比纸样和复杂背景实物图测试，体验节点拖拽校正。
3. 真实双机网络访问与实物纸板/木板裁切验证。

---

## 7. 2026-09-20 全量真实验收与版本发布准备结论（Milestones M1 - M4）

### （一）Milestone M1：核心构建、基线测试与产物同步 (R1)
- **类型检查**：`npm run typecheck` 退出码 0，包含根级与 `miniprogram/tsconfig.json` 全量检查，0 错误 0 警告。
- **单元与集成测试**：`npm test` 全量通过（36 个测试套件，247 项用例全部绿灯，用时 7.18s），覆盖边界、几何逆向应力、单柔性微调、SaaS 租户隔离并发与真实手工场景。
- **构建与产物同步**：`npm run build` 执行成功，`packages/core` 编译生成并完整同步至 `miniprogram/utils/core/` 与 `cloudfunctions/api/core_module/`（含 `cloudfunctions/api/core.js` CommonJS 打包）。
- **零硬编码审计**：排料求解器（Guillotine 24 策略与 PROFILE 栅格启发式）、API 及前端页面完全基于实际数学计算，无假数据冒充，无任何硬编码利用率（如 92.48% 系 296x209 裁切 1220x2440 板材的真实计算结果）、板材数或排料坐标。

### （二）Milestone M2：开发者工具官方预览与云端自动化端到端回归 (R2, R3)
- **DevTools CLI 官方编译预览**：
  - 执行命令：`& "D:\微信web开发者工具\cli.bat" preview --project "D:\Codex\computerapp" --info-output "D:\Codex\computerapp\artifacts\antigravity-preview-info.json" --qr-output "D:\Codex\computerapp\artifacts\antigravity-preview.png"`
  - 退出码：0
  - 产出物：`artifacts/antigravity-preview.png`（46,179 字节，有效二维码）与 `artifacts/antigravity-preview-info.json`（主包体积 563.6 KB / 577,114 Byte）。
- **四大自动化回归脚本顺序执行存证**：
  1. `node scripts/verify-demo-cloud.cjs`：A4 展签微调 1mm 协商（2 张板材优化为 1 张，真实利用率 92.48%，10 步直线分割，放置 8 个展签），退出码 0，生成 `artifacts/debug-demo-result.png`。
  2. `node scripts/verify-select-cloud.cjs`：云端方案确认，持久化至 plans 集合，进入裁切指导（8 步裁切工序，生成 2100×90mm 实测余料预测，工具提示“钢直尺 + 重型美工刀”），退出码 0，生成 `artifacts/debug-cut-view.png`。
  3. `node scripts/verify-project-cloud.cjs`：云端工程新建、防抖自动保存（`saveState: "已自动保存到云端"`）、尺寸持久化（880×420 0.1mm 整数）与测试数据清理闭环，退出码 0。
  4. `node scripts/verify-irregular-automator.cjs`：工作台 L 形模板参数录入、自由绘制吸附与画板交互、进入 PROFILE 启发式排料及裁切步骤，退出码 0，生成 `artifacts/workbench-01-initial.png` 至 `workbench-07-projects.png`。

### （三）Milestone M3：三种图形录入、UI全流程交互走查与隐私审核合规 (R4, R5)
- **三种图形录入模式**：
  - 参数模板：支持 9 种几何形状（RECT, CIRCLE, L_SHAPE 等），Canvas 2D 实时预览，尺寸/面积与顶点数严格同步。
  - 自由点绘：支持 45° 角度吸附、撤销/重做历史栈、节点拖拽及实时自相交（isPolygonSelfIntersecting）拦截提示。
  - 图片辅助：纯前端 Canvas ImageData 提取二值像素与 Moore 邻域轮廓，输入主体物理宽度按比例换算并 Douglas-Peucker 精简，进入节点校准。
- **六步主链路闭环走查**：
  - 完整闭环：“登记材料 → 录入零件 → 比较方案 → 选择方案 → 裁切指导 → 登记实测余料”。
  - 证据留存：`artifacts/flow-01-index.png` 至 `flow-06-finish.png`。
- **隐私审核合规**：
  - 全工程代码审计：业务代码中 `wx.uploadFile` 与 `wx.cloud.uploadFile` 调用次数为 0。
  - 图片文件仅在本地内存与临时文件中处理，完全不上传原图至任何服务器或云存储。

### （四）Milestone M4：版本发布与交付物归档 (R6)
- **开发版上传**：
  - 执行命令：`& "D:\微信web开发者工具\cli.bat" upload --project "D:\Codex\computerapp" -v 1.0.4 -d "修复A/B/C图形录入入口、模板点绘和拍照纸样识别" --info-output "D:\Codex\computerapp\artifacts\upload-1.0.3.json"`
  - 退出码：0
  - 上传产物：`artifacts/upload-1.0.4.json`（总体积 1,600,797 Byte / 1.5 MB）。
- **发布状态**：
  - 已上传开发版：`1.0.4`（已完成）
  - 已提交审核：待微信公众平台后台操作
  - 审核通过：待微信审核
  - 已发布：待发布上线

---

## 8. 2026-09-21 AI 制作智能体 1.1.0 实施记录

### （一）已完成

- [x] `api` 云函数线上超时为20秒，运行时为 Nodejs16.13，状态 Active。
- [x] 云函数模型环境变量固定为 `QIAOCAI_AGENT_MODEL=deepseek-v4-flash`，本地 `cloudbaserc.json` 与线上一致。
- [x] 智能体合同、会话、四个只读工具、结构化清洗、独立求解校验、人工确认和规则降级均已实现并部署。
- [x] 端到端脚本新增严格验收门：默认必须同时满足真实模型、Token usage、四个只读工具、`validationPassed=true` 和人工确认；降级链路只能记录为 "DEGRADED_FALLBACK_VERIFIED"，不能再输出"真实 AI 全部通过"。
- [x] 2026年9月21日全量测试：40个测试文件、266项测试全部通过；`npm run build` 成功。
- [x] 微信开发者工具官方 preview 成功，主包 595.2 KB（609448 Byte），产物为 `artifacts/preview-1.1.0-final.png` 与 `artifacts/preview-1.1.0-final.json`。
- [x] 1.1.0 已上传为微信开发版本，上传包 1.6 MB（1625974 Byte），记录为 `artifacts/upload-1.1.0.json`；未提交审核、未正式发布。

### （二）CloudBase AI+ 真实状态

- `DescribeAIModels` 显示 `cloudbase` 文本模型组存在且已开启，但 `Models` 为空；此前直接调用混元和 DeepSeek 均返回 HTTP 429。
- 官方目录确认 `deepseek-v4-flash` 支持工具调用与结构化输出，当前目录价格为输入1元/百万Token、输出2元/百万Token。
- 调用 `UpdateAIModel` 启用模型时，腾讯云返回 `FailedOperation.PackageUnsupported`，明确提示"当前环境的套餐不支持，请升级到标准版及以上套餐"。因此真实模型多工具调用验收尚未通过。
- 降级自动化完成三轮对话、人工核对、正式确定性求解、方案比较和裁切页，控制台无未捕获异常；证据文件 `artifacts/agent-e2e-evidence.json` 的状态为 "DEGRADED_FALLBACK_VERIFIED"。

### （三）仍需完成

1. 由账号持有人决定是否将 CloudBase 个人版升级到标准版或以上；升级后启用 `deepseek-v4-flash`。
2. 重新运行默认严格模式 `node scripts/verify-agent-automator.cjs`，必须获得真实 Token usage、四个工具顺序和 `validationPassed=true` 后才能写入"真实 AI 验收通过"。
3. 完成两部真机公网测试、A4与KT板实物实验和三名非开发成员体验记录；这些内容仍标记为"待真人执行"。

---

## 9. 2026-09-21 Gemini 接力修复记录（DeepSeek 直连阻塞排查）

### （一）已完成

- [x] **接力现场保护**：确认 7 个未提交文件完整（含新增 `deepseek-provider.js`、`deepseek-provider.test.ts`），无冲突标记。
- [x] **根本原因定位**：本地数学复现测试证明求解器完全可行（2张A4 + 8个展签，`validationPassed=true`）；反向测试确认若材料以毫米（`210×297`）而非0.1mm整数（`2100×2970`）存储则求解失败，与线上表现一致。
- [x] **`prepareDemo` 单位修复**：增加旧演示材料单位检测（`width≤500` 判定为毫米值），自动删除并重建正确的 `2100×2970` 演示材料；只处理明确标记为 `demoKey=A4_BADGES_V1` 的演示数据，不影响真实用户材料。
- [x] **Step4 扩展诊断日志**：`solve_and_compare` 工具现在在服务端日志记录材料尺寸（用于核查单位）和每个候选的 `isComplete`、`unplacedCount`、`validationPassed`，UI 不展示敏感数据。
- [x] **Step5 JSON 稳定性**：强化 System Prompt 明确包含"json"字样和完整字段描述；新增4项 JSON 边界测试（空content、自然语言、Markdown包裹、工具调用后有效JSON）。
- [x] **模型 ID 更新**：`cloudbaserc.json` 中 `QIAOCAI_AGENT_MODEL` 更新为 `deepseek-flash`（与线上直连实际使用的模型一致）。
- [x] **全量测试**：42个测试文件，280项测试全部通过（较修复前增加12项新测试）；`npm run build` 成功。
- [x] **官方 Preview**：主包 595.2 KB（609448 Byte），退出码 0，产物 `artifacts/preview-1.1.0-deepseek.png` 与 `artifacts/preview-1.1.0-deepseek.json`。
- [x] **提交并推送**：提交哈希 `8aa2a26`，推送至 `origin/main`，全程无密钥（`sk-*` 扫描为0）。
- [x] **上传开发版**：版本 1.1.0，包体 1.6 MB（1625974 Byte），记录为 `artifacts/upload-1.1.0-deepseek.json`；未提交审核、未正式发布。

### （二）模型供应商与技术选型记录（准确陈述）

- **模型供应商**：DeepSeek 官方 API（`https://api.deepseek.com`）
- **实际模型 ID**：`deepseek-flash`
- **CloudBase 作用**：云函数（`api`）、数据库（`stocks`/`plans`等）、会话存储（`agent_sessions`）与小程序后端
- **当前未使用 CloudBase AI+ 托管模型**（`FailedOperation.PackageUnsupported`，个人版不支持）
- **上次真实 AI 调用实测**（2026-09-21）：provider=deepseek，model=deepseek-flash，aiGenerated=true，第三轮 Token=7898（prompt 7380 + completion 518）

### （三）仍需完成（严格端到端验收）

1. **运行严格端到端脚本**：`node scripts/verify-agent-automator.cjs`——必须满足 `validationPassed=true`（`prepareDemo` 修复后，线上演示材料将使用正确单位）。
2. **确认开发者工具自动化端口已开启**：`& 'D:\微信web开发者工具\cli.bat' auto --project 'D:\Codex\computerapp' --port 33560 --auto-port 9527 --trust-project`
3. 完成两部真机公网测试、A4与KT板实物实验和三名非开发成员体验记录；这些内容仍标记为"待真人执行"。
