import { ShapeGeometry, ShapeKind } from '../types/index.js';
/**
 * 参数化几何图形生成器（支持 9 种模板）
 */
export declare function generateTemplatePolygon(kind: ShapeKind, params: Record<string, any>): ShapeGeometry;
