"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/core/src/index.ts
var src_exports = {};
__export(src_exports, {
  ALGORITHM_VERSION: () => ALGORITHM_VERSION,
  INTERNAL_SCALE: () => INTERNAL_SCALE,
  MAX_KERF_MM: () => MAX_KERF_MM,
  MAX_PART_INSTANCES: () => MAX_PART_INSTANCES,
  MAX_STOCKS: () => MAX_STOCKS,
  PART_ORDERS: () => PART_ORDERS,
  PROFILE_ALGORITHM_VERSION: () => PROFILE_ALGORITHM_VERSION,
  RECT_FITS: () => RECT_FITS,
  SPLIT_RULES: () => SPLIT_RULES,
  STOCK_ORDERS: () => STOCK_ORDERS,
  build24Strategies: () => build24Strategies,
  buildCutSummary: () => buildCutSummary,
  buildProfileStrategies: () => buildProfileStrategies,
  calculatePolygonArea: () => calculatePolygonArea,
  calculatePolygonBBox: () => calculatePolygonBBox,
  calculateQuote: () => calculateQuote,
  canFitWithKerf: () => canFitWithKerf,
  compareCandidates: () => compareCandidates,
  compareProfileCandidates: () => compareProfileCandidates,
  computeHomography: () => computeHomography,
  createA4DemoOptions: () => createA4DemoOptions,
  createRuleFallbackDraft: () => createRuleFallbackDraft,
  doLineSegmentsIntersect: () => doLineSegmentsIntersect,
  douglasPeucker: () => douglasPeucker,
  executeGuillotineSplit: () => executeGuillotineSplit,
  extractContourFromBinaryImage: () => extractContourFromBinaryImage,
  findContoursFromImageData: () => findContoursFromImageData,
  formatArea: () => formatArea,
  formatInternal: () => formatInternal,
  fromInternalDimension: () => fromInternalDimension,
  generateCutGuidance: () => generateCutGuidance,
  generateNodeId: () => generateNodeId,
  generateTemplatePolygon: () => generateTemplatePolygon,
  isPointInPolygon: () => isPointInPolygon,
  isPolygonClosed: () => isPolygonClosed,
  isPolygonInsideRect: () => isPolygonInsideRect,
  isPolygonSelfIntersecting: () => isPolygonSelfIntersecting,
  otsuThreshold: () => otsuThreshold,
  parseSVGToShapeGeometry: () => parseSVGToShapeGeometry,
  polygonIntersectsRect: () => polygonIntersectsRect,
  polygonsIntersect: () => polygonsIntersect,
  rectifyPoints: () => rectifyPoints,
  resetNodeIdCounter: () => resetNodeIdCounter,
  runA4Demo: () => runA4Demo,
  runSingleStrategy: () => runSingleStrategy,
  sanitizeAgentDraft: () => sanitizeAgentDraft,
  sanitizeSVG: () => sanitizeSVG,
  snapAngle: () => snapAngle,
  solveAndCompare: () => solveAndCompare,
  solveCuttingPlan: () => solveCuttingPlan,
  solveProfileCuttingPlan: () => solveProfileCuttingPlan,
  sortParts: () => sortParts,
  sortStocks: () => sortStocks,
  toInternalDimension: () => toInternalDimension,
  transformPoints: () => transformPoints,
  validateAgentTurnRequest: () => validateAgentTurnRequest,
  validateCandidate: () => validateCandidate,
  validateProfilePlacements: () => validateProfilePlacements,
  validateRequirementDraft: () => validateRequirementDraft,
  validateSolverInput: () => validateSolverInput
});
module.exports = __toCommonJS(src_exports);

// packages/core/src/utils/units.ts
var INTERNAL_SCALE = 10;
function toInternalDimension(value, unit = "mm") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`\u8F93\u5165\u5FC5\u987B\u662F\u6709\u9650\u6570\u503C\uFF0C\u6536\u5230: ${value}`);
  }
  if (value <= 0) {
    throw new Error(`\u5C3A\u5BF8\u5FC5\u987B\u4E3A\u6B63\u6570\uFF0C\u6536\u5230: ${value}`);
  }
  const mmValue = unit === "cm" ? value * 10 : value;
  if (mmValue > 1e5) {
    throw new Error(`\u5C3A\u5BF8\u8D85\u51FA\u6700\u5927\u5141\u8BB8\u8303\u56F4 (100000 mm): ${mmValue}`);
  }
  const scaled = mmValue * INTERNAL_SCALE;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new Error(`\u8F93\u5165\u5C3A\u5BF8 ${value} ${unit} \u8D85\u8FC7\u4E86\u652F\u6301\u7684 0.1 mm \u7CBE\u5EA6\uFF0C\u7981\u6B62\u9759\u9ED8\u56DB\u820D\u4E94\u5165\uFF0C\u8BF7\u4FEE\u6B63\u8F93\u5165`);
  }
  return rounded;
}
function fromInternalDimension(internalValue, unit = "mm") {
  if (!Number.isInteger(internalValue) || internalValue < 0) {
    throw new Error(`\u5185\u90E8\u5C3A\u5BF8\u5FC5\u987B\u4E3A\u975E\u8D1F\u6574\u6570\uFF0C\u6536\u5230: ${internalValue}`);
  }
  const mm = internalValue / INTERNAL_SCALE;
  return unit === "cm" ? mm / 10 : mm;
}
function formatInternal(internalValue, unit = "mm") {
  const num = fromInternalDimension(internalValue, unit);
  const formatted = Number(num.toFixed(1)).toString();
  return `${formatted} ${unit}`;
}
function formatArea(internalArea) {
  const mm2 = internalArea / (INTERNAL_SCALE * INTERNAL_SCALE);
  return `${mm2.toFixed(1)} mm\xB2`;
}

// packages/core/src/utils/validation.ts
var MAX_PART_INSTANCES = 20;
var MAX_STOCKS = 20;
var MAX_KERF_MM = 5;
function validateSolverInput(options) {
  const { stocks, partGroups, kerfMm } = options;
  if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
    throw new Error("\u672A\u9009\u62E9\u4EFB\u4F55\u53EF\u7528\u6750\u6599");
  }
  if (stocks.length > MAX_STOCKS) {
    throw new Error(`\u5355\u6B21\u4EFB\u52A1\u6700\u591A\u9009\u7528 ${MAX_STOCKS} \u5F20\u6750\u6599\uFF0C\u5F53\u524D\u63D0\u4F9B: ${stocks.length}`);
  }
  if (!partGroups || !Array.isArray(partGroups) || partGroups.length === 0) {
    throw new Error("\u672A\u8F93\u5165\u4EFB\u4F55\u96F6\u4EF6\u9700\u6C42");
  }
  if (typeof kerfMm !== "number" || !Number.isFinite(kerfMm) || kerfMm < 0 || kerfMm > MAX_KERF_MM) {
    throw new Error(`\u88C1\u5207\u95F4\u9694\u5FC5\u987B\u5728 0 \u5230 ${MAX_KERF_MM} mm \u4E4B\u95F4\uFF0C\u6536\u5230: ${kerfMm}`);
  }
  const kerfScaled = Math.round(kerfMm * INTERNAL_SCALE);
  if (Math.abs(kerfMm * INTERNAL_SCALE - kerfScaled) > 1e-6) {
    throw new Error(`\u88C1\u5207\u95F4\u9694\u7CBE\u5EA6\u4E0D\u80FD\u8D85\u8FC7 0.1 mm: ${kerfMm}`);
  }
  const firstGroup = stocks[0].group;
  if (!firstGroup || !firstGroup.material || typeof firstGroup.thicknessMm !== "number") {
    throw new Error("\u6750\u6599\u7F3A\u5C11\u5B8C\u6574\u7684\u6750\u8D28\u7EC4\u4FE1\u606F\uFF08\u6750\u8D28\u3001\u539A\u5EA6\u3001\u989C\u8272\uFF09");
  }
  for (const s of stocks) {
    if (s.group.material !== firstGroup.material || s.group.thicknessMm !== firstGroup.thicknessMm || s.group.color !== firstGroup.color) {
      throw new Error(`\u5355\u6B21\u6392\u6599\u4EC5\u652F\u6301\u540C\u4E00\u6750\u6599\u7EC4\uFF0C\u53D1\u73B0\u4E0D\u517C\u5BB9\u6750\u6599: ${s.code || s.id}`);
    }
    if (!Number.isInteger(s.width) || s.width <= 0 || !Number.isInteger(s.height) || s.height <= 0) {
      throw new Error(`\u6750\u6599 ${s.code || s.id} \u5C3A\u5BF8\u975E\u6CD5\uFF0C\u5FC5\u987B\u4E3A\u6B63\u6574\u6570 (0.1 mm): (${s.width}, ${s.height})`);
    }
  }
  let totalPartInstances = 0;
  let flexibleGroupCount = 0;
  for (const g of partGroups) {
    if (!Number.isInteger(g.quantity) || g.quantity <= 0) {
      throw new Error(`\u96F6\u4EF6\u7EC4 [${g.name}] \u6570\u91CF\u5FC5\u987B\u4E3A\u6B63\u6574\u6570: ${g.quantity}`);
    }
    if (!Number.isInteger(g.targetWidth) || g.targetWidth <= 0 || !Number.isInteger(g.targetHeight) || g.targetHeight <= 0) {
      throw new Error(`\u96F6\u4EF6\u7EC4 [${g.name}] \u5C3A\u5BF8\u5FC5\u987B\u4E3A\u6B63\u6574\u6570: (${g.targetWidth}, ${g.targetHeight})`);
    }
    totalPartInstances += g.quantity;
    if (g.flexibleRange && g.flexibleRange.maxShrinkMm > 0) {
      flexibleGroupCount++;
      if (g.flexibleRange.maxShrinkMm !== 1 && g.flexibleRange.maxShrinkMm !== 2) {
        throw new Error(`\u96F6\u4EF6\u7EC4 [${g.name}] \u5C3A\u5BF8\u7F29\u5C0F\u8303\u56F4\u4EC5\u53EF\u9009 0, 1, 2 mm`);
      }
      if (g.flexibleRange.stepMm !== 1) {
        throw new Error(`\u96F6\u4EF6\u7EC4 [${g.name}] \u5C3A\u5BF8\u8C03\u6574\u6B65\u957F\u5FC5\u987B\u4E3A 1 mm`);
      }
      const minPossibleWidth = g.targetWidth - g.flexibleRange.maxShrinkMm * INTERNAL_SCALE;
      if (minPossibleWidth <= 0) {
        throw new Error(`\u96F6\u4EF6\u7EC4 [${g.name}] \u7F29\u5C0F\u540E\u5BBD\u5EA6\u5FC5\u987B\u5927\u4E8E\u96F6`);
      }
    }
  }
  if (totalPartInstances > MAX_PART_INSTANCES) {
    throw new Error(`\u5355\u4EFB\u52A1\u6700\u591A\u5BB9\u7EB3 ${MAX_PART_INSTANCES} \u4E2A\u96F6\u4EF6\u5B9E\u4F8B\uFF0C\u5F53\u524D\u9700\u6C42\u603B\u91CF: ${totalPartInstances}`);
  }
  if (flexibleGroupCount > 1) {
    throw new Error("\u6700\u591A\u53EA\u5141\u8BB8\u4E00\u4E2A\u96F6\u4EF6\u7EC4\u5F00\u542F\u5C3A\u5BF8\u534F\u5546\u4E0E\u8C03\u6574");
  }
}

// packages/core/src/utils/quote.ts
function calculateQuote(input) {
  const totalInputAreaSqm = Number(input?.totalInputAreaSqm) || 0;
  const pricePerSqm = Number(input?.pricePerSqm) || 0;
  const processingFee = Number(input?.processingFee) || 0;
  const miscFee = Number(input?.miscFee) || 0;
  const materialCost = Math.round(totalInputAreaSqm * pricePerSqm * 100) / 100;
  const roundedProcessing = Math.round(processingFee * 100) / 100;
  const roundedMisc = Math.round(miscFee * 100) / 100;
  const totalPrice = Math.round((materialCost + roundedProcessing + roundedMisc) * 100) / 100;
  return {
    materialCost,
    processingFee: roundedProcessing,
    miscFee: roundedMisc,
    totalPrice
  };
}

