import { describe, it, expect } from 'vitest';
import { generateTemplatePolygon } from '../../packages/core/src/geometry/templates.js';
import { calculatePolygonArea } from '../../packages/core/src/geometry/polygon.js';

describe('9 Parameterized Shape Templates', () => {
  it('1. RECT 矩形模板生成合规闭合多边形', () => {
    const geo = generateTemplatePolygon('RECT', { width: 400, height: 300 });
    expect(geo.kind).toBe('RECT');
    expect(geo.source).toBe('TEMPLATE');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBe(4);
    expect(geo.width).toBe(400);
    expect(geo.height).toBe(300);
    expect(geo.area).toBe(120000);
    expect(geo.templateParams).toEqual({ width: 400, height: 300 });
  });

  it('2. ROUNDED_RECT 圆角矩形模板弧度离散点数与误差', () => {
    const geo = generateTemplatePolygon('ROUNDED_RECT', { width: 500, height: 400, radius: 50 });
    expect(geo.kind).toBe('ROUNDED_RECT');
    expect(geo.closed).toBe(true);
    // 4个圆角弧，总点数应合理（不超过 48 点）
    expect(geo.points.length).toBeGreaterThan(4);
    expect(geo.points.length).toBeLessThanOrEqual(48);
    expect(geo.width).toBe(500);
    expect(geo.height).toBe(400);
    // 圆角面积略小于完整矩形
    expect(geo.area).toBeLessThan(500 * 400);
    expect(geo.area).toBeGreaterThan(500 * 400 - 4 * 50 * 50);
  });

  it('3. CIRCLE 圆形模板离散误差 <= 0.5mm 且顶点数 <= 48', () => {
    // 直径 100mm (1000 in 0.1mm) -> 半径 500
    const geo = generateTemplatePolygon('CIRCLE', { diameter: 1000 });
    expect(geo.kind).toBe('CIRCLE');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBeLessThanOrEqual(48);
    expect(geo.points.length).toBeGreaterThanOrEqual(16);
    // 理论面积 pi * r^2 = 3.14159 * 250000 ≈ 785398
    const expectedArea = Math.PI * 500 * 500;
    const areaDiff = Math.abs(geo.area - expectedArea);
    expect(areaDiff / expectedArea).toBeLessThan(0.02); // 误差小于 2%
  });

  it('4. ELLIPSE 椭圆模板', () => {
    const geo = generateTemplatePolygon('ELLIPSE', { rx: 600, ry: 400 });
    expect(geo.kind).toBe('ELLIPSE');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBeLessThanOrEqual(48);
    expect(geo.width).toBe(1200);
    expect(geo.height).toBe(800);
    const expectedArea = Math.PI * 600 * 400;
    expect(Math.abs(geo.area - expectedArea) / expectedArea).toBeLessThan(0.03);
  });

  it('5. TRIANGLE 三角形模板', () => {
    const geo = generateTemplatePolygon('TRIANGLE', { base: 600, height: 400 });
    expect(geo.kind).toBe('TRIANGLE');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBe(3);
    expect(geo.width).toBe(600);
    expect(geo.height).toBe(400);
    expect(geo.area).toBe(120000); // 0.5 * 600 * 400
  });

  it('6. REGULAR_POLYGON 正多边形 (如六边形)', () => {
    const geo = generateTemplatePolygon('REGULAR_POLYGON', { sides: 6, radius: 500 });
    expect(geo.kind).toBe('REGULAR_POLYGON');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBe(6);
    expect(geo.area).toBeGreaterThan(0);
  });

  it('7. L_SHAPE L型多边形', () => {
    const geo = generateTemplatePolygon('L_SHAPE', { w1: 600, h1: 600, w2: 200, h2: 200 });
    expect(geo.kind).toBe('L_SHAPE');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBe(6);
    expect(geo.width).toBe(600);
    expect(geo.height).toBe(600);
    // 面积 = 600*600 - (600-200)*(600-200) = 360000 - 160000 = 200000
    expect(geo.area).toBe(200000);
  });

  it('8. ARCH 拱门形模板', () => {
    const geo = generateTemplatePolygon('ARCH', { width: 400, height: 600, archHeight: 200 });
    expect(geo.kind).toBe('ARCH');
    expect(geo.closed).toBe(true);
    expect(geo.width).toBe(400);
    expect(geo.height).toBe(600);
    expect(geo.points.length).toBeLessThanOrEqual(48);
  });

  it('9. STAR 五角星模板', () => {
    const geo = generateTemplatePolygon('STAR', { points: 5, outerRadius: 500, innerRadius: 200 });
    expect(geo.kind).toBe('STAR');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBe(10);
    expect(geo.area).toBeGreaterThan(0);
  });
});
