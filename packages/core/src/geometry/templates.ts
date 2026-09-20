import { Point, Rect, ShapeGeometry, ShapeKind } from '../types/index.js';
import {
  calculatePolygonArea,
  calculatePolygonBBox,
} from './polygon.js';

/**
 * 参数化几何图形生成器（支持 9 种模板）
 */
export function generateTemplatePolygon(
  kind: ShapeKind,
  params: Record<string, any>
): ShapeGeometry {
  let points: Point[] = [];

  switch (kind) {
    case 'RECT': {
      const w = Math.round(params.width || 100);
      const h = Math.round(params.height || 100);
      points = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
      break;
    }

    case 'ROUNDED_RECT': {
      const w = Math.round(params.width || 200);
      const h = Math.round(params.height || 200);
      const maxR = Math.min(w, h) / 2;
      const r = Math.min(Math.round(params.radius || 20), maxR);

      // 每个圆角离散 6 段弧（4个角共 24 点）
      const segsPerCorner = 6;
      points = [];

      // 右上角: 中心 (w - r, r), 角度 -90° 到 0°
      for (let i = 0; i <= segsPerCorner; i++) {
        const rad = -Math.PI / 2 + (Math.PI / 2) * (i / segsPerCorner);
        points.push({
          x: Math.round(w - r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad)),
        });
      }
      // 右下角: 中心 (w - r, h - r), 角度 0° 到 90°
      for (let i = 1; i <= segsPerCorner; i++) {
        const rad = (Math.PI / 2) * (i / segsPerCorner);
        points.push({
          x: Math.round(w - r + r * Math.cos(rad)),
          y: Math.round(h - r + r * Math.sin(rad)),
        });
      }
      // 左下角: 中心 (r, h - r), 角度 90° 到 180°
      for (let i = 1; i <= segsPerCorner; i++) {
        const rad = Math.PI / 2 + (Math.PI / 2) * (i / segsPerCorner);
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(h - r + r * Math.sin(rad)),
        });
      }
      // 左上角: 中心 (r, r), 角度 180° 到 270°
      for (let i = 1; i < segsPerCorner; i++) {
        const rad = Math.PI + (Math.PI / 2) * (i / segsPerCorner);
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad)),
        });
      }
      break;
    }

    case 'CIRCLE': {
      const d = Math.round(params.diameter || (params.radius ? params.radius * 2 : 200));
      const r = d / 2;
      // 误差 <= 0.5mm (5 in 0.1mm). 弦误差 = r * (1 - cos(pi / N)) <= 5
      // 32 段已足够精细且符合 <= 48 顶点规范
      const n = 32;
      points = [];
      for (let i = 0; i < n; i++) {
        const rad = (i / n) * Math.PI * 2;
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad)),
        });
      }
      break;
    }

    case 'ELLIPSE': {
      const rx = Math.round(params.rx || (params.width ? params.width / 2 : 200));
      const ry = Math.round(params.ry || (params.height ? params.height / 2 : 150));
      const n = 32;
      points = [];
      for (let i = 0; i < n; i++) {
        const rad = (i / n) * Math.PI * 2;
        points.push({
          x: Math.round(rx + rx * Math.cos(rad)),
          y: Math.round(ry + ry * Math.sin(rad)),
        });
      }
      break;
    }

    case 'TRIANGLE': {
      const b = Math.round(params.base || params.width || 200);
      const h = Math.round(params.height || 200);
      // 直角三角形或等腰三角形：采用 (0,0), (b, 0), (0, h)
      points = [
        { x: 0, y: 0 },
        { x: b, y: 0 },
        { x: 0, y: h },
      ];
      break;
    }

    case 'REGULAR_POLYGON': {
      const sides = Math.max(3, Math.round(params.sides || 6));
      const r = Math.round(params.radius || 200);
      points = [];
      for (let i = 0; i < sides; i++) {
        const rad = (i / sides) * Math.PI * 2 - Math.PI / 2;
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad)),
        });
      }
      break;
    }

    case 'L_SHAPE': {
      const w1 = Math.round(params.w1 || params.width || 400);
      const h1 = Math.round(params.h1 || params.height || 400);
      const w2 = Math.round(params.w2 || Math.round(w1 / 2));
      const h2 = Math.round(params.h2 || Math.round(h1 / 2));
      points = [
        { x: 0, y: 0 },
        { x: w1, y: 0 },
        { x: w1, y: h2 },
        { x: w2, y: h2 },
        { x: w2, y: h1 },
        { x: 0, y: h1 },
      ];
      break;
    }

    case 'ARCH': {
      const w = Math.round(params.width || 400);
      const h = Math.round(params.height || 600);
      const archH = Math.min(h, Math.round(params.archHeight || 200));
      const baseH = h - archH;
      const rx = w / 2;
      const ry = archH;

      points = [
        { x: 0, y: baseH },
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: baseH },
      ];

      // 顶部拱弧 (180° 到 0°)
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const rad = (i / segs) * Math.PI;
        points.push({
          x: Math.round(rx + rx * Math.cos(rad)),
          y: Math.round(baseH + ry * Math.sin(rad)),
        });
      }
      break;
    }

    case 'STAR': {
      const numPoints = Math.max(3, Math.round(params.points || 5));
      const rOuter = Math.round(params.outerRadius || 300);
      const rInner = Math.round(params.innerRadius || Math.round(rOuter / 2));
      points = [];
      const totalVerts = numPoints * 2;
      for (let i = 0; i < totalVerts; i++) {
        const rad = (i / totalVerts) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? rOuter : rInner;
        points.push({
          x: Math.round(rOuter + r * Math.cos(rad)),
          y: Math.round(rOuter + r * Math.sin(rad)),
        });
      }
      break;
    }

    default: {
      const w = Math.round(params.width || 100);
      const h = Math.round(params.height || 100);
      points = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
      break;
    }
  }

  // 统一坐标归一化到 (0, 0)
  const bbox = calculatePolygonBBox(points);
  const normalizedPoints = points.map((p) => ({
    x: p.x - bbox.x,
    y: p.y - bbox.y,
  }));
  const finalBBox = calculatePolygonBBox(normalizedPoints);
  const area = calculatePolygonArea(normalizedPoints);

  return {
    kind,
    source: 'TEMPLATE',
    points: normalizedPoints,
    width: finalBBox.width,
    height: finalBBox.height,
    area,
    closed: true,
    templateParams: params,
  };
}