// packages/core/src/solver/cut-tree.ts
var nodeIdCounter = 0;
function resetNodeIdCounter() {
  nodeIdCounter = 0;
}
function generateNodeId(prefix = "node") {
  return `${prefix}_${++nodeIdCounter}`;
}
function canFitWithKerf(regionW, regionH, partW, partH, kerf) {
  if (regionW < partW || regionH < partH) {
    return false;
  }
  if (regionW > partW && regionW - partW < kerf) {
    return false;
  }
  if (regionH > partH && regionH - partH < kerf) {
    return false;
  }
  return true;
}
function executeGuillotineSplit(regionNode, stockId, part, direction, kerf, startStepIndex) {
  const { x, y, width: W, height: H } = regionNode.rect;
  const { width: w, height: h } = part;
  if (!canFitWithKerf(W, H, w, h, kerf)) {
    throw new Error(`\u533A\u57DF (${W}, ${H}) \u65E0\u6CD5\u5BB9\u7EB3\u96F6\u4EF6 (${w}, ${h}) \u4E14\u6EE1\u8DB3\u95F4\u9694 ${kerf}`);
  }
  const steps = [];
  const kerfNodes = [];
  const newOffcuts = [];
  let currentStep = startStepIndex;
  const partNode = {
    id: generateNodeId("part"),
    type: "PART",
    rect: { x, y, width: w, height: h },
    partInstanceId: part.instanceId,
    partGroupId: part.groupId,
    partName: part.name,
    rotated: part.rotated,
    shape: part.shape
  };
  let rootSplitNode;
  if (direction === "VERTICAL") {
    const needsVerticalSplit = W > w;
    const needsHorizontalSplit = H > h;
    if (needsVerticalSplit) {
      const leftStripRect = { x, y, width: w, height: H };
      const rightOffcutWidth = W - w - (kerf > 0 ? kerf : 0);
      const rightOffcutRect = {
        x: x + w + (kerf > 0 ? kerf : 0),
        y,
        width: rightOffcutWidth,
        height: H
      };
      let kerfRect;
      if (kerf > 0) {
        kerfRect = { x: x + w, y, width: kerf, height: H };
        kerfNodes.push({
          id: generateNodeId("kerf"),
          type: "KERF",
          rect: kerfRect
        });
      }
      steps.push({
        stepIndex: currentStep++,
        stockId,
        direction: "VERTICAL",
        parentRect: regionNode.rect,
        cutPosition: x + w,
        kerf,
        kerfRect,
        leftOrTopRect: leftStripRect,
        rightOrBottomRect: rightOffcutRect,
        description: `\u5728 x = ${x + w} \u5904\u5782\u76F4\u8D2F\u7A7F\u5206\u5272\uFF0C\u5206\u51FA\u5DE6\u4FA7\u96F6\u4EF6\u6761\u5E26\u4E0E\u53F3\u4FA7\u4F59\u6599`
      });
      const rightNode = {
        id: generateNodeId("offcut"),
        type: "OFFCUT",
        rect: rightOffcutRect
      };
      if (rightOffcutWidth > 0) {
        newOffcuts.push(rightNode);
      }
      let leftNode;
      if (needsHorizontalSplit) {
        const bottomOffcutHeight = H - h - (kerf > 0 ? kerf : 0);
        const bottomOffcutRect = {
          x,
          y: y + h + (kerf > 0 ? kerf : 0),
          width: w,
          height: bottomOffcutHeight
        };
        let hKerfRect;
        if (kerf > 0) {
          hKerfRect = { x, y: y + h, width: w, height: kerf };
          kerfNodes.push({
            id: generateNodeId("kerf"),
            type: "KERF",
            rect: hKerfRect
          });
        }
        steps.push({
          stepIndex: currentStep++,
          stockId,
          direction: "HORIZONTAL",
          parentRect: leftStripRect,
          cutPosition: y + h,
          kerf,
          kerfRect: hKerfRect,
          leftOrTopRect: partNode.rect,
          rightOrBottomRect: bottomOffcutRect,
          description: `\u5728 y = ${y + h} \u5904\u6C34\u5E73\u8D2F\u7A7F\u5206\u5272\u5DE6\u4FA7\u6761\u5E26\uFF0C\u5206\u51FA\u96F6\u4EF6 [${part.name}] \u4E0E\u4E0B\u65B9\u4F59\u6599`
        });
        const bottomNode = {
          id: generateNodeId("offcut"),
          type: "OFFCUT",
          rect: bottomOffcutRect
        };
        if (bottomOffcutHeight > 0) {
          newOffcuts.push(bottomNode);
        }
        leftNode = {
          id: generateNodeId("split_h"),
          type: "SPLIT",
          rect: leftStripRect,
          direction: "HORIZONTAL",
          splitPos: y + h,
          kerf,
          kerfRect: hKerfRect,
          children: [partNode, bottomNode]
        };
      } else {
        leftNode = partNode;
      }
      rootSplitNode = {
        id: generateNodeId("split_v"),
        type: "SPLIT",
        rect: regionNode.rect,
        direction: "VERTICAL",
        splitPos: x + w,
        kerf,
        kerfRect,
        children: [leftNode, rightNode]
      };
    } else {
      if (needsHorizontalSplit) {
        const bottomOffcutHeight = H - h - (kerf > 0 ? kerf : 0);
        const bottomOffcutRect = {
          x,
          y: y + h + (kerf > 0 ? kerf : 0),
          width: w,
          height: bottomOffcutHeight
        };
        let hKerfRect;
        if (kerf > 0) {
          hKerfRect = { x, y: y + h, width: w, height: kerf };
          kerfNodes.push({
            id: generateNodeId("kerf"),
            type: "KERF",
            rect: hKerfRect
          });
        }
        steps.push({
          stepIndex: currentStep++,
          stockId,
          direction: "HORIZONTAL",
          parentRect: regionNode.rect,
          cutPosition: y + h,
          kerf,
          kerfRect: hKerfRect,
          leftOrTopRect: partNode.rect,
          rightOrBottomRect: bottomOffcutRect,
          description: `\u5728 y = ${y + h} \u5904\u6C34\u5E73\u8D2F\u7A7F\u5206\u5272\uFF0C\u5206\u51FA\u96F6\u4EF6 [${part.name}] \u4E0E\u4E0B\u65B9\u4F59\u6599`
        });
        const bottomNode = {
          id: generateNodeId("offcut"),
          type: "OFFCUT",
          rect: bottomOffcutRect
        };
        if (bottomOffcutHeight > 0) {
          newOffcuts.push(bottomNode);
        }
        rootSplitNode = {
          id: generateNodeId("split_h"),
          type: "SPLIT",
          rect: regionNode.rect,
          direction: "HORIZONTAL",
          splitPos: y + h,
          kerf,
          kerfRect: hKerfRect,
          children: [partNode, bottomNode]
        };
      } else {
        rootSplitNode = partNode;
      }
    }
  } else {
    const needsHorizontalSplit = H > h;
    const needsVerticalSplit = W > w;
    if (needsHorizontalSplit) {
      const topStripRect = { x, y, width: W, height: h };
      const bottomOffcutHeight = H - h - (kerf > 0 ? kerf : 0);
      const bottomOffcutRect = {
        x,
        y: y + h + (kerf > 0 ? kerf : 0),
        width: W,
        height: bottomOffcutHeight
      };
      let kerfRect;
      if (kerf > 0) {
        kerfRect = { x, y: y + h, width: W, height: kerf };
        kerfNodes.push({
          id: generateNodeId("kerf"),
          type: "KERF",
          rect: kerfRect
        });
      }
      steps.push({
        stepIndex: currentStep++,
        stockId,
        direction: "HORIZONTAL",
        parentRect: regionNode.rect,
        cutPosition: y + h,
        kerf,
        kerfRect,
        leftOrTopRect: topStripRect,
        rightOrBottomRect: bottomOffcutRect,
        description: `\u5728 y = ${y + h} \u5904\u6C34\u5E73\u8D2F\u7A7F\u5206\u5272\uFF0C\u5206\u51FA\u4E0A\u65B9\u96F6\u4EF6\u6761\u5E26\u4E0E\u4E0B\u65B9\u4F59\u6599`
      });
      const bottomNode = {
        id: generateNodeId("offcut"),
        type: "OFFCUT",
        rect: bottomOffcutRect
      };
      if (bottomOffcutHeight > 0) {
        newOffcuts.push(bottomNode);
      }
      let topNode;
      if (needsVerticalSplit) {
        const rightOffcutWidth = W - w - (kerf > 0 ? kerf : 0);
        const rightOffcutRect = {
          x: x + w + (kerf > 0 ? kerf : 0),
          y,
          width: rightOffcutWidth,
          height: h
        };
        let vKerfRect;
        if (kerf > 0) {
          vKerfRect = { x: x + w, y, width: kerf, height: h };
          kerfNodes.push({
            id: generateNodeId("kerf"),
            type: "KERF",
            rect: vKerfRect
          });
        }
        steps.push({
          stepIndex: currentStep++,
          stockId,
          direction: "VERTICAL",
          parentRect: topStripRect,
          cutPosition: x + w,
          kerf,
          kerfRect: vKerfRect,
          leftOrTopRect: partNode.rect,
          rightOrBottomRect: rightOffcutRect,
          description: `\u5728 x = ${x + w} \u5904\u5782\u76F4\u5206\u5272\u4E0A\u65B9\u6761\u5E26\uFF0C\u5206\u51FA\u96F6\u4EF6 [${part.name}] \u4E0E\u53F3\u65B9\u4F59\u6599`
        });
        const rightNode = {
          id: generateNodeId("offcut"),
          type: "OFFCUT",
          rect: rightOffcutRect
        };
        if (rightOffcutWidth > 0) {
          newOffcuts.push(rightNode);
        }
        topNode = {
          id: generateNodeId("split_v"),
          type: "SPLIT",
          rect: topStripRect,
          direction: "VERTICAL",
          splitPos: x + w,
          kerf,
          kerfRect: vKerfRect,
          children: [partNode, rightNode]
        };
      } else {
        topNode = partNode;
      }
      rootSplitNode = {
        id: generateNodeId("split_h"),
        type: "SPLIT",
        rect: regionNode.rect,
        direction: "HORIZONTAL",
        splitPos: y + h,
        kerf,
        kerfRect,
        children: [topNode, bottomNode]
      };
    } else {
      if (needsVerticalSplit) {
        const rightOffcutWidth = W - w - (kerf > 0 ? kerf : 0);
        const rightOffcutRect = {
          x: x + w + (kerf > 0 ? kerf : 0),
          y,
          width: rightOffcutWidth,
          height: h
        };
        let vKerfRect;
        if (kerf > 0) {
          vKerfRect = { x: x + w, y, width: kerf, height: h };
          kerfNodes.push({
            id: generateNodeId("kerf"),
            type: "KERF",
            rect: vKerfRect
          });
        }
        steps.push({
          stepIndex: currentStep++,
          stockId,
          direction: "VERTICAL",
          parentRect: regionNode.rect,
          cutPosition: x + w,
          kerf,
          kerfRect: vKerfRect,
          leftOrTopRect: partNode.rect,
          rightOrBottomRect: rightOffcutRect,
          description: `\u5728 x = ${x + w} \u5904\u5782\u76F4\u8D2F\u7A7F\u5206\u5272\uFF0C\u5206\u51FA\u96F6\u4EF6 [${part.name}] \u4E0E\u53F3\u65B9\u4F59\u6599`
        });
        const rightNode = {
          id: generateNodeId("offcut"),
          type: "OFFCUT",
          rect: rightOffcutRect
        };
        if (rightOffcutWidth > 0) {
          newOffcuts.push(rightNode);
        }
        rootSplitNode = {
          id: generateNodeId("split_v"),
          type: "SPLIT",
          rect: regionNode.rect,
          direction: "VERTICAL",
          splitPos: x + w,
          kerf,
          kerfRect: vKerfRect,
          children: [partNode, rightNode]
        };
      } else {
        rootSplitNode = partNode;
      }
    }
  }
  return {
    splitNode: rootSplitNode,
    partNode,
    newOffcuts,
    kerfNodes,
    steps
  };
}

