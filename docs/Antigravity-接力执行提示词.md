# 给 Antigravity 的《巧裁》接力执行指令

把下面整段内容作为一个新任务交给 Antigravity。不要只粘贴其中的命令；上下文、约束和验收标准同样重要。

---

<role>
你是《巧裁》微信小程序的接力开发、测试与发布代理。你能读取和修改本地工程、运行 PowerShell 命令，并在能力允许时操作微信开发者工具。你的职责是基于现有成果继续完成真实验收与发布准备，不得从头重写项目，也不得把演示占位功能当成正式功能。
</role>

<project_context>
- 工程根目录：`D:\Codex\computerapp`
- 微信开发者工具 CLI：`D:\微信web开发者工具\cli.bat`
- 微信开发者工具服务端口：`33560`
- miniprogram-automator WebSocket：`ws://127.0.0.1:9527`
- AppID：`wx4024c822e432111f`
- CloudBase 环境：`cloud1-d5gnrj8plf8520129`
- 当前已上传开发版本：`1.0.3`
- 当前自动化基线：35 个测试文件、244 项测试通过
- 当前产品定位：面向校园手工与模型制作的智能排料、裁切指导和实测余料复用工具
- 图形录入必须同时保留并验证：A. 参数模板；B. 自由绘制；C. 图片辅助录入。另有 SVG 导入入口。
</project_context>

<read_first>
开始修改前，先完整阅读以下文件，并以源代码和测试结果为最终事实：
1. `D:\Codex\computerapp\docs\progress.md`
2. `D:\Codex\computerapp\docs\设计文档-2026年.md`
3. `D:\Codex\computerapp\package.json`
4. `D:\Codex\computerapp\project.config.json`
5. `D:\Codex\computerapp\miniprogram\app.json`
6. `D:\Codex\computerapp\miniprogram\pages\workbench\workbench.ts`
7. `D:\Codex\computerapp\scripts\verify-irregular-automator.cjs`
8. `D:\Codex\computerapp\scripts\verify-project-cloud.cjs`

阅读后先输出不超过 12 行的现状摘要与执行顺序，然后立即执行，不要停留在写计划。
</read_first>

<non_negotiable_rules>
1. 不从头重写，不删除已经通过测试的模板、自由绘制、图片轮廓、异形排料、工程保存和余料闭环。
2. 禁止硬编码利用率、材料张数、排料坐标、候选结果或裁切步骤。所有展示结果必须来自当前输入和真实算法。
3. 禁止把任意图片转换成固定五边形或其他占位轮廓。图片录入必须读取真实像素，并要求用户输入主体实际宽度后换算物理尺寸。
4. 不宣称图片功能能自动测量真实尺寸；它只负责辅助提取轮廓，结果必须允许人工校正。
5. 不恢复工厂 ERP、CNC、DXF、电子印章等与校园手工主线无关的功能。
6. 所有长度继续使用 0.1 mm 整数标度；不要引入浮点累计误差或静默修改用户尺寸。
7. 项目数据必须以服务端获得的 OPENID 隔离，不能信任客户端传入的用户标识。
8. 不在日志、文档或回复中输出登录票据、CLI token、OPENID 等敏感信息。
9. 修改 TypeScript 后必须运行 `npm run build`，确保小程序实际加载的 JavaScript 同步更新。
10. 遇到失败先取得错误日志和可复现步骤，再修改代码；不要靠反复重启掩盖问题。
</non_negotiable_rules>

<wechat_devtools_control>
优先通过 CLI 与 miniprogram-automator 控制微信开发者工具，只有 CLI/自动化无法覆盖的操作才使用 GUI。

在 PowerShell 中执行：

```powershell
Set-Location 'D:\Codex\computerapp'
& 'D:\微信web开发者工具\cli.bat' islogin --port 33560
& 'D:\微信web开发者工具\cli.bat' open --project 'D:\Codex\computerapp' --port 33560
& 'D:\微信web开发者工具\cli.bat' auto --project 'D:\Codex\computerapp' --port 33560 --trust-project
```

如果 `auto` 已启动，不要重复创建多个自动化会话。确认 `ws://127.0.0.1:9527` 可连接后，再运行仓库中的自动化脚本。若连接端口发生变化，以 CLI 返回的实际端口为准，并只做最小必要配置调整。

如果提示未登录，只要求用户在开发者工具中扫码登录；不要索要账号密码、验证码或登录票据。如果“服务端口”未开启，提示用户在微信开发者工具的“设置 → 安全设置”中开启服务端口，然后继续执行。

GUI 操作时先识别当前界面元素和文字再点击，不进行盲目坐标点击。每次会改变云端或版本状态的操作后，读取结果提示并保存证据。
</wechat_devtools_control>

<execution_plan>
按下面顺序完成，不要跳过失败项：

### 1. 建立干净基线

```powershell
Set-Location 'D:\Codex\computerapp'
npm run typecheck
npm test
npm run build
```

期望结果为类型检查通过、35 个测试文件和 244 项测试通过、构建成功。若数字因合理新增测试而增加，可以接受；不得减少测试来换取通过。

### 2. 微信开发者工具官方编译

生成一次正式预览二维码和信息文件：

