import { callCloudFunction } from '../../utils/cloud-adapter';
// @ts-ignore
import Toast, { hideToast } from 'tdesign-miniprogram/toast/index';

const DEMOS: Record<string, string> = {
  a4: '我有 A4 卡纸，要做 8 张 105×70 mm 的校园展签，不旋转，间距 2 mm，尺寸必须保持精确。',
  kt: '我要用 400×200 mm、厚 3 mm 的 KT 板制作 6 片约 120×25 mm 的机翼肋片。我会用拍照识别纸样并点绘校正，请先帮我检查还缺什么条件。'
};

function statusStage(status: string) {
  if (status === 'AWAITING_CONFIRMATION' || status === 'SOLVED') return 4;
  if (status === 'NEEDS_INPUT' || status === 'DEGRADED') return 1;
  return 0;
}

function decorateDraft(draft: any) {
  if (!draft) return null;
  return {
    ...draft,
    partGroups: (draft.partGroups || []).map((group: any) => ({
      ...group,
      widthMm: Number(group.targetWidth || 0) / 10,
      heightMm: Number(group.targetHeight || 0) / 10,
      shrinkMm: Number(group.flexibleRange?.maxShrinkMm || 0)
    }))
  };
}

Page({
  data: {
    sessionId: '',
    inputText: '',
    status: '',
    assistantMessage: '请描述你要制作的物品、数量、尺寸和手边材料。我会逐项核对，再调用确定性排料算法。',
    messages: [] as any[],
    draft: null as any,
    candidateSummary: [] as any[],
    toolRuns: [] as any[],
    model: null as any,
    stageIndex: 0,
    isSending: false,
    isConfirming: false,
    isSimulated: false,
    isDegraded: false,
    canConfirm: false
  },

  onLoad(options: any) {
    const prompt = options.prompt ? decodeURIComponent(options.prompt) : (DEMOS[options.demo] || '');
    if (prompt) this.setData({ inputText: prompt });
  },

  updateInput(e: any) {
    this.setData({ inputText: e.detail.value });
  },

  async sendMessage() {
    const message = String(this.data.inputText || '').trim();
    if (!message || this.data.isSending) return;
    if (message.length > 1000) {
      return Toast({ context: this, selector: '#t-toast', message: '单次输入不能超过 1000 字', theme: 'error' });
    }
    const previous = this.data.messages;
    this.setData({ isSending: true, inputText: '', messages: [...previous, { role: 'user', content: message }] });
    try {
      const response: any = await callCloudFunction('agentTurn', {
        sessionId: this.data.sessionId || undefined,
        message,
        reset: !this.data.sessionId
      });
      const result = response?.result;
      if (!result || result.code !== 200) throw new Error(result?.msg || '智能体暂时不可用');
      const data = result.data;
      const safeCandidates = (data.candidateSummary || []).filter((item: any) => item.validationPassed).map((item: any) => ({
        ...item,
        utilization: (Number(item.utilization || 0) * 100).toFixed(1),
        wasteRate: (Number(item.wasteRate || 0) * 100).toFixed(1)
      }));
      this.setData({
        sessionId: data.sessionId,
        status: data.status,
        assistantMessage: data.assistantMessage,
        messages: [...previous, { role: 'user', content: message }, { role: 'assistant', content: data.assistantMessage }],
        draft: decorateDraft(data.draft),
        candidateSummary: safeCandidates,
        toolRuns: data.toolRuns || [],
        model: data.model || null,
        stageIndex: statusStage(data.status),
        isSimulated: Boolean(data.model?.simulated),
        isDegraded: data.status === 'DEGRADED',
        canConfirm: data.status === 'AWAITING_CONFIRMATION' && safeCandidates.length > 0
      });
    } catch (error: any) {
      Toast({ context: this, selector: '#t-toast', message: error?.message || '请求失败，请稍后重试', theme: 'error' });
    } finally {
      this.setData({ isSending: false });
    }
  },

  useDemo(e: any) {
    const key = e.currentTarget.dataset.demo;
    this.setData({ inputText: DEMOS[key] || '' });
  },

  async openManualEntry() {
    const app = getApp();
    if (this.data.draft?.partGroups?.length) app.globalData.agentDraft = this.data.draft;
    if (!app.globalData.stockList || !app.globalData.stockList.length) {
      try {
        const stocksRes: any = await callCloudFunction('listStocks', {});
        if (stocksRes?.result?.code === 200 && Array.isArray(stocksRes?.result?.data)) {
          app.globalData.stockList = stocksRes.result.data;
        }
      } catch (_) {}
    }
    wx.navigateTo({ url: '/pages/requirement/requirement?agentDraft=1' });
  },

  async confirmAndSolve() {
    if (!this.data.canConfirm || !this.data.draft || this.data.isConfirming) return;
    this.setData({ isConfirming: true });
    Toast({ context: this, selector: '#t-toast', message: '正在重新核验材料并正式求解…', theme: 'loading', duration: 0 });
    try {
      const stocksResponse: any = await callCloudFunction('listStocks', {});
      const stocks = stocksResponse?.result?.data || [];
      const availableIds = new Set(stocks.map((stock: any) => stock._id || stock.id));
      const stockIds = this.data.draft.stockIds || [];
      if (!stockIds.length || stockIds.some((id: string) => !availableIds.has(id))) throw new Error('材料库存已变化，请重新让智能体计算');
      const solveResponse: any = await callCloudFunction('solvePlan', {
        partGroups: this.data.draft.partGroups.map((group: any) => {
          const clean = { ...group };
          delete clean.widthMm;
          delete clean.heightMm;
          delete clean.shrinkMm;
          return clean;
        }),
        kerfMm: this.data.draft.kerfMm,
        stockIds,
        isDemo: false
      });
      const result = solveResponse?.result;
      if (!result || result.code !== 200 || !result.data) throw new Error(result?.msg || '正式求解失败');
      const app = getApp();
      app.globalData.stockList = stocks.filter((stock: any) => stockIds.includes(stock._id || stock.id));
      app.globalData.planData = result.data;
      app.globalData.agentDraft = null;
      hideToast({ context: this, selector: '#t-toast' });
      wx.navigateTo({ url: '/pages/compare/compare?fromAgent=1' });
    } catch (error: any) {
      hideToast({ context: this, selector: '#t-toast' });
      Toast({ context: this, selector: '#t-toast', message: error?.message || '正式求解失败', theme: 'error' });
    } finally {
      this.setData({ isConfirming: false });
    }
  }
});
