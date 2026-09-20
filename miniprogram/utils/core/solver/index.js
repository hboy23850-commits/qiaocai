import { validateSolverInput } from '../utils/validation.js';
import { INTERNAL_SCALE } from '../utils/units.js';
import { build24Strategies, compareCandidates } from './strategies.js';
import { runSingleStrategy } from './single-strategy.js';
import { resetNodeIdCounter } from './cut-tree.js';
import { solveProfileCuttingPlan } from './profile-solver.js';
export const ALGORITHM_VERSION = '1.0.0-guillotine24';
/**
 * 巧裁二维矩形与真异形多策略排料求解器主入口
 */
export function solveCuttingPlan(options) {
    // 1. 严格输入校验
    validateSolverInput(options);
    const { stocks, partGroups, kerfMm } = options;
    // 检查是否含有真异形零件
    const hasIrregular = partGroups.some((g) => (g.geometry && g.geometry.kind !== 'RECT') ||
        (g.shape && g.shape !== 'RECT'));
    if (hasIrregular) {
        return solveProfileCuttingPlan(options);
    }
    const kerf = Math.round(kerfMm * INTERNAL_SCALE);
    // 2. 检查是否有柔性尺寸调整组
    const flexibleGroup = partGroups.find((g) => g.flexibleRange && g.flexibleRange.maxShrinkMm > 0);
    const deltaOptions = [0];
    if (flexibleGroup && flexibleGroup.flexibleRange) {
        if (flexibleGroup.flexibleRange.maxShrinkMm >= 1) {
            deltaOptions.push(1);
        }
        if (flexibleGroup.flexibleRange.maxShrinkMm >= 2) {
            deltaOptions.push(2);
        }
    }
    const strategies = build24Strategies();
    let baselineCandidate = null;
    const bestCandidatePerDelta = [];
    let totalExplored = 0;
    // 3. 对每个尺寸候选运行 24 策略
    for (const delta of deltaOptions) {
        // 构造当前 delta 下的零件实例列表
        const partInstances = [];
        const targetPartDefs = [];
        for (const group of partGroups) {
            const isFlexible = flexibleGroup && flexibleGroup.id === group.id;
            const widthDeduction = isFlexible ? delta * INTERNAL_SCALE : 0;
            const actualWidth = group.targetWidth - widthDeduction;
            targetPartDefs.push({
                groupId: group.id,
                width: actualWidth,
                height: group.targetHeight,
            });
            for (let i = 0; i < group.quantity; i++) {
                partInstances.push({
                    instanceId: `${group.id}_${i + 1}`,
                    groupId: group.id,
                    name: group.name,
                    width: actualWidth,
                    height: group.targetHeight,
                    allowRotation: group.allowRotation,
                });
            }
        }
        const deltaCandidates = [];
        for (const strat of strategies) {
            resetNodeIdCounter();
            const cand = runSingleStrategy(strat, stocks, partInstances, kerf, delta, targetPartDefs);
            totalExplored++;
            if (delta === 0 && strat.isBaseline) {
                baselineCandidate = cand;
            }
            deltaCandidates.push(cand);
        }
        // 在当前 delta 的 24 个方案中，选出排序最优的 1 个
        deltaCandidates.sort(compareCandidates);
        if (deltaCandidates.length > 0) {
            bestCandidatePerDelta.push(deltaCandidates[0]);
        }
    }
    // 4. 排序各个尺寸的最优候选
    const sortedCandidates = [...bestCandidatePerDelta].sort(compareCandidates);
    const bestComplete = sortedCandidates.find((c) => c.isComplete) || null;
    return {
        baselineCandidate,
        candidates: bestCandidatePerDelta, // 包含原尺寸与各允许缩小尺寸的最优方案（每个尺寸至多1个）
        bestCompleteCandidate: bestComplete,
        allExploredCount: totalExplored,
        algorithmVersion: ALGORITHM_VERSION,
    };
}
