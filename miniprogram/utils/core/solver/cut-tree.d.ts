import { CutTreeNode, SplitDirection, CutStep, ShapeKind } from '../types/index.js';
export declare function resetNodeIdCounter(): void;
export declare function generateNodeId(prefix?: string): string;
export interface SplitResult {
    splitNode: CutTreeNode;
    partNode: CutTreeNode;
    newOffcuts: CutTreeNode[];
    kerfNodes: CutTreeNode[];
    steps: CutStep[];
}
/**
 * 检验在区域 (W x H) 中放置尺寸 (w x h)，裁切间隔为 g 时是否合法
 */
export declare function canFitWithKerf(regionW: number, regionH: number, partW: number, partH: number, kerf: number): boolean;
/**
 * 执行 Guillotine 切割，将零件放置在 regionRect 的左上角
 * @param regionNode 当前余区节点（必须是可用的 OFFCUT 节点）
 * @param stockId 材料 ID
 * @param part 零件信息
 * @param direction 优先分割方向：'VERTICAL' (先竖后横) | 'HORIZONTAL' (先横后竖)
 * @param kerf 裁切间隔 (0.1 mm 整数)
 * @param startStepIndex 当前步骤起始序号
 */
export declare function executeGuillotineSplit(regionNode: CutTreeNode, stockId: string, part: {
    instanceId: string;
    groupId: string;
    name: string;
    width: number;
    height: number;
    rotated: boolean;
    shape?: 'RECT' | 'CIRCLE' | 'TRIANGLE' | ShapeKind;
}, direction: SplitDirection, kerf: number, startStepIndex: number): SplitResult;
