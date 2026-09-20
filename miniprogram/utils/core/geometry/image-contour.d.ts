import { Point, ShapeGeometry } from '../types/index.js';
/**
 * 求解 4 点透视变换矩阵 (Direct Linear Transformation)
 * 从源四边形顶点映射到目标矩形/校准四边形顶点
 */
export declare function computeHomography(src: Point[], dst: Point[]): number[][];
/**
 * 应用透视变换矩阵将点序列矫正至物理尺寸
 */
export declare function rectifyPoints(points: Point[], H: number[][]): Point[];
/**
 * Otsu 最大类间方差自适应二值化阈值算法
 */
export declare function otsuThreshold(histogram: number[], totalPixels: number): number;
/**
 * 摩尔邻域外轮廓追踪 (Moore-Neighbor Tracing)
 */
export declare function extractContourFromBinaryImage(grid: Uint8Array | number[], width: number, height: number, options?: {
    scaleMmPerPixel?: number;
    maxVertices?: number;
}): ShapeGeometry;
/**
 * 从 Canvas ImageData 灰度化与二值化提取轮廓
 */
export declare function findContoursFromImageData(imageData: {
    width: number;
    height: number;
    data: Uint8ClampedArray | number[];
}, options?: {
    threshold?: number;
    scaleMmPerPixel?: number;
}): Point[][];
