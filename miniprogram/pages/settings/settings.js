"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const index_1 = __importDefault(require("tdesign-miniprogram/toast/index"));
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
    updateKerf(e) {
        this.setData({ kerf: e.detail.value });
    },
    updatePrefer(e) {
        this.setData({ preferBigOffcut: e.detail.value });
    },
    saveSettings() {
        wx.setStorageSync('defaultKerf', this.data.kerf);
        wx.setStorageSync('preferBigOffcut', this.data.preferBigOffcut);
        (0, index_1.default)({ context: this, selector: '#t-toast', message: '已保存到本地', theme: 'success' });
        setTimeout(() => {
            wx.navigateBack();
        }, 1000);
    }
});
