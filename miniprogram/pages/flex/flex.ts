import { callCloudFunction } from '../../utils/cloud-adapter';
// @ts-ignore
import Toast, { hideToast } from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    partGroups: [] as any[],
    selectedFlexibleGroupId: '' as string,
    maxShrinkMm: 0 as number,
    sliderMarks: { 0: '0 mm', 1: '1 mm', 2: '2 mm' } as Record<number, string>
  },

  onLoad() {
    const app = getApp();
    const req = app.globalData.reqContext;
    if (!req || !req.partGroups || req.partGroups.length === 0) {
      Toast({ context: this, selector: '#t-toast', message: '请先填写零件需求', theme: 'error' });
      return;
    }

    const groups = req.partGroups.map((g: any) => ({
      ...g,
      // 默认锁定，除非已明确设置
      isFlexible: Boolean(g.flexibleRange && g.flexibleRange.maxShrinkMm > 0)
    }));

    let selectedId = '';
    let shrink = 0;

    const existingFlexible = groups.find((g: any) => g.isFlexible);
    if (existingFlexible) {
      selectedId = existingFlexible.id;
      shrink = existingFlexible.flexibleRange.maxShrinkMm;
    } else if (req.isDemo && groups.length > 0) {
      // 演示模式默认选中第一个组允许微调 2 mm
      selectedId = groups[0].id;
      shrink = 2;
      groups[0].isFlexible = true;
    }

    this.setData({
      partGroups: groups,
      selectedFlexibleGroupId: selectedId,
      maxShrinkMm: shrink
    });
  },

  selectGroup(e: any) {
    const groupId = e.currentTarget.dataset.id;
    let newSelectedId = groupId;
    let newShrink = this.data.maxShrinkMm != null ? this.data.maxShrinkMm : 1;

    // 如果点击已选中的组，则取消选中并全部锁定
    if (this.data.selectedFlexibleGroupId === groupId) {
      newSelectedId = '';
      newShrink = 0;
    }

    const updatedGroups = this.data.partGroups.map((g: any) => ({
      ...g,
      isFlexible: g.id === newSelectedId
    }));

    this.setData({
      partGroups: updatedGroups,
      selectedFlexibleGroupId: newSelectedId,
      maxShrinkMm: newShrink
    });
  },

  updateShrink(e: any) {
    const val = Number(e.detail.value);
    // 强制严格限制在 0, 1, 2 mm
    const clamped = Math.max(0, Math.min(2, Math.round(val)));
    this.setData({ maxShrinkMm: clamped });
  },

  async solve() {
    const app = getApp();
    const req = app.globalData.reqContext;
    if (!req || !req.partGroups) {
      return Toast({ context: this, selector: '#t-toast', message: '请先填写需求', theme: 'error' });
    }

    const { selectedFlexibleGroupId, maxShrinkMm } = this.data;

    // 严格确保最多仅有一个组开启柔性调整，其余组全部锁定
    let flexibleCount = 0;
    let hasInvalid = false;

    const normalizedPartGroups = req.partGroups.map((g: any) => {
      const isTargetFlexible = g.id === selectedFlexibleGroupId && maxShrinkMm > 0;
      if (isTargetFlexible) {
        flexibleCount++;
        g.flexibleRange = {
          maxShrinkMm: maxShrinkMm as (0 | 1 | 2),
          stepMm: 1
        };
      } else {
        delete g.flexibleRange;
      }

      if (!g.targetWidth || g.targetWidth <= 0 || !g.targetHeight || g.targetHeight <= 0 || !g.quantity || g.quantity <= 0) {
        hasInvalid = true;
      }

      return g;
    });

    if (hasInvalid) {
      return Toast({ context: this, selector: '#t-toast', message: '请检查零件尺寸和数量是否有效', theme: 'error' });
    }

    if (flexibleCount > 1) {
      return Toast({ context: this, selector: '#t-toast', message: '规则约束：最多只允许一个零件组开启尺寸微调', theme: 'error' });
    }

    req.partGroups = normalizedPartGroups;

    Toast({ context: this, selector: '#t-toast', message: '正在计算最优下料排版...', theme: 'loading', duration: 0 });
    
    try {
      const stockIds = app.globalData.stockList ? app.globalData.stockList.map((s: any) => s._id || s.id) : [];
      const res: any = await callCloudFunction('solvePlan', {
        partGroups: req.partGroups,
        kerfMm: req.kerfMm,
        stockIds: stockIds,
        isDemo: req.isDemo
      });

      hideToast({ context: this, selector: '#t-toast' });
      if (res && res.result && res.result.code === 200 && res.result.data) {
        app.globalData.planData = res.result.data;
        wx.navigateTo({ url: '/pages/compare/compare' });
      } else {
        Toast({
          context: this,
          selector: '#t-toast',
          message: res?.result?.msg || '未找到可行方案，请调整输入或材料',
          theme: 'error'
        });
      }
    } catch (err: any) {
      hideToast({ context: this, selector: '#t-toast' });
      Toast({ context: this, selector: '#t-toast', message: err.message || '网络或计算异常', theme: 'error' });
    }
  }
});