// packages/core/src/solver/single-strategy.ts
function sortParts(parts, strategy) {
  const list = [...parts];
  list.sort((a, b) => {
    if (strategy === "area-desc") {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      if (areaA !== areaB) return areaB - areaA;
      const maxA = Math.max(a.width, a.height);
      const maxB = Math.max(b.width, b.height);
      if (maxA !== maxB) return maxB - maxA;
      return a.instanceId.localeCompare(b.instanceId);
    } else if (strategy === "max-side-desc") {
      const maxA = Math.max(a.width, a.height);
      const maxB = Math.max(b.width, b.height);
      if (maxA !== maxB) return maxB - maxA;
      const minA = Math.min(a.width, a.height);
      const minB = Math.min(b.width, b.height);
      if (minA !== minB) return minB - minA;
      return a.instanceId.localeCompare(b.instanceId);
    } else {
      if (a.width !== b.width) return b.width - a.width;
      if (a.height !== b.height) return b.height - a.height;
      return a.instanceId.localeCompare(b.instanceId);
    }
  });
  return list;
}
function sortStocks(stocks, strategy) {
  const list = [...stocks];
  list.sort((a, b) => {
    if (strategy === "offcut-first") {
      if (a.isOffcut !== b.isOffcut) {
        return a.isOffcut ? -1 : 1;
      }
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      if (areaA !== areaB) return areaA - areaB;
      return a.code.localeCompare(b.code);
    } else {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      if (areaA !== areaB) return areaA - areaB;
      if (a.isOffcut !== b.isOffcut) {
        return a.isOffcut ? -1 : 1;
      }
      return a.code.localeCompare(b.code);
    }
  });
  return list;
}
function replaceNodeInTree(root, targetId, newNode) {
  if (root.id === targetId) {
    return newNode;
  }
  if (root.children) {
    root.children = [
      replaceNodeInTree(root.children[0], targetId, newNode),
      replaceNodeInTree(root.children[1], targetId, newNode)
    ];
  }
  return root;
}
function collectRemainingOffcuts(node, out = []) {
  if (node.type === "OFFCUT") {
    if (node.rect.width > 0 && node.rect.height > 0) {
      out.push({ ...node.rect });
    }
  } else if (node.children) {
    collectRemainingOffcuts(node.children[0], out);
    collectRemainingOffcuts(node.children[1], out);
  }
  return out;
}
function collectKerfArea(node) {
  let sum = 0;
  if (node.type === "KERF") {
    sum += node.rect.width * node.rect.height;
  } else if (node.children) {
    sum += collectKerfArea(node.children[0]);
    sum += collectKerfArea(node.children[1]);
  }
  return sum;
}
function runSingleStrategy(strategy, allStocks, parts, kerf, appliedDeltaMm, targetPartDefs) {
  const sortedParts = sortParts(parts, strategy.partOrder);
  const sortedStocks = sortStocks(allStocks, strategy.stockOrder);
  const activeStocks = [];
  const unplacedPartIds = [];
  const placedParts = [];
  let nextUnusedStockIdx = 0;
  let globalStepCounter = 1;
  function openNewStock(stock) {
    const rootNode = {
      id: generateNodeId("stock_root"),
      type: "OFFCUT",
      rect: { x: 0, y: 0, width: stock.width, height: stock.height }
    };
    const nodeMap = /* @__PURE__ */ new Map();
    nodeMap.set(rootNode.id, rootNode);
    const active = {
      stock,
      rootNode,
      freeNodes: [rootNode],
      placedParts: [],
      steps: [],
      nodeMap
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
          const fIdx = active.freeNodes.findIndex((fn) => fn.id === targetFreeNode.id);
          if (fIdx === -1) continue;
          let currentNode = active.freeNodes[fIdx];
          let currentTree = null;
          const newOffcuts = [];
          const buildSplit = (dir, pos, child1, child2) => {
            return {
              id: generateNodeId(dir === "VERTICAL" ? "split_v" : "split_h"),
              type: "SPLIT",
              rect: {
                x: child1.rect.x,
                y: child1.rect.y,
                width: dir === "VERTICAL" ? child1.rect.width + child2.rect.width : child1.rect.width,
                height: dir === "HORIZONTAL" ? child1.rect.height + child2.rect.height : child1.rect.height
              },
              direction: dir,
              splitPos: pos,
              kerf: 0,
              children: [child1, child2]
            };
          };
          if (I.x > currentNode.rect.x) {
            const leftRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: I.x - currentNode.rect.x, height: currentNode.rect.height };
            const leftNode = { id: generateNodeId("offcut"), type: "OFFCUT", rect: leftRect };
            newOffcuts.push(leftNode);
            const rightRect = { x: I.x, y: currentNode.rect.y, width: currentNode.rect.x + currentNode.rect.width - I.x, height: currentNode.rect.height };
            const rightNode = { id: generateNodeId("temp"), type: "OFFCUT", rect: rightRect };
            const split = buildSplit("VERTICAL", I.x, leftNode, rightNode);
            currentTree = split;
            currentNode = rightNode;
          }
          if (I.x + I.width < currentNode.rect.x + currentNode.rect.width) {
            const rightPos = I.x + I.width;
            const rightRect = { x: rightPos, y: currentNode.rect.y, width: currentNode.rect.x + currentNode.rect.width - rightPos, height: currentNode.rect.height };
            const rightNode = { id: generateNodeId("offcut"), type: "OFFCUT", rect: rightRect };
            newOffcuts.push(rightNode);
            const leftRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: rightPos - currentNode.rect.x, height: currentNode.rect.height };
            const leftNode = { id: generateNodeId("temp"), type: "OFFCUT", rect: leftRect };
            const split = buildSplit("VERTICAL", rightPos, leftNode, rightNode);
            if (currentTree) {
              currentTree = replaceNodeInTree(currentTree, currentNode.id, split);
            } else {
              currentTree = split;
            }
            currentNode = leftNode;
          }
          if (I.y > currentNode.rect.y) {
            const topRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: currentNode.rect.width, height: I.y - currentNode.rect.y };
            const topNode = { id: generateNodeId("offcut"), type: "OFFCUT", rect: topRect };
            newOffcuts.push(topNode);
            const bottomRect = { x: currentNode.rect.x, y: I.y, width: currentNode.rect.width, height: currentNode.rect.y + currentNode.rect.height - I.y };
            const bottomNode = { id: generateNodeId("temp"), type: "OFFCUT", rect: bottomRect };
            const split = buildSplit("HORIZONTAL", I.y, topNode, bottomNode);
            if (currentTree) {
              currentTree = replaceNodeInTree(currentTree, currentNode.id, split);
            } else {
              currentTree = split;
            }
            currentNode = bottomNode;
          }
          if (I.y + I.height < currentNode.rect.y + currentNode.rect.height) {
            const bottomPos = I.y + I.height;
            const bottomRect = { x: currentNode.rect.x, y: bottomPos, width: currentNode.rect.width, height: currentNode.rect.y + currentNode.rect.height - bottomPos };
            const bottomNode = { id: generateNodeId("offcut"), type: "OFFCUT", rect: bottomRect };
            newOffcuts.push(bottomNode);
            const topRect = { x: currentNode.rect.x, y: currentNode.rect.y, width: currentNode.rect.width, height: bottomPos - currentNode.rect.y };
            const topNode = { id: generateNodeId("temp"), type: "OFFCUT", rect: topRect };
            const split = buildSplit("HORIZONTAL", bottomPos, topNode, bottomNode);
            if (currentTree) {
              currentTree = replaceNodeInTree(currentTree, currentNode.id, split);
            } else {
              currentTree = split;
            }
            currentNode = topNode;
          }
          currentNode.type = "DEFECT";
          currentNode.id = generateNodeId("defect");
          if (!currentTree) {
            currentTree = currentNode;
          } else {
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
  for (const part of sortedParts) {
    let bestOption = null;
    for (let sIdx = 0; sIdx < activeStocks.length; sIdx++) {
      const active = activeStocks[sIdx];
      for (let fIdx = 0; fIdx < active.freeNodes.length; fIdx++) {
        const freeNode = active.freeNodes[fIdx];
        const { width: W, height: H } = freeNode.rect;
        const orientations = [false];
        if (part.allowRotation && part.width !== part.height) {
          orientations.push(true);
        }
        for (const rot of orientations) {
          const pw = rot ? part.height : part.width;
          const ph = rot ? part.width : part.height;
          if (canFitWithKerf(W, H, pw, ph, kerf)) {
            let score;
            if (strategy.rectFit === "best-area-fit") {
              score = W * H - pw * ph;
            } else {
              score = Math.min(W - pw, H - ph);
            }
            if (!bestOption || score < bestOption.score || score === bestOption.score && sIdx < bestOption.stockIndex || score === bestOption.score && sIdx === bestOption.stockIndex && freeNode.rect.y < bestOption.freeNode.rect.y || score === bestOption.score && sIdx === bestOption.stockIndex && freeNode.rect.y === bestOption.freeNode.rect.y && freeNode.rect.x < bestOption.freeNode.rect.x || score === bestOption.score && sIdx === bestOption.stockIndex && freeNode.rect.y === bestOption.freeNode.rect.y && freeNode.rect.x === bestOption.freeNode.rect.x && !rot && bestOption.rotated) {
              bestOption = {
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
    }
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
              if (strategy.rectFit === "best-area-fit") {
                score = W * H - pw * ph;
              } else {
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
    if (bestOption) {
      const active = activeStocks[bestOption.stockIndex];
      const targetFreeNode = bestOption.freeNode;
      const pw = bestOption.rotated ? part.height : part.width;
      const ph = bestOption.rotated ? part.width : part.height;
      const splitResult = executeGuillotineSplit(
        targetFreeNode,
        active.stock.id,
        {
          instanceId: part.instanceId,
          groupId: part.groupId,
          name: part.name,
          width: pw,
          height: ph,
          rotated: bestOption.rotated,
          shape: part.shape
        },
        strategy.splitRule === "vertical-first" ? "VERTICAL" : "HORIZONTAL",
        kerf,
        globalStepCounter
      );
      globalStepCounter += splitResult.steps.length;
      active.rootNode = replaceNodeInTree(active.rootNode, targetFreeNode.id, splitResult.splitNode);
      active.freeNodes.splice(bestOption.freeNodeIndex, 1);
      for (const offcut of splitResult.newOffcuts) {
        active.freeNodes.push(offcut);
      }
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
        shape: part.shape
      };
      active.placedParts.push(placed);
      placedParts.push(placed);
      for (const step of splitResult.steps) {
        active.steps.push(step);
      }
    } else {
      unplacedPartIds.push(part.instanceId);
    }
  }
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
      continue;
    }
    if (active.stock.isOffcut) {
      offcutsUsed++;
    } else {
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
      steps: active.steps
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
    utilizationRate
  };
  return {
    candidateId: `cand_${strategy.name}_d${appliedDeltaMm}`,
    strategyName: strategy.name,
    isComplete,
    appliedDeltaMm,
    layoutMode: "GUILLOTINE_RECT",
    targetParts: targetPartDefs,
    placedParts,
    unplacedPartIds,
    usedStocks,
    metrics
  };
}

// packages/core/src/solver/strategies.ts
var PART_ORDERS = ["area-desc", "max-side-desc", "width-desc"];
var RECT_FITS = ["best-area-fit", "best-short-side-fit"];
var SPLIT_RULES = ["vertical-first", "horizontal-first"];
var STOCK_ORDERS = ["offcut-first", "area-asc"];
function build24Strategies() {
  const strategies = [];
  const baseline = {
    name: "baseline_areaDesc_offcutFirst_bestAreaFit_verticalFirst",
    partOrder: "area-desc",
    stockOrder: "offcut-first",
    rectFit: "best-area-fit",
    splitRule: "vertical-first",
    isBaseline: true
  };
  strategies.push(baseline);
  for (const partOrder of PART_ORDERS) {
    for (const stockOrder of STOCK_ORDERS) {
      for (const rectFit of RECT_FITS) {
        for (const splitRule of SPLIT_RULES) {
          if (partOrder === baseline.partOrder && stockOrder === baseline.stockOrder && rectFit === baseline.rectFit && splitRule === baseline.splitRule) {
            continue;
          }
          strategies.push({
            name: `strat_${partOrder}_${stockOrder}_${rectFit}_${splitRule}`,
            partOrder,
            stockOrder,
            rectFit,
            splitRule,
            isBaseline: false
          });
        }
      }
    }
  }
  return strategies;
}
function compareCandidates(a, b) {
  if (a.isComplete !== b.isComplete) {
    return a.isComplete ? -1 : 1;
  }
  if (!a.isComplete) {
    if (a.placedParts.length !== b.placedParts.length) {
      return b.placedParts.length - a.placedParts.length;
    }
  }
  if (a.metrics.newSheetsUsed !== b.metrics.newSheetsUsed) {
    return a.metrics.newSheetsUsed - b.metrics.newSheetsUsed;
  }
  if (a.metrics.totalInputArea !== b.metrics.totalInputArea) {
    return a.metrics.totalInputArea - b.metrics.totalInputArea;
  }
  if (a.metrics.stepsCount !== b.metrics.stepsCount) {
    return a.metrics.stepsCount - b.metrics.stepsCount;
  }
  if (a.appliedDeltaMm !== b.appliedDeltaMm) {
    return a.appliedDeltaMm - b.appliedDeltaMm;
  }
  return a.strategyName.localeCompare(b.strategyName);
}

// packages/core/src/geometry/polygon.ts
function calculatePolygonArea(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(Math.round(area / 2));
}
function calculatePolygonBBox(points) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
function isPolygonClosed(points) {
  if (!points || points.length < 3) return false;
  return calculatePolygonArea(points) > 0;
}
function transformPoints(points, translation, rotationDeg = 0) {
  if (!points || points.length === 0) return [];
  const normDeg = (rotationDeg % 360 + 360) % 360;
  let rotated = [];
  if (normDeg === 0) {
    rotated = points.map((p) => ({ x: p.x, y: p.y }));
  } else if (normDeg === 90) {
    rotated = points.map((p) => ({ x: -p.y, y: p.x }));
  } else if (normDeg === 180) {
    rotated = points.map((p) => ({ x: -p.x, y: -p.y }));
  } else if (normDeg === 270) {
    rotated = points.map((p) => ({ x: p.y, y: -p.x }));
  } else {
    const rad = normDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    rotated = points.map((p) => ({
      x: Math.round(p.x * cos - p.y * sin),
      y: Math.round(p.x * sin + p.y * cos)
    }));
  }
  const rotBBox = calculatePolygonBBox(rotated);
  return rotated.map((p) => ({
    x: p.x - rotBBox.x + translation.x,
    y: p.y - rotBBox.y + translation.y
  }));
}
function isPointInPolygon(p, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function ccw(p1, p2, p3) {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}
function onSegment(p, q, r) {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}
function doLineSegmentsIntersect(p1, p2, p3, p4) {
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);
  if ((d1 > 0 && d2 < 0 || d1 < 0 && d2 > 0) && (d3 > 0 && d4 < 0 || d3 < 0 && d4 > 0)) {
    return true;
  }
  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;
  return false;
}
function isPolygonSelfIntersecting(points) {
  if (!points || points.length < 4) return false;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || i === 0 && j === n - 1) {
        continue;
      }
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      const d1 = ccw(b1, b2, a1);
      const d2 = ccw(b1, b2, a2);
      const d3 = ccw(a1, a2, b1);
      const d4 = ccw(a1, a2, b2);
      if ((d1 > 0 && d2 < 0 || d1 < 0 && d2 > 0) && (d3 > 0 && d4 < 0 || d3 < 0 && d4 > 0)) {
        return true;
      }
    }
  }
  return false;
}
function polygonsIntersect(polyA, polyB) {
  if (!polyA || polyA.length < 3 || !polyB || polyB.length < 3) return false;
  const boxA = calculatePolygonBBox(polyA);
  const boxB = calculatePolygonBBox(polyB);
  if (boxA.x + boxA.width <= boxB.x || boxB.x + boxB.width <= boxA.x || boxA.y + boxA.height <= boxB.y || boxB.y + boxB.height <= boxA.y) {
    return false;
  }
  const nA = polyA.length;
  const nB = polyB.length;
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];
    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];
      if (doLineSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  if (isPointInPolygon(polyA[0], polyB) || isPointInPolygon(polyB[0], polyA)) {
    return true;
  }
  return false;
}
function polygonIntersectsRect(poly, rect) {
  const rectPoly = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
  return polygonsIntersect(poly, rectPoly);
}
function isPolygonInsideRect(poly, rect) {
  if (!poly || poly.length === 0) return false;
  const bbox = calculatePolygonBBox(poly);
  return bbox.x >= rect.x && bbox.y >= rect.y && bbox.x + bbox.width <= rect.x + rect.width && bbox.y + bbox.height <= rect.y + rect.height;
}
function perpendicularDistance(p, lineA, lineB) {
  const dx = lineB.x - lineA.x;
  const dy = lineB.y - lineA.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - lineA.x, p.y - lineA.y);
  }
  const t = ((p.x - lineA.x) * dx + (p.y - lineA.y) * dy) / lenSq;
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = lineA.x + clampedT * dx;
  const projY = lineA.y + clampedT * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}
