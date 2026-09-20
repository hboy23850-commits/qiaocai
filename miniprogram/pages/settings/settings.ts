// @ts-ignore
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    kerf: 2,
    preferBigOffcut: true
  },
  onLoad() {
    const k = wx.getStorageSync('defaultKerf');
    const p = wx.getStorageSync('preferBigOffcut');
    this.setData({
      kerf: k !== '' ? k : 2,
      preferBigOffcut: p !== '' ? p : true
    });
  },
  updateKerf(e: any) {
    this.setData({ kerf: e.detail.value });
  },
  updatePrefer(e: any) {
    this.setData({ preferBigOffcut: e.detail.value });
  },
  saveSettings() {
    wx.setStorageSync('defaultKerf', this.data.kerf);
    wx.setStorageSync('preferBigOffcut', this.data.preferBigOffcut);
    Toast({ context: this, selector: '#t-toast', message: '已保存到本地', theme: 'success' });
    setTimeout(() => {
      wx.navigateBack();
    }, 1000);
  }
})
