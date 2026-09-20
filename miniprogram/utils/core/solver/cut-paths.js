/**
 * 手工排料分步裁切指导与刀路生成
 * 规则：内紧邻优先至外围，给出清晰工具建议与 100mm 校准线
 */
export function generateCutGuidance(placements, stockDimensions) {
    // 1. 判断零件集合的曲线密集度决定推荐工具
    let totalVertices = 0;
    let maxVerticesInPart = 0;
    for (const p of placements) {
        const vCount = p.transformedPoints.length;
        totalVertices += vCount;
        if (vCount > maxVerticesInPart)
            maxVerticesInPart = vCount;
    }
    const avgVertices = placements.length > 0 ? totalVertices / placements.length : 0;
    const isCurvedOrComplex = avgVertices > 8 || maxVerticesInPart > 12;
    const recommendedTool = isCurvedOrComplex
        ? '精密剪刀 / 曲线旋转刻刀（适合异形曲面）'
        : '钢直尺 + 重型美工刀（适合直线多边形）';
    // 2. 内紧邻到外侧分步排序
    // 按照离中心距离从近到远排序（内部优先裁切，便于固定材料）
    const centerX = stockDimensions.width / 2;
    const centerY = stockDimensions.height / 2;
    const sortedPlacements = [...placements].sort((a, b) => {
        const aDist = Math.hypot(a.bbox.x + a.bbox.width / 2 - centerX, a.bbox.y + a.bbox.height / 2 - centerY);
        const bDist = Math.hypot(b.bbox.x + b.bbox.width / 2 - centerX, b.bbox.y + b.bbox.height / 2 - centerY);
        return aDist - bDist;
    });
    const steps = [];
    let stepIndex = 1;
    for (const p of sortedPlacements) {
        steps.push({
            stepIndex,
            instanceId: p.instanceId,
            stockId: p.stockId,
            pathType: p.transformedPoints.length > 4 ? 'CONTOUR' : 'STRAIGHT',
            points: p.transformedPoints,
            toolRecommendation: recommendedTool,
            description: `第 ${stepIndex} 步：裁切零件 [${p.name}] 真实轮廓 (${p.transformedPoints.length} 顶点)，建议使用 ${recommendedTool}`,
        });
        stepIndex++;
    }
    // 3. 外围清边最后一步（若有零件放置）
    if (placements.length > 0) {
        steps.push({
            stepIndex,
            stockId: placements[0].stockId,
            pathType: 'BORDER',
            points: [
                { x: 0, y: 0 },
                { x: stockDimensions.width, y: 0 },
                { x: stockDimensions.width, y: stockDimensions.height },
                { x: 0, y: stockDimensions.height },
            ],
            toolRecommendation: '直尺 + 美工刀',
            description: `第 ${stepIndex} 步：修整板材外侧剩余余料边缘，安全收纳余料`,
        });
    }
    return {
        steps,
        recommendedTool,
        calibrationLineMm: 100, // 100mm 打印实测校准线
    };
}
