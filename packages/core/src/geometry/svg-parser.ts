import { Point, ShapeGeometry } from '../types/index.js';
import {
  calculatePolygonArea,
  calculatePolygonBBox,
  douglasPeucker,
} from './polygon.js';

/**
 * 严格过滤 SVG 中潜在的恶意代码、脚本和外链实体
 */
export function sanitizeSVG(svgStr: string): string {
  if (!svgStr) return '';
  return svgStr
    // 移除脚本与外联对象
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // 移除 DOCTYPE 与 ENTITY 注入
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!ENTITY[^>]*>/gi, '')
    // 移除内联事件处理器 (onclick, onload, etc.)
    .replace(/\son[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // 移除 javascript: 伪协议
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
}

interface SVGParseOptions {
  targetWidthMm?: number;
  targetHeightMm?: number;
}

/**
 * 解析 SVG 路径与基础图形并生成离散化闭合多边形几何
 */
export function parseSVGToShapeGeometry(
  svgStr: string,
  options: SVGParseOptions = {}
): ShapeGeometry {
  const sanitized = sanitizeSVG(svgStr);
  const rawPoints: Point[] = [];

  // 1. 提取 polygon / polyline
  const polyMatch = sanitized.match(/<(?:polygon|polyline)[^>]+points\s*=\s*["']([^"']+)["']/i);
  if (polyMatch) {
    const coords = polyMatch[1].trim().split(/[\s,]+/);
    for (let i = 0; i < coords.length; i += 2) {
      if (i + 1 < coords.length) {
        const x = parseFloat(coords[i]);
        const y = parseFloat(coords[i + 1]);
        if (!isNaN(x) && !isNaN(y)) {
          rawPoints.push({ x: Math.round(x * 10), y: Math.round(y * 10) });
        }
      }
    }
  }

  // 2. 提取 rect
  if (rawPoints.length === 0) {
    const rectMatch = sanitized.match(/<rect[^>]+(?:width\s*=\s*["']([^"']+)["'])[^>]+(?:height\s*=\s*["']([^"']+)["'])/i);
    if (rectMatch) {
      const w = parseFloat(rectMatch[1]) * 10;
      const h = parseFloat(rectMatch[2]) * 10;
      rawPoints.push({ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h });
    }
  }

  // 3. 提取 path
  if (rawPoints.length === 0) {
    const pathMatch = sanitized.match(/<path[^>]+d\s*=\s*["']([^"']+)["']/i);
    if (pathMatch) {
      const pathData = pathMatch[1];
      const parsedPathPoints = parsePathCommands(pathData);
      rawPoints.push(...parsedPathPoints);
    }
  }

  // 4. 兜底默认多边形
  if (rawPoints.length < 3) {
    rawPoints.push(
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 }
    );
  }

  // 5. 坐标归一化
  const rawBBox = calculatePolygonBBox(rawPoints);
  let normalized = rawPoints.map((p) => ({
    x: p.x - rawBBox.x,
    y: p.y - rawBBox.y,
  }));

  // 6. 尺度缩放至指定毫米 (0.1mm 整数)
  if (options.targetWidthMm && options.targetHeightMm) {
    const targetW = Math.round(options.targetWidthMm * 10);
    const targetH = Math.round(options.targetHeightMm * 10);
    const curBBox = calculatePolygonBBox(normalized);
    const scaleX = curBBox.width > 0 ? targetW / curBBox.width : 1;
    const scaleY = curBBox.height > 0 ? targetH / curBBox.height : 1;
    normalized = normalized.map((p) => ({
      x: Math.round(p.x * scaleX),
      y: Math.round(p.y * scaleY),
    }));
  }

  // 7. Douglas-Peucker 顶点精简 (<= 64 顶点)
  const simplified = douglasPeucker(normalized, 2, 64);
  const finalBBox = calculatePolygonBBox(simplified);
  const area = calculatePolygonArea(simplified);

  return {
    kind: 'POLYGON',
    source: 'SVG',
    points: simplified,
    width: finalBBox.width,
    height: finalBBox.height,
    area,
    closed: true,
  };
}

/**
 * 极简健壮的 SVG Path 指令解析器，支持 M, L, H, V, C, Q, Z 及对应小写相对坐标
 */
function parsePathCommands(pathStr: string): Point[] {
  const points: Point[] = [];
  const tokens = pathStr.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/gi) || [];

  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
    }

    if (cmd === 'M' || cmd === 'm') {
      const isRel = cmd === 'm';
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      startX = curX;
      startY = curY;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
      cmd = isRel ? 'l' : 'L'; // 后续数字隐含为 L
    } else if (cmd === 'L' || cmd === 'l') {
      const isRel = cmd === 'l';
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
    } else if (cmd === 'H' || cmd === 'h') {
      const isRel = cmd === 'h';
      const x = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
    } else if (cmd === 'V' || cmd === 'v') {
      const isRel = cmd === 'v';
      const y = parseFloat(tokens[i++]);
      curY = isRel ? curY + y : y;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
    } else if (cmd === 'C' || cmd === 'c') {
      const isRel = cmd === 'c';
      const cp1x = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cp1y = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cp2x = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cp2y = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endX = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endY = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);

      // 三次贝塞尔采样 6 个内插点
      for (let step = 1; step <= 6; step++) {
        const tVal = step / 6;
        const mt = 1 - tVal;
        const bx =
          mt * mt * mt * curX +
          3 * mt * mt * tVal * cp1x +
          3 * mt * tVal * tVal * cp2x +
          tVal * tVal * tVal * endX;
        const by =
          mt * mt * mt * curY +
          3 * mt * mt * tVal * cp1y +
          3 * mt * tVal * tVal * cp2y +
          tVal * tVal * tVal * endY;
        points.push({ x: Math.round(bx * 10), y: Math.round(by * 10) });
      }
      curX = endX;
      curY = endY;
    } else if (cmd === 'Q' || cmd === 'q') {
      const isRel = cmd === 'q';
      const cpx = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cpy = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endX = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endY = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);

      for (let step = 1; step <= 5; step++) {
        const tVal = step / 5;
        const mt = 1 - tVal;
        const bx = mt * mt * curX + 2 * mt * tVal * cpx + tVal * tVal * endX;
        const by = mt * mt * curY + 2 * mt * tVal * cpy + tVal * tVal * endY;
        points.push({ x: Math.round(bx * 10), y: Math.round(by * 10) });
      }
      curX = endX;
      curY = endY;
    } else if (cmd === 'Z' || cmd === 'z') {
      curX = startX;
      curY = startY;
      i++;
    } else {
      // 遇到不识别指令跳过当前 token
      i++;
    }
  }

  return points;
}
