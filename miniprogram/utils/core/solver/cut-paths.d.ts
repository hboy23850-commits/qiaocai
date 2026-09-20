import { CutPath, ProfilePlacement } from '../types/index.js';
export interface CutGuidance {
    steps: CutPath[];
    recommendedTool: string;
    calibrationLineMm: number;
}
/**
 * 手工排料分步裁切指导与刀路生成
 * 规则：内紧邻优先至外围，给出清晰工具建议与 100mm 校准线
 */
export declare function generateCutGuidance(placements: ProfilePlacement[], stockDimensions: {
    width: number;
    height: number;
}): CutGuidance;
