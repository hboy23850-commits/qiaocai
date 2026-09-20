/**
 * 巧裁核心数据类型定义
 * 内部长度单位统一采用 0.1 mm 整数（例如 104 mm 存储为 1040）
 */

export interface Rect {
  x: number;      // 0.1 mm 整数
  y: number;      // 0.1 mm 整数
  width: number;  // 0.1 mm 整数
  height: number; // 0.1 mm 整数
}

export interface MaterialGroup {
  material: string;   // 材质，如 "木质椴木板"、"卡纸"
  thicknessMm: number;// 厚度 mm
  color: string;      // 颜色，如 "原色"、"白色"
}

export interface Stock {
  id: string;
  code: string;       // 实物编号，如 "S1", "S2"
  ownerId?: string;
  factoryId?: string; // SaaS 租户隔离关联字段
  group: MaterialGroup;
  width: number;      // 0.1 mm 整数
  height: number;     // 0.1 mm 整数
  isOffcut: boolean;  // 是否为余料
  status: 'AVAILABLE' | 'CONSUMED';
  version: number;
  createdAt?: number;
  defects?: Defect[];
}

export interface FlexibleRange {
  maxShrinkMm: 0 | 1 | 2; // 最多允许缩小的毫米数：0, 1, 2
  stepMm: 1;             // 固定为 1 mm
}

export interface Point {
  x: number; // 0.1 mm 整数
  y: number; // 0.1 mm 整数
}

export type ShapeKind =
  | 'RECT'
  | 'ROUNDED_RECT'
  | 'CIRCLE'
  | 'ELLIPSE'
  | 'TRIANGLE'
  | 'REGULAR_POLYGON'
  | 'L_SHAPE'
  | 'ARCH'
  | 'STAR'
  | 'POLYGON';

export type ShapeSource = 'TEMPLATE' | 'DRAW' | 'SVG' | 'PHOTO';

export type RotationPolicy = 'LOCKED' | 'RIGHT_ANGLE' | 'FREE_15';

export interface ShapeGeometry {
  kind: ShapeKind;
  source: ShapeSource;
  points: Point[]; // 闭合多边形顶点序列 (0.1mm 整数)
  width: number;   // 外接矩形宽 (0.1mm 整数)
  height: number;  // 外接矩形高 (0.1mm 整数)
  area: number;    // 真实多边形面积 (0.1mm)^2
  closed: true;
  templateParams?: Record<string, any>;
  confidence?: number;
  /** 图片辅助录入的本地来源，仅用于继续编辑与来源说明。 */
  sourceImagePath?: string;
  /** 图片轮廓采用的实际宽度标定值，单位 mm。 */
  scaleReferenceMm?: number;
}

export interface ProfilePlacement {
  instanceId: string;
  groupId: string;
  name: string;
  stockId: string;
  translation: Point;
  rotationDeg: number;
  transformedPoints: Point[];
  bbox: Rect;
}

export interface CutPath {
  stepIndex: number;
  instanceId?: string;
  stockId: string;
  pathType: 'INNER_ADJACENT' | 'CONTOUR' | 'BORDER' | 'STRAIGHT';
  points: Point[];
  toolRecommendation: string;
  description: string;
}

export interface PartGroup {
  id: string;
  name: string;
  targetWidth: number;   // 0.1 mm 整数（初始原尺寸）
  targetHeight: number;  // 0.1 mm 整数（固定不变）
  quantity: number;      // 数量
  allowRotation: boolean;// 默认 false（向后兼容）
  rotationPolicy?: RotationPolicy;
  geometry?: ShapeGeometry;
  flexibleRange?: FlexibleRange;
  shape?: 'RECT' | 'CIRCLE' | 'TRIANGLE' | ShapeKind;
}

export interface PartInstance {
  instanceId: string;    // 如 "P1-1", "P1-2"
  groupId: string;
  name: string;
  width: number;         // 当前候选尺寸（0.1 mm 整数）
  height: number;        // 0.1 mm 整数
  allowRotation: boolean;
  rotationPolicy?: RotationPolicy;
  geometry?: ShapeGeometry;
  shape?: 'RECT' | 'CIRCLE' | 'TRIANGLE' | ShapeKind;
}

export type CutNodeType = 'SPLIT' | 'PART' | 'OFFCUT' | 'KERF' | 'DEFECT';
export type SplitDirection = 'VERTICAL' | 'HORIZONTAL';

