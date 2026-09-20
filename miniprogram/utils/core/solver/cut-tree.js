let nodeIdCounter = 0;
export function resetNodeIdCounter() {
    nodeIdCounter = 0;
}
export function generateNodeId(prefix = 'node') {
    return `${prefix}_${++nodeIdCounter}`;
}
/**
 * 检验在区域 (W x H) 中放置尺寸 (w x h)，裁切间隔为 g 时是否合法
 */
export function canFitWithKerf(regionW, regionH, partW, partH, kerf) {
    if (regionW < partW || regionH < partH) {
        return false;
    }
    // 横向需要分割时，剩余必须足以容纳预留带
    if (regionW > partW && regionW - partW < kerf) {
        return false;
    }
    // 纵向需要分割时，剩余必须足以容纳预留带
    if (regionH > partH && regionH - partH < kerf) {
        return false;
    }
    return true;
}
/**
 * 执行 Guillotine 切割，将零件放置在 regionRect 的左上角
 * @param regionNode 当前余区节点（必须是可用的 OFFCUT 节点）
 * @param stockId 材料 ID
 * @param part 零件信息
 * @param direction 优先分割方向：'VERTICAL' (先竖后横) | 'HORIZONTAL' (先横后竖)
 * @param kerf 裁切间隔 (0.1 mm 整数)
 * @param startStepIndex 当前步骤起始序号
 */
