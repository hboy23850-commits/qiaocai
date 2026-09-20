import { ShapeGeometry } from '../types/index.js';
/**
 * 严格过滤 SVG 中潜在的恶意代码、脚本和外链实体
 */
export declare function sanitizeSVG(svgStr: string): string;
interface SVGParseOptions {
    targetWidthMm?: number;
    targetHeightMm?: number;
}
/**
 * 解析 SVG 路径与基础图形并生成离散化闭合多边形几何
 */
export declare function parseSVGToShapeGeometry(svgStr: string, options?: SVGParseOptions): ShapeGeometry;
export {};
