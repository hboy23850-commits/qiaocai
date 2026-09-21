# 巧裁 QiaoCai

巧裁是面向校园手工、模型制作和社团物料制作的微信小程序。用户可以通过参数模板、自由绘制、图片辅助或 SVG 录入零件轮廓，登记已有材料，比较排料方案，并按分步指导完成裁切和实测余料回收。

## 核心能力

- 9 种参数化图形模板、自由点绘、图片轮廓提取和 SVG 导入
- 矩形 Guillotine 排料与多边形 PROFILE 排料
- 用户明确授权的尺寸微调与方案比较
- 独立几何验证，检查越界、重叠、间距、缺件和自相交
- 可执行的分步裁切指导和 100 mm 打印校准线
- CloudBase 工程自动保存、私人数据隔离和实测余料复用
- AI 制作智能体：自然语言需求补全、四个只读工具、独立校验、人工确认和明确降级

## 技术栈

- 微信原生小程序：TypeScript、WXML、WXSS、Canvas 2D、TDesign MiniProgram
- 微信云开发：Node.js 云函数、云数据库、事务和 OPENID 身份隔离
- 核心算法：TypeScript 纯函数包，同时构建到小程序端和云函数端
- 测试：Vitest、miniprogram-automator、微信开发者工具 CLI

## 开发与验证

```powershell
npm install
npm run typecheck
npm test
npm run build
```

当前验证基线为 40 个测试文件、266 项测试通过。`npm run build` 会编译核心算法，并同步生成小程序和云函数所需的产物。官方微信开发者工具已成功预览并上传 1.1.0 开发版。

使用微信开发者工具导入仓库根目录。项目 AppID 已写入 `project.config.json`；CloudBase 环境需要由有权限的开发者在微信开发者工具中登录后使用。

线上 `api` 云函数超时为 20 秒，模型环境变量固定为 `deepseek-v4-flash`。2026年9月21日的 CloudBase 预检发现个人版环境不能启用文本模型，腾讯云返回 `FailedOperation.PackageUnsupported`；当前智能体会明确进入 `DEGRADED` 并转人工核对。升级到标准版并启用模型前，不得把降级流程视为真实 AI 调用成功。

## 目录结构

- `packages/core/`：排料、几何、校验、裁切路径与余料算法
- `miniprogram/`：微信小程序页面、组件与客户端适配
- `cloudfunctions/api/`：CloudBase API 云函数
- `tests/`：单元、集成、边界和场景测试
- `scripts/`：构建、开发者工具自动化和参赛材料生成脚本
- `docs/`：设计文档、进度记录和实施说明

## 隐私说明

图片辅助功能只读取用户主动选择的临时图片，并在小程序 Canvas 中完成像素分析和轮廓提取。当前实现不上传原始图片。工程和材料数据通过服务端获取的 OPENID 隔离。

原创范围、第三方依赖及 AI 辅助说明见[原创与第三方代码说明](原创与第三方代码说明.md)。
