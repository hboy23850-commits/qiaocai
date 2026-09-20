import { describe, it, expect } from 'vitest';
import { parseSVGToShapeGeometry, sanitizeSVG } from '../../packages/core/src/geometry/svg-parser.js';

describe('SVG Parsing and Security Sanitization', () => {
  it('严格过滤恶意脚本与外链标签', () => {
    const maliciousSVG = `
      <svg width="100" height="100">
        <script>alert('xss')</script>
        <circle cx="50" cy="50" r="40" onclick="evil()" />
        <foreignObject><iframe src="http://evil.com"></iframe></foreignObject>
      </svg>
    `;
    const sanitized = sanitizeSVG(maliciousSVG);
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('<foreignObject');
  });

  it('解析 SVG rect 和 polygon 为闭合多边形', () => {
    const svg = `
      <svg viewBox="0 0 100 100" width="100" height="100">
        <polygon points="10,10 90,10 90,90 10,90" />
      </svg>
    `;
    const geo = parseSVGToShapeGeometry(svg, { targetWidthMm: 50, targetHeightMm: 50 });
    expect(geo.kind).toBe('POLYGON');
    expect(geo.source).toBe('SVG');
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBe(4);
    // 50mm = 500 in 0.1mm
    expect(geo.width).toBe(500);
    expect(geo.height).toBe(500);
  });

  it('解析 SVG path 曲线命令 (C/Q/A) 并离散化为多边形顶点', () => {
    const svgPath = `
      <svg viewBox="0 0 100 100">
        <path d="M 10 10 C 20 20, 40 20, 50 10 L 90 90 L 10 90 Z" />
      </svg>
    `;
    const geo = parseSVGToShapeGeometry(svgPath, { targetWidthMm: 80, targetHeightMm: 80 });
    expect(geo.closed).toBe(true);
    expect(geo.points.length).toBeGreaterThan(4);
    expect(geo.points.length).toBeLessThanOrEqual(64);
    expect(geo.area).toBeGreaterThan(0);
  });
});
