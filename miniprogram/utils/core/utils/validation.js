import { INTERNAL_SCALE } from './units.js';
export const MAX_PART_INSTANCES = 20;
export const MAX_STOCKS = 20;
export const MAX_KERF_MM = 5;
/**
 * 校验求解器整体输入约束
 */
export function validateSolverInput(options) {
    const { stocks, partGroups, kerfMm } = options;
    if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
        throw new Error('未选择任何可用材料');
    }
    if (stocks.length > MAX_STOCKS) {
        throw new Error(`单次任务最多选用 ${MAX_STOCKS} 张材料，当前提供: ${stocks.length}`);
    }
    if (!partGroups || !Array.isArray(partGroups) || partGroups.length === 0) {
        throw new Error('未输入任何零件需求');
    }
    // 校验裁切间隔
    if (typeof kerfMm !== 'number' || !Number.isFinite(kerfMm) || kerfMm < 0 || kerfMm > MAX_KERF_MM) {
        throw new Error(`裁切间隔必须在 0 到 ${MAX_KERF_MM} mm 之间，收到: ${kerfMm}`);
    }
    const kerfScaled = Math.round(kerfMm * INTERNAL_SCALE);
    if (Math.abs(kerfMm * INTERNAL_SCALE - kerfScaled) > 1e-6) {
        throw new Error(`裁切间隔精度不能超过 0.1 mm: ${kerfMm}`);
    }
    // 校验材料组一致性
    const firstGroup = stocks[0].group;
    if (!firstGroup || !firstGroup.material || typeof firstGroup.thicknessMm !== 'number') {
        throw new Error('材料缺少完整的材质组信息（材质、厚度、颜色）');
    }
    for (const s of stocks) {
        if (s.group.material !== firstGroup.material ||
            s.group.thicknessMm !== firstGroup.thicknessMm ||
            s.group.color !== firstGroup.color) {
            throw new Error(`单次排料仅支持同一材料组，发现不兼容材料: ${s.code || s.id}`);
        }
        if (!Number.isInteger(s.width) || s.width <= 0 || !Number.isInteger(s.height) || s.height <= 0) {
            throw new Error(`材料 ${s.code || s.id} 尺寸非法，必须为正整数 (0.1 mm): (${s.width}, ${s.height})`);
        }
    }
    // 统计并校验零件实例数
    let totalPartInstances = 0;
    let flexibleGroupCount = 0;
    for (const g of partGroups) {
        if (!Number.isInteger(g.quantity) || g.quantity <= 0) {
            throw new Error(`零件组 [${g.name}] 数量必须为正整数: ${g.quantity}`);
        }
        if (!Number.isInteger(g.targetWidth) || g.targetWidth <= 0 || !Number.isInteger(g.targetHeight) || g.targetHeight <= 0) {
            throw new Error(`零件组 [${g.name}] 尺寸必须为正整数: (${g.targetWidth}, ${g.targetHeight})`);
        }
        totalPartInstances += g.quantity;
        if (g.flexibleRange && g.flexibleRange.maxShrinkMm > 0) {
            flexibleGroupCount++;
            if (g.flexibleRange.maxShrinkMm !== 1 && g.flexibleRange.maxShrinkMm !== 2) {
                throw new Error(`零件组 [${g.name}] 尺寸缩小范围仅可选 0, 1, 2 mm`);
            }
            if (g.flexibleRange.stepMm !== 1) {
                throw new Error(`零件组 [${g.name}] 尺寸调整步长必须为 1 mm`);
            }
            const minPossibleWidth = g.targetWidth - g.flexibleRange.maxShrinkMm * INTERNAL_SCALE;
            if (minPossibleWidth <= 0) {
                throw new Error(`零件组 [${g.name}] 缩小后宽度必须大于零`);
            }
        }
    }
    if (totalPartInstances > MAX_PART_INSTANCES) {
        throw new Error(`单任务最多容纳 ${MAX_PART_INSTANCES} 个零件实例，当前需求总量: ${totalPartInstances}`);
    }
    if (flexibleGroupCount > 1) {
        throw new Error('最多只允许一个零件组开启尺寸协商与调整');
    }
}