function dpRecursive(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist > tolerance) {
    const left = dpRecursive(points.slice(0, index + 1), tolerance);
    const right = dpRecursive(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [first, last];
  }
}
function douglasPeucker(points, tolerance = 2, maxPoints = 64) {
  if (!points || points.length <= 3) return points;
  let currentTol = tolerance;
  let simplified = dpRecursive(points, currentTol);
  let attempts = 0;
  while (simplified.length > maxPoints && attempts < 20) {
    currentTol *= 1.5;
    simplified = dpRecursive(points, currentTol);
    attempts++;
  }
  return simplified;
}
function snapAngle(dx, dy, snapThresholdDeg = 6) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return { dx, dy };
  let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angleDeg < 0) angleDeg += 360;
  const targets = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  let closestTarget = angleDeg;
  let minDiff = 360;
  for (const t of targets) {
    const diff = Math.abs(angleDeg - t);
    if (diff < minDiff) {
      minDiff = diff;
      closestTarget = t;
    }
  }
  if (minDiff <= snapThresholdDeg) {
    const rad = closestTarget * Math.PI / 180;
    return {
      dx: Math.round(len * Math.cos(rad)),
      dy: Math.round(len * Math.sin(rad))
    };
  }
  return { dx, dy };
}

// packages/core/src/solver/cut-paths.ts
function generateCutGuidance(placements, stockDimensions) {
  let totalVertices = 0;
  let maxVerticesInPart = 0;
  for (const p of placements) {
    const vCount = p.transformedPoints.length;
    totalVertices += vCount;
    if (vCount > maxVerticesInPart) maxVerticesInPart = vCount;
  }
  const avgVertices = placements.length > 0 ? totalVertices / placements.length : 0;
  const isCurvedOrComplex = avgVertices > 8 || maxVerticesInPart > 12;
  const recommendedTool = isCurvedOrComplex ? "\u7CBE\u5BC6\u526A\u5200 / \u66F2\u7EBF\u65CB\u8F6C\u523B\u5200\uFF08\u9002\u5408\u5F02\u5F62\u66F2\u9762\uFF09" : "\u94A2\u76F4\u5C3A + \u91CD\u578B\u7F8E\u5DE5\u5200\uFF08\u9002\u5408\u76F4\u7EBF\u591A\u8FB9\u5F62\uFF09";
  const centerX = stockDimensions.width / 2;
  const centerY = stockDimensions.height / 2;
  const sortedPlacements = [...placements].sort((a, b) => {
    const aDist = Math.hypot(
      a.bbox.x + a.bbox.width / 2 - centerX,
      a.bbox.y + a.bbox.height / 2 - centerY
    );
    const bDist = Math.hypot(
      b.bbox.x + b.bbox.width / 2 - centerX,
      b.bbox.y + b.bbox.height / 2 - centerY
    );
    return aDist - bDist;
  });
  const steps = [];
  let stepIndex = 1;
  for (const p of sortedPlacements) {
    steps.push({
      stepIndex,
      instanceId: p.instanceId,
      stockId: p.stockId,
      pathType: p.transformedPoints.length > 4 ? "CONTOUR" : "STRAIGHT",
      points: p.transformedPoints,
      toolRecommendation: recommendedTool,
      description: `\u7B2C ${stepIndex} \u6B65\uFF1A\u88C1\u5207\u96F6\u4EF6 [${p.name}] \u771F\u5B9E\u8F6E\u5ED3 (${p.transformedPoints.length} \u9876\u70B9)\uFF0C\u5EFA\u8BAE\u4F7F\u7528 ${recommendedTool}`
    });
    stepIndex++;
  }
  if (placements.length > 0) {
    steps.push({
      stepIndex,
      stockId: placements[0].stockId,
      pathType: "BORDER",
      points: [
        { x: 0, y: 0 },
        { x: stockDimensions.width, y: 0 },
        { x: stockDimensions.width, y: stockDimensions.height },
        { x: 0, y: stockDimensions.height }
      ],
      toolRecommendation: "\u76F4\u5C3A + \u7F8E\u5DE5\u5200",
      description: `\u7B2C ${stepIndex} \u6B65\uFF1A\u4FEE\u6574\u677F\u6750\u5916\u4FA7\u5269\u4F59\u4F59\u6599\u8FB9\u7F18\uFF0C\u5B89\u5168\u6536\u7EB3\u4F59\u6599`
    });
  }
  return {
    steps,
    recommendedTool,
    calibrationLineMm: 100
    // 100mm 打印实测校准线
  };
}

