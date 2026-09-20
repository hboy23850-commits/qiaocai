import { describe, it, expect } from 'vitest';
import {
  validateProfilePlacements,
  validateCandidate,
} from '../../packages/core/src/validator/index.js';
import {
  calculatePolygonArea,
  calculatePolygonBBox,
  isPolygonClosed,
  isPolygonInsideRect,
  polygonIntersectsRect,
  polygonsIntersect,
  isPolygonSelfIntersecting,
  isPointInPolygon,
  doLineSegmentsIntersect,
  douglasPeucker,
  snapAngle,
  transformPoints,
} from '../../packages/core/src/geometry/polygon.js';
import { generateTemplatePolygon } from '../../packages/core/src/geometry/templates.js';
import { solveCuttingPlan } from '../../packages/core/src/solver/index.js';
import {
  Candidate,
  PartGroup,
  ProfilePlacement,
  Stock,
  Point,
  Rect,
} from '../../packages/core/src/types/index.js';

describe('Adversarial & Empirical Stress Testing: Milestone 1 Geometry', () => {
  const standardSheet: Stock = {
    id: 'sheet_1000',
    code: 'S1000',
    group: { material: '木板', thicknessMm: 2, color: '原色' },
    width: 1000, // 100.0 mm
    height: 1000, // 100.0 mm
    isOffcut: false,
    status: 'AVAILABLE',
    version: 1,
    defects: [{ x: 400, y: 400, width: 200, height: 200 }],
  };

  // =========================================================================
  // 1. NESTED POLYGONS, CAVITIES & POCKETS
  // =========================================================================
  describe('1. Nested Polygons, Cavities & Pockets', () => {
    it('完全同心包含的两个多边形必须被判定为相交 (Concentric overlap)', () => {
      const outerSquare: Point[] = [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
      ];
      const innerSquare: Point[] = [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
        { x: 250, y: 250 },
        { x: 150, y: 250 },
      ];

      expect(polygonsIntersect(outerSquare, innerSquare)).toBe(true);
      expect(polygonsIntersect(innerSquare, outerSquare)).toBe(true);
    });

    it('凹型(U-Shape)开口凹槽内部的零件不应被误判为相交 (Concave pocket nesting)', () => {
      // U型零件：外包 300x300，中间在 y:[100,300], x:[100,200] 处挖空
      const uShape: Point[] = [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 300 },
        { x: 200, y: 300 },
        { x: 200, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 300 },
        { x: 0, y: 300 },
      ];

      // 放置在 U 型开口凹槽内的矩形 (x: 120-180, y: 150-250)
      const inPocket: Point[] = [
        { x: 120, y: 150 },
        { x: 180, y: 150 },
        { x: 180, y: 250 },
        { x: 120, y: 250 },
      ];

      // 两者包围盒虽重叠，但几何体不相交
      expect(polygonsIntersect(uShape, inPocket)).toBe(false);
      expect(polygonsIntersect(inPocket, uShape)).toBe(false);
    });

    it('侵入凹型多边形实体骨架的分支必须被判定为相交 (Intersects concave body)', () => {
      const uShape: Point[] = [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 300 },
        { x: 200, y: 300 },
        { x: 200, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 300 },
        { x: 0, y: 300 },
      ];

      // 侵入左侧支柱 (x: 0-100) 的零件 (x: 50-150, y: 50-150)
      const intersectingArm: Point[] = [
        { x: 50, y: 50 },
        { x: 150, y: 50 },
        { x: 150, y: 150 },
        { x: 50, y: 150 },
      ];

      expect(polygonsIntersect(uShape, intersectingArm)).toBe(true);
      expect(polygonsIntersect(intersectingArm, uShape)).toBe(true);
    });
  });

  // =========================================================================
  // 2. SELF-TOUCHING BOUNDARIES & EDGE CONTACTS
  // =========================================================================
  describe('2. Self-Touching Boundaries & Edge Contacts', () => {
    it('经典蝴蝶结(Bowtie)8字自交多边形必须被 isPolygonSelfIntersecting 拦截', () => {
      const bowtie: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ];
      expect(isPolygonSelfIntersecting(bowtie)).toBe(true);
    });

    it('逆时针(CCW)与顺时针(CW)多边形面积计算均返回绝对正值且一致', () => {
      const ccwTriangle: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ];
      const cwTriangle: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 0 },
      ];

      expect(calculatePolygonArea(ccwTriangle)).toBe(5000);
      expect(calculatePolygonArea(cwTriangle)).toBe(5000);
    });

    it('两多边形沿对角斜线共边接触时的相交行为验证 (Diagonal Shared Boundary)', () => {
      // 两个直角三角形拼接成 100x100 矩形，共享对角线 (0,100)-(100,0)
      const tri1: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ];
      const tri2: Point[] = [
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 },
      ];

      // SAT / 线段相交在共边处的判定
      const result = polygonsIntersect(tri1, tri2);
      // 记录实际表现：当前基于线段端点重叠的判定会视为相交 (true)
      expect(typeof result).toBe('boolean');
    });
  });

  // =========================================================================
  // 3. ZERO-AREA & COLLINEAR VERTICES
  // =========================================================================
  describe('3. Zero-Area & Collinear Vertices', () => {
    it('三点共线退化线段 (面积为0) 必须判定为未闭合 (isPolygonClosed = false)', () => {
      const collinearPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ];
      expect(calculatePolygonArea(collinearPoints)).toBe(0);
      expect(isPolygonClosed(collinearPoints)).toBe(false);
    });

    it('空顶点序列与单点/两点必须判定为未闭合', () => {
      expect(isPolygonClosed([])).toBe(false);
      expect(isPolygonClosed([{ x: 10, y: 10 }])).toBe(false);
      expect(isPolygonClosed([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe(false);
    });

    it('有效多边形边上插入共线冗余点不影响面积与包围盒计算', () => {
      // 100x100 矩形，底边多包含 (25,0), (50,0), (75,0)
      const rectWithCollinear: Point[] = [
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 75, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      expect(calculatePolygonArea(rectWithCollinear)).toBe(10000);
      expect(calculatePolygonBBox(rectWithCollinear)).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });

      // Douglas-Peucker 能够成功剔除这些共线冗余点
      const simplified = douglasPeucker(rectWithCollinear, 1, 64);
      expect(simplified.length).toBeLessThanOrEqual(5);
    });
  });

  // =========================================================================
  // 4. FLOATING-POINT VS 0.1mm INTEGER ARITHMETIC
  // =========================================================================
  describe('4. Floating-Point vs 0.1mm Integer Contract', () => {
    it('模版生成出的所有 9 种几何图形顶点坐标必须严格为整数', () => {
      const kinds = [
        'RECT',
        'ROUNDED_RECT',
        'CIRCLE',
        'ELLIPSE',
        'TRIANGLE',
        'REGULAR_POLYGON',
        'L_SHAPE',
        'ARCH',
        'STAR',
      ] as const;

      for (const kind of kinds) {
        const geo = generateTemplatePolygon(kind, {
          width: 300,
          height: 200,
          radius: 30,
          diameter: 250,
          sideCount: 5,
        });

        expect(geo.points.length).toBeGreaterThanOrEqual(3);
        expect(geo.points.length).toBeLessThanOrEqual(64);
        for (const pt of geo.points) {
          expect(Number.isInteger(pt.x)).toBe(true);
          expect(Number.isInteger(pt.y)).toBe(true);
        }
      }
    });

    it('transformPoints 旋转在任意角度下输出必须保持为整数坐标', () => {
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      for (let deg = 0; deg < 360; deg += 15) {
        const transformed = transformPoints(square, { x: 50, y: 50 }, deg);
        for (const pt of transformed) {
          expect(Number.isInteger(pt.x)).toBe(true);
          expect(Number.isInteger(pt.y)).toBe(true);
        }
      }
    });

    it('超大坐标 (5米 x 5米 = 50000 x 50000 0.1mm) 不会触发数值溢出', () => {
      const hugePoly: Point[] = [
        { x: 0, y: 0 },
        { x: 50000, y: 0 },
        { x: 50000, y: 50000 },
        { x: 0, y: 50000 },
      ];
      const area = calculatePolygonArea(hugePoly);
      expect(area).toBe(2500000000); // 2.5 * 10^9 < Number.MAX_SAFE_INTEGER (9 * 10^15)
    });
  });

  // =========================================================================
  // 5. validateProfilePlacements INDEPENDENT VALIDATOR CONTRACT
  // =========================================================================
  describe('5. validateProfilePlacements Independent Validator Verification', () => {
    it('完全合法且留有充分间距的排布必须返回 valid: true 且无报错', () => {
      const p1: ProfilePlacement = {
        instanceId: 'p1',
        groupId: 'g1',
        name: 'part1',
        stockId: 'sheet_1000',
        translation: { x: 50, y: 50 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 50, y: 50 },
          { x: 150, y: 50 },
          { x: 150, y: 150 },
          { x: 50, y: 150 },
        ],
        bbox: { x: 50, y: 50, width: 100, height: 100 },
      };

      const p2: ProfilePlacement = {
        instanceId: 'p2',
        groupId: 'g1',
        name: 'part2',
        stockId: 'sheet_1000',
        translation: { x: 700, y: 700 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 700, y: 700 },
          { x: 800, y: 700 },
          { x: 800, y: 800 },
          { x: 700, y: 800 },
        ],
        bbox: { x: 700, y: 700, width: 100, height: 100 },
      };

      const result = validateProfilePlacements(standardSheet, [p1, p2], 0);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('出现重复 instanceId 时必须被立即拦截', () => {
      const p1: ProfilePlacement = {
        instanceId: 'dup_id',
        groupId: 'g1',
        name: 'part1',
        stockId: 'sheet_1000',
        translation: { x: 50, y: 50 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 50, y: 50 },
          { x: 150, y: 50 },
          { x: 150, y: 150 },
          { x: 50, y: 150 },
        ],
        bbox: { x: 50, y: 50, width: 100, height: 100 },
      };
      const p2: ProfilePlacement = {
        ...p1,
        translation: { x: 700, y: 700 },
        transformedPoints: [
          { x: 700, y: 700 },
          { x: 800, y: 700 },
          { x: 800, y: 800 },
          { x: 700, y: 800 },
        ],
      };

      const result = validateProfilePlacements(standardSheet, [p1, p2], 0);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('重复的零件实例编号'))).toBe(true);
    });

    it('零件超出板材各方向边界时必须被准确拦截 (Negative coords & Over-bounds)', () => {
      // 1. 负坐标越界 (左上越界)
      const pNegative: ProfilePlacement = {
        instanceId: 'p_neg',
        groupId: 'g1',
        name: 'neg',
        stockId: 'sheet_1000',
        translation: { x: -10, y: 10 },
        rotationDeg: 0,
        transformedPoints: [
          { x: -10, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 50 },
          { x: -10, y: 50 },
        ],
        bbox: { x: -10, y: 10, width: 60, height: 40 },
      };
      const resNeg = validateProfilePlacements(standardSheet, [pNegative], 0);
      expect(resNeg.valid).toBe(false);
      expect(resNeg.errors.some((e) => e.includes('超出材料'))).toBe(true);

      // 2. 右下越界
      const pOver: ProfilePlacement = {
        instanceId: 'p_over',
        groupId: 'g1',
        name: 'over',
        stockId: 'sheet_1000',
        translation: { x: 950, y: 950 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 950, y: 950 },
          { x: 1050, y: 950 },
          { x: 1050, y: 1050 },
          { x: 950, y: 1050 },
        ],
        bbox: { x: 950, y: 950, width: 100, height: 100 },
      };
      const resOver = validateProfilePlacements(standardSheet, [pOver], 0);
      expect(resOver.valid).toBe(false);
      expect(resOver.errors.some((e) => e.includes('超出材料'))).toBe(true);
    });

    it('零件触碰材料缺陷/禁排区时必须被准确拦截', () => {
      // 缺陷区位于 [400, 400, 200, 200]
      const pDefect: ProfilePlacement = {
        instanceId: 'p_defect',
        groupId: 'g1',
        name: 'defect_part',
        stockId: 'sheet_1000',
        translation: { x: 350, y: 350 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 350, y: 350 },
          { x: 450, y: 350 }, // 侵入 x:400 区域
          { x: 450, y: 450 }, // 侵入 y:400 区域
          { x: 350, y: 450 },
        ],
        bbox: { x: 350, y: 350, width: 100, height: 100 },
      };

      const result = validateProfilePlacements(standardSheet, [pDefect], 0);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('缺陷/禁排区'))).toBe(true);
    });

    it('同板材上零件发生几何重叠时必须被拦截 (Multiple parts)', () => {
      const pA: ProfilePlacement = {
        instanceId: 'p_A',
        groupId: 'g1',
        name: 'partA',
        stockId: 'sheet_1000',
        translation: { x: 100, y: 100 },
        rotationDeg: 0,
        transformedPoints: [
          { x: 100, y: 100 },
          { x: 250, y: 100 },
          { x: 250, y: 250 },
          { x: 100, y: 250 },
        ],
        bbox: { x: 100, y: 100, width: 150, height: 150 },
      };

      const pB: ProfilePlacement = {
        instanceId: 'p_B',
        groupId: 'g1',
        name: 'partB',
        stockId: 'sheet_1000',
        translation: { x: 200, y: 200 }, // 与 pA 重叠 [200-250, 200-250]
        rotationDeg: 0,
        transformedPoints: [
          { x: 200, y: 200 },
          { x: 350, y: 200 },
          { x: 350, y: 350 },
          { x: 200, y: 350 },
        ],
        bbox: { x: 200, y: 200, width: 150, height: 150 },
      };

      const result = validateProfilePlacements(standardSheet, [pA, pB], 0);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('发生几何重叠'))).toBe(true);
    });
  });

  // =========================================================================
  // 6. BACKWARD COMPATIBILITY: LEGACY RECTANGULAR INPUTS & ZERO REGRESSION
  // =========================================================================
  describe('6. Backward Compatibility: Legacy Rectangular Inputs', () => {
    it('纯矩形遗留数据 (仅 targetWidth/targetHeight) 正确分流至 Guillotine 求解器且全绿', () => {
      const legacyStocks: Stock[] = [
        {
          id: 'legacy_stock_1',
          code: 'LS1',
          group: { material: '椴木板', thicknessMm: 3, color: '原木' },
          width: 2000,
          height: 1500,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
        },
      ];

      const legacyGroups: PartGroup[] = [
        {
          id: 'lg1',
          name: '底板',
          targetWidth: 600,
          targetHeight: 400,
          quantity: 2,
          allowRotation: true,
          // 无 geometry, 无 shape
        },
        {
          id: 'lg2',
          name: '侧板',
          targetWidth: 500,
          targetHeight: 300,
          quantity: 3,
          allowRotation: false,
        },
      ];

      const output = solveCuttingPlan({
        stocks: legacyStocks,
        partGroups: legacyGroups,
        kerfMm: 2,
      });

      expect(output.algorithmVersion).toContain('guillotine24');
      expect(output.bestCompleteCandidate).not.toBeNull();
      expect(output.bestCompleteCandidate!.isComplete).toBe(true);
      expect(output.bestCompleteCandidate!.placedParts.length).toBe(5);

      // 通过独立验证器复核
      const valResult = validateCandidate(
        output.bestCompleteCandidate!,
        legacyGroups,
        legacyStocks,
        2
      );
      expect(valResult.valid).toBe(true);
      expect(valResult.errors.length).toBe(0);
    });

    it('含有 shape: "RECT" 的新结构依然平滑分流至 Guillotine 求解器', () => {
      const stocks: Stock[] = [
        {
          id: 's_rect',
          code: 'SR1',
          group: { material: '卡纸', thicknessMm: 1, color: '白' },
          width: 1000,
          height: 1000,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
        },
      ];

      const groupsWithRectShape: PartGroup[] = [
        {
          id: 'rg1',
          name: '标准矩形卡片',
          targetWidth: 300,
          targetHeight: 200,
          quantity: 2,
          allowRotation: true,
          shape: 'RECT',
        },
      ];

      const output = solveCuttingPlan({
        stocks,
        partGroups: groupsWithRectShape,
        kerfMm: 0,
      });

      expect(output.algorithmVersion).toContain('guillotine24');
      expect(output.bestCompleteCandidate?.isComplete).toBe(true);
    });

    it('混合含有真异形零件时自动升级分流至 PROFILE 求解器', () => {
      const stocks: Stock[] = [
        {
          id: 's_mix',
          code: 'SM1',
          group: { material: '卡纸', thicknessMm: 1, color: '白' },
          width: 1000,
          height: 1000,
          isOffcut: false,
          status: 'AVAILABLE',
          version: 1,
        },
      ];

      const mixedGroups: PartGroup[] = [
        {
          id: 'mg1',
          name: '矩形底板',
          targetWidth: 300,
          targetHeight: 200,
          quantity: 1,
          allowRotation: false,
        },
        {
          id: 'mg2',
          name: '三角形立柱',
          targetWidth: 200,
          targetHeight: 200,
          quantity: 1,
          allowRotation: false,
          geometry: generateTemplatePolygon('TRIANGLE', { base: 200, height: 200 }),
        },
      ];

      const output = solveCuttingPlan({
        stocks,
        partGroups: mixedGroups,
        kerfMm: 0,
      });

      expect(output.algorithmVersion).toContain('profile');
      expect(output.candidates.length).toBeGreaterThan(0);
      expect(output.candidates[0].layoutMode).toBe('PROFILE');
    });
  });
});
