import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('A/B/C 图形录入的真实用户入口', () => {
  it('首页直接展示三种录入方式并通过点击进入工作台', () => {
    const wxml = read('miniprogram/pages/index/index.wxml');
    const ts = read('miniprogram/pages/index/index.ts');

    expect(wxml).toContain('形状模板');
    expect(wxml).toContain('模板＋点绘');
    expect(wxml).toContain('拍照识别纸样');
    expect(wxml).toContain('bind:tap="navToWorkbench"');
    expect(ts).toContain("'/pages/workbench/workbench?mode='");
  });

  it('演示需求页也展示工作台入口', () => {
    const wxml = read('miniprogram/pages/requirement/requirement.wxml');
    const entry = wxml.match(/<!-- 图形工作台快捷入口 -->([\s\S]*?)<!-- 零件组列表 -->/)?.[1] || '';
    expect(entry).not.toContain('wx:if="{{!isDemo}}"');
  });

  it('自由绘制默认空白开放，并支持把当前模板转为可编辑节点', () => {
    const ts = read('miniprogram/pages/workbench/workbench.ts');
    const wxml = read('miniprogram/pages/workbench/workbench.wxml');

    expect(ts).toContain('traceCurrentTemplate()');
    expect(ts).toContain('startBlankDrawing()');
    expect(wxml).toContain('bindtap="traceCurrentTemplate"');
    expect(wxml).toContain('bindtap="startBlankDrawing"');
    expect(ts).not.toContain('// 初始化默认三角形绘制点');
  });
});
