import { canFitWithKerf, executeGuillotineSplit, generateNodeId, } from './cut-tree.js';
/**
 * 对零件列表进行确定性排序
 */
export function sortParts(parts, strategy) {
    const list = [...parts];
    list.sort((a, b) => {
        if (strategy === 'area-desc') {
            const areaA = a.width * a.height;
            const areaB = b.width * b.height;
            if (areaA !== areaB)
                return areaB - areaA;
            const maxA = Math.max(a.width, a.height);
            const maxB = Math.max(b.width, b.height);
            if (maxA !== maxB)
                return maxB - maxA;
            return a.instanceId.localeCompare(b.instanceId);
        }
        else if (strategy === 'max-side-desc') {
            const maxA = Math.max(a.width, a.height);
            const maxB = Math.max(b.width, b.height);
            if (maxA !== maxB)
                return maxB - maxA;
            const minA = Math.min(a.width, a.height);
            const minB = Math.min(b.width, b.height);
            if (minA !== minB)
                return minB - minA;
            return a.instanceId.localeCompare(b.instanceId);
        }
        else {
            // width-desc
            if (a.width !== b.width)
                return b.width - a.width;
            if (a.height !== b.height)
                return b.height - a.height;
            return a.instanceId.localeCompare(b.instanceId);
        }
    });
    return list;
}
/**
 * 对材料列表进行确定性排序
 */
export function sortStocks(stocks, strategy) {
    const list = [...stocks];
    list.sort((a, b) => {
        if (strategy === 'offcut-first') {
            // 余料优先 (isOffcut === true 优先于 false)
            if (a.isOffcut !== b.isOffcut) {
                return a.isOffcut ? -1 : 1;
            }
            // 同样是余料或同样是整板，按面积升序
            const areaA = a.width * a.height;
            const areaB = b.width * b.height;
            if (areaA !== areaB)
                return areaA - areaB;
            return a.code.localeCompare(b.code);
        }
        else {
            // area-asc
            const areaA = a.width * a.height;
            const areaB = b.width * b.height;
            if (areaA !== areaB)
                return areaA - areaB;
            if (a.isOffcut !== b.isOffcut) {
                return a.isOffcut ? -1 : 1;
            }
            return a.code.localeCompare(b.code);
        }
    });
    return list;
}
/**
 * 递归在树中将 targetId 的节点替换为 newNode
 */
function replaceNodeInTree(root, targetId, newNode) {
    if (root.id === targetId) {
        return newNode;
    }
    if (root.children) {
        root.children = [
            replaceNodeInTree(root.children[0], targetId, newNode),
            replaceNodeInTree(root.children[1], targetId, newNode),
        ];
    }
    return root;
}
/**
 * 收集树中所有未被使用的 OFFCUT 叶子节点
 */
function collectRemainingOffcuts(node, out = []) {
    if (node.type === 'OFFCUT') {
        if (node.rect.width > 0 && node.rect.height > 0) {
            out.push({ ...node.rect });
        }
    }
    else if (node.children) {
        collectRemainingOffcuts(node.children[0], out);
        collectRemainingOffcuts(node.children[1], out);
    }
    return out;
}
/**
 * 收集树中所有 KERF 节点的总面积
 */
function collectKerfArea(node) {
    let sum = 0;
    if (node.type === 'KERF') {
        sum += node.rect.width * node.rect.height;
    }
    else if (node.children) {
        sum += collectKerfArea(node.children[0]);
        sum += collectKerfArea(node.children[1]);
    }
    return sum;
}
/**
 * 执行单一策略构造排料候选
 */
