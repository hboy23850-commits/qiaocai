import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('home page guidance', () => {
  const markup = fs.readFileSync(
    path.resolve(__dirname, '../../miniprogram/pages/index/index.wxml'),
    'utf8'
  );
  const logic = fs.readFileSync(
    path.resolve(__dirname, '../../miniprogram/pages/index/index.ts'),
    'utf8'
  );

  it('explains the three-step cutting workflow in order', () => {
    const steps = ['1. 登记材料', '2. 填写零件', '3. 比较方案'];
    let cursor = -1;
    for (const step of steps) {
      const position = markup.indexOf(step);
      expect(position).toBeGreaterThan(cursor);
      cursor = position;
    }
  });

  it('offers one obvious demo action and keeps destructive actions off the home page', () => {
    expect(markup).toContain('快速体验 A4 展签案例');
    expect(markup.match(/bind:tap="startDemo"/g)).toHaveLength(1);
    expect(markup).not.toContain('清理个人数据');
  });

  it('shows a useful empty-state instruction', () => {
    expect(markup).toContain('还没有材料');
    expect(markup).toContain('先登记手边的卡纸或板材');
  });

  it('prepares demo materials before opening the guided case', () => {
    expect(logic).toContain("callCloudFunction('prepareDemo'");
    expect(logic).toContain('globalData.stockList');
    expect(markup).toContain('loading="{{isStartingDemo}}"');
  });
});