export function executeGuillotineSplit(regionNode, stockId, part, direction, kerf, startStepIndex) {
    const { x, y, width: W, height: H } = regionNode.rect;
    const { width: w, height: h } = part;
    if (!canFitWithKerf(W, H, w, h, kerf)) {
        throw new Error(`区域 (${W}, ${H}) 无法容纳零件 (${w}, ${h}) 且满足间隔 ${kerf}`);
    }
    const steps = [];
    const kerfNodes = [];
    const newOffcuts = [];
    let currentStep = startStepIndex;
    // 零件最终所在的叶子节点
    const partNode = {
        id: generateNodeId('part'),
        type: 'PART',
        rect: { x, y, width: w, height: h },
        partInstanceId: part.instanceId,
        partGroupId: part.groupId,
        partName: part.name,
        rotated: part.rotated,
        shape: part.shape,
    };
    let rootSplitNode;
    if (direction === 'VERTICAL') {
        // 先竖后横 (Vertical First)
        // 第一刀：竖直贯穿切（若 W > w）
        const needsVerticalSplit = W > w;
        const needsHorizontalSplit = H > h;
        if (needsVerticalSplit) {
            // 竖切产生左边条带 (w x H) 和右边余区 ((W - w - g) x H)
            const leftStripRect = { x, y, width: w, height: H };
            const rightOffcutWidth = W - w - (kerf > 0 ? kerf : 0);
            const rightOffcutRect = {
                x: x + w + (kerf > 0 ? kerf : 0),
                y,
                width: rightOffcutWidth,
                height: H,
            };
            let kerfRect;
            if (kerf > 0) {
                kerfRect = { x: x + w, y, width: kerf, height: H };
                kerfNodes.push({
                    id: generateNodeId('kerf'),
                    type: 'KERF',
                    rect: kerfRect,
                });
            }
            steps.push({
                stepIndex: currentStep++,
                stockId,
                direction: 'VERTICAL',
                parentRect: regionNode.rect,
                cutPosition: x + w,
                kerf,
                kerfRect,
                leftOrTopRect: leftStripRect,
                rightOrBottomRect: rightOffcutRect,
                description: `在 x = ${x + w} 处垂直贯穿分割，分出左侧零件条带与右侧余料`,
            });
            // 右侧余区
            const rightNode = {
                id: generateNodeId('offcut'),
                type: 'OFFCUT',
                rect: rightOffcutRect,
            };
            if (rightOffcutWidth > 0) {
                newOffcuts.push(rightNode);
            }
            // 第二刀：在左边条带内部横切（若 H > h）
            let leftNode;
            if (needsHorizontalSplit) {
                const bottomOffcutHeight = H - h - (kerf > 0 ? kerf : 0);
                const bottomOffcutRect = {
                    x,
                    y: y + h + (kerf > 0 ? kerf : 0),
                    width: w,
                    height: bottomOffcutHeight,
                };
                let hKerfRect;
                if (kerf > 0) {
                    hKerfRect = { x, y: y + h, width: w, height: kerf };
                    kerfNodes.push({
                        id: generateNodeId('kerf'),
                        type: 'KERF',
                        rect: hKerfRect,
                    });
                }
                steps.push({
                    stepIndex: currentStep++,
                    stockId,
                    direction: 'HORIZONTAL',
                    parentRect: leftStripRect,
                    cutPosition: y + h,
                    kerf,
                    kerfRect: hKerfRect,
                    leftOrTopRect: partNode.rect,
                    rightOrBottomRect: bottomOffcutRect,
                    description: `在 y = ${y + h} 处水平贯穿分割左侧条带，分出零件 [${part.name}] 与下方余料`,
                });
                const bottomNode = {
                    id: generateNodeId('offcut'),
                    type: 'OFFCUT',
                    rect: bottomOffcutRect,
                };
                if (bottomOffcutHeight > 0) {
                    newOffcuts.push(bottomNode);
                }
                leftNode = {
                    id: generateNodeId('split_h'),
                    type: 'SPLIT',
                    rect: leftStripRect,
                    direction: 'HORIZONTAL',
                    splitPos: y + h,
                    kerf,
                    kerfRect: hKerfRect,
                    children: [partNode, bottomNode],
                };
            }
            else {
                // H === h，左边条带直接就是零件
                leftNode = partNode;
            }
            rootSplitNode = {
                id: generateNodeId('split_v'),
                type: 'SPLIT',
                rect: regionNode.rect,
                direction: 'VERTICAL',
                splitPos: x + w,
                kerf,
                kerfRect,
                children: [leftNode, rightNode],
            };
        }
        else {
            // W === w，不需要竖切，只看是否需要横切
            if (needsHorizontalSplit) {
                const bottomOffcutHeight = H - h - (kerf > 0 ? kerf : 0);
                const bottomOffcutRect = {
                    x,
                    y: y + h + (kerf > 0 ? kerf : 0),
                    width: w,
                    height: bottomOffcutHeight,
                };
                let hKerfRect;
                if (kerf > 0) {
                    hKerfRect = { x, y: y + h, width: w, height: kerf };
                    kerfNodes.push({
                        id: generateNodeId('kerf'),
                        type: 'KERF',
                        rect: hKerfRect,
                    });
                }
                steps.push({
                    stepIndex: currentStep++,
                    stockId,
                    direction: 'HORIZONTAL',
                    parentRect: regionNode.rect,
                    cutPosition: y + h,
                    kerf,
                    kerfRect: hKerfRect,
                    leftOrTopRect: partNode.rect,
                    rightOrBottomRect: bottomOffcutRect,
                    description: `在 y = ${y + h} 处水平贯穿分割，分出零件 [${part.name}] 与下方余料`,
                });
                const bottomNode = {
                    id: generateNodeId('offcut'),
                    type: 'OFFCUT',
                    rect: bottomOffcutRect,
                };
                if (bottomOffcutHeight > 0) {
                    newOffcuts.push(bottomNode);
                }
                rootSplitNode = {
                    id: generateNodeId('split_h'),
                    type: 'SPLIT',
                    rect: regionNode.rect,
                    direction: 'HORIZONTAL',
                    splitPos: y + h,
                    kerf,
                    kerfRect: hKerfRect,
                    children: [partNode, bottomNode],
                };
            }
            else {
                // W === w && H === h，恰好完全铺满当前区域，无需任何切割
                rootSplitNode = partNode;
            }
        }
    }
    else {
        // 先横后竖 (Horizontal First)
        // 第一刀：横向贯穿切（若 H > h）
        const needsHorizontalSplit = H > h;
        const needsVerticalSplit = W > w;
        if (needsHorizontalSplit) {
            // 横切产生上方条带 (W x h) 和下方余区 (W x (H - h - g))
            const topStripRect = { x, y, width: W, height: h };
            const bottomOffcutHeight = H - h - (kerf > 0 ? kerf : 0);
            const bottomOffcutRect = {
                x,
                y: y + h + (kerf > 0 ? kerf : 0),
                width: W,
                height: bottomOffcutHeight,
            };
            let kerfRect;
            if (kerf > 0) {
                kerfRect = { x, y: y + h, width: W, height: kerf };
                kerfNodes.push({
                    id: generateNodeId('kerf'),
                    type: 'KERF',
                    rect: kerfRect,
                });
            }
            steps.push({
                stepIndex: currentStep++,
                stockId,
                direction: 'HORIZONTAL',
                parentRect: regionNode.rect,
                cutPosition: y + h,
                kerf,
                kerfRect,
                leftOrTopRect: topStripRect,
                rightOrBottomRect: bottomOffcutRect,
                description: `在 y = ${y + h} 处水平贯穿分割，分出上方零件条带与下方余料`,
            });
            const bottomNode = {
                id: generateNodeId('offcut'),
                type: 'OFFCUT',
                rect: bottomOffcutRect,
            };
            if (bottomOffcutHeight > 0) {
                newOffcuts.push(bottomNode);
            }
            // 第二刀：在上方条带内部竖切（若 W > w）
            let topNode;
            if (needsVerticalSplit) {
                const rightOffcutWidth = W - w - (kerf > 0 ? kerf : 0);
                const rightOffcutRect = {
                    x: x + w + (kerf > 0 ? kerf : 0),
                    y,
                    width: rightOffcutWidth,
                    height: h,
                };
                let vKerfRect;
                if (kerf > 0) {
                    vKerfRect = { x: x + w, y, width: kerf, height: h };
                    kerfNodes.push({
                        id: generateNodeId('kerf'),
                        type: 'KERF',
                        rect: vKerfRect,
                    });
                }
                steps.push({
                    stepIndex: currentStep++,
                    stockId,
                    direction: 'VERTICAL',
                    parentRect: topStripRect,
                    cutPosition: x + w,
                    kerf,
                    kerfRect: vKerfRect,
                    leftOrTopRect: partNode.rect,
                    rightOrBottomRect: rightOffcutRect,
                    description: `在 x = ${x + w} 处垂直分割上方条带，分出零件 [${part.name}] 与右方余料`,
                });
                const rightNode = {
                    id: generateNodeId('offcut'),
                    type: 'OFFCUT',
                    rect: rightOffcutRect,
                };
                if (rightOffcutWidth > 0) {
                    newOffcuts.push(rightNode);
                }
                topNode = {
                    id: generateNodeId('split_v'),
                    type: 'SPLIT',
                    rect: topStripRect,
                    direction: 'VERTICAL',
                    splitPos: x + w,
                    kerf,
                    kerfRect: vKerfRect,
                    children: [partNode, rightNode],
                };
            }
            else {
                // W === w，上方条带直接是零件
                topNode = partNode;
            }
            rootSplitNode = {
                id: generateNodeId('split_h'),
                type: 'SPLIT',
                rect: regionNode.rect,
                direction: 'HORIZONTAL',
                splitPos: y + h,
                kerf,
                kerfRect,
                children: [topNode, bottomNode],
            };
        }
        else {
            // H === h，不需要横切，只看是否需要竖切
            if (needsVerticalSplit) {
                const rightOffcutWidth = W - w - (kerf > 0 ? kerf : 0);
                const rightOffcutRect = {
                    x: x + w + (kerf > 0 ? kerf : 0),
                    y,
                    width: rightOffcutWidth,
                    height: h,
                };
                let vKerfRect;
                if (kerf > 0) {
                    vKerfRect = { x: x + w, y, width: kerf, height: h };
                    kerfNodes.push({
                        id: generateNodeId('kerf'),
                        type: 'KERF',
                        rect: vKerfRect,
                    });
                }
                steps.push({
                    stepIndex: currentStep++,
                    stockId,
                    direction: 'VERTICAL',
                    parentRect: regionNode.rect,
                    cutPosition: x + w,
                    kerf,
                    kerfRect: vKerfRect,
                    leftOrTopRect: partNode.rect,
                    rightOrBottomRect: rightOffcutRect,
                    description: `在 x = ${x + w} 处垂直贯穿分割，分出零件 [${part.name}] 与右方余料`,
                });
                const rightNode = {
                    id: generateNodeId('offcut'),
                    type: 'OFFCUT',
                    rect: rightOffcutRect,
                };
                if (rightOffcutWidth > 0) {
                    newOffcuts.push(rightNode);
                }
                rootSplitNode = {
                    id: generateNodeId('split_v'),
                    type: 'SPLIT',
                    rect: regionNode.rect,
                    direction: 'VERTICAL',
                    splitPos: x + w,
                    kerf,
                    kerfRect: vKerfRect,
                    children: [partNode, rightNode],
                };
            }
            else {
                // W === w && H === h
                rootSplitNode = partNode;
            }
        }
    }
    return {
        splitNode: rootSplitNode,
        partNode,
        newOffcuts,
        kerfNodes,
        steps,
    };
}
