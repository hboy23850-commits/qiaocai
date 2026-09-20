import { Point, Rect } from '../types/index.js';
/**
 * 计算多边形面积（Shoelace 公式，返回正数）
 */
export declare function calculatePolygonArea(points: Point[]): number;
/**
 * 计算多边形外接轴对齐矩形 (AABB)
 */
export declare function calculatePolygonBBox(points: Point[]): Rect;
/**
 * 判断多边形是否有效且闭合
 */
export declare function isPolygonClosed(points: Point[]): boolean;
/**
 * 多边形刚体几何变换（旋转与平移）
 * 旋转后对齐到目标 translation 坐标（作为外接矩形左上角起点）
 */
export declare function transformPoints(points: Point[], translation: Point, rotationDeg?: number): Point[];
/**
 * 射线投射法检测点是否在多边形内部
 */
export declare function isPointInPolygon(p: Point, poly: Point[]): boolean;
export declare function doLineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean;
/**
 * 检测多边形自身是否有边自交 (Self-intersection)
 */
export declare function isPolygonSelfIntersecting(points: Point[]): boolean;
/**
 * 两任意多边形是否相交判定
 */
export declare function polygonsIntersect(polyA: Point[], polyB: Point[]): boolean;
/**
 * 多边形与轴对齐矩形是否相交判定
 */
export declare function polygonIntersectsRect(poly: Point[], rect: Rect): boolean;
/**
 * 多边形是否完全落在轴对齐矩形边界内部
 */
export declare function isPolygonInsideRect(poly: Point[], rect: Rect): boolean;
export declare function douglasPeucker(points: Point[], tolerance?: number, maxPoints?: number): Point[];
/**
 * 角度吸附（水平、垂直、45度）
 */
export declare function snapAngle(dx: number, dy: number, snapThresholdDeg?: number): {
    dx: number;
    dy: number;
};
