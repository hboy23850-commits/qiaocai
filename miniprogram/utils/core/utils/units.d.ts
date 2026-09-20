/**
 * 单位转换与精度校验工具
 * 内部长度统一采用 0.1 mm 整数表示（例如 104 mm -> 1040）
 * 严格拒绝静默四舍五入，超精度直接抛出异常
 */
export declare const INTERNAL_SCALE = 10;
/**
 * 将 mm 或 cm 转换为内部整数（0.1 mm 标度）
 * @param value 输入数值
 * @param unit 单位 'mm' | 'cm'
 * @returns 内部 0.1 mm 整数
 */
export declare function toInternalDimension(value: number, unit?: 'mm' | 'cm'): number;
/**
 * 将内部整数转换为可显示的 mm 或 cm 浮点数
 */
export declare function fromInternalDimension(internalValue: number, unit?: 'mm' | 'cm'): number;
/**
 * 格式化输出为可读字符串，带单位
 */
export declare function formatInternal(internalValue: number, unit?: 'mm' | 'cm'): string;
/**
 * 格式化面积 (内部单位平方转换为 mm^2)
 */
export declare function formatArea(internalArea: number): string;
