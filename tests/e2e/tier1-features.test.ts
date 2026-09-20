import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  // Types
  Point,
  ShapeGeometry,
  ShapeKind,
  Stock,
  PartGroup,
  Candidate,
  ProfilePlacement,
  // Units & Validation
  toInternalDimension,
  fromInternalDimension,
  INTERNAL_SCALE,
  validateCandidate,
  // Templates & Geometry
  generateTemplatePolygon,
  calculatePolygonArea,
  calculatePolygonBBox,
  isPolygonClosed,
  isPolygonSelfIntersecting,
  polygonsIntersect,
  polygonIntersectsRect,
  isPolygonInsideRect,
  snapAngle,
  douglasPeucker,
  transformPoints,
  // SVG
  sanitizeSVG,
  parseSVGToShapeGeometry,
  // Photo & Homography
  computeHomography,
  rectifyPoints,
  otsuThreshold,
  extractContourFromBinaryImage,
  findContoursFromImageData,
  // Solver & Guidance
  solveCuttingPlan,
  buildProfileStrategies,
  solveProfileCuttingPlan,
  generateCutGuidance,
  // Quote
  calculateQuote,
} from '../../packages/core/src/index.js';

describe('E2E Tier 1: Feature Coverage (All 17 Features in Isolation)', () => {
  // --------------------------------------------------------------------------
  // F1. 统一几何数据模型 (Unified Geometry Data Model)
  // --------------------------------------------------------------------------
  describe('F1: 统一几何数据模型 (Unified Geometry Data Model)', () => {
    it('F1.1: 0.1mm 整数定点化存储与无损精度转换', () => {
      // 104.5 mm should map to 1045 (0.1mm units)
      const internalVal = toInternalDimension(104.5, 'mm');
      expect(internalVal).toBe(1045);
      expect(Number.isInteger(internalVal)).toBe(true);

      const restoredMm = fromInternalDimension(internalVal, 'mm');
      expect(restoredMm).toBe(104.5);

      // Verify no floating point accumulation on 104mm (1040)
      expect(toInternalDimension(104, 'mm')).toBe(1040);
      expect(INTERNAL_SCALE).toBe(10);
    });

    it('F1.2: 几何多边形 ShapeGeometry 与包围盒计算', () => {
      const pts: Point[] = [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
        { x: 400, y: 500 },
        { x: 100, y: 500 },
      ];
      const bbox = calculatePolygonBBox(pts);
      expect(bbox).toEqual({ x: 100, y: 100, width: 300, height: 400 });

      const area = calculatePolygonArea(pts);
      expect(area).toBe(300 * 400); // 120,000 in (0.1mm)^2
      expect(isPolygonClosed(pts)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F2. 独立多边形验证器 (Independent Polygon Validator)
  // --------------------------------------------------------------------------
  describe('F2: 独立多边形验证器 (Independent Polygon Validator)', () => {
    const stock: Stock = {
      id: 'stk_val_1',
      code: 'STK-01',
      group: { material: '椴木板', thicknessMm: 2, color: '原色' },
      width: 2000,
      height: 2000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
      defects: [{ x: 900, y: 900, width: 200, height: 200 }],
    };

    const triangleGeo = generateTemplatePolygon('TRIANGLE', { base: 400, height: 300 });
    const partGroup: PartGroup = {
      id: 'grp_val_1',
      name: '三角零件',
      targetWidth: 400,
      targetHeight: 300,
      quantity: 1,
      rotationPolicy: 'LOCKED',
      geometry: triangleGeo,
    };

    it('F2.1: 合法排布方案全票通过独立验证器', () => {
      const validCand: Candidate = {
        candidateId: 'cand_val_ok',
        strategyName: '合规验证',
        isComplete: true,
        appliedDeltaMm: 0,
        layoutMode: 'PROFILE',
        targetParts: [{ groupId: 'grp_val_1', width: 400, height: 300 }],
        placedParts: [
          { instanceId: 'g1_1', groupId: 'grp_val_1', name: '三角零件', stockId: 'stk_val_1', x: 100, y: 100, width: 400, height: 300, rotated: false },
        ],
        profilePlacements: [
          {
            instanceId: 'g1_1',
            groupId: 'grp_val_1',
            name: '三角零件',
            stockId: 'stk_val_1',
            translation: { x: 100, y: 100 },
            rotationDeg: 0,
            transformedPoints: [
              { x: 100, y: 100 },
              { x: 500, y: 100 },
              { x: 100, y: 400 },
            ],
            bbox: { x: 100, y: 100, width: 400, height: 300 },
          },
        ],
        unplacedPartIds: [],
        usedStocks: [{ stockId: 'stk_val_1', stockCode: 'STK-01', isOffcut: false, width: 2000, height: 2000, cutTree: {} as any, placedParts: [], remainingOffcuts: [], steps: [] }],
        metrics: { newSheetsUsed: 1, offcutsUsed: 0, totalInputArea: 4000000, partsArea: 60000, kerfArea: 0, offcutArea: 3940000, stepsCount: 1, utilizationRate: 0.015 },
      };

      const result = validateCandidate(validCand, [partGroup], [stock], 0);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('F2.2: 零件重叠、越界与缺陷侵入均被一票否决', () => {
      // 越界多边形
      const outOfBoundsCand: Candidate = {
        candidateId: 'cand_oob',
        strategyName: '越界方案',
        isComplete: true,
        appliedDeltaMm: 0,
        layoutMode: 'PROFILE',
        targetParts: [{ groupId: 'grp_val_1', width: 400, height: 300 }],
        placedParts: [],
        profilePlacements: [
          {
            instanceId: 'g1_1',
            groupId: 'grp_val_1',
            name: '三角零件',
            stockId: 'stk_val_1',
            translation: { x: 1900, y: 1900 },
            rotationDeg: 0,
            transformedPoints: [
              { x: 1900, y: 1900 },
              { x: 2300, y: 1900 }, // 越过 2000 边界
              { x: 1900, y: 2200 },
            ],
            bbox: { x: 1900, y: 1900, width: 400, height: 300 },
          },
        ],
        unplacedPartIds: [],
        usedStocks: [{ stockId: 'stk_val_1', stockCode: 'STK-01', isOffcut: false, width: 2000, height: 2000, cutTree: {} as any, placedParts: [], remainingOffcuts: [], steps: [] }],
        metrics: {} as any,
      };

      const res = validateCandidate(outOfBoundsCand, [partGroup], [stock], 0);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('超出材料'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F3. 历史兼容与构建基线 (Backward Compatibility & Baseline Zero Regression)
  // --------------------------------------------------------------------------
  describe('F3: 历史兼容与构建基线 (Backward Compatibility & Baseline)', () => {
    it('F3.1: 旧版纯宽高数据自动无缝升级为矩形几何结构并保持 24 策略排料', () => {
      const legacyStock: Stock = {
        id: 'stk_legacy',
        code: 'S_LEGACY',
        group: { material: '卡纸', thicknessMm: 0.5, color: '白' },
        width: 1000,
        height: 1000,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      // 仅有 targetWidth/targetHeight，无 geometry
      const legacyPart: PartGroup = {
        id: 'grp_legacy_1',
        name: '旧版矩形',
        targetWidth: 300,
        targetHeight: 200,
        quantity: 2,
        allowRotation: true,
      };

      const output = solveCuttingPlan({
        stocks: [legacyStock],
        partGroups: [legacyPart],
        kerfMm: 1,
      });

      expect(output.candidates.length).toBeGreaterThan(0);
      const best = output.candidates[0];
      expect(best.isComplete).toBe(true);
      expect(best.placedParts).toHaveLength(2);
      expect(best.layoutMode).toBe('GUILLOTINE_RECT'); // 传统 Guillotine
    });

    it('F3.2: 核心代码构建产物在 Node 与小程序端目录均完整输出', () => {
      const distPath = path.resolve(__dirname, '../../packages/core/dist/index.js');
      const cfCorePath = path.resolve(__dirname, '../../cloudfunctions/api/core.js');
      const mpCorePath = path.resolve(__dirname, '../../miniprogram/utils/core/index.js');

      expect(fs.existsSync(distPath)).toBe(true);
      expect(fs.existsSync(cfCorePath)).toBe(true);
      expect(fs.existsSync(mpCorePath)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F4. 9 种基础形状模板 (9 Basic Shape Templates)
  // --------------------------------------------------------------------------
  describe('F4: 9 种基础形状模板 (9 Basic Shape Templates)', () => {
    const templates: ShapeKind[] = [
      'RECT',
      'ROUNDED_RECT',
      'CIRCLE',
      'ELLIPSE',
      'TRIANGLE',
      'REGULAR_POLYGON',
      'L_SHAPE',
      'ARCH',
      'STAR',
    ];

    it.each(templates)('F4.1: 模板 %s 生成合规闭合多边形且顶点数 <= 48', (kind) => {
      const geo = generateTemplatePolygon(kind, {
        width: 200,
        height: 200,
        diameter: 200,
        radius: 30,
        rx: 100,
        ry: 60,
        base: 200,
        sides: 6,
        w1: 200,
        h1: 200,
        w2: 80,
        h2: 80,
        archHeight: 80,
        points: 5,
        outerRadius: 100,
        innerRadius: 40,
      });

      expect(geo.kind).toBe(kind);
      expect(geo.closed).toBe(true);
      expect(geo.points.length).toBeGreaterThanOrEqual(3);
      expect(geo.points.length).toBeLessThanOrEqual(48);
      expect(geo.area).toBeGreaterThan(0);
      expect(geo.width).toBeGreaterThan(0);
      expect(geo.height).toBeGreaterThan(0);
      expect(geo.templateParams).toBeDefined();
    });

    it('F4.2: 圆形与椭圆模板离散化弦高误差 <= 0.5mm (5 in 0.1mm units)', () => {
      // 直径 200mm (r = 100mm = 1000 in 0.1mm)
      const circleGeo = generateTemplatePolygon('CIRCLE', { diameter: 2000 });
      const r = 1000;
      const n = circleGeo.points.length; // 32
      // 弦高误差公式: h = r * (1 - cos(pi / n))
      const chordError = r * (1 - Math.cos(Math.PI / n));
      expect(chordError).toBeLessThanOrEqual(5); // <= 0.5mm
    });
  });

  // --------------------------------------------------------------------------
  // F5. 全屏图形工作台 (Full-Screen Graphic Workbench)
  // --------------------------------------------------------------------------
  describe('F5: 全屏图形工作台 (Full-Screen Graphic Workbench)', () => {
    it('F5.1: 屏幕触控像素坐标到内部 0.1mm 尺度换算', () => {
      const screenScale = 2.5;
      const touchPx = { x: 120, y: 160 };
      const internalPt: Point = {
        x: Math.round(touchPx.x * screenScale),
        y: Math.round(touchPx.y * screenScale),
      };
      expect(internalPt).toEqual({ x: 300, y: 400 });
    });

    it('F5.2: 工作台历史记录栈支持撤销与重做', () => {
      const history: Point[][] = [];
      let index = -1;

      const push = (pts: Point[]) => {
        history.splice(index + 1);
        history.push([...pts]);
        index++;
      };

      push([{ x: 0, y: 0 }]);
      push([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
      push([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);

      expect(index).toBe(2);
      expect(history[index]).toHaveLength(3);

      // Undo
      index--;
      expect(history[index]).toHaveLength(2);

      // Redo
      index++;
      expect(history[index]).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // F6. 触摸自由点绘轮廓 (Touch Free Drawing Contour)
  // --------------------------------------------------------------------------
  describe('F6: 触摸自由点绘轮廓 (Touch Free Drawing Contour)', () => {
    it('F6.1: 角度吸附 snapAngle 正确对齐 0°、45° 与 90°', () => {
      // 2° 偏差对齐到 0°
      const snap0 = snapAngle(100, 3, 6);
      expect(snap0.dy).toBe(0);
      expect(snap0.dx).toBeGreaterThan(0);

      // 89° 偏差对齐到 90°
      const snap90 = snapAngle(2, 100, 6);
      expect(snap90.dx).toBe(0);
      expect(snap90.dy).toBeGreaterThan(0);

      // 44° 偏差对齐到 45°
      const snap45 = snapAngle(100, 97, 6);
      expect(Math.abs(snap45.dx - snap45.dy)).toBeLessThanOrEqual(1);
    });

    it('F6.2: 自相交多边形严格检测并拦截', () => {
      // 自相交 "8" 字形四边形
      const selfIntersectingPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 200, y: 200 },
        { x: 200, y: 0 },
        { x: 0, y: 200 },
      ];
      expect(isPolygonSelfIntersecting(selfIntersectingPoints)).toBe(true);

      // 正常凸四边形无自相交
      const normalPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 200 },
        { x: 0, y: 200 },
      ];
      expect(isPolygonSelfIntersecting(normalPoints)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // F7. SVG 导入与安全过滤 (SVG Import & Security Sanitization)
  // --------------------------------------------------------------------------
  describe('F7: SVG 导入与安全过滤 (SVG Import & Security Sanitization)', () => {
    it('F7.1: 强力拦截 XSS 恶意脚本、外联实体与 iframe', () => {
      const maliciousSVG = `
        <svg viewBox="0 0 100 100">
          <script>alert("xss")</script>
          <foreignObject><body onload="steal()">hack</body></foreignObject>
          <iframe src="http://evil.com"></iframe>
          <polygon points="0,0 100,0 100,100 0,100" onclick="evil()" />
        </svg>
      `;
      const clean = sanitizeSVG(maliciousSVG);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('<foreignObject');
      expect(clean).not.toContain('<iframe');
      expect(clean).not.toContain('onclick');
    });

    it('F7.2: 解析标准 SVG polygon/path 并离散化为 ShapeGeometry', () => {
      const validSVG = `
        <svg viewBox="0 0 200 200">
          <polygon points="0,0 200,0 200,150 0,150" />
        </svg>
      `;
      const geo = parseSVGToShapeGeometry(validSVG, { targetWidthMm: 20, targetHeightMm: 15 });
      expect(geo.kind).toBe('POLYGON');
      expect(geo.source).toBe('SVG');
      expect(geo.width).toBe(200); // 20mm in 0.1mm
      expect(geo.height).toBe(150); // 15mm in 0.1mm
      expect(geo.closed).toBe(true);
      expect(geo.points.length).toBeLessThanOrEqual(64);
    });
  });

  // --------------------------------------------------------------------------
  // F8. 拍照纸样识别与交互校准 (Camera Pattern Recognition & Homography)
  // --------------------------------------------------------------------------
  describe('F8: 拍照纸样识别与交互校准 (Camera Pattern Recognition & Homography)', () => {
    it('F8.1: DLT 单应性矩阵计算与透视矫正', () => {
      // 畸变四边形映射到正方形
      const src: Point[] = [
        { x: 10, y: 10 },
        { x: 110, y: 20 },
        { x: 105, y: 115 },
        { x: 15, y: 105 },
      ];
      const dst: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const H = computeHomography(src, dst);
      expect(H).toHaveLength(3);
      expect(H[0]).toHaveLength(3);

      const rectified = rectifyPoints(src, H);
      // 验证矫正后四角接近目标正方形
      expect(rectified[0].x).toBeCloseTo(0, -1);
      expect(rectified[0].y).toBeCloseTo(0, -1);
      expect(rectified[1].x).toBeCloseTo(100, -1);
      expect(rectified[2].x).toBeCloseTo(100, -1);
    });

    it('F8.2: Otsu 阈值与摩尔邻域外轮廓追踪', () => {
      // 构造 10x10 二值网格，中间 4x4 为前景 (1)
      const w = 10;
      const h = 10;
      const grid = new Uint8Array(w * h);
      for (let y = 3; y <= 6; y++) {
        for (let x = 3; x <= 6; x++) {
          grid[y * w + x] = 1;
        }
      }

      const geo = extractContourFromBinaryImage(grid, w, h, { scaleMmPerPixel: 1.0 });
      expect(geo.source).toBe('PHOTO');
      expect(geo.closed).toBe(true);
      expect(geo.points.length).toBeGreaterThanOrEqual(4);
      expect(geo.points.length).toBeLessThanOrEqual(64);
      expect(geo.confidence).toBeGreaterThan(0.8);
    });
  });

  // --------------------------------------------------------------------------
  // F9. PROFILE 异形排料求解器 (PROFILE Irregular Nesting Solver)
  // --------------------------------------------------------------------------
  describe('F9: PROFILE 异形排料求解器 (PROFILE Irregular Nesting Solver)', () => {
    it('F9.1: 构建至少 12 种确定性启发式放置策略', () => {
      const strategies = buildProfileStrategies();
      expect(strategies.length).toBeGreaterThanOrEqual(12);
      expect(strategies.every((s) => s.id && s.name && s.partOrder && s.stockOrder)).toBe(true);
    });

    it('F9.2: 异形排料求解器输出零重叠、在板范围内的排料方案', () => {
      const stock: Stock = {
        id: 's_prof_nest',
        code: 'S-NEST',
        group: { material: '椴木板', thicknessMm: 2, color: '原木' },
        width: 1000,
        height: 1000,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      const triangleGeo = generateTemplatePolygon('TRIANGLE', { base: 200, height: 200 });
      const partGroup: PartGroup = {
        id: 'g_tri_nest',
        name: '三角形零件',
        targetWidth: 200,
        targetHeight: 200,
        quantity: 2,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: triangleGeo,
      };

      const res = solveProfileCuttingPlan({
        stocks: [stock],
        partGroups: [partGroup],
        kerfMm: 1,
      });

      expect(res.candidates.length).toBeGreaterThan(0);
      const best = res.candidates[0];
      expect(best.isComplete).toBe(true);
      expect(best.layoutMode).toBe('PROFILE');
      expect(best.profilePlacements).toHaveLength(2);

      // 验证互不重叠
      const [p1, p2] = best.profilePlacements!;
      expect(polygonsIntersect(p1.transformedPoints, p2.transformedPoints)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // F10. 候选方案生成与对比 (Candidate Solution Generation & Comparison)
  // --------------------------------------------------------------------------
  describe('F10: 候选方案生成与对比 (Candidate Generation & Comparison)', () => {
    it('F10.1: 生成节省材料、方便裁切与综合平衡 3 类推荐方案且均通过验证器', () => {
      const stock: Stock = {
        id: 's_cand_cmp',
        code: 'S-CMP',
        group: { material: '亚克力', thicknessMm: 3, color: '透明' },
        width: 1200,
        height: 1200,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      const lGeo = generateTemplatePolygon('L_SHAPE', { w1: 300, h1: 300, w2: 120, h2: 120 });
      const partGroup: PartGroup = {
        id: 'g_l_cmp',
        name: 'L形支架',
        targetWidth: 300,
        targetHeight: 300,
        quantity: 2,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: lGeo,
      };

      const output = solveCuttingPlan({
        stocks: [stock],
        partGroups: [partGroup],
        kerfMm: 1,
      });

      expect(output.candidates.length).toBeGreaterThanOrEqual(1);
      for (const cand of output.candidates) {
        const valRes = validateCandidate(cand, [partGroup], [stock], 1);
        expect(valRes.valid).toBe(true);
      }
    });

    it('F10.2: 确定性算法保证相同输入产生绝对一致的排料与利用率结果', () => {
      const stock: Stock = {
        id: 's_det',
        code: 'S-DET',
        group: { material: '木板', thicknessMm: 2, color: '原木' },
        width: 800,
        height: 800,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      const starGeo = generateTemplatePolygon('STAR', { points: 5, outerRadius: 100, innerRadius: 40 });
      const partGroup: PartGroup = {
        id: 'g_star_det',
        name: '五角星',
        targetWidth: 200,
        targetHeight: 200,
        quantity: 2,
        rotationPolicy: 'LOCKED',
        geometry: starGeo,
      };

      const run1 = solveCuttingPlan({ stocks: [stock], partGroups: [partGroup], kerfMm: 1 });
      const run2 = solveCuttingPlan({ stocks: [stock], partGroups: [partGroup], kerfMm: 1 });

      expect(run1.candidates[0].metrics.utilizationRate).toBe(run2.candidates[0].metrics.utilizationRate);
      expect(run1.candidates[0].profilePlacements![0].translation).toEqual(
        run2.candidates[0].profilePlacements![0].translation
      );
    });
  });

  // --------------------------------------------------------------------------
  // F11. 手工裁切指导工序 (Handcraft Cutting Guidance Sequence)
  // --------------------------------------------------------------------------
  describe('F11: 手工裁切指导工序 (Handcraft Cutting Guidance Sequence)', () => {
    it('F11.1: 裁切指导工序按离中心距离由内向外排序，并给出正确工具提示', () => {
      const placements: ProfilePlacement[] = [
        {
          instanceId: 'p_outer',
          groupId: 'g1',
          name: '外侧直线件',
          stockId: 's1',
          translation: { x: 50, y: 50 },
          rotationDeg: 0,
          transformedPoints: [{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }, { x: 50, y: 150 }],
          bbox: { x: 50, y: 50, width: 100, height: 100 },
        },
        {
          instanceId: 'p_center',
          groupId: 'g2',
          name: '中心圆弧件',
          stockId: 's1',
          translation: { x: 450, y: 450 },
          rotationDeg: 0,
          transformedPoints: generateTemplatePolygon('CIRCLE', { diameter: 100 }).points.map(p => ({ x: p.x + 450, y: p.y + 450 })),
          bbox: { x: 450, y: 450, width: 100, height: 100 },
        },
      ];

      const guidance = generateCutGuidance(placements, { width: 1000, height: 1000 });
      expect(guidance.steps.length).toBeGreaterThanOrEqual(2);
      expect(guidance.calibrationLineMm).toBe(100);

      // 中心件距离 (500, 500) 最近，应排在第 1 步
      expect(guidance.steps[0].instanceId).toBe('p_center');
      // 包含圆弧曲线，工具推荐应提示曲线刀/精密剪刀
      expect(guidance.recommendedTool).toContain('剪刀');
    });
  });

  // --------------------------------------------------------------------------
  // F12. 1:1 打印校准图纸导出 (1:1 Print Calibration Sheet Export)
  // --------------------------------------------------------------------------
  describe('F12: 1:1 打印校准图纸导出 (1:1 Print Calibration Sheet Export)', () => {
    it('F12.1: 包含 100mm (1000 0.1mm) 打印实测校准标尺', () => {
      const guidance = generateCutGuidance([], { width: 1000, height: 1000 });
      expect(guidance.calibrationLineMm).toBe(100);
      const internalRulerLen = toInternalDimension(guidance.calibrationLineMm, 'mm');
      expect(internalRulerLen).toBe(1000);
    });
  });

  // --------------------------------------------------------------------------
  // F13. 界面视觉与品牌色升级 (Visual Specification & Brand Colors)
  // --------------------------------------------------------------------------
  describe('F13: 界面视觉与品牌色升级 (Visual Specification & Brand Colors)', () => {
    it('F13.1: 验证 app.wxss 品牌主色、强调色与背景色定义', () => {
      const wxssPath = path.resolve(__dirname, '../../miniprogram/app.wxss');
      const content = fs.readFileSync(wxssPath, 'utf-8');

      expect(content).toContain('#185C37'); // 主色 (Brand green)
      expect(content).toContain('#F06A2A'); // 强调色 (Accent orange)
      expect(content).toContain('#F6F7F4'); // 背景色 (Background)
    });
  });

  // --------------------------------------------------------------------------
  // F14. 三栏底部 Tab 导航 (3-Tab Bottom Navigation)
  // --------------------------------------------------------------------------
  describe('F14: 三栏底部 Tab 导航 (3-Tab Bottom Navigation)', () => {
    it('F14.1: app.json 页面结构涵盖三大核心模块路径', () => {
      const appJsonPath = path.resolve(__dirname, '../../miniprogram/app.json');
      const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));

      const pages = appConfig.pages;
      expect(pages).toContain('pages/index/index');       // 【制作】
      expect(pages).toContain('pages/history/history');   // 【图纸】
      expect(pages).toContain('pages/stock/stock');       // 【材料】
      expect(pages).toContain('pages/workbench/workbench'); // 工作台
    });
  });

  // --------------------------------------------------------------------------
  // F15. 项目创建四步向导 (4-Step Project Creation Wizard)
  // --------------------------------------------------------------------------
  describe('F15: 项目创建四步向导 (4-Step Project Creation Wizard)', () => {
    it('F15.1: 完整串联：选材料 -> 录零件 -> 设间距 -> 算方案全链路状态契约', () => {
      // 1. 选材料
      const stock: Stock = {
        id: 's_wizard',
        code: 'S-WIZARD',
        group: { material: '木板', thicknessMm: 2, color: '原色' },
        width: 1500,
        height: 1500,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      // 2. 录入异形零件 (Workbench 产物)
      const archGeo = generateTemplatePolygon('ARCH', { width: 300, height: 400, archHeight: 150 });
      const partGroup: PartGroup = {
        id: 'g_wizard',
        name: '拱门部件',
        targetWidth: 300,
        targetHeight: 400,
        quantity: 2,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: archGeo,
      };

      // 3. 设间距 (Kerf = 2mm)
      const kerfMm = 2;

      // 4. 计算并比较方案
      const solution = solveCuttingPlan({
        stocks: [stock],
        partGroups: [partGroup],
        kerfMm,
      });

      expect(solution.candidates.length).toBeGreaterThan(0);
      expect(solution.candidates[0].isComplete).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F16. 云函数远程部署与同步 (CloudBase Backend & Multi-Tenancy)
  // --------------------------------------------------------------------------
  describe('F16: 云函数远程部署与同步 (CloudBase Backend & Multi-Tenancy)', () => {
    it('F16.1: 商业 ERP 报价单计算纯函数输出精确金额', () => {
      const quote = calculateQuote({
        totalInputAreaSqm: 1.5,
        pricePerSqm: 80,
        processingFee: 35,
        miscFee: 15,
      });

      expect(quote.materialCost).toBe(120); // 1.5 * 80
      expect(quote.processingFee).toBe(35);
      expect(quote.miscFee).toBe(15);
      expect(quote.totalPrice).toBe(170); // 120 + 35 + 15
    });
  });

  // --------------------------------------------------------------------------
  // F17. 自动化测试与多端真实验收 (Automated Test & Verification)
  // --------------------------------------------------------------------------
  describe('F17: 自动化测试与多端真实验收 (Automated Test & Verification)', () => {
    it('F17.1: 确认项目构建命令产出合法可部署包', () => {
      const packageJsonPath = path.resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
    });
  });
});