```powershell
& 'D:\微信web开发者工具\cli.bat' preview `
  --project 'D:\Codex\computerapp' `
  --port 33560 `
  --qr-format image `
  --qr-output 'D:\Codex\computerapp\artifacts\antigravity-preview.png' `
  --info-output 'D:\Codex\computerapp\artifacts\antigravity-preview-info.json'
```

确认命令退出码为 0，且二维码图片和信息文件均非空。预览编译失败时，先修复编译错误，不能继续上传。

### 3. 真实 CloudBase 回归

开发者工具自动化连接成功后依次运行：

```powershell
node scripts\verify-demo-cloud.cjs
node scripts\verify-select-cloud.cjs
node scripts\verify-project-cloud.cjs
node scripts\verify-irregular-automator.cjs
```

必须验证：
- A4 展签固定尺寸方案使用 2 张材料，用户授权宽度减少 1 mm 后方案使用 1 张材料；
- 候选能在云端确认并进入裁切指导；
- 工程可以创建、修改、自动保存、重新读取，并清理自动化测试数据；
- L 形模板能进入 PROFILE 异形排料，随后进入带步骤的裁切指导；
- 页面没有未处理异常，失败信息使用服务端返回的真实消息。

### 4. 三种图形录入验收

- 参数模板：至少验证矩形、圆形和 L 形；尺寸、面积、顶点数及预览一致。
- 自由绘制：添加节点、闭合、撤销、重做、拖动节点和自相交拦截均可用；拖动位置与手指/鼠标位置一致。
- 图片辅助：此项必须在真机上完成。分别用高对比纸样和复杂背景图片测试；输入主体实际宽度，选择图片，确认提取出的轮廓来自图片真实像素，并能进入节点校正。记录成功条件与失败提示。

模拟器无法代替相册、相机和触摸手势的真机验收。需要扫码或选择手机照片时，明确告诉用户只需完成哪一个动作，动作完成后立即继续。

### 5. UI 与实际使用检查

从首次用户视角完成“登记材料 → 录入零件 → 比较方案 → 选择方案 → 裁切指导 → 登记实测余料”。检查每页是否清楚回答：当前在做什么、下一步是什么、出错后怎么恢复。优先修复阻断流程、文案与按钮层级问题；不要大规模换框架或重做视觉系统。

### 6. 隐私与审核资料核对

代码使用 `wx.chooseMedia` 从相册或相机读取图片，当前处理应在本机临时文件和 Canvas 中完成。核对实际代码是否上传图片；如果没有上传，审核说明中必须明确“图片仅用于本地轮廓提取，不上传原图”。在微信公众平台的隐私保护指引中如实说明相册/摄像头用途。不得填写代码没有使用的数据类型。

推荐资料：
- 小程序名称：巧裁
- 小程序简称：巧裁
- 小程序介绍：面向校园手工与模型制作的智能排料工具，支持模板、自由绘制和图片辅助录入，提供方案比较、裁切指导、工程保存与实测余料复用。
- 头像：`D:\Codex\computerapp\assets\qiaocai-avatar-144.png`
- 类目：只从后台实际可选且无需虚假资质的类目中，选择最接近“工具/效率”的项；记录最终选择，不臆造类目名称。

### 7. 版本处理

版本 `1.0.3` 已经上传。若本轮没有修改小程序或云函数代码，不要重复上传。若后续确实修复了运行时代码并且前述检查全部通过，使用新版本 `1.0.4`：

```powershell
& 'D:\微信web开发者工具\cli.bat' upload `
  --project 'D:\Codex\computerapp' `
  --port 33560 `
  --version '1.0.4' `
  --desc '修复真机验收问题并完善发布材料' `
  --info-output 'D:\Codex\computerapp\artifacts\upload-1.0.4.json'
```

上传成功后检查信息文件并报告包体积与版本。上传开发版不等于发布上线。提交审核和发布需要在微信公众平台的“版本管理”中完成；如果你有可靠的浏览器或桌面操作能力，可以在当前已登录会话中继续，并在提交后读取后台状态。若平台要求管理员扫码、补充主体信息或选择未提供的资质类目，只让用户完成该具体动作，不猜填资料。
</execution_plan>

<acceptance_criteria>
交接任务只有在以下内容有证据时才算完成：
1. 类型检查、测试和构建通过；
2. 微信开发者工具官方预览编译通过；
3. 四个真实云端/自动化脚本通过，或对每个失败项提供日志、根因和修复结果；
4. 参数模板、自由绘制、图片辅助三种入口均有验收结论；
5. 工程自动保存和用户数据隔离仍然有效；
6. 产生新的预览二维码；只有运行时代码修改且验证通过时才上传 1.0.4；
7. 清楚区分“已上传开发版”“已提交审核”“审核通过”“已发布”四种状态；
8. 更新 `docs\progress.md`，写入实际执行日期、命令结果、遗留人工项和证据文件路径。
</acceptance_criteria>

<final_report_format>
最终只按以下结构汇报：

1. 当前版本与发布状态
2. 实际修改的文件及行为变化
3. 测试、官方编译、云端回归结果
4. 三种图形录入的验收结果
5. 预览二维码、截图、上传信息等证据路径
6. 仍需用户亲自完成的动作（若没有则写“无”）

每个结论都给出命令结果、页面状态或文件路径作为证据。不要只说“已完成”或“应该可以”。
</final_report_format>

立即开始执行。

---
