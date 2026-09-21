import { solveCuttingPlan } from '../solver/index.js';
import { validateCandidate } from '../validator/index.js';
const GOALS = new Set(['BALANCED', 'SAVE_MATERIAL', 'EASY_CUT']);
export function validateAgentTurnRequest(input) {
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!message)
        return { valid: false, error: '请输入制作需求' };
    if (message.length > 1000)
        return { valid: false, error: '单次输入不能超过1000字' };
    return { valid: true };
}
function toScaled(value, unit) {
    const mm = unit.toLowerCase() === 'cm' ? value * 10 : value;
    return Math.round(mm * 10);
}
export function createRuleFallbackDraft(text) {
    const normalized = String(text || '').trim();
    const partGroups = [];
    const pattern = /(?:(\d+)\s*(?:个|块|张|件|片)[^0-9\n]{0,12})?([0-9]+(?:\.[0-9]+)?)\s*[xX×乘*]\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|毫米|厘米)?/g;
    let match;
    let index = 1;
    while ((match = pattern.exec(normalized)) !== null && partGroups.length < 10) {
        const unit = match[4] === 'cm' || match[4] === '厘米' ? 'cm' : 'mm';
        const shrink = normalized.match(/(?:允许|可)[^。；，,]{0,16}(?:宽度)?(?:最多)?缩小\s*([012](?:\.0)?)\s*(?:mm|毫米)/);
        const allowRotation = /(?:允许|可以|可)旋转/.test(normalized) && !/(?:不|禁止)旋转/.test(normalized);
        const maxShrinkMm = shrink ? Number(shrink[1]) : 0;
        const quantity = Number(match[1] || (normalized.match(/(\d+)\s*(?:个|块|张|件|片)/) || [])[1] || 1);
        partGroups.push({
            id: `agent-g${index}`, name: /展签/.test(normalized) ? `展签${index}` : `零件组${index}`,
            targetWidth: toScaled(Number(match[2]), unit), targetHeight: toScaled(Number(match[3]), unit),
            quantity, allowRotation, rotationPolicy: allowRotation ? 'RIGHT_ANGLE' : 'LOCKED',
            ...(maxShrinkMm === 1 || maxShrinkMm === 2 ? { flexibleRange: { maxShrinkMm: maxShrinkMm, stepMm: 1 } } : {}),
        });
        index++;
    }
    const kerfMatch = normalized.match(/(?:间距|刀缝|缝隙)\s*(?:为|是|:|：)?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|毫米)?/);
    return {
        stockIds: [], partGroups,
        kerfMm: kerfMatch ? Math.max(0, Math.min(5, Number(kerfMatch[1]))) : 2,
        optimizationGoal: /省料|节省|利用率/.test(normalized) ? 'SAVE_MATERIAL' : 'BALANCED',
    };
}
export function sanitizeAgentDraft(raw, accessibleStocks) {
    const availableIds = new Set(accessibleStocks.filter((stock) => stock.status === 'AVAILABLE').map((stock) => stock.id));
    const rawGroups = Array.isArray(raw?.partGroups) ? raw.partGroups.slice(0, 10) : [];
    const partGroups = rawGroups.map((group, index) => {
        const maxShrink = Number(group?.flexibleRange?.maxShrinkMm);
        const allowRotation = group?.allowRotation === true;
        return {
            id: String(group?.id || `agent-g${index + 1}`).slice(0, 64), name: String(group?.name || `零件组${index + 1}`).slice(0, 40),
            targetWidth: Math.round(Number(group?.targetWidth) || 0), targetHeight: Math.round(Number(group?.targetHeight) || 0),
            quantity: Math.round(Number(group?.quantity) || 0), allowRotation, rotationPolicy: allowRotation ? 'RIGHT_ANGLE' : 'LOCKED',
            ...(maxShrink === 1 || maxShrink === 2 ? { flexibleRange: { maxShrinkMm: maxShrink, stepMm: 1 } } : {}),
        };
    });
    return {
        stockIds: Array.isArray(raw?.stockIds) ? [...new Set(raw.stockIds.map(String))].filter((id) => availableIds.has(id)) : [],
        partGroups, kerfMm: Math.max(0, Math.min(5, Number(raw?.kerfMm) || 0)),
        optimizationGoal: GOALS.has(raw?.optimizationGoal) ? raw.optimizationGoal : 'BALANCED',
    };
}
export function validateRequirementDraft(draft, accessibleStocks) {
    const missingFields = [];
    const errors = [];
    if (!draft.stockIds.length)
        missingFields.push('stockIds');
    if (!draft.partGroups.length)
        missingFields.push('partGroups');
    const availableIds = new Set(accessibleStocks.filter((s) => s.status === 'AVAILABLE').map((s) => s.id));
    if (draft.stockIds.some((id) => !availableIds.has(id)))
        errors.push('包含不可访问或已消耗的材料');
    let totalQuantity = 0;
    for (const group of draft.partGroups) {
        totalQuantity += group.quantity;
        if (!Number.isInteger(group.targetWidth) || !Number.isInteger(group.targetHeight) || group.targetWidth <= 0 || group.targetHeight <= 0)
            errors.push(`${group.name}的尺寸必须为正数`);
        if (!Number.isInteger(group.quantity) || group.quantity <= 0)
            errors.push(`${group.name}的数量必须为正整数`);
        if (group.targetWidth > 20000 || group.targetHeight > 20000)
            errors.push(`${group.name}的尺寸超过2000mm上限`);
        if (group.flexibleRange && ![1, 2].includes(group.flexibleRange.maxShrinkMm))
            errors.push(`${group.name}的尺寸调整范围无效`);
    }
    if (totalQuantity > 20)
        errors.push('单次任务最多支持20个零件');
    if (draft.kerfMm < 0 || draft.kerfMm > 5)
        errors.push('裁切间距必须在0到5mm之间');
    return { valid: missingFields.length === 0 && errors.length === 0, missingFields, errors };
}
export function solveAndCompare(draft, accessibleStocks) {
    const validation = validateRequirementDraft(draft, accessibleStocks);
    if (!validation.valid)
        throw new Error([...validation.missingFields, ...validation.errors].join('；'));
    const selectedStocks = accessibleStocks.filter((stock) => draft.stockIds.includes(stock.id) && stock.status === 'AVAILABLE');
    const solverOutput = solveCuttingPlan({ stocks: selectedStocks, partGroups: draft.partGroups, kerfMm: draft.kerfMm });
    const candidates = solverOutput.candidates.map((candidate) => {
        const checked = validateCandidate(candidate, draft.partGroups, selectedStocks, draft.kerfMm);
        return {
            candidateId: candidate.candidateId, sheetCount: candidate.usedStocks.length,
            utilization: candidate.metrics.utilizationRate, wasteRate: Math.max(0, 1 - candidate.metrics.utilizationRate),
            cutComplexity: candidate.metrics.stepsCount, validationPassed: checked.valid && candidate.isComplete,
            appliedDeltaMm: candidate.appliedDeltaMm, strategyName: candidate.strategyName,
        };
    });
    return { solverOutput, candidates, stocks: selectedStocks };
}
export function buildCutSummary(output) {
    const candidate = output.bestCompleteCandidate || output.candidates.find((item) => item.isComplete) || null;
    return {
        algorithmVersion: output.algorithmVersion, candidateId: candidate?.candidateId || '',
        stepsCount: candidate?.metrics.stepsCount || candidate?.cutPaths?.length || 0,
        sheetCount: candidate?.usedStocks.length || 0,
        placedCount: candidate?.placedParts.length || candidate?.profilePlacements?.length || 0,
    };
}
