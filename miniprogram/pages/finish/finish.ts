import { callCloudFunction } from '../../utils/cloud-adapter';
// @ts-ignore
import Toast, { hideToast } from 'tdesign-miniprogram/toast/index';
// @ts-ignore
import Dialog from 'tdesign-miniprogram/dialog/index';

Page({
  data: {
    planId: '',
    candidateId: '',
    usedStocksCount: 0,
    partsList: [] as any[],
    utilizationDisplay: '',
    offcutItems: [] as any[],
    idempotencyKey: '',
    isCommitting: false
  },

  onLoad() {
    const app = getApp();
    const candidate = app.globalData?.selectedCandidate;
    const planData = app.globalData?.planData;

    if (!candidate || !candidate.usedStocks) {
      Toast({ context: this, selector: '#t-toast', message: '未找到方案数据，请返回重新计算', theme: 'error' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    const planId = planData?.planId || 'plan_local_' + Date.now();
    const candidateId = candidate.candidateId;

    // 稳定幂等键：同一次结案页面会话复用同一个键，网络重试不更换
    const idempotencyKey = `idemp_${planId}_${candidateId}`;

    const parts = (candidate.usedStocks || []).flatMap((s: any) => s.placedParts || []);
    const rate = candidate.metrics?.utilizationRate;
    const utilizationDisplay = typeof rate === 'number' ? (rate * 100).toFixed(1) + '%' : '已完成';

    // 提取算法预测的潜在余料区域
    const offcuts: any[] = [];
    (candidate.usedStocks || []).forEach((us: any, sIdx: number) => {
      (us.remainingOffcuts || []).forEach((r: any, rIdx: number) => {
        // 仅提示长宽均在20mm以上的显著可用区域供用户选择性保留
        const minEdge = Math.min(r.width, r.height);
        const area = r.width * r.height;
        const isSignificant = minEdge >= 200 && area >= 100000;

        offcuts.push({
          id: `offcut_${sIdx}_${rIdx}`,
          sourceStockId: us.stockId,
          predictedOffcutIndex: rIdx,
          predictedWidth: r.width,
          predictedHeight: r.height,
          retained: isSignificant, // 建议保留显著区域，但实测值留空让用户填
          measuredWidthMm: '',
          measuredHeightMm: '',
          widthError: '',
          heightError: ''
        });
      });
    });

    this.setData({
      planId,
      candidateId,
      usedStocksCount: candidate.usedStocks.length,
      partsList: parts,
      utilizationDisplay,
      offcutItems: offcuts,
      idempotencyKey,
      isCommitting: false
    });
  },

  onToggleRetain(e: any) {
    const idx = e.currentTarget.dataset.index;
    const checked = Boolean(e.detail.value);
    this.setData({
      [`offcutItems[${idx}].retained`]: checked,
      [`offcutItems[${idx}].widthError`]: '',
      [`offcutItems[${idx}].heightError`]: ''
    });
  },

  onMeasuredWidthChange(e: any) {
    const idx = e.currentTarget.dataset.index;
    const valStr = e.detail.value;
    const item = this.data.offcutItems[idx];
    const val = parseFloat(valStr);

    let error = '';
    if (valStr.trim() !== '') {
      if (isNaN(val) || val <= 0) {
        error = '必须为正数';
      } else {
        const scaledVal = Math.round(val * 10);
        const maxDim = Math.max(item.predictedWidth, item.predictedHeight);
        if (scaledVal > maxDim) {
          error = `不可超过预测可用范围上限 (${maxDim / 10} mm)`;
        }
      }
    }

    this.setData({
      [`offcutItems[${idx}].measuredWidthMm`]: valStr,
      [`offcutItems[${idx}].widthError`]: error
    });
  },

  onMeasuredHeightChange(e: any) {
    const idx = e.currentTarget.dataset.index;
    const valStr = e.detail.value;
    const item = this.data.offcutItems[idx];
    const val = parseFloat(valStr);

    let error = '';
    if (valStr.trim() !== '') {
      if (isNaN(val) || val <= 0) {
        error = '必须为正数';
      } else {
        const scaledVal = Math.round(val * 10);
        const maxDim = Math.max(item.predictedWidth, item.predictedHeight);
        if (scaledVal > maxDim) {
          error = `不可超过预测可用范围上限 (${maxDim / 10} mm)`;
        }
      }
    }

    this.setData({
      [`offcutItems[${idx}].measuredHeightMm`]: valStr,
      [`offcutItems[${idx}].heightError`]: error
    });
  },

  async commit() {
    if (this.data.isCommitting) return;

    const { offcutItems, planId, candidateId, idempotencyKey } = this.data;

    // 校验所有勾选保留的余料实测尺寸
    const actualOffcuts: any[] = [];
    let hasError = false;

    for (let i = 0; i < offcutItems.length; i++) {
      const item = offcutItems[i];
      if (!item.retained) continue;

      const w = parseFloat(item.measuredWidthMm);
      const h = parseFloat(item.measuredHeightMm);

      if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
        this.setData({
          [`offcutItems[${i}].widthError`]: isNaN(w) || w <= 0 ? '请填写实际测量长' : '',
          [`offcutItems[${i}].heightError`]: isNaN(h) || h <= 0 ? '请填写实际测量宽' : ''
        });
        hasError = true;
        continue;
      }

      const wScaled = Math.round(w * 10);
      const hScaled = Math.round(h * 10);

      // 核验是否在预测区域矩形内 (允许旋转对比)
      const fitsNormal = wScaled <= item.predictedWidth && hScaled <= item.predictedHeight;
      const fitsRotated = wScaled <= item.predictedHeight && hScaled <= item.predictedWidth;

      if (!fitsNormal && !fitsRotated) {
        this.setData({
          [`offcutItems[${i}].widthError`]: '实测尺寸超出对应预测区域',
          [`offcutItems[${i}].heightError`]: '请核对实际测量数据'
        });
        hasError = true;
        continue;
      }

      actualOffcuts.push({
        sourceStockId: item.sourceStockId,
        predictedOffcutIndex: item.predictedOffcutIndex,
        width: wScaled,
        height: hScaled
      });
    }

    if (hasError) {
      return Toast({ context: this, selector: '#t-toast', message: '请检查余料实测数据是否填写完整并符合范围', theme: 'error' });
    }

    this.setData({ isCommitting: true });
    Toast({ context: this, selector: '#t-toast', message: '正在提交结案并更新材料库...', theme: 'loading', duration: 0 });

    try {
      const res: any = await callCloudFunction('commitExecution', {
        planId,
        candidateId,
        actualOffcuts,
        idempotencyKey
      });

      hideToast({ context: this, selector: '#t-toast' });
      this.setData({ isCommitting: false });

      if (res && res.result && res.result.code === 200) {
        const offcutMsg = actualOffcuts.length > 0 ? `已登记 ${actualOffcuts.length} 块实测余料入库` : '无保留余料';
        Dialog.alert({
          title: '制作完成并已结案',
          content: `材料已正确扣减，${offcutMsg}，可直接用于下一次手工任务！`,
          confirmBtn: '返回首页'
        }).then(() => {
          wx.reLaunch({ url: '/pages/index/index' });
        });
      } else {
        Toast({
          context: this,
          selector: '#t-toast',
          message: res?.result?.message || '结案提交失败，请重试',
          theme: 'error'
        });
      }
    } catch (e: any) {
      hideToast({ context: this, selector: '#t-toast' });
      this.setData({ isCommitting: false });
      Toast({ context: this, selector: '#t-toast', message: e.message || '网络连接异常，未扣减库存', theme: 'error' });
    }
  }
});