export interface CutTreeNode {
  id: string;
  type: CutNodeType;
  rect: Rect;
  // 当 type === 'SPLIT'
  direction?: SplitDirection;
  splitPos?: number;      // 绝对坐标位置（0.1 mm 整数）
  kerf?: number;          // 预留条带宽度（0.1 mm 整数）
  kerfRect?: Rect;        // 预留条带的绝对几何矩形
  children?: [CutTreeNode, CutTreeNode]; // [first, second]
  // 当 type === 'PART'
  partInstanceId?: string;
  partGroupId?: string;
  partName?: string;
  rotated?: boolean;
  shape?: 'RECT' | 'CIRCLE' | 'TRIANGLE' | ShapeKind;
  // 步骤顺序序号 (1, 2, 3...)
  stepIndex?: number;
}

export interface PlacedPart {
  instanceId: string;
  groupId: string;
  name: string;
  stockId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  shape?: 'RECT' | 'CIRCLE' | 'TRIANGLE' | ShapeKind;
}

export interface Defect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UsedStockPlan {
  stockId: string;
  stockCode: string;
  isOffcut: boolean;
  width: number;
  height: number;
  cutTree: CutTreeNode;
  placedParts: PlacedPart[];
  remainingOffcuts: Rect[];
  steps: CutStep[];
}

export interface CutStep {
  stepIndex: number;
  stockId: string;
  direction: SplitDirection;
  parentRect: Rect;
  cutPosition: number;
  kerf: number;
  kerfRect?: Rect;
  leftOrTopRect: Rect;
  rightOrBottomRect: Rect;
  description: string;
}

export interface PlanMetrics {
  newSheetsUsed: number;   // 新整张材料数量
  offcutsUsed: number;     // 使用的余料数量
  totalInputArea: number;  // 投入总面积 (0.1mm)^2
  partsArea: number;       // 零件总面积 (0.1mm)^2
  kerfArea: number;        // 条带损耗总面积 (0.1mm)^2
  offcutArea: number;      // 剩余余区总面积 (0.1mm)^2
  stepsCount: number;      // 分割步骤总数
  utilizationRate: number; // 零件总面积 / 投入总面积 (0~1)
}

export interface Candidate {
  candidateId: string;
  strategyName: string;
  isComplete: boolean;
  appliedDeltaMm: number;  // 宽度减少的 mm (0, 1, 2)
  layoutMode?: 'GUILLOTINE_RECT' | 'PROFILE';
  targetParts: {
    groupId: string;
    width: number;
    height: number;
  }[];
  placedParts: PlacedPart[];
  profilePlacements?: ProfilePlacement[];
  cutPaths?: CutPath[];
  unplacedPartIds: string[];
  usedStocks: UsedStockPlan[];
  metrics: PlanMetrics;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SolverOptions {
  stocks: Stock[];
  partGroups: PartGroup[];
  kerfMm: number; // 0 - 5 mm, 精度 0.1 mm
}

export interface SolverOutput {
  baselineCandidate: Candidate | null;
  candidates: Candidate[]; // 仅包含不同尺寸下最优的有效候选（同一尺寸最多1个最优）
  bestCompleteCandidate: Candidate | null;
  allExploredCount: number;
  algorithmVersion: string;
}

/**
 * SaaS 工厂角色
 */
export type FactoryRole = 'BOSS' | 'WORKER';

/**
 * SaaS 工厂企业租户模型
 */
export interface FactoryTenant {
  id: string;
  name: string;
  inviteCode: string;
  ownerOpenId: string;
  createdAt?: number | any;
  memberCount?: number;
}

/**
 * 工厂成员关系
 */
export interface FactoryMember {
  id?: string;
  factoryId: string;
  openId: string;
  role: FactoryRole;
  nickName?: string;
  joinedAt?: number | any;
}

/**
 * ERP 报价单明细项
 */
export interface QuoteItem {
  name: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  material?: string;
}

/**
 * ERP 商业报价单记录
 */
export interface QuoteRecord {
  id?: string;
  _id?: string;
  quoteNo?: string;
  factoryId?: string;
  operatorId?: string;
  creatorRole?: FactoryRole;
  customerName?: string;
  projectName?: string;
  materialCost: number;
  processingFee: number;
  miscFee: number;
  totalPrice: number;
  totalInputAreaSqm?: number;
  pricePerSqm?: number;
  items?: QuoteItem[];
  createdAt?: number | string | any;
}

/**
 * 报价单实时计算输入
 */
export interface QuoteCalculationInput {
  totalInputAreaSqm: number;
  pricePerSqm: number;
  processingFee: number;
  miscFee: number;
}

/**
 * 报价单实时计算结果
 */
export interface QuoteCalculationResult {
  materialCost: number;
  processingFee: number;
  miscFee: number;
  totalPrice: number;
}
