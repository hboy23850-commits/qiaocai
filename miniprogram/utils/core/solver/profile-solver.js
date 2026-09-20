import { INTERNAL_SCALE } from '../utils/units.js';
import { calculatePolygonArea, calculatePolygonBBox, polygonIntersectsRect, polygonsIntersect, transformPoints, } from '../geometry/polygon.js';
import { generateCutGuidance } from './cut-paths.js';
export const PROFILE_ALGORITHM_VERSION = '2.0.0-profile-nesting';
/**
 * 构建至少 12 种确定性异形排料策略
 */
export function buildProfileStrategies() {
    const partOrders = [
        'area-desc',
        'bbox-desc',
        'complexity-desc',
        'aspect-desc',
    ];
    const stockOrders = [
        'offcut-first-small',
        'offcut-first-large',
        'smallest-area-first',
    ];
    const strategies = [];
    let idCount = 1;
    for (const po of partOrders) {
        for (const so of stockOrders) {
            let archetype = 'BALANCED';
            if (so === 'offcut-first-large' && po === 'area-desc') {
                archetype = 'MATERIAL_SAVING';
            }
            else if (po === 'complexity-desc' || po === 'aspect-desc') {
                archetype = 'EASY_CUTTING';
            }
            strategies.push({
                id: `profile_strat_${idCount++}`,
                name: getStrategyDisplayName(po, so),
                partOrder: po,
                stockOrder: so,
                archetype,
            });
        }
    }
    return strategies;
}
function getStrategyDisplayName(po, so) {
    const poName = po === 'area-desc'
        ? '大面积优先'
        : po === 'bbox-desc'
            ? '包围盒优先'
            : po === 'complexity-desc'
                ? '复杂轮廓优先'
                : '长宽比优先';
    const soName = so === 'offcut-first-small'
        ? '余料紧凑优先'
        : so === 'offcut-first-large'
            ? '余料高容优先'
            : '小板递增优先';
    return `${poName}·${soName}`;
}
/**
 * PROFILE 异形排料求解器主入口
 */
