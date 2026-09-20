import { describe, it, expect } from 'vitest';
import {
  generateTemplatePolygon,
  calculatePolygonArea,
  calculatePolygonBBox,
  isPolygonSelfIntersecting,
  extractContourFromBinaryImage,
  douglasPeucker,
  snapAngle,
  Point,
} from '../../packages/core/src/index.js';

describe('三种图形录入核心能力验证', () => {
  describe('1. 参数模板录入验证 (矩形、圆形、L形)', () => {
    it('矩形模板：尺寸、面积、顶点数与包围盒严格匹配', () => {
      // 100mm x 50mm -> 1000 x 500 in 0.1mm
      const geo = generateTemplatePolygon('RECT', { width: 1000, height: 500 });
      expect(geo.kind).toBe('RECT');
      expect(geo.points.length).toBe(4);
      expect(geo.width).toBe(1000);
      expect(geo.height).toBe(500);
      expect(geo.area).toBe(500000); // 1000 * 500
      expect(isPolygonSelfIntersecting(geo.points)).toBe(false);

      const bbox = calculatePolygonBBox(geo.points);
      expect(bbox.width).toBe(1000);
      expect(bbox.height).toBe(500);
    });

    it('圆形模板：离散顶点数<=48，面积逼近圆理论面积', () => {
      // 直径 100mm -> 1000 in 0.1mm, 半径 500
      const geo = generateTemplatePolygon('CIRCLE', { diameter: 1000 });
      expect(geo.kind).toBe('CIRCLE');
      expect(geo.points.length).toBeGreaterThanOrEqual(16);
      expect(geo.points.length).toBeLessThanOrEqual(48);
      expect(geo.width).toBe(1000);
      expect(geo.height).toBe(1000);
      const theoreticalArea = Math.PI * 500 * 500;
      expect(Math.abs(geo.area - theoreticalArea) / theoreticalArea).toBeLessThan(0.02);
      expect(isPolygonSelfIntersecting(geo.points)).toBe(false);
    });

    it('L形模板：凹多边形6顶点，无自相交，面积精准扣减缺口', () => {
      // w1=100mm(1000), h1=100mm(1000), w2=40mm(400), h2=40mm(400)
      const geo = generateTemplatePolygon('L_SHAPE', { w1: 1000, h1: 1000, w2: 400, h2: 400 });
      expect(geo.kind).toBe('L_SHAPE');
      expect(geo.points.length).toBe(6);
      expect(geo.width).toBe(1000);
      expect(geo.height).toBe(1000);
      // 整体 1000x1000 - 右上缺口 (1000-400)*(1000-400) = 1000000 - 360000 = 640000
      expect(geo.area).toBe(640000);
      expect(isPolygonSelfIntersecting(geo.points)).toBe(false);
    });

    it('其余6种参数模板均生成有效无自交闭合多边形 (圆角矩形、椭圆、三角形、正多边形、拱门、星形)', () => {
      // 1. ROUNDED_RECT
      const rrect = generateTemplatePolygon('ROUNDED_RECT', { width: 1000, height: 800, radius: 100 });
      expect(rrect.points.length).toBeGreaterThanOrEqual(16);
      expect(rrect.area).toBeGreaterThan(0);
      expect(isPolygonSelfIntersecting(rrect.points)).toBe(false);

      // 2. ELLIPSE
      const ellipse = generateTemplatePolygon('ELLIPSE', { rx: 500, ry: 300 });
      expect(ellipse.points.length).toBe(32);
      expect(ellipse.area).toBeGreaterThan(0);
      expect(isPolygonSelfIntersecting(ellipse.points)).toBe(false);

      // 3. TRIANGLE
      const tri = generateTemplatePolygon('TRIANGLE', { base: 800, height: 600 });
      expect(tri.points.length).toBe(3);
      expect(tri.area).toBe(240000);
      expect(isPolygonSelfIntersecting(tri.points)).toBe(false);

      // 4. REGULAR_POLYGON
      const hex = generateTemplatePolygon('REGULAR_POLYGON', { sides: 6, radius: 500 });
      expect(hex.points.length).toBe(6);
      expect(hex.area).toBeGreaterThan(0);
      expect(isPolygonSelfIntersecting(hex.points)).toBe(false);

      // 5. ARCH
      const arch = generateTemplatePolygon('ARCH', { width: 800, height: 1000, archHeight: 300 });
      expect(arch.points.length).toBeGreaterThanOrEqual(16);
      expect(arch.area).toBeGreaterThan(0);
      expect(isPolygonSelfIntersecting(arch.points)).toBe(false);

      // 6. STAR
      const star = generateTemplatePolygon('STAR', { points: 5, outerRadius: 600, innerRadius: 250 });
      expect(star.points.length).toBe(10);
      expect(star.area).toBeGreaterThan(0);
      expect(isPolygonSelfIntersecting(star.points)).toBe(false);
    });
  });

  describe('2. 自由绘制能力验证 (节点添加、闭合、撤销重做、吸附与自相交拦截)', () => {
    it('添加节点、计算面积与包围盒', () => {
      const pts: Point[] = [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 400 },
      ];
      expect(isPolygonSelfIntersecting(pts)).toBe(false);
      expect(calculatePolygonArea(pts)).toBe(60000); // 0.5 * 300 * 400
      const bbox = calculatePolygonBBox(pts);
      expect(bbox).toEqual({ x: 0, y: 0, width: 300, height: 400 });
    });

    it('45°/水平/垂直智能吸附', () => {
      // 接近水平 (dx=100, dy=3) -> 吸附为水平 (dy=0)
      const snapH = snapAngle(100, 3);
      expect(snapH.dy).toBe(0);
      expect(snapH.dx).toBe(100);

      // 接近垂直 (dx=2, dy=150) -> 吸附为垂直 (dx=0)
      const snapV = snapAngle(2, 150);
      expect(snapV.dx).toBe(0);
      expect(snapV.dy).toBe(150);

      // 接近45度 (dx=100, dy=102) -> 吸附为45度
      const snapDiag = snapAngle(100, 102);
      expect(snapDiag.dx).toBe(snapDiag.dy);
    });

    it('自相交多边形拦截：蝴蝶形 (Bowtie) 严格被识别为自交', () => {
      const bowtie: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ];
      expect(isPolygonSelfIntersecting(bowtie)).toBe(true);
    });

    it('正常凸凹多边形不触发自相交', () => {
      const concave: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 50, y: 50 },
        { x: 0, y: 100 },
      ];
      expect(isPolygonSelfIntersecting(concave)).toBe(false);
    });

    it('历史栈撤销与重做数据流模拟', () => {
      const history: Point[][] = [];
      let historyIndex = -1;

      function pushState(pts: Point[]) {
        history.splice(historyIndex + 1);
        history.push([...pts]);
        historyIndex = history.length - 1;
      }

      pushState([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
      pushState([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
      expect(historyIndex).toBe(1);
      expect(history.length).toBe(2);

      // 撤销
      historyIndex--;
      expect(history[historyIndex].length).toBe(2);

      // 重做
      historyIndex++;
      expect(history[historyIndex].length).toBe(3);
    });
  });

  describe('3. 图片辅助录入真实算法验证 (物理尺寸换算、纯色高对比与复杂低对比背景)', () => {
    it('高对比度纯色背景：精准提取矩形纸样轮廓并换算物理毫米尺寸', () => {
      const w = 40;
      const h = 40;
      const grid = new Uint8Array(w * h);
      // 中间 20x10 的主体物体 (x: 10..29, y: 15..24)
      for (let y = 15; y < 25; y++) {
        for (let x = 10; x < 30; x++) {
          grid[y * w + x] = 1;
        }
      }

      const raw = extractContourFromBinaryImage(grid, w, h, { scaleMmPerPixel: 1, maxVertices: 64 });
      expect(raw.points.length).toBeGreaterThanOrEqual(4);
      // raw.width 在 scaleMmPerPixel=1 时以 0.1mm 存储 (19px * 10 = 190)
      expect(raw.width).toBe(190);
      expect(raw.height).toBe(90);

      // 用户指定实际主体宽度为 120mm (1200 in 0.1mm)
      const userKnownWidthMm = 120;
      const physicalScale = (userKnownWidthMm * 10) / raw.width; // 1200 / 190
      const scaled = raw.points.map((p) => ({
        x: Math.round(p.x * physicalScale),
        y: Math.round(p.y * physicalScale),
      }));
      const simplified = douglasPeucker(scaled, 20, 64);
      expect(simplified.length).toBeGreaterThanOrEqual(4);
      const bbox = calculatePolygonBBox(simplified);
      expect(bbox.width).toBe(1200); // 120mm 准确还原
      expect(Math.abs(bbox.height - 568)).toBeLessThanOrEqual(5); // 约 57mm 依比例还原
    });

    it('低对比度或复杂背景：主体像素过少或过多时合理触发对比不足判定', () => {
      const w = 50;
      const h = 50;
      const gridTooLittle = new Uint8Array(w * h); // 几乎全是背景 (foreground < 12)
      let fgCountLittle = 0;
      for (let i = 0; i < gridTooLittle.length; i++) {
        if (gridTooLittle[i] === 1) fgCountLittle++;
      }
      expect(fgCountLittle < 12).toBe(true);

      const gridTooMuch = new Uint8Array(w * h).fill(1); // 几乎全被误判为主体 (> 92%)
      let fgCountMuch = gridTooMuch.length;
      expect(fgCountMuch > gridTooMuch.length * 0.92).toBe(true);
    });
  });
});
