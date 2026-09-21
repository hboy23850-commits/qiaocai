"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_adapter_1 = require("../../utils/cloud-adapter");
// @ts-ignore
const index_1 = __importDefault(require("tdesign-miniprogram/toast/index"));
Page({
    data: {
        stockCount: 0,
        offcutCount: 0,
        isStartingDemo: false,
        agentText: ''
    },
    onShow() {
        this.fetchStats();
    },
    async fetchStats() {
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('listStocks', {});
            if (res && res.result && res.result.code === 200) {
                const stocks = res.result.data || [];
                const offcuts = stocks.filter((s) => Boolean(s.isOffcut));
                this.setData({
                    stockCount: stocks.length,
                    offcutCount: offcuts.length
                });
            }
        }
        catch (e) {
            console.warn('[Index] fetchStats error:', e);
        }
    },
    updateAgentText(e) {
        this.setData({ agentText: e.detail.value });
    },
    navToAgent() {
        const text = String(this.data.agentText || '').trim();
        const query = text ? '?prompt=' + encodeURIComponent(text) : '';
        wx.navigateTo({ url: '/pages/agent/agent' + query });
    },
    startAgentDemo(e) {
        wx.navigateTo({ url: '/pages/agent/agent?demo=' + e.currentTarget.dataset.demo });
    },
    navToRequirement() {
        wx.navigateTo({ url: '/pages/requirement/requirement' });
    },
    navToWorkbench(e) {
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
        if (this.data.isStartingDemo)
            return;
        this.setData({ isStartingDemo: true });
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('prepareDemo', {});
            if (!res || !res.result || res.result.code !== 200) {
                throw new Error(res?.result?.msg || '演示材料准备失败');
            }
            const app = getApp();
            app.globalData.stockList = res.result.data.stocks || [];
            wx.navigateTo({ url: '/pages/requirement/requirement?demo=1' });
        }
        catch (error) {
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: error?.message || '暂时无法开始演示，请稍后重试',
                theme: 'error'
            });
        }
        finally {
            this.setData({ isStartingDemo: false });
        }
    }
});