export function solveProfileCuttingPlan(options) {
    const { stocks, partGroups, kerfMm } = options;
    const kerf = Math.round(kerfMm * INTERNAL_SCALE);
    // 1. 标准化零件组（若无 geometry 则按长宽转为 RECT）
    const normalizedGroups = partGroups.map((g) => {
        let geo = g.geometry;
        if (!geo) {
            const w = g.targetWidth;
            const h = g.targetHeight;
            geo = {
                kind: 'RECT',
                source: 'TEMPLATE',
                points: [
                    { x: 0, y: 0 },
                    { x: w, y: 0 },
                    { x: w, y: h },
                    { x: 0, y: h },
                ],
                width: w,
                height: h,
                area: w * h,
                closed: true,
            };
        }
        const rotPolicy = g.rotationPolicy || (g.allowRotation ? 'RIGHT_ANGLE' : 'LOCKED');
        return {
            ...g,
            geometry: geo,
            rotationPolicy: rotPolicy,
        };
    });
    // 2. 展开零件实例
    const baseInstances = [];
    for (const group of normalizedGroups) {
        for (let i = 0; i < group.quantity; i++) {
            baseInstances.push({
                instanceId: `${group.id}_${i + 1}`,
                groupId: group.id,
                name: group.name,
                width: group.geometry.width,
                height: group.geometry.height,
                allowRotation: group.rotationPolicy !== 'LOCKED',
                rotationPolicy: group.rotationPolicy,
                geometry: group.geometry,
            });
        }
    }
    const strategies = buildProfileStrategies();
    const exploredCandidates = [];
    for (const strat of strategies) {
        const cand = runProfileSingleStrategy(strat, stocks, baseInstances, normalizedGroups, kerf);
        exploredCandidates.push(cand);
    }
    // 3. 排序所有候选方案
    exploredCandidates.sort(compareProfileCandidates);
    const bestComplete = exploredCandidates.find((c) => c.isComplete) || null;
    const baseline = exploredCandidates[0] || null;
    // 4. 筛选出 3 种不同倾向的方案推荐展示 (节省材料、方便裁切、综合平衡)
    const selectedCandidates = [];
    // A. 节省材料（完成度最高、板材数最少、利用率最高）
    const materialSaving = exploredCandidates.find((c) => c.isComplete) || exploredCandidates[0];
    if (materialSaving) {
        selectedCandidates.push({
            ...materialSaving,
            strategyName: '节省材料（优先余料与利用率）',
        });
    }
    // B. 方便裁切（旋转次数最少，以直角对齐为主）
    const easyCutting = exploredCandidates.find((c) => c.candidateId !== materialSaving?.candidateId &&
        (c.profilePlacements || []).every((p) => p.rotationDeg === 0)) ||
        exploredCandidates.find((c) => c.candidateId !== materialSaving?.candidateId) ||
        materialSaving;
    if (easyCutting && !selectedCandidates.some((c) => c.candidateId === easyCutting.candidateId)) {
        selectedCandidates.push({
            ...easyCutting,
            strategyName: '方便裁切（平直对齐刀路顺畅）',
        });
    }
    // C. 综合平衡
    const balanced = exploredCandidates.find((c) => !selectedCandidates.some((sc) => sc.candidateId === c.candidateId)) || selectedCandidates[0];
    if (balanced && !selectedCandidates.some((c) => c.candidateId === balanced.candidateId)) {
        selectedCandidates.push({
            ...balanced,
            strategyName: '综合平衡（兼顾料耗与操作）',
        });
    }
    return {
        baselineCandidate: baseline,
        candidates: selectedCandidates.length > 0 ? selectedCandidates : exploredCandidates.slice(0, 3),
        bestCompleteCandidate: bestComplete,
        allExploredCount: exploredCandidates.length,
        algorithmVersion: PROFILE_ALGORITHM_VERSION,
    };
}
/**
 * 运行单个确定性 PROFILE 策略
 */
