import { Point, ShapeGeometry } from '../types/index.js';
import {
  calculatePolygonArea,
  calculatePolygonBBox,
  douglasPeucker,
} from './polygon.js';

/**
 * 求解 4 点透视变换矩阵 (Direct Linear Transformation)
 * 从源四边形顶点映射到目标矩形/校准四边形顶点
 */
export function computeHomography(
  src: Point[],
  dst: Point[]
): number[][] {
  if (src.length < 4 || dst.length < 4) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  // 构造 8x8 线性方程组 A * h = b
  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const u = dst[i].x;
    const v = dst[i].y;

    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);

    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }

  // 高斯消元法求解 8 元线性方程组
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    const tempA = A[i];
    A[i] = A[maxRow];
    A[maxRow] = tempA;
    const tempB = B[i];
    B[i] = B[maxRow];
    B[maxRow] = tempB;

    if (Math.abs(A[i][i]) < 1e-12) continue;

    for (let k = i + 1; k < n; k++) {
      const c = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= c * A[i][j];
      }
      B[k] -= c * B[i];
    }
  }

  const h = new Array(8).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * h[j];
    }
    h[i] = (B[i] - sum) / (A[i][i] || 1);
  }

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1.0],
  ];
}

/**
 * 应用透视变换矩阵将点序列矫正至物理尺寸
 */
export function rectifyPoints(points: Point[], H: number[][]): Point[] {
  return points.map((p) => {
    const w = H[2][0] * p.x + H[2][1] * p.y + H[2][2];
    const denom = Math.abs(w) > 1e-8 ? w : 1;
    const u = (H[0][0] * p.x + H[0][1] * p.y + H[0][2]) / denom;
    const v = (H[1][0] * p.x + H[1][1] * p.y + H[1][2]) / denom;
    return {
      x: Math.round(u),
      y: Math.round(v),
    };
  });
}

/**
 * Otsu 最大类间方差自适应二值化阈值算法
 */
export function otsuThreshold(histogram: number[], totalPixels: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVar = -1;
  let tStart = 0;
  let tEnd = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const betweenVar = wB * wF * (mB - mF) * (mB - mF);

    if (betweenVar > maxVar + 1e-6) {
      maxVar = betweenVar;
      tStart = t;
      tEnd = t;
    } else if (Math.abs(betweenVar - maxVar) <= 1e-6) {
      tEnd = t;
    }
  }

  return Math.round((tStart + tEnd) / 2);
}

/**
 * 摩尔邻域外轮廓追踪 (Moore-Neighbor Tracing)
 */
export function extractContourFromBinaryImage(
  grid: Uint8Array | number[],
  width: number,
  height: number,
  options: { scaleMmPerPixel?: number; maxVertices?: number } = {}
): ShapeGeometry {
  const scaleMmPerPixel = options.scaleMmPerPixel || 1.0;
  const maxVertices = options.maxVertices || 64;

  // 1. 寻找物体起始边界点 (从上往下，从左往右扫描首个前景点)
  let startX = -1;
  let startY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] === 1) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) {
    // 未检测到物体，返回安全兜底矩形
    return {
      kind: 'POLYGON',
      source: 'PHOTO',
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      width: 1000,
      height: 1000,
      area: 1000000,
      closed: true,
      confidence: 0.1,
    };
  }

  // 2. 摩尔邻域顺时针追踪
  // 8 方向偏移 (从西/左侧开始: (-1, 0))
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];

  const contourPoints: Point[] = [];
  let currX = startX;
  let currY = startY;
  let dir = 0; // 回溯方向

  contourPoints.push({
    x: Math.round(currX * scaleMmPerPixel * 10),
    y: Math.round(currY * scaleMmPerPixel * 10),
  });

  const maxSteps = width * height;
  let step = 0;

  while (step < maxSteps) {
    let foundNext = false;
    // 检查 8 邻域
    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + i) % 8;
      const nx = currX + dx[checkDir];
      const ny = currY + dy[checkDir];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (grid[ny * width + nx] === 1) {
          currX = nx;
          currY = ny;
          dir = (checkDir + 5) % 8; // 新的回溯入口方向
          contourPoints.push({
            x: Math.round(currX * scaleMmPerPixel * 10),
            y: Math.round(currY * scaleMmPerPixel * 10),
          });
          foundNext = true;
          break;
        }
      }
    }

    if (!foundNext) break;
    // 回到起点且闭合
    if (currX === startX && currY === startY && contourPoints.length > 3) {
      break;
    }
    step++;
  }

  // 3. 归一化与精简
  const bbox = calculatePolygonBBox(contourPoints);
  const normalized = contourPoints.map((p) => ({
    x: p.x - bbox.x,
    y: p.y - bbox.y,
  }));

  const simplified = douglasPeucker(normalized, 3, maxVertices);
  const finalBBox = calculatePolygonBBox(simplified);
  const area = calculatePolygonArea(simplified);

  return {
    kind: 'POLYGON',
    source: 'PHOTO',
    points: simplified,
    width: finalBBox.width,
    height: finalBBox.height,
    area,
    closed: true,
    confidence: 0.92,
  };
}

/**
 * 从 Canvas ImageData 灰度化与二值化提取轮廓
 */
export function findContoursFromImageData(
  imageData: { width: number; height: number; data: Uint8ClampedArray | number[] },
  options: { threshold?: number; scaleMmPerPixel?: number } = {}
): Point[][] {
  const { width, height, data } = imageData;
  const total = width * height;
  const gray = new Uint8Array(total);
  const hist = new Array(256).fill(0);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const g = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    );
    gray[i] = g;
    hist[g]++;
  }

  const th =
    typeof options.threshold === 'number'
      ? options.threshold
      : otsuThreshold(hist, total);

  const binGrid = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    // 假设深色物体在浅色背景上：gray < th 为物体前景 (1)
    binGrid[i] = gray[i] < th ? 1 : 0;
  }

  const geo = extractContourFromBinaryImage(binGrid, width, height, options);
  return [geo.points];
}
