import { QuoteCalculationInput, QuoteCalculationResult } from '../types/index.js';

/**
 * 计算商业 ERP 报价单金额纯函数
 * 
 * 核心公式：
 * materialCost = Math.round((input.totalInputAreaSqm * input.pricePerSqm) * 100) / 100;
 * totalPrice = Math.round((materialCost + input.processingFee + input.miscFee) * 100) / 100;
 */
export function calculateQuote(input: QuoteCalculationInput): QuoteCalculationResult {
  const totalInputAreaSqm = Number(input?.totalInputAreaSqm) || 0;
  const pricePerSqm = Number(input?.pricePerSqm) || 0;
  const processingFee = Number(input?.processingFee) || 0;
  const miscFee = Number(input?.miscFee) || 0;

  const materialCost = Math.round((totalInputAreaSqm * pricePerSqm) * 100) / 100;
  const roundedProcessing = Math.round(processingFee * 100) / 100;
  const roundedMisc = Math.round(miscFee * 100) / 100;
  const totalPrice = Math.round((materialCost + roundedProcessing + roundedMisc) * 100) / 100;

  return {
    materialCost,
    processingFee: roundedProcessing,
    miscFee: roundedMisc,
    totalPrice,
  };
}
