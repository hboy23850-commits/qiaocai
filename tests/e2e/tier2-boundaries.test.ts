import { describe, it, expect } from 'vitest';
import {
  Point,
  Stock,
  PartGroup,
  Candidate,
  toInternalDimension,
  fromInternalDimension,
  validateCandidate,
  generateTemplatePolygon,
  calculatePolygonArea,
  calculatePolygonBBox,
  isPolygonClosed,
  isPolygonSelfIntersecting,
  polygonsIntersect,
  douglasPeucker,
  solveCuttingPlan,
  solveProfileCuttingPlan,
  parseSVGToShapeGeometry,
  extractContourFromBinaryImage,
} from '../../packages/core/src/index.js';

describe('E2E Tier 2: Boundary & Corner Cases (Extreme, Invalid, and Precision Edges)', () => {
  // --------------------------------------------------------------------------
  // B1. 零尺寸、负数尺寸与超范围边界 (Zero, Negative & Out-of-Bound Dimensions)
  // --------------------------------------------------------------------------
  describe('B1: 零尺寸、负数与超限尺寸防御', () => {
    it('B1.1: 尺寸为 0 或负数时严格抛出异常', () => {
      expect(() => toInternalDimension(0, 'mm')).toThrow('尺寸必须为正数');
      expect(() => toInternalDimension(-5, 'mm')).toThrow('尺寸必须为正数');
      expect(() => toInternalDimension(NaN as any, 'mm')).toThrow('输入必须是有限数值');
      expect(() => toInternalDimension(Infinity as any, 'mm')).toThrow('输入必须是有限数值');
    });

    it('B1.2: 尺寸超出上限 100000 mm 时拒绝处理', () => {
      expect(() => toInternalDimension(100001, 'mm')).toThrow('尺寸超出最大允许范围');
    });

    it('B1.3: 排料求解器对非法尺寸零件组拒绝排料', () => {
      const invalidOptions = {
        stocks: [
          {
            id: 's_bad',
            code: 'SBAD',
            group: { material: '木板', thicknessMm: 2, color: '原色' },
            width: 1000,
            height: 1000,
            isOffcut: false,
            status: 'AVAILABLE' as const,
            version: 1,
          },
        ],
        partGroups: [
          {
            id: 'g_bad',
            name: '非法零件',
            targetWidth: 0,
            targetHeight: 100,
            quantity: 1,
            allowRotation: false,
          },
        ],
        kerfMm: 1,
      };

      expect(() => solveCuttingPlan(invalidOptions)).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // B2. 共线顶点与退化多边形 (Collinear Vertices & Degenerate Polygons)
  // --------------------------------------------------------------------------
  describe('B2: 共线顶点与退化多边形', () => {
    it('B2.1: 三点共线退化为线段时，计算面积为 0 且判定为未闭合有效多边形', () => {
      const collinearPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 1000, y: 0 },
      ];
      const area = calculatePolygonArea(collinearPoints);
      expect(area).toBe(0);
      expect(isPolygonClosed(collinearPoints)).toBe(false);
    });

    it('B2.2: Douglas-Peucker 算法对共线多点自动压缩消除冗余顶点', () => {
      const lineWithRedundantPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 300, y: 0 },
        { x: 400, y: 0 },
        { x: 500, y: 0 },
      ];
      const simplified = douglasPeucker(lineWithRedundantPoints, 2, 64);
      // 共线点垂直距离全为0，DP 精简后仅保留起点和终点
      expect(simplified).toHaveLength(2);
      expect(simplified[0]).toEqual({ x: 0, y: 0 });
      expect(simplified[1]).toEqual({ x: 500, y: 0 });
    });
  });

  // --------------------------------------------------------------------------
  // B3. 自相碰与自交叉拓扑边界 (Self-Touching & Self-Intersecting Topology)
  // --------------------------------------------------------------------------
  describe('B3: 自相碰与自交叉拓扑边界', () => {
    it('B3.1: 经典 "8" 字形领结自交叉多边形被准确检测', () => {
      const bowTie: Point[] = [
        { x: 0, y: 0 },
        { x: 1000, y: 1000 },
        { x: 1000, y: 0 },
        { x: 0, y: 1000 },
      ];
      expect(isPolygonSelfIntersecting(bowTie)).toBe(true);
    });

    it('B3.2: 凹多边形与复杂 L 形无自相交时正确判定为合法', () => {
      const lShape = generateTemplatePolygon('L_SHAPE', {
        w1: 400,
        h1: 400,
        w2: 150,
        h2: 150,
      });
      expect(isPolygonSelfIntersecting(lShape.points)).toBe(false);
      expect(isPolygonClosed(lShape.points)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // B4. 极端长宽比边界 (Extreme Aspect Ratios: 1000:1)
  // --------------------------------------------------------------------------
  describe('B4: 极端长宽比边界 (Extreme Aspect Ratio: 1000:1)', () => {
    it('B4.1: 极细长条零件 (2000mm × 2mm) 计算包围盒与面积无溢出与精度漂移', () => {
      const thinPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 20000, y: 0 },  // 2000 mm
        { x: 20000, y: 20 }, // 2 mm
        { x: 0, y: 20 },
      ];

      const bbox = calculatePolygonBBox(thinPoints);
      expect(bbox).toEqual({ x: 0, y: 0, width: 20000, height: 20 });

      const area = calculatePolygonArea(thinPoints);
      expect(area).toBe(20000 * 20); // 400,000 in (0.1mm)^2
    });

    it('B4.2: 排料算法能够成功排入极端长宽比细长条零件', () => {
      const stock: Stock = {
        id: 's_sliver',
        code: 'S-SLIVER',
        group: { material: '木板', thicknessMm: 2, color: '原色' },
        width: 3000,
        height: 1000,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      const sliverGroup: PartGroup = {
        id: 'g_sliver',
        name: '极细装饰压条',
        targetWidth: 2000, // 200 mm
        targetHeight: 20,   // 2 mm
        quantity: 3,
        allowRotation: false,
      };

      const res = solveCuttingPlan({
        stocks: [stock],
        partGroups: [sliverGroup],
        kerfMm: 1,
      });

      expect(res.candidates[0].isComplete).toBe(true);
      expect(res.candidates[0].placedParts).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // B5. 顶点上限 64 点约束 (Maximum 64 Vertices Strict Enforcement)
  // --------------------------------------------------------------------------
  describe('B5: 顶点上限 64 点严格约束', () => {
    it('B5.1: 超过 200 个密集采样的多边形经 DP 算法自适应精简至严格 <= 64 顶点', () => {
      // 构造具有 256 个顶点的超密圆多边形
      const denseCircle: Point[] = [];
      const n = 256;
      const r = 500;
      for (let i = 0; i < n; i++) {
        const rad = (i / n) * Math.PI * 2;
        denseCircle.push({
          x: Math.round(500 + r * Math.cos(rad)),
          y: Math.round(500 + r * Math.sin(rad)),
        });
      }
      expect(denseCircle.length).toBe(256);

      const simplified = douglasPeucker(denseCircle, 1, 64);
      expect(simplified.length).toBeLessThanOrEqual(64);
      expect(simplified.length).toBeGreaterThanOrEqual(16);
      expect(isPolygonClosed(simplified)).toBe(true);
    });

    it('B5.2: 所有 9 种基础模板原生顶点均严格控制在 <= 48 顶点以内', () => {
      const kinds = [
        'RECT', 'ROUNDED_RECT', 'CIRCLE', 'ELLIPSE',
        'TRIANGLE', 'REGULAR_POLYGON', 'L_SHAPE', 'ARCH', 'STAR',
      ] as const;

      for (const kind of kinds) {
        const geo = generateTemplatePolygon(kind, {
          width: 500,
          height: 500,
          sides: 12,
          radius: 100,
          diameter: 500,
        });
        expect(geo.points.length).toBeLessThanOrEqual(48);
      }
    });

    it('B5.3: SVG 与 拍照提取轮廓均遵守 <= 64 顶点规范', () => {
      // SVG 复杂路径
      const svgStr = `
        <svg viewBox="0 0 500 500">
          <path d="M 50 50 C 100 0, 200 0, 250 50 C 300 100, 400 100, 450 50 L 450 400 C 350 450, 250 350, 150 400 Z" />
        </svg>
      `;
      const svgGeo = parseSVGToShapeGeometry(svgStr);
      expect(svgGeo.points.length).toBeLessThanOrEqual(64);

      // 拍照二值图提取
      const grid = new Uint8Array(400);
      grid.fill(1, 40, 160);
      const photoGeo = extractContourFromBinaryImage(grid, 20, 20, { maxVertices: 64 });
      expect(photoGeo.points.length).toBeLessThanOrEqual(64);
    });
  });

  // --------------------------------------------------------------------------
  // B6. 极值刀缝 kerf = 0mm 与 kerf = 5mm 边界 (Kerf Zero vs Large Kerf)
  // --------------------------------------------------------------------------
  describe('B6: 极值刀缝 kerf = 0mm 与 kerf = 5mm 边界', () => {
    const stock: Stock = {
      id: 's_kerf',
      code: 'S-KERF',
      group: { material: '亚克力', thicknessMm: 2, color: '白' },
      width: 1000,
      height: 1000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    const triGeo = generateTemplatePolygon('TRIANGLE', { base: 300, height: 300 });
    const partGroup: PartGroup = {
      id: 'g_tri_k',
      name: '三角试件',
      targetWidth: 300,
      targetHeight: 300,
      quantity: 2,
      rotationPolicy: 'LOCKED',
      geometry: triGeo,
    };

    it('B6.1: kerf = 0mm 时零件紧贴放置且完全通过独立验证器', () => {
      const plan0 = solveProfileCuttingPlan({
        stocks: [stock],
        partGroups: [partGroup],
        kerfMm: 0,
      });

      expect(plan0.candidates[0].isComplete).toBe(true);
      const val0 = validateCandidate(plan0.candidates[0], [partGroup], [stock], 0);
      expect(val0.valid).toBe(true);
    });

    it('B6.2: kerf = 5mm 时零件保持至少 50 (0.1mm) 间隙', () => {
      const plan5 = solveProfileCuttingPlan({
        stocks: [stock],
        partGroups: [partGroup],
        kerfMm: 5,
      });

      expect(plan5.candidates[0].isComplete).toBe(true);
      const val5 = validateCandidate(plan5.candidates[0], [partGroup], [stock], 5);
      expect(val5.valid).toBe(true);

      const [p1, p2] = plan5.candidates[0].profilePlacements!;
      // 验证两者 AABB 或多边形存在充分距离
      const dist = Math.hypot(p1.translation.x - p2.translation.x, p1.translation.y - p2.translation.y);
      expect(dist).toBeGreaterThanOrEqual(50); // 至少 5mm 间隙
    });
  });

  // --------------------------------------------------------------------------
  // B7. 0.1mm 整数定点化极限与亚毫米碰撞 (0.1mm Precision Limits)
  // --------------------------------------------------------------------------
  describe('B7: 0.1mm 整数精度极限与超精度拦截', () => {
    it('B7.1: 用户输入超过 0.1mm 精度 (如 12.35mm) 时严禁静默四舍五入并抛错', () => {
      expect(() => toInternalDimension(12.35, 'mm')).toThrow('超过了支持的 0.1 mm 精度，禁止静默四舍五入');
      expect(() => toInternalDimension(100.005, 'mm')).toThrow('超过了支持的 0.1 mm 精度');
      // 精确到 0.1mm 合法通过
      expect(toInternalDimension(12.3, 'mm')).toBe(123);
      expect(toInternalDimension(12.4, 'mm')).toBe(124);
    });

    it('B7.2: 亚毫米级 (1 unit = 0.1mm) 距离碰撞精确判定', () => {
      const polyA: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      // polyB 与 polyA 相隔刚好 1 个单位 (0.1mm)，不重叠
      const polyB_Separated: Point[] = [
        { x: 101, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 101, y: 100 },
      ];
      expect(polygonsIntersect(polyA, polyB_Separated)).toBe(false);

      // polyC 与 polyA 共享边 (x=100) 并重叠 1 个单位 (x=99 到 199)，发生重叠
      const polyC_Overlap1Unit: Point[] = [
        { x: 99, y: 0 },
        { x: 199, y: 0 },
        { x: 199, y: 100 },
        { x: 99, y: 100 },
      ];
      expect(polygonsIntersect(polyA, polyC_Overlap1Unit)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // B8. 旋转约束边界防伪 (Rotation Policy Conformance)
  // --------------------------------------------------------------------------
  describe('B8: 旋转权限边界防伪', () => {
    const stock: Stock = {
      id: 's_rot',
      code: 'S-ROT',
      group: { material: '木板', thicknessMm: 2, color: '原色' },
      width: 1000,
      height: 1000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    it('B8.1: LOCKED 策略零件被旋转哪怕 15° 也必须被验证器一票否决', () => {
      const lockedGroup: PartGroup = {
        id: 'g_locked',
        name: '纹理锁定件',
        targetWidth: 200,
        targetHeight: 200,
        quantity: 1,
        rotationPolicy: 'LOCKED',
      };

      const illegalCand: Candidate = {
        candidateId: 'cand_rot_bad',
        strategyName: '非法旋转',
        isComplete: true,
        appliedDeltaMm: 0,
        layoutMode: 'PROFILE',
        targetParts: [{ groupId: 'g_locked', width: 200, height: 200 }],
        placedParts: [],
        profilePlacements: [
          {
            instanceId: 'g_locked_1',
            groupId: 'g_locked',
            name: '纹理锁定件',
            stockId: 's_rot',
            translation: { x: 100, y: 100 },
            rotationDeg: 15, // 违背 LOCKED
            transformedPoints: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }],
            bbox: { x: 100, y: 100, width: 200, height: 200 },
          },
        ],
        unplacedPartIds: [],
        usedStocks: [{ stockId: 's_rot', stockCode: 'S-ROT', isOffcut: false, width: 1000, height: 1000, cutTree: {} as any, placedParts: [], remainingOffcuts: [], steps: [] }],
        metrics: {} as any,
      };

      const res = validateCandidate(illegalCand, [lockedGroup], [stock], 0);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('LOCKED'))).toBe(true);
    });

    it('B8.2: RIGHT_ANGLE 策略零件被旋转 45° 时被验证器一票否决', () => {
      const raGroup: PartGroup = {
        id: 'g_ra',
        name: '直角旋转件',
        targetWidth: 200,
        targetHeight: 200,
        quantity: 1,
        rotationPolicy: 'RIGHT_ANGLE',
      };

      const cand45: Candidate = {
        candidateId: 'cand_45_bad',
        strategyName: '非直角旋转',
        isComplete: true,
        appliedDeltaMm: 0,
        layoutMode: 'PROFILE',
        targetParts: [{ groupId: 'g_ra', width: 200, height: 200 }],
        placedParts: [],
        profilePlacements: [
          {
            instanceId: 'g_ra_1',
            groupId: 'g_ra',
            name: '直角旋转件',
            stockId: 's_rot',
            translation: { x: 100, y: 100 },
            rotationDeg: 45, // 违背 RIGHT_ANGLE
            transformedPoints: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }],
            bbox: { x: 100, y: 100, width: 200, height: 200 },
          },
        ],
        unplacedPartIds: [],
        usedStocks: [{ stockId: 's_rot', stockCode: 'S-ROT', isOffcut: false, width: 1000, height: 1000, cutTree: {} as any, placedParts: [], remainingOffcuts: [], steps: [] }],
        metrics: {} as any,
      };

      const res = validateCandidate(cand45, [raGroup], [stock], 0);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('直角旋转'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // B9. 材料容量不足与无法排入负向验证 (Capacity Exhaustion)
  // --------------------------------------------------------------------------
  describe('B9: 材料容量耗尽负向验证', () => {
    it('B9.1: 零件尺寸大于板材全幅时正确标记为无法放置，绝不静默越界', () => {
      const tinyStock: Stock = {
        id: 's_tiny',
        code: 'S-TINY',
        group: { material: '木板', thicknessMm: 2, color: '原色' },
        width: 300,
        height: 300,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
      };

      const hugeGroup: PartGroup = {
        id: 'g_huge',
        name: '超大构件',
        targetWidth: 500, // 超出 300
        targetHeight: 500,
        quantity: 1,
        allowRotation: false,
        geometry: generateTemplatePolygon('RECT', { width: 500, height: 500 }),
      };

      const res = solveProfileCuttingPlan({
        stocks: [tinyStock],
        partGroups: [hugeGroup],
        kerfMm: 1,
      });

      const cand = res.candidates[0];
      expect(cand.isComplete).toBe(false);
      expect(cand.unplacedPartIds).toContain('g_huge_1');
      expect(cand.profilePlacements).toHaveLength(0);
    });
  });
});
