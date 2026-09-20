import { callCloudFunction } from '../../utils/cloud-adapter';
// @ts-ignore
import Toast, { hideToast } from 'tdesign-miniprogram/toast/index';
// @ts-ignore
import Dialog from 'tdesign-miniprogram/dialog/index';

Page({
  data: {
    stocks: [] as any[],
    displayStocks: [] as any[],
    activeTab: 0,
    materials: ['全部', '白卡纸', '椴木板', '亚克力', '雪弗板']
  },
  onShow() {
    this.loadStocks();
  },
  onChangeTab(e: any) {
    this.setData({ activeTab: e.detail.value });
    this.filterStocks();
  },
  filterStocks() {
    if (this.data.activeTab === 0) {
      this.setData({ displayStocks: this.data.stocks });
    } else {
      const mat = this.data.materials[this.data.activeTab];
      this.setData({ displayStocks: this.data.stocks.filter((s:any) => s.group && s.group.material === mat) });
    }
  },
  async loadStocks() {
    Toast({ context: this, selector: '#t-toast', message: '加载中...', theme: 'loading' });
    try {
      const res: any = await callCloudFunction('listStocks', {});
      hideToast({ context: this, selector: '#t-toast' });
      if (res && res.result && res.result.code === 200) {
        this.setData({ stocks: res.result.data || [] });
        getApp().globalData.stockList = res.result.data || [];
        this.filterStocks();
      } else {
        Toast({ context: this, selector: '#t-toast', message: '加载失败，请重试', theme: 'error' });
      }
    } catch (e: any) {
      hideToast({ context: this, selector: '#t-toast' });
      Toast({ context: this, selector: '#t-toast', message: '加载材料失败：' + (e.message || '网络错误'), theme: 'error' });
    }
  },
  showAddPopup() {
    wx.navigateTo({ url: '/pages/add-stock/add-stock' });
  },
  async deleteStock(e: any) {
    const id = e.currentTarget.dataset.id;
    Dialog.confirm({ title: '确认删除', content: '删除后无法恢复' }).then(async () => {
      Toast({ context: this, selector: '#t-toast', message: '删除中...', theme: 'loading' });
      await callCloudFunction('deleteStock', { stockId: id });
      Toast({ context: this, selector: '#t-toast', message: '已删除', theme: 'success' });
      this.loadStocks();
    }).catch(() => {});
  }
})
