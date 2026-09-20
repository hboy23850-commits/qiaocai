import { callCloudFunction } from '../../utils/cloud-adapter';
// @ts-ignore
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    stockCount: 0,
    offcutCount: 0,
    isStartingDemo: false
  },

  onShow() {
    this.fetchStats();
  },

  async fetchStats() {
    try {
      const res: any = await callCloudFunction('listStocks', {});
      if (res && res.result && res.result.code === 200) {
        const stocks = res.result.data || [];
        const offcuts = stocks.filter((s: any) => Boolean(s.isOffcut));
        this.setData({ 
          stockCount: stocks.length,
          offcutCount: offcuts.length
        });
      }
    } catch (e) {
      console.warn('[Index] fetchStats error:', e);
    }
  },

  navToRequirement() {
    wx.navigateTo({ url: '/pages/requirement/requirement' });
  },

  navToWorkbench(e: any) {
    const mode = e?.currentTarget?.dataset?.mode || 'template';
    wx.navigateTo({ url: '/pages/workbench/workbench?mode=' + mode });
  },

  navToStock() {
    wx.navigateTo({ url: '/pages/stock/stock' });
  },

  navToHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  navToSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  async startDemo() {
    if (this.data.isStartingDemo) return;
    this.setData({ isStartingDemo: true });
    try {
      const res: any = await callCloudFunction('prepareDemo', {});
      if (!res || !res.result || res.result.code !== 200) {
        throw new Error(res?.result?.msg || '演示材料准备失败');
      }
      const app = getApp();
      app.globalData.stockList = res.result.data.stocks || [];
      wx.navigateTo({ url: '/pages/requirement/requirement?demo=1' });
    } catch (error: any) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: error?.message || '暂时无法开始演示，请稍后重试',
        theme: 'error'
      });
    } finally {
      this.setData({ isStartingDemo: false });
    }
  }
});