export function runSingleStrategy(strategy, allStocks, parts, kerf, appliedDeltaMm, targetPartDefs) {
    // 对零件和材料排序
    const sortedParts = sortParts(parts, strategy.partOrder);
    const sortedStocks = sortStocks(allStocks, strategy.stockOrder);
    const activeStocks = [];
    const unplacedPartIds = [];
    const placedParts = [];
    let nextUnusedStockIdx = 0;
    let globalStepCounter = 1;
    // 内部辅助：打开新材料
    function openNewStock(stock) {
        const rootNode = {
            id: generateNodeId('stock_root'),
            type: 'OFFCUT',
            rect: { x: 0, y: 0, width: stock.width, height: stock.height },
        };
        const nodeMap = new Map();
        nodeMap.set(rootNode.id, rootNode);
        const active = {
            stock,
            rootNode,
            freeNodes: [rootNode],
            placedParts: [],
            steps: [],
            nodeMap,
        };
        activeStocks.push(active);
        if (stock.defects && stock.defects.length > 0) {
            for (const defect of stock.defects) {
                const currentFreeNodes = [...active.freeNodes];
                for (const targetFreeNode of currentFreeNodes) {
                    const r1 = targetFreeNode.rect;
                    const r2 = defect;
                    const x = Math.max(r1.x, r2.x);
                    const y = Math.max(r1.y, r2.y);
                    const right = Math.min(r1.x + r1.width, r2.x + r2.width);
                    const bottom = Math.min(r1.y + r1.height, r2.y + r2.height);
                    if (x >= right || y >= bottom) {
                        continue;
                    }
                    const I = { x, y, width: right - x, height: bottom - y };
                    const fIdx = active.freeNodes.findIndex(fn => fn.id === targetFreeNode.id);
                    if (fIdx === -1)
                        continue;
                    let currentNode = active.freeNodes[fIdx];
                    let currentTree = null;
                    const newOffcuts = [];
                    const buildSplit = (dir, pos, child1, child2) => {
                        return {
                            id: generateNodeId(dir === 'VERTICAL' ? 'split_v' : 'split_h'),
                            type: 'SPLIT',
                            rect: {
                                x: child1.rect.x,
                                y: child1.rect.y,
                                width: dir === 'VERTICAL' ? child1.rect.width + child2.rect.width : child1.rect.width,
                                height: dir === 'HORIZONTAL' ? child1.rect.height + child2.rect.height : child1.rect.height
                            },
                            direction: dir,
                            splitPos: pos,
                            kerf: 0,
                            children: [child1, child2]
                        };
                    };
                    if (I.x > currentNode.rect.x) {
                        const leftRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: I.x - currentNode.rect.x, height: currentNode.rect.height };
                        const leftNode = { id: generateNodeId('offcut'), type: 'OFFCUT', rect: leftRect };
                        newOffcuts.push(leftNode);
                        const rightRect = { x: I.x, y: currentNode.rect.y, width: currentNode.rect.x + currentNode.rect.width - I.x, height: currentNode.rect.height };
                        const rightNode = { id: generateNodeId('temp'), type: 'OFFCUT', rect: rightRect };
                        const split = buildSplit('VERTICAL', I.x, leftNode, rightNode);
                        currentTree = split;
                        currentNode = rightNode;
                    }
                    if (I.x + I.width < currentNode.rect.x + currentNode.rect.width) {
                        const rightPos = I.x + I.width;
                        const rightRect = { x: rightPos, y: currentNode.rect.y, width: currentNode.rect.x + currentNode.rect.width - rightPos, height: currentNode.rect.height };
                        const rightNode = { id: generateNodeId('offcut'), type: 'OFFCUT', rect: rightRect };
                        newOffcuts.push(rightNode);
                        const leftRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: rightPos - currentNode.rect.x, height: currentNode.rect.height };
                        const leftNode = { id: generateNodeId('temp'), type: 'OFFCUT', rect: leftRect };
                        const split = buildSplit('VERTICAL', rightPos, leftNode, rightNode);
                        if (currentTree) {
                            currentTree = replaceNodeInTree(currentTree, currentNode.id, split);
                        }
                        else {
                            currentTree = split;
                        }
                        currentNode = leftNode;
                    }
                    if (I.y > currentNode.rect.y) {
                        const topRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: currentNode.rect.width, height: I.y - currentNode.rect.y };
                        const topNode = { id: generateNodeId('offcut'), type: 'OFFCUT', rect: topRect };
                        newOffcuts.push(topNode);
                        const bottomRect = { x: currentNode.rect.x, y: I.y, width: currentNode.rect.width, height: currentNode.rect.y + currentNode.rect.height - I.y };
                        const bottomNode = { id: generateNodeId('temp'), type: 'OFFCUT', rect: bottomRect };
                        const split = buildSplit('HORIZONTAL', I.y, topNode, bottomNode);
                        if (currentTree) {
                            currentTree = replaceNodeInTree(currentTree, currentNode.id, split);
                        }
                        else {
                            currentTree = split;
                        }
                        currentNode = bottomNode;
                    }
                    if (I.y + I.height < currentNode.rect.y + currentNode.rect.height) {
                        const bottomPos = I.y + I.height;
                        const bottomRect = { x: currentNode.rect.x, y: bottomPos, width: currentNode.rect.width, height: currentNode.rect.y + currentNode.rect.height - bottomPos };
                        const bottomNode = { id: generateNodeId('offcut'), type: 'OFFCUT', rect: bottomRect };
                        newOffcuts.push(bottomNode);
                        const topRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: currentNode.rect.width, height: bottomPos - currentNode.rect.y };
                        const topNode = { id: generateNodeId('temp'), type: 'OFFCUT', rect: topRect };
                        const split = buildSplit('HORIZONTAL', bottomPos, topNode, bottomNode);
                        if (currentTree) {
                            currentTree = replaceNodeInTree(currentTree, currentNode.id, split);
                        }
                        else {
                            currentTree = split;
                        }
                        currentNode = topNode;
                    }
                    currentNode.type = 'DEFECT';
                    currentNode.id = generateNodeId('defect');
                    if (!currentTree) {
                        currentTree = currentNode;
                    }
                    else {
                        currentTree = replaceNodeInTree(currentTree, currentNode.id, currentNode);
                    }
                    active.rootNode = replaceNodeInTree(active.rootNode, targetFreeNode.id, currentTree);
                    active.freeNodes.splice(fIdx, 1);
                    active.freeNodes.push(...newOffcuts);
                }
            }
        }
        return active;
    }
    // 依次排每个零件
    for (const part of sortedParts) {
        let bestOption = null;
        // 1. 优先在已打开的材料余区中寻找最佳位置
        for (let sIdx = 0; sIdx < activeStocks.length; sIdx++) {
            const active = activeStocks[sIdx];
            for (let fIdx = 0; fIdx < active.freeNodes.length; fIdx++) {
                const freeNode = active.freeNodes[fIdx];
                const { width: W, height: H } = freeNode.rect;
                // 尝试两种朝向：0° 与 90°
                const orientations = [false];
                if (part.allowRotation && part.width !== part.height) {
                    orientations.push(true);
                }
                for (const rot of orientations) {
                    const pw = rot ? part.height : part.width;
                    const ph = rot ? part.width : part.height;
                    if (canFitWithKerf(W, H, pw, ph, kerf)) {
                        // 计算得分
                        let score;
                        if (strategy.rectFit === 'best-area-fit') {
                            score = W * H - pw * ph;
                        }
                        else {
                            // best-short-side-fit
                            score = Math.min(W - pw, H - ph);
                        }
                        // 比较并更新最佳选择
                        if (!bestOption ||
                            score < bestOption.score ||
                            (score === bestOption.score && sIdx < bestOption.stockIndex) ||
                            (score === bestOption.score &&
                                sIdx === bestOption.stockIndex &&
                                freeNode.rect.y < bestOption.freeNode.rect.y) ||
                            (score === bestOption.score &&
                                sIdx === bestOption.stockIndex &&
                                freeNode.rect.y === bestOption.freeNode.rect.y &&
                                freeNode.rect.x < bestOption.freeNode.rect.x) ||
                            (score === bestOption.score &&
                                sIdx === bestOption.stockIndex &&
                                freeNode.rect.y === bestOption.freeNode.rect.y &&
                                freeNode.rect.x === bestOption.freeNode.rect.x &&
                                !rot &&
                                bestOption.rotated)) {
                            bestOption = {
                                stockIndex: sIdx,
                                freeNodeIndex: fIdx,
                                freeNode,
                                rotated: rot,
                                score,
                            };
                        }
                    }
                }
            }
        }
        // 2. 如果已打开材料放不下，尝试打开下一张材料
        if (!bestOption) {
            while (nextUnusedStockIdx < sortedStocks.length) {
                const candidateStock = sortedStocks[nextUnusedStockIdx++];
                const active = openNewStock(candidateStock);
                const sIdx = activeStocks.length - 1;
                const orientations = [false];
                if (part.allowRotation && part.width !== part.height) {
                    orientations.push(true);
                }
                let bestFreeNodeOption = null;
                for (let fIdx = 0; fIdx < active.freeNodes.length; fIdx++) {
                    const freeNode = active.freeNodes[fIdx];
                    const { width: W, height: H } = freeNode.rect;
                    for (const rot of orientations) {
                        const pw = rot ? part.height : part.width;
                        const ph = rot ? part.width : part.height;
                        if (canFitWithKerf(W, H, pw, ph, kerf)) {
                            let score;
                            if (strategy.rectFit === 'best-area-fit') {
                                score = W * H - pw * ph;
                            }
                            else {
                                score = Math.min(W - pw, H - ph);
                            }
                            if (!bestFreeNodeOption || score < bestFreeNodeOption.score) {
                                bestFreeNodeOption = {
                                    stockIndex: sIdx,
                                    freeNodeIndex: fIdx,
                                    freeNode,
                                    rotated: rot,
                                    score
                                };
                            }
                        }
                    }
                }
                if (bestFreeNodeOption) {
                    bestOption = bestFreeNodeOption;
                    break;
                }
            }
        }
        // 3. 执行放置或记录未放置
        if (bestOption) {
            const active = activeStocks[bestOption.stockIndex];
            const targetFreeNode = bestOption.freeNode;
            const pw = bestOption.rotated ? part.height : part.width;
            const ph = bestOption.rotated ? part.width : part.height;
            const splitResult = executeGuillotineSplit(targetFreeNode, active.stock.id, {
                instanceId: part.instanceId,
                groupId: part.groupId,
                name: part.name,
                width: pw,
                height: ph,
                rotated: bestOption.rotated,
                shape: part.shape,
            }, strategy.splitRule === 'vertical-first' ? 'VERTICAL' : 'HORIZONTAL', kerf, globalStepCounter);
            globalStepCounter += splitResult.steps.length;
            // 更新树结构
            active.rootNode = replaceNodeInTree(active.rootNode, targetFreeNode.id, splitResult.splitNode);
            // 从 freeNodes 中移除原节点，并加入新产生的余区
            active.freeNodes.splice(bestOption.freeNodeIndex, 1);
            for (const offcut of splitResult.newOffcuts) {
                active.freeNodes.push(offcut);
            }
            // 记录已放置零件
            const placed = {
                instanceId: part.instanceId,
                groupId: part.groupId,
                name: part.name,
                stockId: active.stock.id,
                x: targetFreeNode.rect.x,
                y: targetFreeNode.rect.y,
                width: pw,
                height: ph,
                rotated: bestOption.rotated,
                shape: part.shape,
            };
            active.placedParts.push(placed);
            placedParts.push(placed);
            for (const step of splitResult.steps) {
                active.steps.push(step);
            }
        }
        else {
            unplacedPartIds.push(part.instanceId);
        }
    }
    // 4. 统计结果和指标
    let newSheetsUsed = 0;
    let offcutsUsed = 0;
    let totalInputArea = 0;
    let partsArea = 0;
    let kerfArea = 0;
    let offcutArea = 0;
    let stepsCount = 0;
    const usedStocks = [];
    for (const active of activeStocks) {
        if (active.placedParts.length === 0) {
            // 未实际放置零件的板材不计入
            continue;
        }
        if (active.stock.isOffcut) {
            offcutsUsed++;
        }
        else {
            newSheetsUsed++;
        }
        const stockArea = active.stock.width * active.stock.height;
        totalInputArea += stockArea;
        const remaining = collectRemainingOffcuts(active.rootNode);
        for (const r of remaining) {
            offcutArea += r.width * r.height;
        }
        kerfArea += collectKerfArea(active.rootNode);
        stepsCount += active.steps.length;
        usedStocks.push({
            stockId: active.stock.id,
            stockCode: active.stock.code,
            isOffcut: active.stock.isOffcut,
            width: active.stock.width,
            height: active.stock.height,
            cutTree: active.rootNode,
            placedParts: active.placedParts,
            remainingOffcuts: remaining,
            steps: active.steps,
        });
    }
    for (const p of placedParts) {
        partsArea += p.width * p.height;
    }
    const utilizationRate = totalInputArea > 0 ? partsArea / totalInputArea : 0;
    const isComplete = unplacedPartIds.length === 0;
    const metrics = {
        newSheetsUsed,
        offcutsUsed,
        totalInputArea,
        partsArea,
        kerfArea,
        offcutArea,
        stepsCount,
        utilizationRate,
    };
    return {
        candidateId: `cand_${strategy.name}_d${appliedDeltaMm}`,
        strategyName: strategy.name,
        isComplete,
        appliedDeltaMm,
        layoutMode: 'GUILLOTINE_RECT',
        targetParts: targetPartDefs,
        placedParts,
        unplacedPartIds,
        usedStocks,
        metrics,
    };
}
