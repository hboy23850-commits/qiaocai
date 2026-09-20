import { Candidate, PartGroup, Stock, ValidationResult, ProfilePlacement } from '../types/index.js';
/**
 * R1 规范：纯数学无依赖独立几何多边形验证器
 * 校验单张板材上的零件放置是否越界、触碰缺陷、相互重叠
 * @param sheet 板材定义 (含尺寸与缺陷禁排区)
 * @param placements 该板材上的异形零件放置列表
 * @param kerf 裁切间隙预留 (0.1 mm 整数)
 */
export declare function validateProfilePlacements(sheet: Stock, placements: ProfilePlacement[], kerf?: number): {
    valid: boolean;
    errors: string[];
};
export declare function validateProfilePlacements(candidate: Candidate, partGroups: PartGroup[], stocks: Stock[], kerfMm?: number): ValidationResult;
/**
 * 独立几何与业务约束校验器
 */
export declare function validateCandidate(candidate: Candidate, partGroups: PartGroup[], stocks: Stock[], kerfMm: number): ValidationResult;