// packages/core/src/solver/profile-solver.ts
var PROFILE_ALGORITHM_VERSION = "2.0.0-profile-nesting";
function buildProfileStrategies() {
  const partOrders = [
    "area-desc",
    "bbox-desc",
    "complexity-desc",
    "aspect-desc"
  ];
  const stockOrders = [
    "offcut-first-small",
    "offcut-first-large",
    "smallest-area-first"
  ];
  const strategies = [];
  let idCount = 1;
  for (const po of partOrders) {
    for (const so of stockOrders) {
      let archetype = "BALANCED";
      if (so === "offcut-first-large" && po === "area-desc") {
        archetype = "MATERIAL_SAVING";
      } else if (po === "complexity-desc" || po === "aspect-desc") {
        archetype = "EASY_CUTTING";
      }
      strategies.push({
        id: `profile_strat_${idCount++}`,
        name: getStrategyDisplayName(po, so),
        partOrder: po,
        stockOrder: so,
        archetype
      });
    }
  }
  return strategies;
}
function getStrategyDisplayName(po, so) {
  const poName = po === "area-desc" ? "\u5927\u9762\u79EF\u4F18\u5148" : po === "bbox-desc" ? "\u5305\u56F4\u76D2\u4F18\u5148" : po === "complexity-desc" ? "\u590D\u6742\u8F6E\u5ED3\u4F18\u5148" : "\u957F\u5BBD\u6BD4\u4F18\u5148";
  const soName = so === "offcut-first-small" ? "\u4F59\u6599\u7D27\u51D1\u4F18\u5148" : so === "offcut-first-large" ? "\u4F59\u6599\u9AD8\u5BB9\u4F18\u5148" : "\u5C0F\u677F\u9012\u589E\u4F18\u5148";
  return `${poName}\xB7${soName}`;
}
function solveProfileCuttingPlan(options) {
  const { stocks, partGroups, kerfMm } = options;
  const kerf = Math.round(kerfMm * INTERNAL_SCALE);
  const normalizedGroups = partGroups.map((g) => {
    let geo = g.geometry;
    if (!geo) {
      const w = g.targetWidth;
      const h = g.targetHeight;
      geo = {
        kind: "RECT",
        source: "TEMPLATE",
        points: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h }
        ],
        width: w,
        height: h,
        area: w * h,
        closed: true
      };
    }
    const rotPolicy = g.rotationPolicy || (g.allowRotation ? "RIGHT_ANGLE" : "LOCKED");
    return {
      ...g,
      geometry: geo,
      rotationPolicy: rotPolicy
    };
  });
  const baseInstances = [];
  for (const group of normalizedGroups) {
    for (let i = 0; i < group.quantity; i++) {
      baseInstances.push({
        instanceId: `${group.id}_${i + 1}`,
        groupId: group.id,
        name: group.name,
        width: group.geometry.width,
        height: group.geometry.height,
        allowRotation: group.rotationPolicy !== "LOCKED",
        rotationPolicy: group.rotationPolicy,
        geometry: group.geometry
      });
    }
  }
  const strategies = buildProfileStrategies();
  const exploredCandidates = [];
  for (const strat of strategies) {
    const cand = runProfileSingleStrategy(
      strat,
      stocks,
      baseInstances,
      normalizedGroups,
      kerf
    );
    exploredCandidates.push(cand);
  }
  exploredCandidates.sort(compareProfileCandidates);
  const bestComplete = exploredCandidates.find((c) => c.isComplete) || null;
  const baseline = exploredCandidates[0] || null;
  const selectedCandidates = [];
  const materialSaving = exploredCandidates.find((c) => c.isComplete) || exploredCandidates[0];
  if (materialSaving) {
    selectedCandidates.push({
      ...materialSaving,
      strategyName: "\u8282\u7701\u6750\u6599\uFF08\u4F18\u5148\u4F59\u6599\u4E0E\u5229\u7528\u7387\uFF09"
    });
  }
  const easyCutting = exploredCandidates.find(
    (c) => c.candidateId !== materialSaving?.candidateId && (c.profilePlacements || []).every((p) => p.rotationDeg === 0)
  ) || exploredCandidates.find((c) => c.candidateId !== materialSaving?.candidateId) || materialSaving;
  if (easyCutting && !selectedCandidates.some((c) => c.candidateId === easyCutting.candidateId)) {
    selectedCandidates.push({
      ...easyCutting,
      strategyName: "\u65B9\u4FBF\u88C1\u5207\uFF08\u5E73\u76F4\u5BF9\u9F50\u5200\u8DEF\u987A\u7545\uFF09"
    });
  }
  const balanced = exploredCandidates.find(
    (c) => !selectedCandidates.some((sc) => sc.candidateId === c.candidateId)
  ) || selectedCandidates[0];
  if (balanced && !selectedCandidates.some((c) => c.candidateId === balanced.candidateId)) {
    selectedCandidates.push({
      ...balanced,
      strategyName: "\u7EFC\u5408\u5E73\u8861\uFF08\u517C\u987E\u6599\u8017\u4E0E\u64CD\u4F5C\uFF09"
    });
  }
  return {
    baselineCandidate: baseline,
    candidates: selectedCandidates.length > 0 ? selectedCandidates : exploredCandidates.slice(0, 3),
    bestCompleteCandidate: bestComplete,
    allExploredCount: exploredCandidates.length,
    algorithmVersion: PROFILE_ALGORITHM_VERSION
  };
}
function runProfileSingleStrategy(strat, rawStocks, instances, groups, kerf) {
  const sortedStocks = [...rawStocks].sort((a, b) => {
    if (strat.stockOrder === "offcut-first-small") {
      if (a.isOffcut !== b.isOffcut) return a.isOffcut ? -1 : 1;
      return a.width * a.height - b.width * b.height;
    } else if (strat.stockOrder === "offcut-first-large") {
      if (a.isOffcut !== b.isOffcut) return a.isOffcut ? -1 : 1;
      return b.width * b.height - a.width * a.height;
    } else {
      return a.width * a.height - b.width * b.height;
    }
  });
  const sortedParts = [...instances].sort((a, b) => {
    const geoA = a.geometry;
    const geoB = b.geometry;
    if (strat.partOrder === "area-desc") {
      return geoB.area - geoA.area;
    } else if (strat.partOrder === "bbox-desc") {
      return geoB.width * geoB.height - geoA.width * geoA.height;
    } else if (strat.partOrder === "complexity-desc") {
      return geoB.points.length - geoA.points.length;
    } else {
      const aspA = Math.max(geoA.width / geoA.height, geoA.height / geoA.width);
      const aspB = Math.max(geoB.width / geoB.height, geoB.height / geoB.width);
      return aspB - aspA;
    }
  });
  const placementsByStock = /* @__PURE__ */ new Map();
  for (const s of sortedStocks) {
    placementsByStock.set(s.id, []);
  }
  const placedProfiles = [];
  const unplacedPartIds = [];
  for (const part of sortedParts) {
    const angles = getCandidateAngles(part.rotationPolicy);
    let placed = false;
    for (const stock of sortedStocks) {
      const existingOnStock = placementsByStock.get(stock.id) || [];
      const stockDefects = stock.defects || [];
      const foundPos = findBestPlacement(
        part.geometry.points,
        angles,
        stock,
        existingOnStock,
        stockDefects,
        kerf
      );
      if (foundPos) {
        const placement = {
          instanceId: part.instanceId,
          groupId: part.groupId,
          name: part.name,
          stockId: stock.id,
          translation: foundPos.translation,
          rotationDeg: foundPos.rotationDeg,
          transformedPoints: foundPos.transformedPoints,
          bbox: foundPos.bbox
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
      if (stock.isOffcut) offcutsUsed++;
      else newSheetsUsed++;
      const placedOnThisStock = placements.map((p) => ({
        instanceId: p.instanceId,
        groupId: p.groupId,
        name: p.name,
        stockId: p.stockId,
        x: p.bbox.x,
        y: p.bbox.y,
        width: p.bbox.width,
        height: p.bbox.height,
        rotated: p.rotationDeg !== 0
      }));
      usedStocks.push({
        stockId: stock.id,
        stockCode: stock.code,
        isOffcut: stock.isOffcut,
        width: stock.width,
        height: stock.height,
        cutTree: {
          id: `root_${stock.id}`,
          type: "PART",
          rect: { x: 0, y: 0, width: stock.width, height: stock.height }
        },
        placedParts: placedOnThisStock,
        remainingOffcuts: [],
        steps: []
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
    utilizationRate
  };
  const cutGuidance = generateCutGuidance(
    placedProfiles,
    usedStocks.length > 0 ? { width: usedStocks[0].width, height: usedStocks[0].height } : { width: 1e3, height: 1e3 }
  );
  const placedParts = placedProfiles.map((p) => ({
    instanceId: p.instanceId,
    groupId: p.groupId,
    name: p.name,
    stockId: p.stockId,
    x: p.bbox.x,
    y: p.bbox.y,
    width: p.bbox.width,
    height: p.bbox.height,
    rotated: p.rotationDeg !== 0
  }));
  return {
    candidateId: `cand_prof_${strat.id}`,
    strategyName: strat.name,
    isComplete: unplacedPartIds.length === 0,
    appliedDeltaMm: 0,
    layoutMode: "PROFILE",
    targetParts: groups.map((g) => ({
      groupId: g.id,
      width: g.targetWidth,
      height: g.targetHeight
    })),
    placedParts,
    profilePlacements: placedProfiles,
    cutPaths: cutGuidance.steps,
    unplacedPartIds,
    usedStocks,
    metrics
  };
}
function getCandidateAngles(policy) {
  if (!policy || policy === "LOCKED") return [0];
  if (policy === "RIGHT_ANGLE") return [0, 90, 180, 270];
  if (policy === "FREE_15") {
    const angles = [];
    for (let a = 0; a < 360; a += 15) angles.push(a);
    return angles;
  }
  return [0];
}
function findBestPlacement(rawPoints, angles, stock, existing, defects, kerf) {
  const step = 20;
  for (const rot of angles) {
    const tempTransformed = transformPoints(rawPoints, { x: 0, y: 0 }, rot);
    const bbox = calculatePolygonBBox(tempTransformed);
    if (bbox.width > stock.width || bbox.height > stock.height) {
      continue;
    }
    for (let y = 0; y <= stock.height - bbox.height; y += step) {
      for (let x = 0; x <= stock.width - bbox.width; x += step) {
        const candidatePoints = transformPoints(rawPoints, { x, y }, rot);
        const candBBox = calculatePolygonBBox(candidatePoints);
        if (candBBox.x < 0 || candBBox.y < 0 || candBBox.x + candBBox.width > stock.width || candBBox.y + candBBox.height > stock.height) {
          continue;
        }
        let hitDefect = false;
        for (const def of defects) {
          if (polygonIntersectsRect(candidatePoints, def)) {
            hitDefect = true;
            break;
          }
        }
        if (hitDefect) continue;
        let hitExisting = false;
        for (const prev of existing) {
          const pBox = prev.bbox;
          const overlapBBox = !(candBBox.x + candBBox.width + kerf <= pBox.x || pBox.x + pBox.width + kerf <= candBBox.x || candBBox.y + candBBox.height + kerf <= pBox.y || pBox.y + pBox.height + kerf <= candBBox.y);
          if (overlapBBox) {
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
            bbox: candBBox
          };
        }
      }
    }
  }
  return null;
}
function compareProfileCandidates(a, b) {
  if (a.isComplete !== b.isComplete) {
    return a.isComplete ? -1 : 1;
  }
  if (!a.isComplete && !b.isComplete) {
    return b.placedParts.length - a.placedParts.length;
  }
  if (a.metrics.newSheetsUsed !== b.metrics.newSheetsUsed) {
    return a.metrics.newSheetsUsed - b.metrics.newSheetsUsed;
  }
  if (a.metrics.offcutsUsed !== b.metrics.offcutsUsed) {
    return b.metrics.offcutsUsed - a.metrics.offcutsUsed;
  }
  if (Math.abs(b.metrics.utilizationRate - a.metrics.utilizationRate) > 1e-4) {
    return b.metrics.utilizationRate - a.metrics.utilizationRate;
  }
  return a.metrics.stepsCount - b.metrics.stepsCount;
}

// packages/core/src/solver/index.ts
var ALGORITHM_VERSION = "1.0.0-guillotine24";
function solveCuttingPlan(options) {
  validateSolverInput(options);
  const { stocks, partGroups, kerfMm } = options;
  const hasIrregular = partGroups.some(
    (g) => g.geometry && g.geometry.kind !== "RECT" || g.shape && g.shape !== "RECT"
  );
  if (hasIrregular) {
    return solveProfileCuttingPlan(options);
  }
  const kerf = Math.round(kerfMm * INTERNAL_SCALE);
  const flexibleGroup = partGroups.find(
    (g) => g.flexibleRange && g.flexibleRange.maxShrinkMm > 0
  );
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
  for (const delta of deltaOptions) {
    const partInstances = [];
    const targetPartDefs = [];
    for (const group of partGroups) {
      const isFlexible = flexibleGroup && flexibleGroup.id === group.id;
      const widthDeduction = isFlexible ? delta * INTERNAL_SCALE : 0;
      const actualWidth = group.targetWidth - widthDeduction;
      targetPartDefs.push({
        groupId: group.id,
        width: actualWidth,
        height: group.targetHeight
      });
      for (let i = 0; i < group.quantity; i++) {
        partInstances.push({
          instanceId: `${group.id}_${i + 1}`,
          groupId: group.id,
          name: group.name,
          width: actualWidth,
          height: group.targetHeight,
          allowRotation: group.allowRotation
        });
      }
    }
    const deltaCandidates = [];
    for (const strat of strategies) {
      resetNodeIdCounter();
      const cand = runSingleStrategy(
        strat,
        stocks,
        partInstances,
        kerf,
        delta,
        targetPartDefs
      );
      totalExplored++;
      if (delta === 0 && strat.isBaseline) {
        baselineCandidate = cand;
      }
      deltaCandidates.push(cand);
    }
    deltaCandidates.sort(compareCandidates);
    if (deltaCandidates.length > 0) {
      bestCandidatePerDelta.push(deltaCandidates[0]);
    }
  }
  const sortedCandidates = [...bestCandidatePerDelta].sort(compareCandidates);
  const bestComplete = sortedCandidates.find((c) => c.isComplete) || null;
  return {
    baselineCandidate,
    candidates: bestCandidatePerDelta,
    // 包含原尺寸与各允许缩小尺寸的最优方案（每个尺寸至多1个）
    bestCompleteCandidate: bestComplete,
    allExploredCount: totalExplored,
    algorithmVersion: ALGORITHM_VERSION
  };
}

// packages/core/src/validator/index.ts
function validateProfilePlacements(first, second, third = 0, fourth = 0) {
  if ("candidateId" in first) {
    return validateCandidate(
      first,
      second,
      Array.isArray(third) ? third : [],
      fourth
    );
  }
  const sheet = first;
  const placements = second || [];
  const errors = [];
  const seen = /* @__PURE__ */ new Set();
  for (const p of placements) {
    if (seen.has(p.instanceId)) {
      errors.push(`\u53D1\u73B0\u91CD\u590D\u7684\u96F6\u4EF6\u5B9E\u4F8B\u7F16\u53F7: ${p.instanceId}`);
    }
    seen.add(p.instanceId);
    if (!isPolygonInsideRect(p.transformedPoints, {
      x: 0,
      y: 0,
      width: sheet.width,
      height: sheet.height
    })) {
      errors.push(`\u96F6\u4EF6 ${p.instanceId} \u8D85\u51FA\u6750\u6599 ${sheet.code || sheet.id} \u8FB9\u754C`);
    }
    for (const def of sheet.defects || []) {
      if (polygonIntersectsRect(p.transformedPoints, def)) {
        errors.push(`\u96F6\u4EF6 ${p.instanceId} \u89E6\u78B0\u6750\u6599 ${sheet.code || sheet.id} \u7684\u7F3A\u9677/\u7981\u6392\u533A\uFF01`);
      }
    }
  }
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const p1 = placements[i];
      const p2 = placements[j];
      if (polygonsIntersect(p1.transformedPoints, p2.transformedPoints)) {
        errors.push(`\u6750\u6599\u4E0A\u96F6\u4EF6 ${p1.instanceId} \u4E0E ${p2.instanceId} \u53D1\u751F\u51E0\u4F55\u91CD\u53E0\uFF01`);
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function validateCandidate(candidate, partGroups, stocks, kerfMm) {
  const errors = [];
  const kerf = Math.round(kerfMm * INTERNAL_SCALE);
  const groupMap = /* @__PURE__ */ new Map();
  let expectedTotalQuantity = 0;
  let flexibleGroupId = null;
  let maxShrinkAllowed = 0;
  for (const g of partGroups) {
    groupMap.set(g.id, g);
    expectedTotalQuantity += g.quantity;
    if (g.flexibleRange && g.flexibleRange.maxShrinkMm > 0) {
      flexibleGroupId = g.id;
      maxShrinkAllowed = g.flexibleRange.maxShrinkMm;
    }
  }
  if (candidate.appliedDeltaMm > 0) {
    if (!flexibleGroupId || candidate.appliedDeltaMm > maxShrinkAllowed) {
      errors.push(
        `\u65B9\u6848\u91C7\u7528\u4E86\u672A\u7ECF\u6388\u6743\u7684\u5C3A\u5BF8\u7F29\u5C0F\u91CF: ${candidate.appliedDeltaMm} mm (\u5141\u8BB8\u4E0A\u9650: ${maxShrinkAllowed} mm)`
      );
    }
  }
  if (candidate.isComplete) {
    if (candidate.placedParts.length !== expectedTotalQuantity) {
      errors.push(
        `\u5B8C\u6574\u65B9\u6848\u96F6\u4EF6\u6570\u91CF\u4E0D\u5339\u914D: \u671F\u671B ${expectedTotalQuantity} \u4E2A\uFF0C\u5B9E\u9645\u653E\u7F6E ${candidate.placedParts.length} \u4E2A`
      );
    }
    if (candidate.unplacedPartIds.length > 0) {
      errors.push(
        `\u65B9\u6848\u6807\u8BB0\u4E3A\u5B8C\u6574\uFF0C\u4F46\u5B58\u5728\u672A\u653E\u7F6E\u96F6\u4EF6: ${candidate.unplacedPartIds.join(", ")}`
      );
    }
  }
  if (candidate.layoutMode === "PROFILE") {
    const placements = candidate.profilePlacements || [];
    if (candidate.isComplete) {
      if (placements.length !== expectedTotalQuantity) {
        errors.push(
          `\u5B8C\u6574\u65B9\u6848\u96F6\u4EF6\u6570\u91CF\u4E0D\u5339\u914D: \u671F\u671B ${expectedTotalQuantity} \u4E2A\uFF0C\u5B9E\u9645\u653E\u7F6E ${placements.length} \u4E2A`
        );
      }
      if (candidate.unplacedPartIds.length > 0) {
        errors.push(
          `\u65B9\u6848\u6807\u8BB0\u4E3A\u5B8C\u6574\uFF0C\u4F46\u5B58\u5728\u672A\u653E\u7F6E\u96F6\u4EF6: ${candidate.unplacedPartIds.join(", ")}`
        );
      }
    }
    const seenProf = /* @__PURE__ */ new Set();
    for (const p of placements) {
      if (seenProf.has(p.instanceId)) {
        errors.push(`\u53D1\u73B0\u91CD\u590D\u7684\u96F6\u4EF6\u5B9E\u4F8B\u7F16\u53F7: ${p.instanceId}`);
      }
      seenProf.add(p.instanceId);
      const group = groupMap.get(p.groupId);
      if (!group) {
        errors.push(`\u96F6\u4EF6\u5B9E\u4F8B ${p.instanceId} \u627E\u4E0D\u5230\u5BF9\u5E94\u7684\u96F6\u4EF6\u7EC4\u5B9A\u4E49: ${p.groupId}`);
        continue;
      }
      const rotPolicy = group.rotationPolicy || (group.allowRotation ? "RIGHT_ANGLE" : "LOCKED");
      if (rotPolicy === "LOCKED" && p.rotationDeg !== 0) {
        errors.push(`\u96F6\u4EF6 [${p.name}] (${p.instanceId}) \u65CB\u8F6C\u7B56\u7565\u4E3A LOCKED\uFF0C\u4F46\u5B9E\u9645\u88AB\u65CB\u8F6C ${p.rotationDeg} \u5EA6`);
      } else if (rotPolicy === "RIGHT_ANGLE" && p.rotationDeg % 90 !== 0) {
        errors.push(`\u96F6\u4EF6 [${p.name}] (${p.instanceId}) \u4EC5\u5141\u8BB8\u76F4\u89D2\u65CB\u8F6C\uFF0C\u4F46\u5B9E\u9645\u88AB\u65CB\u8F6C ${p.rotationDeg} \u5EA6`);
      } else if (rotPolicy === "FREE_15" && p.rotationDeg % 15 !== 0) {
        errors.push(`\u96F6\u4EF6 [${p.name}] (${p.instanceId}) \u65CB\u8F6C\u89D2\u5EA6\u5FC5\u987B\u4E3A 15 \u5EA6\u6574\u6570\u500D\uFF0C\u6536\u5230: ${p.rotationDeg}`);
      }
    }
    const stockMap2 = /* @__PURE__ */ new Map();
    for (const s of stocks) stockMap2.set(s.id, s);
    for (const p of placements) {
      const stock = stockMap2.get(p.stockId);
      if (!stock) {
        errors.push(`\u96F6\u4EF6 ${p.instanceId} \u5F15\u7528\u7684\u6750\u6599\u4E0D\u5B58\u5728: ${p.stockId}`);
        continue;
      }
      if (!isPolygonInsideRect(p.transformedPoints, { x: 0, y: 0, width: stock.width, height: stock.height })) {
        errors.push(`\u96F6\u4EF6 ${p.instanceId} \u8D85\u51FA\u6750\u6599 ${stock.code || stock.id} \u8FB9\u754C`);
      }
      for (const def of stock.defects || []) {
        if (polygonIntersectsRect(p.transformedPoints, def)) {
          errors.push(`\u96F6\u4EF6 ${p.instanceId} \u89E6\u78B0\u6750\u6599 ${stock.code || stock.id} \u7684\u7F3A\u9677/\u7981\u6392\u533A\uFF01`);
        }
      }
    }
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const p1 = placements[i];
        const p2 = placements[j];
        if (p1.stockId === p2.stockId) {
          if (polygonsIntersect(p1.transformedPoints, p2.transformedPoints)) {
            errors.push(`\u6750\u6599\u4E0A\u96F6\u4EF6 ${p1.instanceId} \u4E0E ${p2.instanceId} \u53D1\u751F\u51E0\u4F55\u91CD\u53E0\uFF01`);
          }
        }
      }
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
  const seenInstances = /* @__PURE__ */ new Set();
  for (const p of candidate.placedParts) {
    if (seenInstances.has(p.instanceId)) {
      errors.push(`\u53D1\u73B0\u91CD\u590D\u7684\u96F6\u4EF6\u5B9E\u4F8B\u7F16\u53F7: ${p.instanceId}`);
    }
    seenInstances.add(p.instanceId);
    const group = groupMap.get(p.groupId);
    if (!group) {
      errors.push(`\u96F6\u4EF6\u5B9E\u4F8B ${p.instanceId} \u627E\u4E0D\u5230\u5BF9\u5E94\u7684\u96F6\u4EF6\u7EC4\u5B9A\u4E49: ${p.groupId}`);
      continue;
    }
    if (p.rotated && !group.allowRotation) {
      errors.push(
        `\u96F6\u4EF6 [${p.name}] (${p.instanceId}) \u672A\u6388\u6743\u65CB\u8F6C\uFF0C\u4F46\u5B9E\u9645\u88AB\u65CB\u8F6C 90 \u5EA6`
      );
    }
    const isFlexible = group.id === flexibleGroupId;
    const expectedWidth = group.targetWidth - (isFlexible ? candidate.appliedDeltaMm * INTERNAL_SCALE : 0);
    const expectedHeight = group.targetHeight;
    if (!p.rotated) {
      if (p.width !== expectedWidth || p.height !== expectedHeight) {
        errors.push(
          `\u96F6\u4EF6 ${p.instanceId} \u5C3A\u5BF8\u4E0E\u8981\u6C42\u4E0D\u4E00\u81F4: \u671F\u671B (${expectedWidth}, ${expectedHeight})\uFF0C\u5B9E\u9645 (${p.width}, ${p.height})`
        );
      }
    } else {
      if (p.width !== expectedHeight || p.height !== expectedWidth) {
        errors.push(
          `\u96F6\u4EF6 ${p.instanceId} \u65CB\u8F6C\u540E\u5C3A\u5BF8\u4E0E\u8981\u6C42\u4E0D\u4E00\u81F4: \u671F\u671B (${expectedHeight}, ${expectedWidth})\uFF0C\u5B9E\u9645 (${p.width}, ${p.height})`
        );
      }
    }
  }
  const stockMap = /* @__PURE__ */ new Map();
  for (const s of stocks) {
    stockMap.set(s.id, s);
  }
  let firstMaterialGroup = null;
  for (const used of candidate.usedStocks) {
    const stock = stockMap.get(used.stockId);
    if (!stock) {
      errors.push(`\u4F7F\u7528\u7684\u6750\u6599 ID \u672A\u5728\u53EF\u7528\u6750\u6599\u5217\u8868\u4E2D: ${used.stockId}`);
      continue;
    }
    if (!firstMaterialGroup) {
      firstMaterialGroup = stock.group;
    } else {
      if (stock.group.material !== firstMaterialGroup.material || stock.group.thicknessMm !== firstMaterialGroup.thicknessMm || stock.group.color !== firstMaterialGroup.color) {
        errors.push(`\u4F7F\u7528\u4E86\u4E0D\u517C\u5BB9\u7684\u6750\u6599\u7EC4\u6750\u6599: ${stock.code || stock.id}`);
      }
    }
    for (const p of used.placedParts) {
      if (p.x < 0 || p.y < 0 || p.x + p.width > stock.width || p.y + p.height > stock.height) {
        errors.push(
          `\u96F6\u4EF6 ${p.instanceId} \u8D85\u51FA\u6750\u6599 ${stock.code} \u8FB9\u754C: \u5750\u6807(${p.x},${p.y}), \u5C3A\u5BF8(${p.width},${p.height}), \u6750\u6599(${stock.width},${stock.height})`
        );
      }
    }
    for (let i = 0; i < used.placedParts.length; i++) {
      for (let j = i + 1; j < used.placedParts.length; j++) {
        const p1 = used.placedParts[i];
        const p2 = used.placedParts[j];
        const overlap = !(p1.x + p1.width <= p2.x || p2.x + p2.width <= p1.x || p1.y + p1.height <= p2.y || p2.y + p2.height <= p1.y);
        if (overlap) {
          errors.push(
            `\u6750\u6599 ${stock.code} \u4E0A\u96F6\u4EF6 ${p1.instanceId} \u4E0E ${p2.instanceId} \u53D1\u751F\u51E0\u4F55\u91CD\u53E0\uFF01`
          );
        }
      }
    }
    const treeAreaCheck = verifyCutTreeAndArea(used.cutTree, stock, kerf);
    if (!treeAreaCheck.valid) {
      errors.push(...treeAreaCheck.errors);
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function verifyCutTreeAndArea(root, stock, kerf) {
  const errors = [];
  if (root.rect.x !== 0 || root.rect.y !== 0 || root.rect.width !== stock.width || root.rect.height !== stock.height) {
    errors.push(
      `\u5207\u5272\u6811\u6839\u8282\u70B9\u5C3A\u5BF8 (${root.rect.width}, ${root.rect.height}) \u4E0E\u6750\u6599\u5C3A\u5BF8 (${stock.width}, ${stock.height}) \u4E0D\u5339\u914D`
    );
  }
  let totalPartArea = 0;
  let totalOffcutArea = 0;
  let totalKerfArea = 0;
  function traverse(node) {
    const nodeArea = node.rect.width * node.rect.height;
    if (node.type === "PART") {
      totalPartArea += nodeArea;
    } else if (node.type === "OFFCUT") {
      totalOffcutArea += nodeArea;
    } else if (node.type === "KERF") {
      totalKerfArea += nodeArea;
    } else if (node.type === "SPLIT") {
      if (!node.children || node.children.length !== 2) {
        errors.push(`SPLIT \u8282\u70B9 ${node.id} \u5FC5\u987B\u6070\u597D\u5305\u542B\u4E24\u4E2A\u5B50\u8282\u70B9`);
        return;
      }
      const [c1, c2] = node.children;
      let kerfArea = 0;
      if (node.kerfRect) {
        kerfArea = node.kerfRect.width * node.kerfRect.height;
        totalKerfArea += kerfArea;
      }
      const childrenArea = c1.rect.width * c1.rect.height + c2.rect.width * c2.rect.height;
      if (nodeArea !== childrenArea + kerfArea) {
        errors.push(
          `\u8282\u70B9 ${node.id} \u9762\u79EF\u4E0D\u5B88\u6052: \u7236\u8282\u70B9\u9762\u79EF ${nodeArea} != \u5B50\u8282\u70B9 (${childrenArea}) + \u9884\u7559\u5E26 (${kerfArea})`
        );
      }
      traverse(c1);
      traverse(c2);
    }
  }
  traverse(root);
  const stockArea = stock.width * stock.height;
  const totalAccountedArea = totalPartArea + totalOffcutArea + totalKerfArea;
  if (stockArea !== totalAccountedArea) {
    errors.push(
      `\u6750\u6599 ${stock.code} \u4E25\u683C\u9762\u79EF\u5B88\u6052\u5931\u8D25: \u677F\u6750\u603B\u9762\u79EF ${stockArea}, \u96F6\u4EF6+\u4F59\u6599+\u9884\u7559\u5E26\u603B\u9762\u79EF ${totalAccountedArea}, \u5DEE\u989D: ${stockArea - totalAccountedArea}`
    );
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

// packages/core/src/demo/a4-demo.ts
function createA4DemoOptions() {
  const commonGroup = {
    material: "\u6807\u51C6\u767D\u5361\u7EB8",
    thicknessMm: 0.3,
    color: "\u767D\u8272"
  };
  const stocks = [
    {
      id: "demo_a4_1",
      code: "A4-01",
      group: commonGroup,
      width: toInternalDimension(210, "mm"),
      // 2100
      height: toInternalDimension(297, "mm"),
      // 2970
      isOffcut: false,
      status: "AVAILABLE",
      version: 1
    },
    {
      id: "demo_a4_2",
      code: "A4-02",
      group: commonGroup,
      width: toInternalDimension(210, "mm"),
      // 2100
      height: toInternalDimension(297, "mm"),
      // 2970
      isOffcut: false,
      status: "AVAILABLE",
      version: 1
    }
  ];
  const partGroups = [
    {
      id: "demo_badges",
      name: "\u5C55\u7B7E",
      targetWidth: toInternalDimension(105, "mm"),
      // 1050
      targetHeight: toInternalDimension(70, "mm"),
      // 700
      quantity: 8,
      allowRotation: false,
      // 严格禁止旋转
      flexibleRange: {
        maxShrinkMm: 2,
        stepMm: 1
      }
    }
  ];
  return {
    stocks,
    partGroups,
    kerfMm: 2
    // 2 mm 裁切预留间隔
  };
}
function runA4Demo() {
  const options = createA4DemoOptions();
  const result = solveCuttingPlan(options);
  let baselineValid = false;
  let baselineErrors = [];
  if (result.baselineCandidate) {
    const v = validateCandidate(
      result.baselineCandidate,
      options.partGroups,
      options.stocks,
      options.kerfMm
    );
    baselineValid = v.valid;
    baselineErrors = v.errors;
  }
  let bestValid = false;
  let bestErrors = [];
  if (result.bestCompleteCandidate) {
    const v = validateCandidate(
      result.bestCompleteCandidate,
      options.partGroups,
      options.stocks,
      options.kerfMm
    );
    bestValid = v.valid;
    bestErrors = v.errors;
  }
  return {
    solverOutput: result,
    validationReport: {
      baselineValid,
      baselineErrors,
      bestValid,
      bestErrors
    }
  };
}

// packages/core/src/geometry/templates.ts
function generateTemplatePolygon(kind, params) {
  let points = [];
  switch (kind) {
    case "RECT": {
      const w = Math.round(params.width || 100);
      const h = Math.round(params.height || 100);
      points = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h }
      ];
      break;
    }
    case "ROUNDED_RECT": {
      const w = Math.round(params.width || 200);
      const h = Math.round(params.height || 200);
      const maxR = Math.min(w, h) / 2;
      const r = Math.min(Math.round(params.radius || 20), maxR);
      const segsPerCorner = 6;
      points = [];
      for (let i = 0; i <= segsPerCorner; i++) {
        const rad = -Math.PI / 2 + Math.PI / 2 * (i / segsPerCorner);
        points.push({
          x: Math.round(w - r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad))
        });
      }
      for (let i = 1; i <= segsPerCorner; i++) {
        const rad = Math.PI / 2 * (i / segsPerCorner);
        points.push({
          x: Math.round(w - r + r * Math.cos(rad)),
          y: Math.round(h - r + r * Math.sin(rad))
        });
      }
      for (let i = 1; i <= segsPerCorner; i++) {
        const rad = Math.PI / 2 + Math.PI / 2 * (i / segsPerCorner);
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(h - r + r * Math.sin(rad))
        });
      }
      for (let i = 1; i < segsPerCorner; i++) {
        const rad = Math.PI + Math.PI / 2 * (i / segsPerCorner);
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad))
        });
      }
      break;
    }
    case "CIRCLE": {
      const d = Math.round(params.diameter || (params.radius ? params.radius * 2 : 200));
      const r = d / 2;
      const n = 32;
      points = [];
      for (let i = 0; i < n; i++) {
        const rad = i / n * Math.PI * 2;
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad))
        });
      }
      break;
    }
    case "ELLIPSE": {
      const rx = Math.round(params.rx || (params.width ? params.width / 2 : 200));
      const ry = Math.round(params.ry || (params.height ? params.height / 2 : 150));
      const n = 32;
      points = [];
      for (let i = 0; i < n; i++) {
        const rad = i / n * Math.PI * 2;
        points.push({
          x: Math.round(rx + rx * Math.cos(rad)),
          y: Math.round(ry + ry * Math.sin(rad))
        });
      }
      break;
    }
    case "TRIANGLE": {
      const b = Math.round(params.base || params.width || 200);
      const h = Math.round(params.height || 200);
      points = [
        { x: 0, y: 0 },
        { x: b, y: 0 },
        { x: 0, y: h }
      ];
      break;
    }
    case "REGULAR_POLYGON": {
      const sides = Math.max(3, Math.round(params.sides || 6));
      const r = Math.round(params.radius || 200);
      points = [];
      for (let i = 0; i < sides; i++) {
        const rad = i / sides * Math.PI * 2 - Math.PI / 2;
        points.push({
          x: Math.round(r + r * Math.cos(rad)),
          y: Math.round(r + r * Math.sin(rad))
        });
      }
      break;
    }
    case "L_SHAPE": {
      const w1 = Math.round(params.w1 || params.width || 400);
      const h1 = Math.round(params.h1 || params.height || 400);
      const w2 = Math.round(params.w2 || Math.round(w1 / 2));
      const h2 = Math.round(params.h2 || Math.round(h1 / 2));
      points = [
        { x: 0, y: 0 },
        { x: w1, y: 0 },
        { x: w1, y: h2 },
        { x: w2, y: h2 },
        { x: w2, y: h1 },
        { x: 0, y: h1 }
      ];
      break;
    }
    case "ARCH": {
      const w = Math.round(params.width || 400);
      const h = Math.round(params.height || 600);
      const archH = Math.min(h, Math.round(params.archHeight || 200));
      const baseH = h - archH;
      const rx = w / 2;
      const ry = archH;
      points = [
        { x: 0, y: baseH },
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: baseH }
      ];
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const rad = i / segs * Math.PI;
        points.push({
          x: Math.round(rx + rx * Math.cos(rad)),
          y: Math.round(baseH + ry * Math.sin(rad))
        });
      }
      break;
    }
    case "STAR": {
      const numPoints = Math.max(3, Math.round(params.points || 5));
      const rOuter = Math.round(params.outerRadius || 300);
      const rInner = Math.round(params.innerRadius || Math.round(rOuter / 2));
      points = [];
      const totalVerts = numPoints * 2;
      for (let i = 0; i < totalVerts; i++) {
        const rad = i / totalVerts * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? rOuter : rInner;
        points.push({
          x: Math.round(rOuter + r * Math.cos(rad)),
          y: Math.round(rOuter + r * Math.sin(rad))
        });
      }
      break;
    }
    default: {
      const w = Math.round(params.width || 100);
      const h = Math.round(params.height || 100);
      points = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h }
      ];
      break;
    }
  }
  const bbox = calculatePolygonBBox(points);
  const normalizedPoints = points.map((p) => ({
    x: p.x - bbox.x,
    y: p.y - bbox.y
  }));
  const finalBBox = calculatePolygonBBox(normalizedPoints);
  const area = calculatePolygonArea(normalizedPoints);
  return {
    kind,
    source: "TEMPLATE",
    points: normalizedPoints,
    width: finalBBox.width,
    height: finalBBox.height,
    area,
    closed: true,
    templateParams: params
  };
}

