/**
 * 巧裁核心数据类型定义
 * 内部长度单位统一采用 0.1 mm 整数（例如 104 mm 存储为 1040）
 */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface MaterialGroup {
    material: string;
    thicknessMm: number;
    color: string;
}
export interface Stock {
    id: string;
    code: string;
    ownerId?: string;
    factoryId?: string;
    group: MaterialGroup;
    width: number;
    height: number;
    isOffcut: boolean;
    status: 'AVAILABLE' | 'CONSUMED';
    version: number;
    createdAt?: number;
    defects?: Defect[];
}
export interface FlexibleRange {
    maxShrinkMm: 0 | 1 | 2;
    stepMm: 1;
}
export interface Point {
    x: number;
    y: number;
}
export type ShapeKind = 'RECT' | 'ROUNDED_RECT' | 'CIRCLE' | 'ELLIPSE' | 'TRIANGLE' | 'REGULAR_POLYGON' | 'L_SHAPE' | 'ARCH' | 'STAR' | 'POLYGON';
export type ShapeSource = 'TEMPLATE' | 'DRAW' | 'SVG' | 'PHOTO';
export type RotationPolicy = 'LOCKED' | 'RIGHT_ANGLE' | 'FREE_15';
export interface ShapeGeometry {
    kind: ShapeKind;
    source: ShapeSource;
    points: Point[];
    width: number;
    height: number;
    area: number;
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
    targetWidth: number;
    targetHeight: number;
    quantity: number;
    allowRotation: boolean;
    rotationPolicy?: RotationPolicy;
    geometry?: ShapeGeometry;
    flexibleRange?: FlexibleRange;
    shape?: 'RECT' | 'CIRCLE' | 'TRIANGLE' | ShapeKind;
}
export interface PartInstance {
    instanceId: string;
    groupId: string;
    name: string;
    width: number;
    height: number;
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
    direction?: SplitDirection;
    splitPos?: number;
    kerf?: number;
    kerfRect?: Rect;
    children?: [CutTreeNode, CutTreeNode];
    partInstanceId?: string;
    partGroupId?: string;
    partName?: string;
    rotated?: boolean;
    shape?: 'RECT' | 'CIRCLE' | 'TRIANGLE' | ShapeKind;
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
    newSheetsUsed: number;
    offcutsUsed: number;
    totalInputArea: number;
    partsArea: number;
    kerfArea: number;
    offcutArea: number;
    stepsCount: number;
    utilizationRate: number;
}
export interface Candidate {
    candidateId: string;
    strategyName: string;
    isComplete: boolean;
    appliedDeltaMm: number;
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
    kerfMm: number;
}
export interface SolverOutput {
    baselineCandidate: Candidate | null;
    candidates: Candidate[];
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