function runProfileSingleStrategy(strat, rawStocks, instances, groups, kerf) {
    // 1. 排序材料
    const sortedStocks = [...rawStocks].sort((a, b) => {
        if (strat.stockOrder === 'offcut-first-small') {
            if (a.isOffcut !== b.isOffcut)
                return a.isOffcut ? -1 : 1;
            return a.width * a.height - b.width * b.height;
        }
        else if (strat.stockOrder === 'offcut-first-large') {
            if (a.isOffcut !== b.isOffcut)
                return a.isOffcut ? -1 : 1;
            return b.width * b.height - a.width * a.height;
        }
        else {
            return a.width * a.height - b.width * b.height;
        }
    });
    // 2. 排序零件实例
    const sortedParts = [...instances].sort((a, b) => {
        const geoA = a.geometry;
        const geoB = b.geometry;
        if (strat.partOrder === 'area-desc') {
            return geoB.area - geoA.area;
        }
        else if (strat.partOrder === 'bbox-desc') {
            return geoB.width * geoB.height - geoA.width * geoA.height;
        }
        else if (strat.partOrder === 'complexity-desc') {
            return geoB.points.length - geoA.points.length;
        }
        else {
            const aspA = Math.max(geoA.width / geoA.height, geoA.height / geoA.width);
            const aspB = Math.max(geoB.width / geoB.height, geoB.height / geoB.width);
            return aspB - aspA;
        }
    });
    const placementsByStock = new Map();
    for (const s of sortedStocks) {
        placementsByStock.set(s.id, []);
    }
    const placedProfiles = [];
    const unplacedPartIds = [];
    // 3. 确定性栅格与多边形精细相交放置
    for (const part of sortedParts) {
        const angles = getCandidateAngles(part.rotationPolicy);
        let placed = false;
        for (const stock of sortedStocks) {
            const existingOnStock = placementsByStock.get(stock.id) || [];
            const stockDefects = stock.defects || [];
            // 寻找最优放置点 (Bottom-Left 优先搜索)
            const foundPos = findBestPlacement(part.geometry.points, angles, stock, existingOnStock, stockDefects, kerf);
            if (foundPos) {
                const placement = {
                    instanceId: part.instanceId,
                    groupId: part.groupId,
                    name: part.name,
                    stockId: stock.id,
                    translation: foundPos.translation,
                    rotationDeg: foundPos.rotationDeg,
                    transformedPoints: foundPos.transformedPoints,
                    bbox: foundPos.bbox,
                };
                existingOnStock.push(placement);
                placedProfiles.push(placement);
                placed = true;
                break;
            }
        }
        if (!placed) {
            unplacedPartIds.push(part.instanceId);
        }
    }
    // 4. 汇总材料使用与统计
    const usedStocks = [];
    let totalInputArea = 0;
    let newSheetsUsed = 0;
    let offcutsUsed = 0;
    let partsArea = 0;
    for (const stock of sortedStocks) {
        const placements = placementsByStock.get(stock.id) || [];
        if (placements.length > 0) {
            const stockArea = stock.width * stock.height;
            totalInputArea += stockArea;
            if (stock.isOffcut)
                offcutsUsed++;
            else
                newSheetsUsed++;
            const placedOnThisStock = placements.map((p) => ({
                instanceId: p.instanceId,
                groupId: p.groupId,
                name: p.name,
                stockId: p.stockId,
                x: p.bbox.x,
                y: p.bbox.y,
                width: p.bbox.width,
                height: p.bbox.height,
                rotated: p.rotationDeg !== 0,
            }));
            usedStocks.push({
                stockId: stock.id,
                stockCode: stock.code,
                isOffcut: stock.isOffcut,
                width: stock.width,
                height: stock.height,
                cutTree: {
                    id: `root_${stock.id}`,
                    type: 'PART',
                    rect: { x: 0, y: 0, width: stock.width, height: stock.height },
                },
                placedParts: placedOnThisStock,
                remainingOffcuts: [],
                steps: [],
            });
        }
    }
    for (const p of placedProfiles) {
        partsArea += calculatePolygonArea(p.transformedPoints);
    }
    const kerfArea = placedProfiles.length * kerf * 100;
    const offcutArea = Math.max(0, totalInputArea - partsArea - kerfArea);
    const utilizationRate = totalInputArea > 0 ? partsArea / totalInputArea : 0;
    const metrics = {
        newSheetsUsed,
        offcutsUsed,
        totalInputArea,
        partsArea,
        kerfArea,
        offcutArea,
        stepsCount: placedProfiles.length,
        utilizationRate,
    };
    const cutGuidance = generateCutGuidance(placedProfiles, usedStocks.length > 0 ? { width: usedStocks[0].width, height: usedStocks[0].height } : { width: 1000, height: 1000 });
    const placedParts = placedProfiles.map((p) => ({
        instanceId: p.instanceId,
        groupId: p.groupId,
        name: p.name,
        stockId: p.stockId,
        x: p.bbox.x,
        y: p.bbox.y,
        width: p.bbox.width,
        height: p.bbox.height,
        rotated: p.rotationDeg !== 0,
    }));
    return {
        candidateId: `cand_prof_${strat.id}`,
        strategyName: strat.name,
        isComplete: unplacedPartIds.length === 0,
        appliedDeltaMm: 0,
        layoutMode: 'PROFILE',
        targetParts: groups.map((g) => ({
            groupId: g.id,
            width: g.targetWidth,
            height: g.targetHeight,
        })),
        placedParts,
        profilePlacements: placedProfiles,
        cutPaths: cutGuidance.steps,
        unplacedPartIds,
        usedStocks,
        metrics,
    };
}
/**
 * 获取旋转策略允许的角度
 */
