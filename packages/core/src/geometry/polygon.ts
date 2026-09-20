import { Point, Rect } from '../types/index.js';

/**
 * 计算多边形面积（Shoelace 公式，返回正数）
 */
export function calculatePolygonArea(points: Point[]): number {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(Math.round(area / 2));
}

/**
 * 计算多边形外接轴对齐矩形 (AABB)
 */
export function calculatePolygonBBox(points: Point[]): Rect {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 判断多边形是否有效且闭合
 */
export function isPolygonClosed(points: Point[]): boolean {
  if (!points || points.length < 3) return false;
  return calculatePolygonArea(points) > 0;
}

/**
 * 多边形刚体几何变换（旋转与平移）
 * 旋转后对齐到目标 translation 坐标（作为外接矩形左上角起点）
 */
export function transformPoints(
  points: Point[],
  translation: Point,
  rotationDeg: number = 0
): Point[] {
  if (!points || points.length === 0) return [];

  const normDeg = ((rotationDeg % 360) + 360) % 360;

  // 1. 旋转
  let rotated: Point[] = [];
  if (normDeg === 0) {
    rotated = points.map((p) => ({ x: p.x, y: p.y }));
  } else if (normDeg === 90) {
    rotated = points.map((p) => ({ x: -p.y, y: p.x }));
  } else if (normDeg === 180) {
    rotated = points.map((p) => ({ x: -p.x, y: -p.y }));
  } else if (normDeg === 270) {
    rotated = points.map((p) => ({ x: p.y, y: -p.x }));
  } else {
    const rad = (normDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    rotated = points.map((p) => ({
      x: Math.round(p.x * cos - p.y * sin),
      y: Math.round(p.x * sin + p.y * cos),
    }));
  }

  // 2. 计算旋转后的包围盒并平移至 translation
  const rotBBox = calculatePolygonBBox(rotated);
  return rotated.map((p) => ({
    x: p.x - rotBBox.x + translation.x,
    y: p.y - rotBBox.y + translation.y,
  }));
}

/**
 * 射线投射法检测点是否在多边形内部
 */
export function isPointInPolygon(p: Point, poly: Point[]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;

    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 跨立实验判定两条线段是否严格或端点相交
 */
function ccw(p1: Point, p2: Point, p3: Point): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  );
}

export function doLineSegmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;

  return false;
}

/**
 * 检测多边形自身是否有边自交 (Self-intersection)
 */
export function isPolygonSelfIntersecting(points: Point[]): boolean {
  if (!points || points.length < 4) return false;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      // 排除相邻边（它们在顶点处正常相连）
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) {
        continue;
      }

      const b1 = points[j];
      const b2 = points[(j + 1) % n];

      // 严格相交测试
      const d1 = ccw(b1, b2, a1);
      const d2 = ccw(b1, b2, a2);
      const d3 = ccw(a1, a2, b1);
      const d4 = ccw(a1, a2, b2);

      if (
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 两任意多边形是否相交判定
 */
export function polygonsIntersect(polyA: Point[], polyB: Point[]): boolean {
  if (!polyA || polyA.length < 3 || !polyB || polyB.length < 3) return false;

  // 1. AABB 快速粗筛
  const boxA = calculatePolygonBBox(polyA);
  const boxB = calculatePolygonBBox(polyB);
  if (
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y
  ) {
    return false;
  }

  // 2. 边与边相交测试
  const nA = polyA.length;
  const nB = polyB.length;
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];
    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];
      if (doLineSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  // 3. 包含测试（无边交点但一个完全在另一个内部）
  if (isPointInPolygon(polyA[0], polyB) || isPointInPolygon(polyB[0], polyA)) {
    return true;
  }

  return false;
}

/**
 * 多边形与轴对齐矩形是否相交判定
 */
export function polygonIntersectsRect(poly: Point[], rect: Rect): boolean {
  const rectPoly: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return polygonsIntersect(poly, rectPoly);
}

/**
 * 多边形是否完全落在轴对齐矩形边界内部
 */
export function isPolygonInsideRect(poly: Point[], rect: Rect): boolean {
  if (!poly || poly.length === 0) return false;
  const bbox = calculatePolygonBBox(poly);
  return (
    bbox.x >= rect.x &&
    bbox.y >= rect.y &&
    bbox.x + bbox.width <= rect.x + rect.width &&
    bbox.y + bbox.height <= rect.y + rect.height
  );
}

/**
 * 点到线段的垂直距离
 */
function perpendicularDistance(p: Point, lineA: Point, lineB: Point): number {
  const dx = lineB.x - lineA.x;
  const dy = lineB.y - lineA.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - lineA.x, p.y - lineA.y);
  }
  const t = ((p.x - lineA.x) * dx + (p.y - lineA.y) * dy) / lenSq;
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = lineA.x + clampedT * dx;
  const projY = lineA.y + clampedT * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Douglas-Peucker 算法精简顶点
 */
function dpRecursive(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = dpRecursive(points.slice(0, index + 1), tolerance);
    const right = dpRecursive(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [first, last];
  }
}

export function douglasPeucker(
  points: Point[],
  tolerance: number = 2,
  maxPoints: number = 64
): Point[] {
  if (!points || points.length <= 3) return points;

  let currentTol = tolerance;
  let simplified = dpRecursive(points, currentTol);

  // 如果点数依然超出限制，逐步自适应增大容差
  let attempts = 0;
  while (simplified.length > maxPoints && attempts < 20) {
    currentTol *= 1.5;
    simplified = dpRecursive(points, currentTol);
    attempts++;
  }

  return simplified;
}

/**
 * 角度吸附（水平、垂直、45度）
 */
export function snapAngle(
  dx: number,
  dy: number,
  snapThresholdDeg: number = 6
): { dx: number; dy: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return { dx, dy };

  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  // 标准吸附目标角度：0, 45, 90, 135, 180, 225, 270, 315, 360
  const targets = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  let closestTarget = angleDeg;
  let minDiff = 360;

  for (const t of targets) {
    const diff = Math.abs(angleDeg - t);
    if (diff < minDiff) {
      minDiff = diff;
      closestTarget = t;
    }
  }

  if (minDiff <= snapThresholdDeg) {
    const rad = (closestTarget * Math.PI) / 180;
    return {
      dx: Math.round(len * Math.cos(rad)),
      dy: Math.round(len * Math.sin(rad)),
    };
  }

  return { dx, dy };
}
