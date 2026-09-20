/**
 * 单位转换与精度校验工具
 * 内部长度统一采用 0.1 mm 整数表示（例如 104 mm -> 1040）
 * 严格拒绝静默四舍五入，超精度直接抛出异常
 */
export const INTERNAL_SCALE = 10; // 1 mm = 10 units (0.1 mm)
/**
 * 将 mm 或 cm 转换为内部整数（0.1 mm 标度）
 * @param value 输入数值
 * @param unit 单位 'mm' | 'cm'
 * @returns 内部 0.1 mm 整数
 */
export function toInternalDimension(value, unit = 'mm') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`输入必须是有限数值，收到: ${value}`);
    }
    if (value <= 0) {
        throw new Error(`尺寸必须为正数，收到: ${value}`);
    }
    // 转换为以毫米为单位的值
    const mmValue = unit === 'cm' ? value * 10 : value;
    // 检查是否在合理范围（防止溢出）
    if (mmValue > 100000) {
        throw new Error(`尺寸超出最大允许范围 (100000 mm): ${mmValue}`);
    }
    // 计算内部整数值：mmValue * 10
    // 为避免浮点精度问题（如 10.1 * 10 = 101.00000000000001），使用高精度四舍五入检测浮点抖动与真实超精度
    const scaled = mmValue * INTERNAL_SCALE;
    const rounded = Math.round(scaled);
    // 如果与四舍五入后的整数差异超过浮点误差微量 (1e-6)，说明用户输入了超过 0.1 mm 的精度（如 10.25 mm）
    if (Math.abs(scaled - rounded) > 1e-6) {
        throw new Error(`输入尺寸 ${value} ${unit} 超过了支持的 0.1 mm 精度，禁止静默四舍五入，请修正输入`);
    }
    return rounded;
}
/**
 * 将内部整数转换为可显示的 mm 或 cm 浮点数
 */
export function fromInternalDimension(internalValue, unit = 'mm') {
    if (!Number.isInteger(internalValue) || internalValue < 0) {
        throw new Error(`内部尺寸必须为非负整数，收到: ${internalValue}`);
    }
    const mm = internalValue / INTERNAL_SCALE;
    return unit === 'cm' ? mm / 10 : mm;
}
/**
 * 格式化输出为可读字符串，带单位
 */
export function formatInternal(internalValue, unit = 'mm') {
    const num = fromInternalDimension(internalValue, unit);
    // 保留最多1位小数（如果能整除则不保留小数）
    const formatted = Number(num.toFixed(1)).toString();
    return `${formatted} ${unit}`;
}
/**
 * 格式化面积 (内部单位平方转换为 mm^2)
 */
export function formatArea(internalArea) {
    // 1 internal unit = 0.1 mm, 1 internalArea = 0.01 mm^2
    const mm2 = internalArea / (INTERNAL_SCALE * INTERNAL_SCALE);
    return `${mm2.toFixed(1)} mm²`;
}
