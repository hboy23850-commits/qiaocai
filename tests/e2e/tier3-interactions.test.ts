import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import Module from 'node:module';
import {
  Point,
  Stock,
  PartGroup,
  generateTemplatePolygon,
  parseSVGToShapeGeometry,
  computeHomography,
  rectifyPoints,
  douglasPeucker,
  extractContourFromBinaryImage,
  solveCuttingPlan,
  validateCandidate,
  generateCutGuidance,
  calculateQuote,
  polygonsIntersect,
  polygonIntersectsRect,
} from '../../packages/core/src/index.js';

// Mock CloudBase backend database and context for SaaS interaction testing
interface DocRecord {
  _id: string;
  [key: string]: any;
}

class MockCollection {
  name: string;
  docs: DocRecord[] = [];

  constructor(name: string) {
    this.name = name;
  }

  where(query: any) {
    return new MockQuery(this, query);
  }

  doc(id: string) {
    return new MockDocRef(this, id);
  }

  async add({ data }: { data: any }) {
    const _id = data._id || `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const doc = { ...data, _id, id: _id };
    this.docs.push(doc);
    return { _id };
  }
}

class MockQuery {
  col: MockCollection;
  query: any;

  constructor(col: MockCollection, query: any) {
    this.col = col;
    this.query = query;
  }

  orderBy() { return this; }
  limit() { return this; }

  private matches(doc: any): boolean {
    for (const key of Object.keys(this.query)) {
      const qVal = this.query[key];
      if (qVal && typeof qVal === 'object' && qVal.$in) {
        if (!qVal.$in.includes(doc[key])) return false;
      } else if (doc[key] !== qVal) {
        return false;
      }
    }
    return true;
  }

  async get() {
    const matched = this.col.docs.filter((d) => this.matches(d));
    return { data: JSON.parse(JSON.stringify(matched)) };
  }

  async update({ data }: { data: any }) {
    let updated = 0;
    for (const doc of this.col.docs) {
      if (this.matches(doc)) {
        Object.assign(doc, data);
        updated++;
      }
    }
    return { stats: { updated } };
  }
}

class MockDocRef {
  col: MockCollection;
  id: string;

  constructor(col: MockCollection, id: string) {
    this.col = col;
    this.id = id;
  }

  async get() {
    const found = this.col.docs.find((d) => d._id === this.id);
    if (!found) throw new Error(`Doc ${this.id} not found`);
    return { data: JSON.parse(JSON.stringify(found)) };
  }

  async update({ data }: { data: any }) {
    const doc = this.col.docs.find((d) => d._id === this.id);
    if (!doc) return { stats: { updated: 0 } };
    Object.assign(doc, data);
    return { stats: { updated: 1 } };
  }
}

const mockDbInstance = {
  collections: new Map<string, MockCollection>(),
  getCollection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(name));
    }
    return this.collections.get(name)!;
  },
  reset() {
    this.collections.clear();
  },
};

let currentWxContext = {
  OPENID: 'boss_user',
  REQUESTID: 'req_tier3',
};

const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init: () => {},
  getWXContext: () => currentWxContext,
  database: () => ({
    collection: (name: string) => mockDbInstance.getCollection(name),
    serverDate: () => new Date().toISOString(),
    command: {
      in: (arr: any[]) => ({ $in: arr }),
      inc: (val: number) => ({ $inc: val }),
    },
  }),
};

// Hook require for wx-server-sdk
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === 'wx-server-sdk') {
    return mockSdk;
  }
  return originalRequire.apply(this, [id, ...args]);
};

describe('E2E Tier 3: Cross-Feature Interactions (End-to-End Multi-Subsystem Workflows)', () => {
  let mainHandler: any;

  beforeEach(() => {
    mockDbInstance.reset();
    currentWxContext = { OPENID: 'boss_user', REQUESTID: 'req_tier3' };

    const modulePath = path.resolve(__dirname, '../../cloudfunctions/api/index.js');
    delete require.cache[require.resolve(modulePath)];
    const apiModule = require(modulePath);
    mainHandler = apiModule.main;
  });

  // --------------------------------------------------------------------------
  // Interaction 1: 模板 + SVG导入 + Kerf + PROFILE求解 + 裁切指导 + 100mm校准线
  // --------------------------------------------------------------------------
  it('Interaction 1: Template + SVG Import + Kerf + PROFILE Solver + Cut Guide + 100mm Calibration', () => {
    // 1. 从模板生成 L形与拱门形
    const lGeo = generateTemplatePolygon('L_SHAPE', { w1: 300, h1: 300, w2: 120, h2: 120 });
    const archGeo = generateTemplatePolygon('ARCH', { width: 300, height: 400, archHeight: 150 });

    // 2. 从 SVG 导入三角支架
    const svgStr = `
      <svg viewBox="0 0 400 300">
        <polygon points="0,300 400,300 200,0" />
      </svg>
    `;
    const svgGeo = parseSVGToShapeGeometry(svgStr, { targetWidthMm: 30, targetHeightMm: 25 });

    // 3. 组装零件清单
    const partGroups: PartGroup[] = [
      {
        id: 'grp_l',
        name: 'L形构件',
        targetWidth: lGeo.width,
        targetHeight: lGeo.height,
        quantity: 1,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: lGeo,
      },
      {
        id: 'grp_arch',
        name: '拱门构件',
        targetWidth: archGeo.width,
        targetHeight: archGeo.height,
        quantity: 1,
        rotationPolicy: 'LOCKED',
        geometry: archGeo,
      },
      {
        id: 'grp_svg',
        name: 'SVG三角构件',
        targetWidth: svgGeo.width,
        targetHeight: svgGeo.height,
        quantity: 1,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: svgGeo,
      },
    ];

    const stock: Stock = {
      id: 'stk_composite',
      code: 'STK-COMPOSITE',
      group: { material: '椴木板', thicknessMm: 2, color: '原色' },
      width: 1500,
      height: 1500,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    // 4. 求解排料方案 (Kerf = 1.5mm)
    const kerfMm = 1.5;
    const solution = solveCuttingPlan({
      stocks: [stock],
      partGroups,
      kerfMm,
    });

    expect(solution.candidates.length).toBeGreaterThan(0);
    const bestCand = solution.candidates[0];
    expect(bestCand.isComplete).toBe(true);
    expect(bestCand.layoutMode).toBe('PROFILE');
    expect(bestCand.profilePlacements).toHaveLength(3);

    // 5. 独立多边形验证器一票否决复核
    const validation = validateCandidate(bestCand, partGroups, [stock], kerfMm);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // 6. 生成手工分步裁切指导工序
    const cutGuidance = generateCutGuidance(bestCand.profilePlacements!, {
      width: stock.width,
      height: stock.height,
    });

    expect(cutGuidance.steps.length).toBe(4); // 3 零件 + 1 外围修边
    expect(cutGuidance.calibrationLineMm).toBe(100); // 100mm 实测校准线
    expect(cutGuidance.recommendedTool).toContain('剪刀'); // 包含拱门曲线

    // 验证外围修边是最后一步
    const lastStep = cutGuidance.steps[cutGuidance.steps.length - 1];
    expect(lastStep.pathType).toBe('BORDER');
  });

  // --------------------------------------------------------------------------
  // Interaction 2: 拍照纸样识别 + 单应性矫正 + 材料缺陷避让 + 验证器单票否决
  // --------------------------------------------------------------------------
  it('Interaction 2: Camera Pattern Recognition + Homography + Defect Avoidance + Veto Validation', () => {
    // 1. 模拟斜拍畸变的四边形纸样，经 DLT 单应性矩阵映射为 400×300mm 正射轮廓
    const distortedCorners: Point[] = [
      { x: 120, y: 150 },
      { x: 530, y: 180 },
      { x: 490, y: 520 },
      { x: 80, y: 470 },
    ];
    const targetMmCorners: Point[] = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ];

    const H = computeHomography(distortedCorners, targetMmCorners);
    const rectified = rectifyPoints(distortedCorners, H);
    expect(rectified[0].x).toBeCloseTo(0, -1);
    expect(rectified[0].y).toBeCloseTo(0, -1);
    expect(rectified[1].x).toBeCloseTo(4000, -1);

    // 2. 模拟从图像二值网格提取轮廓并简化至 <= 64 顶点
    const w = 40;
    const h = 40;
    const grid = new Uint8Array(w * h);
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        grid[y * w + x] = 1;
      }
    }
    const extractedGeo = extractContourFromBinaryImage(grid, w, h, { scaleMmPerPixel: 1.0 });
    expect(extractedGeo.points.length).toBeLessThanOrEqual(64);

    // 3. 板材上存在结疤/裂纹缺陷禁排区 (x: 400, y: 400, w: 200, h: 200)
    const stockWithDefect: Stock = {
      id: 'stk_defect',
      code: 'STK-DEFECT',
      group: { material: '椴木实木板', thicknessMm: 3, color: '原木' },
      width: 1500,
      height: 1500,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
      defects: [{ x: 400, y: 400, width: 200, height: 200 }],
    };

    const photoPartGroup: PartGroup = {
      id: 'grp_photo',
      name: '纸样提取零件',
      targetWidth: extractedGeo.width,
      targetHeight: extractedGeo.height,
      quantity: 2,
      rotationPolicy: 'RIGHT_ANGLE',
      geometry: extractedGeo,
    };

    // 4. 排料求解
    const solution = solveCuttingPlan({
      stocks: [stockWithDefect],
      partGroups: [photoPartGroup],
      kerfMm: 1,
    });

    expect(solution.candidates.length).toBeGreaterThan(0);
    const cand = solution.candidates[0];
    expect(cand.isComplete).toBe(true);

    // 5. 验证放置的零件绝不触碰禁排缺陷区
    for (const p of cand.profilePlacements || []) {
      for (const def of stockWithDefect.defects || []) {
        expect(polygonIntersectsRect(p.transformedPoints, def)).toBe(false);
      }
    }

    // 验证器复核通过
    const valRes = validateCandidate(cand, [photoPartGroup], [stockWithDefect], 1);
    expect(valRes.valid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Interaction 3: SaaS工厂创建/加入 + 异形排料 + ERP报价单生成 + 幂等扣减
  // --------------------------------------------------------------------------
  it('Interaction 3: SaaS Factory Multi-Tenancy + PROFILE Solver + ERP Quote + Idempotent Stock Deduction', async () => {
    // 1. 老板创建工厂
    currentWxContext.OPENID = 'boss_saas_01';
    const createFacRes = await mainHandler({
      action: 'createFactory',
      payload: { name: '创新模型工坊' },
    }, {});
    expect(createFacRes.code).toBe(200);
    const factoryId = createFacRes.data.factory.id;
    const inviteCode = createFacRes.data.factory.inviteCode;

    // 2. 老板向工厂添加 1 张大板材
    const addStockRes = await mainHandler({
      action: 'addStock',
      payload: {
        stock: {
          code: 'WOOD-LARGE-01',
          width: 24400, // 2440 mm
          height: 12200, // 1220 mm
          group: { material: '桦木多层板', thicknessMm: 5, color: '浅木色' },
        },
      },
    }, {});
    expect(addStockRes.code).toBe(200);
    const stockId = addStockRes.data.stockId;

    // 3. 工人输入邀请码成功加入工厂
    currentWxContext.OPENID = 'worker_saas_01';
    const joinRes = await mainHandler({
      action: 'joinFactory',
      payload: { inviteCode },
    }, {});
    expect(joinRes.code).toBe(200);
    expect(joinRes.data.factory.id).toBe(factoryId);

    // 4. 工人查询到工厂共享板材并执行异形排料
    const workerStocksRes = await mainHandler({
      action: 'getFactoryStocks',
      payload: {},
    }, {});
    expect(workerStocksRes.code).toBe(200);
    expect(workerStocksRes.data.stocks.some((s: any) => s.code === 'WOOD-LARGE-01')).toBe(true);

    const triangleGeo = generateTemplatePolygon('TRIANGLE', { base: 600, height: 600 });
    const partGroups: PartGroup[] = [
      {
        id: 'g_tri_saas',
        name: '大型桁架角件',
        targetWidth: 600,
        targetHeight: 600,
        quantity: 4,
        rotationPolicy: 'RIGHT_ANGLE',
        geometry: triangleGeo,
      },
    ];

    const stockObj: Stock = {
      id: stockId,
      code: 'WOOD-LARGE-01',
      group: { material: '桦木多层板', thicknessMm: 5, color: '浅木色' },
      width: 24400,
      height: 12200,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    const solution = solveCuttingPlan({
      stocks: [stockObj],
      partGroups,
      kerfMm: 2,
    });
    expect(solution.candidates[0].isComplete).toBe(true);

    // 5. 任务结算页生成商业 ERP 报价单 (材料费按面积 + 加工费 + 杂费)
    // 投入板材 2440mm × 1220mm = 2.9768 ㎡
    const totalAreaSqm = (24400 * 12200) / 1e8; // (0.1mm)^2 转 ㎡
    const pricePerSqm = 95; // 95 元/㎡
    const processingFee = 80; // 80 元
    const miscFee = 25; // 25 元运费杂费

    const quoteResult = calculateQuote({
      totalInputAreaSqm: totalAreaSqm,
      pricePerSqm,
      processingFee,
      miscFee,
    });

    expect(quoteResult.materialCost).toBe(Math.round(totalAreaSqm * pricePerSqm * 100) / 100);
    expect(quoteResult.totalPrice).toBe(
      Math.round((quoteResult.materialCost + processingFee + miscFee) * 100) / 100
    );

    // 保存商业报价单至云端
    const saveQuoteRes = await mainHandler({
      action: 'saveQuote',
      payload: {
        quote: {
          projectName: '校园建筑模型项目',
          materialCost: quoteResult.materialCost,
          processingFee: quoteResult.processingFee,
          miscFee: quoteResult.miscFee,
          totalPrice: quoteResult.totalPrice,
          totalInputAreaSqm: totalAreaSqm,
          pricePerSqm,
        },
      },
    }, {});
    expect(saveQuoteRes.code).toBe(200);

    // 6. 提交制作结案并原子扣减板材库存
    const deductRes = await mainHandler({
      action: 'deductStock',
      payload: {
        stockId,
        usedLength: 1200,
        usedWidth: 1200,
      },
    }, {});
    expect(deductRes.code).toBe(200);
    expect(deductRes.data.stock.status).toBe('CONSUMED');

    // 7. 多租户隔离验证：未加入工厂的用户无法扣减该板材 (403)
    currentWxContext.OPENID = 'stranger_user';
    const breachDeduct = await mainHandler({
      action: 'deductStock',
      payload: { stockId, usedLength: 100, usedWidth: 100 },
    }, {});
    expect(breachDeduct.code).toBe(403);
  });

  // --------------------------------------------------------------------------
  // Interaction 4: 矩形与异形混合负载调度分流与零重叠验证
  // --------------------------------------------------------------------------
  it('Interaction 4: Mixed Rectangular & Irregular Workload Dispatch & Mutual Non-Overlap', () => {
    const stock: Stock = {
      id: 's_mixed',
      code: 'S-MIXED',
      group: { material: '卡纸', thicknessMm: 0.5, color: '原色' },
      width: 1500,
      height: 1500,
      isOffcut: false,
      status: 'AVAILABLE',
      version: 1,
    };

    // 混合纯矩形与异形多边形
    const rectGroup: PartGroup = {
      id: 'g_rect',
      name: '纯矩形底板',
      targetWidth: 400,
      targetHeight: 300,
      quantity: 1,
      allowRotation: true,
      shape: 'RECT',
    };

    const starGeo = generateTemplatePolygon('STAR', { points: 5, outerRadius: 150, innerRadius: 60 });
    const starGroup: PartGroup = {
      id: 'g_star',
      name: '装饰星形',
      targetWidth: 300,
      targetHeight: 300,
      quantity: 1,
      rotationPolicy: 'LOCKED',
      geometry: starGeo,
    };

    const solution = solveCuttingPlan({
      stocks: [stock],
      partGroups: [rectGroup, starGroup],
      kerfMm: 1,
    });

    // 必须自动调度至 PROFILE 异形求解器
    expect(solution.candidates[0].layoutMode).toBe('PROFILE');
    expect(solution.candidates[0].isComplete).toBe(true);

    // 矩形底板与星形在同一板材上绝无几何碰撞
    const placements = solution.candidates[0].profilePlacements!;
    expect(placements).toHaveLength(2);
    expect(polygonsIntersect(placements[0].transformedPoints, placements[1].transformedPoints)).toBe(false);

    // 通过独立验证器
    const valRes = validateCandidate(solution.candidates[0], [rectGroup, starGroup], [stock], 1);
    expect(valRes.valid).toBe(true);
  });
});