// packages/core/src/geometry/svg-parser.ts
function sanitizeSVG(svgStr) {
  if (!svgStr) return "";
  return svgStr.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "").replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "").replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<!ENTITY[^>]*>/gi, "").replace(/\son[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/href\s*=\s*["']javascript:[^"']*["']/gi, "");
}
function parseSVGToShapeGeometry(svgStr, options = {}) {
  const sanitized = sanitizeSVG(svgStr);
  const rawPoints = [];
  const polyMatch = sanitized.match(/<(?:polygon|polyline)[^>]+points\s*=\s*["']([^"']+)["']/i);
  if (polyMatch) {
    const coords = polyMatch[1].trim().split(/[\s,]+/);
    for (let i = 0; i < coords.length; i += 2) {
      if (i + 1 < coords.length) {
        const x = parseFloat(coords[i]);
        const y = parseFloat(coords[i + 1]);
        if (!isNaN(x) && !isNaN(y)) {
          rawPoints.push({ x: Math.round(x * 10), y: Math.round(y * 10) });
        }
      }
    }
  }
  if (rawPoints.length === 0) {
    const rectMatch = sanitized.match(/<rect[^>]+(?:width\s*=\s*["']([^"']+)["'])[^>]+(?:height\s*=\s*["']([^"']+)["'])/i);
    if (rectMatch) {
      const w = parseFloat(rectMatch[1]) * 10;
      const h = parseFloat(rectMatch[2]) * 10;
      rawPoints.push({ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h });
    }
  }
  if (rawPoints.length === 0) {
    const pathMatch = sanitized.match(/<path[^>]+d\s*=\s*["']([^"']+)["']/i);
    if (pathMatch) {
      const pathData = pathMatch[1];
      const parsedPathPoints = parsePathCommands(pathData);
      rawPoints.push(...parsedPathPoints);
    }
  }
  if (rawPoints.length < 3) {
    rawPoints.push(
      { x: 0, y: 0 },
      { x: 1e3, y: 0 },
      { x: 1e3, y: 1e3 },
      { x: 0, y: 1e3 }
    );
  }
  const rawBBox = calculatePolygonBBox(rawPoints);
  let normalized = rawPoints.map((p) => ({
    x: p.x - rawBBox.x,
    y: p.y - rawBBox.y
  }));
  if (options.targetWidthMm && options.targetHeightMm) {
    const targetW = Math.round(options.targetWidthMm * 10);
    const targetH = Math.round(options.targetHeightMm * 10);
    const curBBox = calculatePolygonBBox(normalized);
    const scaleX = curBBox.width > 0 ? targetW / curBBox.width : 1;
    const scaleY = curBBox.height > 0 ? targetH / curBBox.height : 1;
    normalized = normalized.map((p) => ({
      x: Math.round(p.x * scaleX),
      y: Math.round(p.y * scaleY)
    }));
  }
  const simplified = douglasPeucker(normalized, 2, 64);
  const finalBBox = calculatePolygonBBox(simplified);
  const area = calculatePolygonArea(simplified);
  return {
    kind: "POLYGON",
    source: "SVG",
    points: simplified,
    width: finalBBox.width,
    height: finalBBox.height,
    area,
    closed: true
  };
}
function parsePathCommands(pathStr) {
  const points = [];
  const tokens = pathStr.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/gi) || [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let cmd = "";
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
    }
    if (cmd === "M" || cmd === "m") {
      const isRel = cmd === "m";
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      startX = curX;
      startY = curY;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
      cmd = isRel ? "l" : "L";
    } else if (cmd === "L" || cmd === "l") {
      const isRel = cmd === "l";
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
    } else if (cmd === "H" || cmd === "h") {
      const isRel = cmd === "h";
      const x = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
    } else if (cmd === "V" || cmd === "v") {
      const isRel = cmd === "v";
      const y = parseFloat(tokens[i++]);
      curY = isRel ? curY + y : y;
      points.push({ x: Math.round(curX * 10), y: Math.round(curY * 10) });
    } else if (cmd === "C" || cmd === "c") {
      const isRel = cmd === "c";
      const cp1x = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cp1y = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cp2x = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cp2y = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endX = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endY = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      for (let step = 1; step <= 6; step++) {
        const tVal = step / 6;
        const mt = 1 - tVal;
        const bx = mt * mt * mt * curX + 3 * mt * mt * tVal * cp1x + 3 * mt * tVal * tVal * cp2x + tVal * tVal * tVal * endX;
        const by = mt * mt * mt * curY + 3 * mt * mt * tVal * cp1y + 3 * mt * tVal * tVal * cp2y + tVal * tVal * tVal * endY;
        points.push({ x: Math.round(bx * 10), y: Math.round(by * 10) });
      }
      curX = endX;
      curY = endY;
    } else if (cmd === "Q" || cmd === "q") {
      const isRel = cmd === "q";
      const cpx = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const cpy = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endX = isRel ? curX + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      const endY = isRel ? curY + parseFloat(tokens[i++]) : parseFloat(tokens[i++]);
      for (let step = 1; step <= 5; step++) {
        const tVal = step / 5;
        const mt = 1 - tVal;
        const bx = mt * mt * curX + 2 * mt * tVal * cpx + tVal * tVal * endX;
        const by = mt * mt * curY + 2 * mt * tVal * cpy + tVal * tVal * endY;
        points.push({ x: Math.round(bx * 10), y: Math.round(by * 10) });
      }
      curX = endX;
      curY = endY;
    } else if (cmd === "Z" || cmd === "z") {
      curX = startX;
      curY = startY;
      i++;
    } else {
      i++;
    }
  }
  return points;
}

