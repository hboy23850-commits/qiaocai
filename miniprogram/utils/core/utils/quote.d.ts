import { QuoteCalculationInput, QuoteCalculationResult } from '../types/index.js';
/**
 * 计算商业 ERP 报价单金额纯函数
 *
 * 核心公式：
 * materialCost = Math.round((input.totalInputAreaSqm * input.pricePerSqm) * 100) / 100;
 * totalPrice = Math.round((materialCost + input.processingFee + input.miscFee) * 100) / 100;
 */
export declare function calculateQuote(input: QuoteCalculationInput): QuoteCalculationResult;
