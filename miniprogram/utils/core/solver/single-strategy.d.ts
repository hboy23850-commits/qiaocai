import { Stock, PartInstance, Candidate } from '../types/index.js';
export type PartOrderStrategy = 'area-desc' | 'max-side-desc' | 'width-desc';
export type RectFitStrategy = 'best-area-fit' | 'best-short-side-fit';
export type SplitRuleStrategy = 'vertical-first' | 'horizontal-first';
export type StockOrderStrategy = 'offcut-first' | 'area-asc';
export interface StrategyConfig {
    name: string;
    partOrder: PartOrderStrategy;
    rectFit: RectFitStrategy;
    splitRule: SplitRuleStrategy;
    stockOrder: StockOrderStrategy;
    isBaseline?: boolean;
}
/**
 * 对零件列表进行确定性排序
 */
export declare function sortParts(parts: PartInstance[], strategy: PartOrderStrategy): PartInstance[];
/**
 * 对材料列表进行确定性排序
 */
export declare function sortStocks(stocks: Stock[], strategy: StockOrderStrategy): Stock[];
/**
 * 执行单一策略构造排料候选
 */
export declare function runSingleStrategy(strategy: StrategyConfig, allStocks: Stock[], parts: PartInstance[], kerf: number, appliedDeltaMm: number, targetPartDefs: {
    groupId: string;
    width: number;
    height: number;
}[]): Candidate;
