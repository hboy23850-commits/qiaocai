import { describe, it, expect } from 'vitest';
import {
  computeHomography,
  rectifyPoints,
  findContoursFromImageData,
  extractContourFromBinaryImage,
  otsuThreshold,
} from '../../packages/core/src/geometry/image-contour.js';
import { Point } from '../../packages/core/src/types/index.js';

describe('Image Contour Extraction and Perspective Rectification', () => {
  it('四点透视校正矩阵计算与点坐标映射', () => {
    // 拍摄倾斜的四边形源点
    const srcPoints: Point[] = [
      { x: 10, y: 20 },
      { x: 90, y: 15 },
      { x: 95, y: 85 },
      { x: 15, y: 90 },
    ];
    // 目标校准标准矩形 (例如 A4 尺寸比例)
    const dstPoints: Point[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 700 },
      { x: 0, y: 700 },
    ];

    const H = computeHomography(srcPoints, dstPoints);
    expect(H).toBeDefined();
    expect(H.length).toBe(3);

    const rectified = rectifyPoints(srcPoints, H);
    // 验证校正后的点贴合目标点
    expect(Math.abs(rectified[0].x - dstPoints[0].x)).toBeLessThan(5);
    expect(Math.abs(rectified[0].y - dstPoints[0].y)).toBeLessThan(5);
    expect(Math.abs(rectified[1].x - dstPoints[1].x)).toBeLessThan(5);
    expect(Math.abs(rectified[2].x - dstPoints[2].x)).toBeLessThan(5);
  });

  it('Otsu 自适应二值化阈值计算', () => {
    // 双峰灰度分布：一部分 50 左右，一部分 200 左右
    const histogram = new Array(256).fill(0);
    for (let i = 40; i <= 60; i++) histogram[i] = 100;
    for (let i = 190; i <= 210; i++) histogram[i] = 100;

    const total = 21 * 100 + 21 * 100;
    const threshold = otsuThreshold(histogram, total);
    // 阈值应在两个峰值之间 (60 ~ 190)
    expect(threshold).toBeGreaterThan(60);
    expect(threshold).toBeLessThan(190);
  });

  it('从二值化网格提取轮廓多边形并精简至 <= 64 顶点', () => {
    // 创建 50x50 网格，中间有一个 20x20 的黑色物体 (值为 1)
    const width = 50;
    const height = 50;
    const grid = new Uint8Array(width * height);
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        grid[y * width + x] = 1;
      }
    }

    const contour = extractContourFromBinaryImage(grid, width, height, {
      scaleMmPerPixel: 1.0,
      maxVertices: 64,
    });

    expect(contour).toBeDefined();
    expect(contour.points.length).toBeGreaterThanOrEqual(4);
    expect(contour.points.length).toBeLessThanOrEqual(64);
    expect(contour.closed).toBe(true);
    expect(contour.area).toBeGreaterThan(0);
  });
});
