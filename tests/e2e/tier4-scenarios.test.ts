import { describe, it, expect } from 'vitest';
import {
  Point,
  Stock,
  PartGroup,
  generateTemplatePolygon,
  solveCuttingPlan,
  solveProfileCuttingPlan,
  validateCandidate,
  generateCutGuidance,
  calculateQuote,
  polygonsIntersect,
  polygonIntersectsRect,
} from '../../packages/core/src/index.js';

describe('E2E Tier 4: Real-World Scenarios (Authentic Handcraft, Model & Maker Use Cases)', () => {
  // --------------------------------------------------------------------------
  // Scenario 1: 建筑模型墙体与拱门窗洞制作 (Architectural Model Wall Cutting)
  // --------------------------------------------------------------------------
  it('Scenario 1: Architectural Model Pavilion Facade on Balsa Wood Sheet', () => {
    // 材质：椴木模型板 500 × 300 mm (5000 × 3000 in 0.1mm)
    const balsaSheet: Stock = {
      id: 'stk_balsa_facade',
      code: 'BALSA-500-300',
      group: { material: '椴木模型薄板', thicknessMm: 1.5, color: '原木色' },
      width: 5000,
      height: 3000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    // 木纹沿高度方向敏感，严格禁止旋转 (LOCKED)
    // 2 个拱门主立面墙体
    const archWallGeo = generateTemplatePolygon('ARCH', { width: 1200, height: 1800, archHeight: 600 });
    // 2 个三角山墙屋顶
    const pedimentGeo = generateTemplatePolygon('TRIANGLE', { base: 1600, height: 800 });
    // 4 根长立柱饰板
    const columnGeo = generateTemplatePolygon('RECT', { width: 300, height: 1500 });

    const partGroups: PartGroup[] = [
      {
        id: 'grp_arch_wall',
        name: '拱门立面墙板',
        targetWidth: 1200,
        targetHeight: 1800,
        quantity: 2,
        rotationPolicy: 'LOCKED',
        geometry: archWallGeo,
      },
      {
        id: 'grp_pediment',
        name: '三角山墙屋架',
        targetWidth: 1600,
        targetHeight: 800,
        quantity: 2,
        rotationPolicy: 'LOCKED',
        geometry: pedimentGeo,
      },
      {
        id: 'grp_column',
        name: '门廊柱面饰条',
        targetWidth: 300,
        targetHeight: 1500,
        quantity: 4,
        rotationPolicy: 'LOCKED',
        geometry: columnGeo,
      },
    ];

    const kerfMm = 1.0;
    const solution = solveCuttingPlan({
      stocks: [balsaSheet],
      partGroups,
      kerfMm,
    });

    expect(solution.candidates.length).toBeGreaterThan(0);
    const bestCand = solution.candidates[0];

    // 1. 完整排料
    expect(bestCand.isComplete).toBe(true);
    expect(bestCand.profilePlacements).toHaveLength(8);

    // 2. 严格木纹一致性：所有零件旋转角度为 0°
    expect(bestCand.profilePlacements!.every((p) => p.rotationDeg === 0)).toBe(true);

    // 3. 独立验证器一票否决复核
    const valRes = validateCandidate(bestCand, partGroups, [balsaSheet], kerfMm);
    expect(valRes.valid).toBe(true);
    expect(valRes.errors).toHaveLength(0);

    // 4. 手工工序指导：内紧邻拱门优先裁切，外围清边最后
    const guidance = generateCutGuidance(bestCand.profilePlacements!, {
      width: balsaSheet.width,
      height: balsaSheet.height,
    });
    expect(guidance.calibrationLineMm).toBe(100);
    expect(guidance.steps.length).toBe(9); // 8 零件 + 1 边框
    expect(guidance.steps[guidance.steps.length - 1].pathType).toBe('BORDER');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: 航模机翼肋板异形排料 (Aircraft Wing Airfoil Rib Layout)
  // --------------------------------------------------------------------------
  it('Scenario 2: Aircraft Wing Airfoil Rib Layout on KT Foam Board', () => {
    // 材质：KT 泡沫复合板 400 × 200 mm (4000 × 2000 in 0.1mm)
    const ktBoard: Stock = {
      id: 'stk_kt_wing',
      code: 'KT-400-200',
      group: { material: 'KT泡沫板', thicknessMm: 3, color: '白色' },
      width: 4000,
      height: 2000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    // 6 片流线型机翼肋板 (翼型前圆后尖，弦长 120mm, 翼厚 25mm)
    const airfoilPoints: Point[] = [
      { x: 0, y: 120 },    // 前缘中心
      { x: 100, y: 50 },   // 上翼面上扬
      { x: 300, y: 10 },   // 上翼面最高点
      { x: 600, y: 20 },
      { x: 900, y: 50 },
      { x: 1200, y: 100 }, // 后缘尖端
      { x: 900, y: 150 },
      { x: 600, y: 180 },  // 下翼面平缓
      { x: 300, y: 200 },
      { x: 100, y: 180 },
    ];

    const airfoilGeo = {
      kind: 'POLYGON' as const,
      source: 'DRAW' as const,
      points: airfoilPoints,
      width: 1200,
      height: 200,
      area: 160000,
      closed: true as const,
    };

    const wingRibGroup: PartGroup = {
      id: 'grp_airfoil_ribs',
      name: '机翼主肋板',
      targetWidth: 1200,
      targetHeight: 200,
      quantity: 6,
      rotationPolicy: 'FREE_15', // 允许 15° 微调旋转互嵌
      geometry: airfoilGeo,
    };

    const kerfMm = 1.5;
    const solution = solveCuttingPlan({
      stocks: [ktBoard],
      partGroups: [wingRibGroup],
      kerfMm,
    });

    expect(solution.candidates.length).toBeGreaterThan(0);
    const cand = solution.candidates[0];

    // 1. 全部排入单张 KT 板中
    expect(cand.isComplete).toBe(true);
    expect(cand.usedStocks).toHaveLength(1);
    expect(cand.profilePlacements).toHaveLength(6);

    // 2. 旋转角度符合 FREE_15 约束 (15° 的倍数)
    for (const p of cand.profilePlacements!) {
      expect(p.rotationDeg % 15).toBe(0);
    }

    // 3. 所有肋板互不重叠
    const placements = cand.profilePlacements!;
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        expect(polygonsIntersect(placements[i].transformedPoints, placements[j].transformedPoints)).toBe(false);
      }
    }

    // 4. 验证器复核通过
    const valRes = validateCandidate(cand, [wingRibGroup], [ktBoard], kerfMm);
    expect(valRes.valid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: 校园皮革钥匙扣文创制作 (Campus Leather Keychain Craft)
  // --------------------------------------------------------------------------
  it('Scenario 3: Campus Leather Keychain Craft on Scrap Leather with Defect Avoidance', () => {
    // 材质：天然植鞣头层牛皮实测余料 200 × 160 mm (2000 × 1600 in 0.1mm)
    // 表面有一块天然虫斑/伤疤缺陷禁排区 (x: 800, y: 600, w: 300, h: 300)
    const leatherScrap: Stock = {
      id: 'stk_leather_scrap',
      code: 'LTH-OFFCUT-01',
      group: { material: '植鞣头层牛皮', thicknessMm: 2.2, color: '原色焦糖' },
      width: 2000,
      height: 1600,
      isOffcut: true,
      status: 'AVAILABLE',
      version: 1,
      defects: [{ x: 800, y: 600, width: 300, height: 300 }],
    };

    // 制作 2 个五角星挂坠、2 个圆形皮垫、1 个 L 形文创吊坠
    const starGeo = generateTemplatePolygon('STAR', { points: 5, outerRadius: 250, innerRadius: 100 });
    const circleGeo = generateTemplatePolygon('CIRCLE', { diameter: 400 });
    const lGeo = generateTemplatePolygon('L_SHAPE', { w1: 400, h1: 400, w2: 150, h2: 150 });

    const partGroups: PartGroup[] = [
      {
        id: 'grp_star_keychain',
        name: '星形皮革钥匙扣',
        targetWidth: starGeo.width,
        targetHeight: starGeo.height,
        quantity: 2,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: starGeo,
      },
      {
        id: 'grp_round_coaster',
        name: '圆形皮标印章垫',
        targetWidth: circleGeo.width,
        targetHeight: circleGeo.height,
        quantity: 2,
        rotationPolicy: 'LOCKED',
        geometry: circleGeo,
      },
      {
        id: 'grp_l_pendant',
        name: '直角拼接挂牌',
        targetWidth: lGeo.width,
        targetHeight: lGeo.height,
        quantity: 1,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: lGeo,
      },
    ];

    const kerfMm = 2.0;
    const solution = solveCuttingPlan({
      stocks: [leatherScrap],
      partGroups,
      kerfMm,
    });

    expect(solution.candidates.length).toBeGreaterThan(0);
    const bestCand = solution.candidates[0];

    // 1. 全部完整排入
    expect(bestCand.isComplete).toBe(true);
    expect(bestCand.profilePlacements).toHaveLength(5);

    // 2. 完美避让皮革表面天然伤疤缺陷
    for (const p of bestCand.profilePlacements!) {
      for (const def of leatherScrap.defects || []) {
        expect(polygonIntersectsRect(p.transformedPoints, def)).toBe(false);
      }
    }

    // 3. 刀具推荐：含有星形与圆弧曲线，提示精密剪刀/曲线旋转皮雕刀
    const guidance = generateCutGuidance(bestCand.profilePlacements!, {
      width: leatherScrap.width,
      height: leatherScrap.height,
    });
    expect(guidance.recommendedTool).toContain('剪刀');
    expect(guidance.calibrationLineMm).toBe(100);

    // 4. 独立验证器通过
    const valRes = validateCandidate(bestCand, partGroups, [leatherScrap], kerfMm);
    expect(valRes.valid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: 多材质展台构件嵌套与商业 ERP 报价 (Multi-Material Board Nesting & ERP Quote)
  // --------------------------------------------------------------------------
  it('Scenario 4: Multi-Material Exhibition Stand Nesting & Commercial ERP Quotation', () => {
    // 材质：3mm 亚克力透明板 (1200 × 800 mm = 12000 × 8000 in 0.1mm)
    const acrylicSheet: Stock = {
      id: 'stk_acrylic_stand',
      code: 'ACR-1200-800',
      group: { material: '高透亚克力板', thicknessMm: 3.0, color: '高透明' },
      width: 12000,
      height: 8000,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    // 4 个拱门展示立板，2 个圆角矩形展签底座
    const archGeo = generateTemplatePolygon('ARCH', { width: 2500, height: 3500, archHeight: 1200 });
    const roundRectGeo = generateTemplatePolygon('ROUNDED_RECT', { width: 3000, height: 2000, radius: 250 });

    const partGroups: PartGroup[] = [
      {
        id: 'grp_acrylic_arch',
        name: '展示拱门背板',
        targetWidth: 2500,
        targetHeight: 3500,
        quantity: 4,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: archGeo,
      },
      {
        id: 'grp_acrylic_base',
        name: '圆角展签底座',
        targetWidth: 3000,
        targetHeight: 2000,
        quantity: 2,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: roundRectGeo,
      },
    ];

    const kerfMm = 2.0;
    const solution = solveCuttingPlan({
      stocks: [acrylicSheet],
      partGroups,
      kerfMm,
    });

    expect(solution.candidates.length).toBeGreaterThan(0);
    const bestCand = solution.candidates[0];
    expect(bestCand.isComplete).toBe(true);
    expect(bestCand.profilePlacements).toHaveLength(6);

    // 独立验证器通过
    const valRes = validateCandidate(bestCand, partGroups, [acrylicSheet], kerfMm);
    expect(valRes.valid).toBe(true);

    // 商业 ERP 报价单计算
    // 投入总板材面积: 1.2m × 0.8m = 0.96 ㎡
    const totalAreaSqm = (acrylicSheet.width * acrylicSheet.height) / 1e8;
    expect(totalAreaSqm).toBe(0.96);

    const pricePerSqm = 140; // 亚克力单价 140 元/㎡
    const processingFee = 65; // 激光切割机时费 65 元
    const miscFee = 20; // 五金挂件与包装杂费 20 元

    const quote = calculateQuote({
      totalInputAreaSqm: totalAreaSqm,
      pricePerSqm,
      processingFee,
      miscFee,
    });

    // 核算金额精确度
    expect(quote.materialCost).toBe(134.4); // 0.96 * 140 = 134.4
    expect(quote.processingFee).toBe(65);
    expect(quote.miscFee).toBe(20);
    expect(quote.totalPrice).toBe(219.4); // 134.4 + 65 + 20 = 219.4

    // 1:1 打印导出校准线验证
    const guidance = generateCutGuidance(bestCand.profilePlacements!, {
      width: acrylicSheet.width,
      height: acrylicSheet.height,
    });
    expect(guidance.calibrationLineMm).toBe(100);
  });
});
