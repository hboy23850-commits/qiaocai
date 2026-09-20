import { callCloudFunction } from '../../utils/cloud-adapter';

Page({
  data: {
    candidates: [] as any[],
    planId: '' as string,
    hasCompleteCandidate: false
  },
  onLoad() {
    const app = getApp();
    if (!app.globalData.planData || !app.globalData.planData.solverOutput) {
      wx.showToast({ title: '未找到方案数据，请重新求解', icon: 'none' });
      return;
    }
    const planData = app.globalData.planData;
    const data = planData.solverOutput;
    const planId = planData.planId || '';
    const stockPrice = app.globalData.stockList?.[0]?.group?.pricePerSqm || 10;
    
    let hasComplete = false;
    const cands = (data.candidates || []).map((c: any) => {
      if (c.isComplete) hasComplete = true;
      const stepsCount = c.metrics?.stepsCount || 0;
      const estimatedSeconds = stepsCount * 5; 
      const mins = Math.floor(estimatedSeconds / 60);
      const secs = estimatedSeconds % 60;
      const timeStr = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
      
      let totalAreaSqm = 0;
      (c.usedStocks || []).forEach((us: any) => {
        // Correct field access: us.width and us.height are stored in 0.1 mm units
        const w = Number(us.width) || 0;
        const h = Number(us.height) || 0;
        totalAreaSqm += (w / 10000) * (h / 10000);
      });

      const cost = (totalAreaSqm * stockPrice).toFixed(2);
      const utilizationRate = Number(c.metrics?.utilizationRate) || 0;
      const wasteCost = (totalAreaSqm * (1 - utilizationRate) * stockPrice).toFixed(2);
      const offcutRate = ((1 - utilizationRate) * 100).toFixed(1);
      const unplacedSummary = Array.isArray(c.unplacedPartIds) ? c.unplacedPartIds.join(', ') : '';
      
      return {
        ...c,
        timeStr,
        cost,
        wasteCost,
        offcutRate,
        unplacedSummary,
        placedPartsCount: Array.isArray(c.placedParts) ? c.placedParts.length : 0,
        metrics: {
          ...c.metrics,
          utilization: Number(utilizationRate.toFixed(4)),
          utilizationPercent: Math.round(utilizationRate * 100)
        }
      };
    });

    this.setData({
      candidates: cands,
      planId,
      hasCompleteCandidate: hasComplete
    });
  },

  async selectCandidate(e: any) {
    const cid = e.currentTarget.dataset.id;
    const cand = this.data.candidates.find((c: any) => c.candidateId === cid);
    if (!cand) {
      wx.showToast({ title: '未找到选中的候选方案', icon: 'none' });
      return;
    }
    if (!cand.isComplete) {
      wx.showToast({ title: '该方案材料不足，无法完整制作', icon: 'none' });
      return;
    }

    const app = getApp();
    const planId = this.data.planId;

    if (planId) {
      wx.showLoading({ title: '确认方案中...' });
      try {
        const res: any = await callCloudFunction('selectPlan', {
          planId,
          candidateId: cid
        });
        wx.hideLoading();
        if (res && res.result && res.result.code !== 200) {
          wx.showToast({ title: res.result.msg || '确认失败', icon: 'none' });
          return;
        }
      } catch (err) {
        wx.hideLoading();
        console.warn('selectPlan call warning:', err);
        wx.showToast({ title: '方案确认失败，请检查网络后重试', icon: 'none' });
        return;
      }
    }

    app.globalData.selectedCandidate = cand;
    app.globalData.selectedCandidateId = cid;
    wx.navigateTo({ url: '/pages/cut-view/cut-view' });
  }
});
