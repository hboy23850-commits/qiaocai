import { describe, it, expect } from 'vitest';
import {
  calculatePolygonArea,
  calculatePolygonBBox,
  isPolygonClosed,
  transformPoints,
  isPointInPolygon,
  doLineSegmentsIntersect,
  isPolygonSelfIntersecting,
  polygonsIntersect,
  polygonIntersectsRect,
  isPolygonInsideRect,
  douglasPeucker,
  snapAngle,
} from '../../packages/core/src/geometry/polygon.js';
import { Point, Rect } from '../../packages/core/src/types/index.js';

describe('Irregular Geometry Utilities', () => {
  it('Shoelace 面积计算与外接矩形计算准确', () => {
    // 100mm x 50mm 矩形 (1000 x 500 in 0.1mm)
    const rectPoly: Point[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
      { x: 0, y: 500 },
    ];
    const area = calculatePolygonArea(rectPoly);
    expect(area).toBe(500000); // 1000 * 500

    const bbox = calculatePolygonBBox(rectPoly);
    expect(bbox).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
  });

  it('多边形闭合性判定', () => {
    const validPoly: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ];
    expect(isPolygonClosed(validPoly)).toBe(true);

    // 少于3个点不是闭合多边形
    expect(isPolygonClosed([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(false);
  });

  it('多边形自相交检测 (Self-intersection detection)', () => {
    // 正常凹多边形 (无自交)
    const concavePoly: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 50 },
      { x: 0, y: 100 },
    ];
    expect(isPolygonSelfIntersecting(concavePoly)).toBe(false);

    // 8字形自相交多边形
    const bowtiePoly: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(isPolygonSelfIntersecting(bowtiePoly)).toBe(true);
  });

  it('点在多边形内部检测 (Ray-casting point in polygon)', () => {
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 200 },
    ];
    expect(isPointInPolygon({ x: 100, y: 50 }, triangle)).toBe(true);
    expect(isPointInPolygon({ x: 300, y: 50 }, triangle)).toBe(false);
    expect(isPointInPolygon({ x: 0, y: 200 }, triangle)).toBe(false);
  });

  it('多边形刚体变换 (平移与精确直角/15度旋转)', () => {
    const poly: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];

    // 平移 (50, 60)
    const translated = transformPoints(poly, { x: 50, y: 60 }, 0);
    expect(translated[0]).toEqual({ x: 50, y: 60 });
    expect(translated[1]).toEqual({ x: 150, y: 60 });

    // 顺时针旋转 90 度并平移
    const rot90 = transformPoints(poly, { x: 200, y: 200 }, 90);
    // (0,0)->(200,200), (100,0)->(200,300), (100,50)->(150,300), (0,50)->(150,200)
    expect(rot90.length).toBe(4);
    const bbox = calculatePolygonBBox(rot90);
    expect(bbox.width).toBe(50);
    expect(bbox.height).toBe(100);
  });

  it('两多边形相交判定 (SAT & Ray casting)', () => {
    const polyA: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    // 重叠的 polyB
    const polyB: Point[] = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 150 },
      { x: 50, y: 150 },
    ];
    expect(polygonsIntersect(polyA, polyB)).toBe(true);

    // 不重叠且相离的 polyC
    const polyC: Point[] = [
      { x: 200, y: 200 },
      { x: 300, y: 200 },
      { x: 300, y: 300 },
      { x: 200, y: 300 },
    ];
    expect(polygonsIntersect(polyA, polyC)).toBe(false);

    // 一个完全包含另一个
    const outerPoly: Point[] = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 },
    ];
    const innerPoly: Point[] = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];
    expect(polygonsIntersect(outerPoly, innerPoly)).toBe(true);
  });

  it('多边形边界与禁排区检测', () => {
    const stockRect: Rect = { x: 0, y: 0, width: 1000, height: 1000 };
    const insidePoly: Point[] = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];
    expect(isPolygonInsideRect(insidePoly, stockRect)).toBe(true);

    const outsidePoly: Point[] = [
      { x: 900, y: 900 },
      { x: 1100, y: 900 }, // 越界
      { x: 1100, y: 1100 },
      { x: 900, y: 1100 },
    ];
    expect(isPolygonInsideRect(outsidePoly, stockRect)).toBe(false);

    // 禁排缺陷矩形相交
    const defectRect: Rect = { x: 150, y: 150, width: 100, height: 100 };
    expect(polygonIntersectsRect(insidePoly, defectRect)).toBe(true);
  });

  it('Douglas-Peucker 多边形顶点精简与阈值', () => {
    // 密集直线上多个共线点
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const simplified = douglasPeucker(points, 2, 64);
    expect(simplified.length).toBeLessThanOrEqual(4);
  });

  it('水平/垂直/45度角吸附功能', () => {
    // 近似水平 (dx=100, dy=2) -> 吸附为水平 dy=0
    const snapH = snapAngle(100, 2);
    expect(snapH.dy).toBe(0);
    expect(snapH.dx).toBe(100);

    // 近似 45 度 (dx=100, dy=98) -> 吸附为 45 度
    const snap45 = snapAngle(100, 98);
    expect(Math.abs(snap45.dx - snap45.dy)).toBeLessThan(2);
  });
});