// packages/core/src/geometry/image-contour.ts
function computeHomography(src, dst) {
  if (src.length < 4 || dst.length < 4) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const u = dst[i].x;
    const v = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    const tempA = A[i];
    A[i] = A[maxRow];
    A[maxRow] = tempA;
    const tempB = B[i];
    B[i] = B[maxRow];
    B[maxRow] = tempB;
    if (Math.abs(A[i][i]) < 1e-12) continue;
    for (let k = i + 1; k < n; k++) {
      const c = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= c * A[i][j];
      }
      B[k] -= c * B[i];
    }
  }
  const h = new Array(8).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * h[j];
    }
    h[i] = (B[i] - sum) / (A[i][i] || 1);
  }
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1]
  ];
}
function rectifyPoints(points, H) {
  return points.map((p) => {
    const w = H[2][0] * p.x + H[2][1] * p.y + H[2][2];
    const denom = Math.abs(w) > 1e-8 ? w : 1;
    const u = (H[0][0] * p.x + H[0][1] * p.y + H[0][2]) / denom;
    const v = (H[1][0] * p.x + H[1][1] * p.y + H[1][2]) / denom;
    return {
      x: Math.round(u),
      y: Math.round(v)
    };
  });
}
function otsuThreshold(histogram, totalPixels) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVar = -1;
  let tStart = 0;
  let tEnd = 0;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const betweenVar = wB * wF * (mB - mF) * (mB - mF);
    if (betweenVar > maxVar + 1e-6) {
      maxVar = betweenVar;
      tStart = t;
      tEnd = t;
    } else if (Math.abs(betweenVar - maxVar) <= 1e-6) {
      tEnd = t;
    }
  }
  return Math.round((tStart + tEnd) / 2);
}
function extractContourFromBinaryImage(grid, width, height, options = {}) {
  const scaleMmPerPixel = options.scaleMmPerPixel || 1;
  const maxVertices = options.maxVertices || 64;
  let startX = -1;
  let startY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] === 1) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }
  if (startX === -1) {
    return {
      kind: "POLYGON",
      source: "PHOTO",
      points: [
        { x: 0, y: 0 },
        { x: 1e3, y: 0 },
        { x: 1e3, y: 1e3 },
        { x: 0, y: 1e3 }
      ],
      width: 1e3,
      height: 1e3,
      area: 1e6,
      closed: true,
      confidence: 0.1
    };
  }
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];
  const contourPoints = [];
  let currX = startX;
  let currY = startY;
  let dir = 0;
  contourPoints.push({
    x: Math.round(currX * scaleMmPerPixel * 10),
    y: Math.round(currY * scaleMmPerPixel * 10)
  });
  const maxSteps = width * height;
  let step = 0;
  while (step < maxSteps) {
    let foundNext = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + i) % 8;
      const nx = currX + dx[checkDir];
      const ny = currY + dy[checkDir];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (grid[ny * width + nx] === 1) {
          currX = nx;
          currY = ny;
          dir = (checkDir + 5) % 8;
          contourPoints.push({
            x: Math.round(currX * scaleMmPerPixel * 10),
            y: Math.round(currY * scaleMmPerPixel * 10)
          });
          foundNext = true;
          break;
        }
      }
    }
    if (!foundNext) break;
    if (currX === startX && currY === startY && contourPoints.length > 3) {
      break;
    }
    step++;
  }
  const bbox = calculatePolygonBBox(contourPoints);
  const normalized = contourPoints.map((p) => ({
    x: p.x - bbox.x,
    y: p.y - bbox.y
  }));
  const simplified = douglasPeucker(normalized, 3, maxVertices);
  const finalBBox = calculatePolygonBBox(simplified);
  const area = calculatePolygonArea(simplified);
  return {
    kind: "POLYGON",
    source: "PHOTO",
    points: simplified,
    width: finalBBox.width,
    height: finalBBox.height,
    area,
    closed: true,
    confidence: 0.92
  };
}
function findContoursFromImageData(imageData, options = {}) {
  const { width, height, data } = imageData;
  const total = width * height;
  const gray = new Uint8Array(total);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const g = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    );
    gray[i] = g;
    hist[g]++;
  }
  const th = typeof options.threshold === "number" ? options.threshold : otsuThreshold(hist, total);
  const binGrid = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    binGrid[i] = gray[i] < th ? 1 : 0;
  }
  const geo = extractContourFromBinaryImage(binGrid, width, height, options);
  return [geo.points];
}

