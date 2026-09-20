import {
  Candidate,
  PartGroup,
  Stock,
  ValidationResult,
  CutTreeNode,
  Rect,
  ProfilePlacement,
} from '../types/index.js';
import { INTERNAL_SCALE } from '../utils/units.js';
import {
  isPolygonInsideRect,
  polygonIntersectsRect,
  polygonsIntersect,
} from '../geometry/polygon.js';

/**
 * R1 规范：纯数学无依赖独立几何多边形验证器
 * 校验单张板材上的零件放置是否越界、触碰缺陷、相互重叠
 * @param sheet 板材定义 (含尺寸与缺陷禁排区)
 * @param placements 该板材上的异形零件放置列表
 * @param kerf 裁切间隙预留 (0.1 mm 整数)
 */
export function validateProfilePlacements(
  sheet: Stock,
  placements: ProfilePlacement[],
  kerf?: number
): { valid: boolean; errors: string[] };
export function validateProfilePlacements(
  candidate: Candidate,
  partGroups: PartGroup[],
  stocks: Stock[],
  kerfMm?: number
): ValidationResult;
export function validateProfilePlacements(
  first: Stock | Candidate,
  second: ProfilePlacement[] | PartGroup[],
  third: number | Stock[] = 0,
  fourth: number = 0
): { valid: boolean; errors: string[] } {
  if ('candidateId' in first) {
    return validateCandidate(
      first as Candidate,
      second as PartGroup[],
      Array.isArray(third) ? third : [],
      fourth
    );
  }

  const sheet = first as Stock;
  const placements = (second as ProfilePlacement[]) || [];
  const errors: string[] = [];

  // 1. 唯一性校验
  const seen = new Set<string>();
  for (const p of placements) {
    if (seen.has(p.instanceId)) {
      errors.push(`发现重复的零件实例编号: ${p.instanceId}`);
    }
    seen.add(p.instanceId);

    // 2. 越界校验
    if (
      !isPolygonInsideRect(p.transformedPoints, {
        x: 0,
        y: 0,
        width: sheet.width,
        height: sheet.height,
      })
    ) {
      errors.push(`零件 ${p.instanceId} 超出材料 ${sheet.code || sheet.id} 边界`);
    }

    // 3. 缺陷/禁排区相交校验
    for (const def of sheet.defects || []) {
      if (polygonIntersectsRect(p.transformedPoints, def)) {
        errors.push(`零件 ${p.instanceId} 触碰材料 ${sheet.code || sheet.id} 的缺陷/禁排区！`);
      }
    }
  }

  // 4. 同板零件两两相交校验
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const p1 = placements[i];
      const p2 = placements[j];
      if (polygonsIntersect(p1.transformedPoints, p2.transformedPoints)) {
        errors.push(`材料上零件 ${p1.instanceId} 与 ${p2.instanceId} 发生几何重叠！`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 独立几何与业务约束校验器
 */
export function validateCandidate(
  candidate: Candidate,
  partGroups: PartGroup[],
  stocks: Stock[],
  kerfMm: number
): ValidationResult {
  const errors: string[] = [];
  const kerf = Math.round(kerfMm * INTERNAL_SCALE);

  // 1. 零件组映射与总数校验
  const groupMap = new Map<string, PartGroup>();
  let expectedTotalQuantity = 0;
  let flexibleGroupId: string | null = null;
  let maxShrinkAllowed = 0;

  for (const g of partGroups) {
    groupMap.set(g.id, g);
    expectedTotalQuantity += g.quantity;
    if (g.flexibleRange && g.flexibleRange.maxShrinkMm > 0) {
      flexibleGroupId = g.id;
      maxShrinkAllowed = g.flexibleRange.maxShrinkMm;
    }
  }

  // 尺寸缩减授权检查
  if (candidate.appliedDeltaMm > 0) {
    if (!flexibleGroupId || candidate.appliedDeltaMm > maxShrinkAllowed) {
      errors.push(
        `方案采用了未经授权的尺寸缩小量: ${candidate.appliedDeltaMm} mm (允许上限: ${maxShrinkAllowed} mm)`
      );
    }
  }

  if (candidate.isComplete) {
    if (candidate.placedParts.length !== expectedTotalQuantity) {
      errors.push(
        `完整方案零件数量不匹配: 期望 ${expectedTotalQuantity} 个，实际放置 ${candidate.placedParts.length} 个`
      );
    }
    if (candidate.unplacedPartIds.length > 0) {
      errors.push(
        `方案标记为完整，但存在未放置零件: ${candidate.unplacedPartIds.join(', ')}`
      );
    }
  }

  // 如果是 PROFILE 异形排版方案，进入异形独立几何校验
  if (candidate.layoutMode === 'PROFILE') {
    const placements = candidate.profilePlacements || [];
    if (candidate.isComplete) {
      if (placements.length !== expectedTotalQuantity) {
        errors.push(
          `完整方案零件数量不匹配: 期望 ${expectedTotalQuantity} 个，实际放置 ${placements.length} 个`
        );
      }
      if (candidate.unplacedPartIds.length > 0) {
        errors.push(
          `方案标记为完整，但存在未放置零件: ${candidate.unplacedPartIds.join(', ')}`
        );
      }
    }

    const seenProf = new Set<string>();
    for (const p of placements) {
      if (seenProf.has(p.instanceId)) {
        errors.push(`发现重复的零件实例编号: ${p.instanceId}`);
      }
      seenProf.add(p.instanceId);

      const group = groupMap.get(p.groupId);
      if (!group) {
        errors.push(`零件实例 ${p.instanceId} 找不到对应的零件组定义: ${p.groupId}`);
        continue;
      }

      // 旋转权限校验
      const rotPolicy = group.rotationPolicy || (group.allowRotation ? 'RIGHT_ANGLE' : 'LOCKED');
      if (rotPolicy === 'LOCKED' && p.rotationDeg !== 0) {
        errors.push(`零件 [${p.name}] (${p.instanceId}) 旋转策略为 LOCKED，但实际被旋转 ${p.rotationDeg} 度`);
      } else if (rotPolicy === 'RIGHT_ANGLE' && p.rotationDeg % 90 !== 0) {
        errors.push(`零件 [${p.name}] (${p.instanceId}) 仅允许直角旋转，但实际被旋转 ${p.rotationDeg} 度`);
      } else if (rotPolicy === 'FREE_15' && p.rotationDeg % 15 !== 0) {
        errors.push(`零件 [${p.name}] (${p.instanceId}) 旋转角度必须为 15 度整数倍，收到: ${p.rotationDeg}`);
      }
    }

    // 校验材料与多边形几何关系
    const stockMap = new Map<string, Stock>();
    for (const s of stocks) stockMap.set(s.id, s);

    for (const p of placements) {
      const stock = stockMap.get(p.stockId);
      if (!stock) {
        errors.push(`零件 ${p.instanceId} 引用的材料不存在: ${p.stockId}`);
        continue;
      }

      // 越界校验
      if (!isPolygonInsideRect(p.transformedPoints, { x: 0, y: 0, width: stock.width, height: stock.height })) {
        errors.push(`零件 ${p.instanceId} 超出材料 ${stock.code || stock.id} 边界`);
      }

      // 缺陷/禁排区相交校验
      for (const def of stock.defects || []) {
        if (polygonIntersectsRect(p.transformedPoints, def)) {
          errors.push(`零件 ${p.instanceId} 触碰材料 ${stock.code || stock.id} 的缺陷/禁排区！`);
        }
      }
    }

    // 同板零件两两相交校验
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const p1 = placements[i];
        const p2 = placements[j];
        if (p1.stockId === p2.stockId) {
          if (polygonsIntersect(p1.transformedPoints, p2.transformedPoints)) {
            errors.push(`材料上零件 ${p1.instanceId} 与 ${p2.instanceId} 发生几何重叠！`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // 检查放置实例编号唯一性
  const seenInstances = new Set<string>();
  for (const p of candidate.placedParts) {
    if (seenInstances.has(p.instanceId)) {
      errors.push(`发现重复的零件实例编号: ${p.instanceId}`);
    }
    seenInstances.add(p.instanceId);

    const group = groupMap.get(p.groupId);
    if (!group) {
      errors.push(`零件实例 ${p.instanceId} 找不到对应的零件组定义: ${p.groupId}`);
      continue;
    }

    // 旋转权限校验
    if (p.rotated && !group.allowRotation) {
      errors.push(
        `零件 [${p.name}] (${p.instanceId}) 未授权旋转，但实际被旋转 90 度`
      );
    }

    // 尺寸合规校验
    const isFlexible = group.id === flexibleGroupId;
    const expectedWidth = group.targetWidth - (isFlexible ? candidate.appliedDeltaMm * INTERNAL_SCALE : 0);
    const expectedHeight = group.targetHeight;

    if (!p.rotated) {
      if (p.width !== expectedWidth || p.height !== expectedHeight) {
        errors.push(
          `零件 ${p.instanceId} 尺寸与要求不一致: 期望 (${expectedWidth}, ${expectedHeight})，实际 (${p.width}, ${p.height})`
        );
      }
    } else {
      if (p.width !== expectedHeight || p.height !== expectedWidth) {
        errors.push(
          `零件 ${p.instanceId} 旋转后尺寸与要求不一致: 期望 (${expectedHeight}, ${expectedWidth})，实际 (${p.width}, ${p.height})`
        );
      }
    }
  }

  // 2. 材料组一致性与越界检查
  const stockMap = new Map<string, Stock>();
  for (const s of stocks) {
    stockMap.set(s.id, s);
  }

  let firstMaterialGroup: Stock['group'] | null = null;

  for (const used of candidate.usedStocks) {
    const stock = stockMap.get(used.stockId);
    if (!stock) {
      errors.push(`使用的材料 ID 未在可用材料列表中: ${used.stockId}`);
      continue;
    }

    if (!firstMaterialGroup) {
      firstMaterialGroup = stock.group;
    } else {
      if (
        stock.group.material !== firstMaterialGroup.material ||
        stock.group.thicknessMm !== firstMaterialGroup.thicknessMm ||
        stock.group.color !== firstMaterialGroup.color
      ) {
        errors.push(`使用了不兼容的材料组材料: ${stock.code || stock.id}`);
      }
    }

    // 检查越界
    for (const p of used.placedParts) {
      if (p.x < 0 || p.y < 0 || p.x + p.width > stock.width || p.y + p.height > stock.height) {
        errors.push(
          `零件 ${p.instanceId} 超出材料 ${stock.code} 边界: 坐标(${p.x},${p.y}), 尺寸(${p.width},${p.height}), 材料(${stock.width},${stock.height})`
        );
      }
    }

    // 检查同一材料内零件重叠
    for (let i = 0; i < used.placedParts.length; i++) {
      for (let j = i + 1; j < used.placedParts.length; j++) {
        const p1 = used.placedParts[i];
        const p2 = used.placedParts[j];
        const overlap = !(
          p1.x + p1.width <= p2.x ||
          p2.x + p2.width <= p1.x ||
          p1.y + p1.height <= p2.y ||
          p2.y + p2.height <= p1.y
        );
        if (overlap) {
          errors.push(
            `材料 ${stock.code} 上零件 ${p1.instanceId} 与 ${p2.instanceId} 发生几何重叠！`
          );
        }
      }
    }

    // 3. 切割树重放与严格面积守恒校验
    const treeAreaCheck = verifyCutTreeAndArea(used.cutTree, stock, kerf);
    if (!treeAreaCheck.valid) {
      errors.push(...treeAreaCheck.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 递归验证切割树节点与面积守恒
 */
function verifyCutTreeAndArea(
  root: CutTreeNode,
  stock: Stock,
  kerf: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 根节点尺寸必须等于材料全幅
  if (
    root.rect.x !== 0 ||
    root.rect.y !== 0 ||
    root.rect.width !== stock.width ||
    root.rect.height !== stock.height
  ) {
    errors.push(
      `切割树根节点尺寸 (${root.rect.width}, ${root.rect.height}) 与材料尺寸 (${stock.width}, ${stock.height}) 不匹配`
    );
  }

  let totalPartArea = 0;
  let totalOffcutArea = 0;
  let totalKerfArea = 0;

  function traverse(node: CutTreeNode) {
    const nodeArea = node.rect.width * node.rect.height;

    if (node.type === 'PART') {
      totalPartArea += nodeArea;
    } else if (node.type === 'OFFCUT') {
      totalOffcutArea += nodeArea;
    } else if (node.type === 'KERF') {
      totalKerfArea += nodeArea;
    } else if (node.type === 'SPLIT') {
      if (!node.children || node.children.length !== 2) {
        errors.push(`SPLIT 节点 ${node.id} 必须恰好包含两个子节点`);
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
          `节点 ${node.id} 面积不守恒: 父节点面积 ${nodeArea} != 子节点 (${childrenArea}) + 预留带 (${kerfArea})`
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
      `材料 ${stock.code} 严格面积守恒失败: 板材总面积 ${stockArea}, 零件+余料+预留带总面积 ${totalAccountedArea}, 差额: ${stockArea - totalAccountedArea}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
