import { PartOrderStrategy, RectFitStrategy, SplitRuleStrategy, StockOrderStrategy, StrategyConfig } from './single-strategy.js';
import { Candidate } from '../types/index.js';
export declare const PART_ORDERS: PartOrderStrategy[];
export declare const RECT_FITS: RectFitStrategy[];
export declare const SPLIT_RULES: SplitRuleStrategy[];
export declare const STOCK_ORDERS: StockOrderStrategy[];
/**
 * 构建 24 种确定性策略组合，保证基线策略固定且排在首位
 */
export declare function build24Strategies(): StrategyConfig[];
/**
 * 比较两个候选方案优劣
 * 完整有效方案按以下顺序比较：
 * 1. 完整性优先 (isComplete === true)
 * 2. 新整张材料数更少 (newSheetsUsed 升序)
 * 3. 投入材料总面积更小 (totalInputArea 升序)
 * 4. 分割步骤更少 (stepsCount 升序)
 * 5. 尺寸变化更小 (appliedDeltaMm 升序)
 * 6. 稳定策略编号顺序
 */
export declare function compareCandidates(a: Candidate, b: Candidate): number;