// packages/core/src/agent/tools.ts
var GOALS = /* @__PURE__ */ new Set(["BALANCED", "SAVE_MATERIAL", "EASY_CUT"]);
function validateAgentTurnRequest(input) {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return { valid: false, error: "\u8BF7\u8F93\u5165\u5236\u4F5C\u9700\u6C42" };
  if (message.length > 1e3) return { valid: false, error: "\u5355\u6B21\u8F93\u5165\u4E0D\u80FD\u8D85\u8FC71000\u5B57" };
  return { valid: true };
}
function toScaled(value, unit) {
  const mm = unit.toLowerCase() === "cm" ? value * 10 : value;
  return Math.round(mm * 10);
}
function createRuleFallbackDraft(text) {
  const normalized = String(text || "").trim();
  const partGroups = [];
  const pattern = /(?:(\d+)\s*(?:个|块|张|件|片)[^0-9\n]{0,12})?([0-9]+(?:\.[0-9]+)?)\s*[xX×乘*]\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|毫米|厘米)?/g;
  let match;
  let index = 1;
  while ((match = pattern.exec(normalized)) !== null && partGroups.length < 10) {
    const unit = match[4] === "cm" || match[4] === "\u5398\u7C73" ? "cm" : "mm";
    const shrink = normalized.match(/(?:允许|可)[^。；，,]{0,16}(?:宽度)?(?:最多)?缩小\s*([012](?:\.0)?)\s*(?:mm|毫米)/);
    const allowRotation = /(?:允许|可以|可)旋转/.test(normalized) && !/(?:不|禁止)旋转/.test(normalized);
    const maxShrinkMm = shrink ? Number(shrink[1]) : 0;
    const quantity = Number(match[1] || (normalized.match(/(\d+)\s*(?:个|块|张|件|片)/) || [])[1] || 1);
    partGroups.push({
      id: `agent-g${index}`,
      name: /展签/.test(normalized) ? `\u5C55\u7B7E${index}` : `\u96F6\u4EF6\u7EC4${index}`,
      targetWidth: toScaled(Number(match[2]), unit),
      targetHeight: toScaled(Number(match[3]), unit),
      quantity,
      allowRotation,
      rotationPolicy: allowRotation ? "RIGHT_ANGLE" : "LOCKED",
      ...maxShrinkMm === 1 || maxShrinkMm === 2 ? { flexibleRange: { maxShrinkMm, stepMm: 1 } } : {}
    });
    index++;
  }
  const kerfMatch = normalized.match(/(?:间距|刀缝|缝隙)\s*(?:为|是|:|：)?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|毫米)?/);
  return {
    stockIds: [],
    partGroups,
    kerfMm: kerfMatch ? Math.max(0, Math.min(5, Number(kerfMatch[1]))) : 2,
    optimizationGoal: /省料|节省|利用率/.test(normalized) ? "SAVE_MATERIAL" : "BALANCED"
  };
}
function sanitizeAgentDraft(raw, accessibleStocks) {
  const availableIds = new Set(accessibleStocks.filter((stock) => stock.status === "AVAILABLE").map((stock) => stock.id));
  const rawGroups = Array.isArray(raw?.partGroups) ? raw.partGroups.slice(0, 10) : [];
  const partGroups = rawGroups.map((group, index) => {
    const maxShrink = Number(group?.flexibleRange?.maxShrinkMm);
    const allowRotation = group?.allowRotation === true;
    return {
      id: String(group?.id || `agent-g${index + 1}`).slice(0, 64),
      name: String(group?.name || `\u96F6\u4EF6\u7EC4${index + 1}`).slice(0, 40),
      targetWidth: Math.round(Number(group?.targetWidth) || 0),
      targetHeight: Math.round(Number(group?.targetHeight) || 0),
      quantity: Math.round(Number(group?.quantity) || 0),
      allowRotation,
      rotationPolicy: allowRotation ? "RIGHT_ANGLE" : "LOCKED",
      ...maxShrink === 1 || maxShrink === 2 ? { flexibleRange: { maxShrinkMm: maxShrink, stepMm: 1 } } : {}
    };
  });
  return {
    stockIds: Array.isArray(raw?.stockIds) ? [...new Set(raw.stockIds.map(String))].filter((id) => availableIds.has(id)) : [],
    partGroups,
    kerfMm: Math.max(0, Math.min(5, Number(raw?.kerfMm) || 0)),
    optimizationGoal: GOALS.has(raw?.optimizationGoal) ? raw.optimizationGoal : "BALANCED"
  };
}
function validateRequirementDraft(draft, accessibleStocks) {
  const missingFields = [];
  const errors = [];
  if (!draft.stockIds.length) missingFields.push("stockIds");
  if (!draft.partGroups.length) missingFields.push("partGroups");
  const availableIds = new Set(accessibleStocks.filter((s) => s.status === "AVAILABLE").map((s) => s.id));
  if (draft.stockIds.some((id) => !availableIds.has(id))) errors.push("\u5305\u542B\u4E0D\u53EF\u8BBF\u95EE\u6216\u5DF2\u6D88\u8017\u7684\u6750\u6599");
  let totalQuantity = 0;
  for (const group of draft.partGroups) {
    totalQuantity += group.quantity;
    if (!Number.isInteger(group.targetWidth) || !Number.isInteger(group.targetHeight) || group.targetWidth <= 0 || group.targetHeight <= 0) errors.push(`${group.name}\u7684\u5C3A\u5BF8\u5FC5\u987B\u4E3A\u6B63\u6570`);
    if (!Number.isInteger(group.quantity) || group.quantity <= 0) errors.push(`${group.name}\u7684\u6570\u91CF\u5FC5\u987B\u4E3A\u6B63\u6574\u6570`);
    if (group.targetWidth > 2e4 || group.targetHeight > 2e4) errors.push(`${group.name}\u7684\u5C3A\u5BF8\u8D85\u8FC72000mm\u4E0A\u9650`);
    if (group.flexibleRange && ![1, 2].includes(group.flexibleRange.maxShrinkMm)) errors.push(`${group.name}\u7684\u5C3A\u5BF8\u8C03\u6574\u8303\u56F4\u65E0\u6548`);
  }
  if (totalQuantity > 20) errors.push("\u5355\u6B21\u4EFB\u52A1\u6700\u591A\u652F\u630120\u4E2A\u96F6\u4EF6");
  if (draft.kerfMm < 0 || draft.kerfMm > 5) errors.push("\u88C1\u5207\u95F4\u8DDD\u5FC5\u987B\u57280\u52305mm\u4E4B\u95F4");
  return { valid: missingFields.length === 0 && errors.length === 0, missingFields, errors };
}
function solveAndCompare(draft, accessibleStocks) {
  const validation = validateRequirementDraft(draft, accessibleStocks);
  if (!validation.valid) throw new Error([...validation.missingFields, ...validation.errors].join("\uFF1B"));
  const selectedStocks = accessibleStocks.filter((stock) => draft.stockIds.includes(stock.id) && stock.status === "AVAILABLE");
  const solverOutput = solveCuttingPlan({ stocks: selectedStocks, partGroups: draft.partGroups, kerfMm: draft.kerfMm });
  const candidates = solverOutput.candidates.map((candidate) => {
    const checked = validateCandidate(candidate, draft.partGroups, selectedStocks, draft.kerfMm);
    return {
      candidateId: candidate.candidateId,
      sheetCount: candidate.usedStocks.length,
      utilization: candidate.metrics.utilizationRate,
      wasteRate: Math.max(0, 1 - candidate.metrics.utilizationRate),
      cutComplexity: candidate.metrics.stepsCount,
      validationPassed: checked.valid && candidate.isComplete,
      appliedDeltaMm: candidate.appliedDeltaMm,
      strategyName: candidate.strategyName
    };
  });
  return { solverOutput, candidates, stocks: selectedStocks };
}
function buildCutSummary(output) {
  const candidate = output.bestCompleteCandidate || output.candidates.find((item) => item.isComplete) || null;
  return {
    algorithmVersion: output.algorithmVersion,
    candidateId: candidate?.candidateId || "",
    stepsCount: candidate?.metrics.stepsCount || candidate?.cutPaths?.length || 0,
    sheetCount: candidate?.usedStocks.length || 0,
    placedCount: candidate?.placedParts.length || candidate?.profilePlacements?.length || 0
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALGORITHM_VERSION,
  INTERNAL_SCALE,
  MAX_KERF_MM,
  MAX_PART_INSTANCES,
  MAX_STOCKS,
  PART_ORDERS,
  PROFILE_ALGORITHM_VERSION,
  RECT_FITS,
  SPLIT_RULES,
  STOCK_ORDERS,
  build24Strategies,
  buildCutSummary,
  buildProfileStrategies,
  calculatePolygonArea,
  calculatePolygonBBox,
  calculateQuote,
  canFitWithKerf,
  compareCandidates,
  compareProfileCandidates,
  computeHomography,
  createA4DemoOptions,
  createRuleFallbackDraft,
  doLineSegmentsIntersect,
  douglasPeucker,
  executeGuillotineSplit,
  extractContourFromBinaryImage,
  findContoursFromImageData,
  formatArea,
  formatInternal,
  fromInternalDimension,
  generateCutGuidance,
  generateNodeId,
  generateTemplatePolygon,
  isPointInPolygon,
  isPolygonClosed,
  isPolygonInsideRect,
  isPolygonSelfIntersecting,
  otsuThreshold,
  parseSVGToShapeGeometry,
  polygonIntersectsRect,
  polygonsIntersect,
  rectifyPoints,
  resetNodeIdCounter,
  runA4Demo,
  runSingleStrategy,
  sanitizeAgentDraft,
  sanitizeSVG,
  snapAngle,
  solveAndCompare,
  solveCuttingPlan,
  solveProfileCuttingPlan,
  sortParts,
  sortStocks,
  toInternalDimension,
  transformPoints,
  validateAgentTurnRequest,
  validateCandidate,
  validateProfilePlacements,
  validateRequirementDraft,
  validateSolverInput
});
