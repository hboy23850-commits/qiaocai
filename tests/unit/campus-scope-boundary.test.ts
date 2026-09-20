import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('校园首版产品边界', () => {
  it('不打包工厂模拟与缺陷标注页面', () => {
    const app = JSON.parse(read('miniprogram/app.json'));
    expect(app.pages).not.toContain('pages/factory/factory');
    expect(app.pages).not.toContain('pages/defect-mark/defect-mark');
  });

  it('材料库不展示工厂或SaaS协同入口', () => {
    const source = read('miniprogram/pages/stock/stock.ts') + read('miniprogram/pages/stock/stock.wxml');
    expect(source).not.toMatch(/getFactory|navToFactory|inFactory|SaaS|工厂|厂长|技工/);
  });

  it('裁切向导不引入工业导出、缺陷和非矩形逻辑', () => {
    const source = read('miniprogram/pages/cut-view/cut-view.ts');
    expect(source).not.toMatch(/generateDXF|generateGCode|DEFECT|CIRCLE|TRIANGLE/);
  });

  it('完成页名称聚焦实测余料，不宣称商业报价', () => {
    const config = read('miniprogram/pages/finish/finish.json');
    expect(config).not.toMatch(/商业|报价/);
    expect(config).toContain('实测余料');
  });
});
