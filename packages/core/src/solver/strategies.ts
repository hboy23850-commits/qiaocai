import {
  PartOrderStrategy,
  RectFitStrategy,
  SplitRuleStrategy,
  StockOrderStrategy,
  StrategyConfig,
} from './single-strategy.js';
import { Candidate } from '../types/index.js';

export const PART_ORDERS: PartOrderStrategy[] = ['area-desc', 'max-side-desc', 'width-desc'];
export const RECT_FITS: RectFitStrategy[] = ['best-area-fit', 'best-short-side-fit'];
export const SPLIT_RULES: SplitRuleStrategy[] = ['vertical-first', 'horizontal-first'];
export const STOCK_ORDERS: StockOrderStrategy[] = ['offcut-first', 'area-asc'];

/**
 * 构建 24 种确定性策略组合，保证基线策略固定且排在首位
 */
export function build24Strategies(): StrategyConfig[] {
  const strategies: StrategyConfig[] = [];

  // 基线策略: 面积降序、余料优先、面积余量最小、先竖后横
  const baseline: StrategyConfig = {
    name: 'baseline_areaDesc_offcutFirst_bestAreaFit_verticalFirst',
    partOrder: 'area-desc',
    stockOrder: 'offcut-first',
    rectFit: 'best-area-fit',
    splitRule: 'vertical-first',
    isBaseline: true,
  };
  strategies.push(baseline);

  for (const partOrder of PART_ORDERS) {
    for (const stockOrder of STOCK_ORDERS) {
      for (const rectFit of RECT_FITS) {
        for (const splitRule of SPLIT_RULES) {
          // 排除已添加的基线
          if (
            partOrder === baseline.partOrder &&
            stockOrder === baseline.stockOrder &&
            rectFit === baseline.rectFit &&
            splitRule === baseline.splitRule
          ) {
            continue;
          }

          strategies.push({
            name: `strat_${partOrder}_${stockOrder}_${rectFit}_${splitRule}`,
            partOrder,
            stockOrder,
            rectFit,
            splitRule,
            isBaseline: false,
          });
        }
      }
    }
  }

  return strategies;
}

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
export function compareCandidates(a: Candidate, b: Candidate): number {
  // 1. 完整性
  if (a.isComplete !== b.isComplete) {
    return a.isComplete ? -1 : 1;
  }

  // 若均不完整，优先放入更多零件的方案
  if (!a.isComplete) {
    if (a.placedParts.length !== b.placedParts.length) {
      return b.placedParts.length - a.placedParts.length; // 放入多的优先
    }
  }

  // 2. 新整张材料数少
  if (a.metrics.newSheetsUsed !== b.metrics.newSheetsUsed) {
    return a.metrics.newSheetsUsed - b.metrics.newSheetsUsed;
  }

  // 3. 投入材料总面积小
  if (a.metrics.totalInputArea !== b.metrics.totalInputArea) {
    return a.metrics.totalInputArea - b.metrics.totalInputArea;
  }

  // 4. 分割步骤少
  if (a.metrics.stepsCount !== b.metrics.stepsCount) {
    return a.metrics.stepsCount - b.metrics.stepsCount;
  }

  // 5. 尺寸变化小 (delta)
  if (a.appliedDeltaMm !== b.appliedDeltaMm) {
    return a.appliedDeltaMm - b.appliedDeltaMm;
  }

  // 6. 稳定策略名排序
  return a.strategyName.localeCompare(b.strategyName);
}