function getCandidateAngles(policy) {
    if (!policy || policy === 'LOCKED')
        return [0];
    if (policy === 'RIGHT_ANGLE')
        return [0, 90, 180, 270];
    if (policy === 'FREE_15') {
        const angles = [];
        for (let a = 0; a < 360; a += 15)
            angles.push(a);
        return angles;
    }
    return [0];
}
/**
 * 寻找多边形在指定板材上的首个合法放置点 (Bottom-Left 栅格步进)
 */
function findBestPlacement(rawPoints, angles, stock, existing, defects, kerf) {
    // 栅格步长: 1mm (10 in 0.1mm) 或 2mm
    const step = 20;
    for (const rot of angles) {
        const tempTransformed = transformPoints(rawPoints, { x: 0, y: 0 }, rot);
        const bbox = calculatePolygonBBox(tempTransformed);
        if (bbox.width > stock.width || bbox.height > stock.height) {
            continue;
        }
        // 在板材范围内双重循环测试候选坐标
        for (let y = 0; y <= stock.height - bbox.height; y += step) {
            for (let x = 0; x <= stock.width - bbox.width; x += step) {
                const candidatePoints = transformPoints(rawPoints, { x, y }, rot);
                const candBBox = calculatePolygonBBox(candidatePoints);
                // 1. 边界检查
                if (candBBox.x < 0 ||
                    candBBox.y < 0 ||
                    candBBox.x + candBBox.width > stock.width ||
                    candBBox.y + candBBox.height > stock.height) {
                    continue;
                }
                // 2. 瑕疵与禁排区检查
                let hitDefect = false;
                for (const def of defects) {
                    if (polygonIntersectsRect(candidatePoints, def)) {
                        hitDefect = true;
                        break;
                    }
                }
                if (hitDefect)
                    continue;
                // 3. 与同板材上已放多边形相交与间隙 (kerf) 检查
                let hitExisting = false;
                for (const prev of existing) {
                    // AABB 粗筛（加上 kerf 间隙）
                    const pBox = prev.bbox;
                    const overlapBBox = !(candBBox.x + candBBox.width + kerf <= pBox.x ||
                        pBox.x + pBox.width + kerf <= candBBox.x ||
                        candBBox.y + candBBox.height + kerf <= pBox.y ||
                        pBox.y + pBox.height + kerf <= candBBox.y);
                    if (overlapBBox) {
                        // 精细多边形相交测试
                        if (polygonsIntersect(candidatePoints, prev.transformedPoints)) {
                            hitExisting = true;
                            break;
                        }
                    }
                }
                if (!hitExisting) {
                    return {
                        translation: { x, y },
                        rotationDeg: rot,
                        transformedPoints: candidatePoints,
                        bbox: candBBox,
                    };
                }
            }
        }
    }
    return null;
}
/**
 * 候选方案优劣比较器
 */
export function compareProfileCandidates(a, b) {
    // 1. 完整放置优先
    if (a.isComplete !== b.isComplete) {
        return a.isComplete ? -1 : 1;
    }
    // 若均未完整放置，放置数量多者优先
    if (!a.isComplete && !b.isComplete) {
        return b.placedParts.length - a.placedParts.length;
    }
    // 2. 整板使用少者优先
    if (a.metrics.newSheetsUsed !== b.metrics.newSheetsUsed) {
        return a.metrics.newSheetsUsed - b.metrics.newSheetsUsed;
    }
    // 3. 余料利用优先（使用余料更多者优先）
    if (a.metrics.offcutsUsed !== b.metrics.offcutsUsed) {
        return b.metrics.offcutsUsed - a.metrics.offcutsUsed;
    }
    // 4. 利用率高者优先
    if (Math.abs(b.metrics.utilizationRate - a.metrics.utilizationRate) > 1e-4) {
        return b.metrics.utilizationRate - a.metrics.utilizationRate;
    }
    // 5. 裁切复杂度 / 步骤数少者优先
    return a.metrics.stepsCount - b.metrics.stepsCount;
}
