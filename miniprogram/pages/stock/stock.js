"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_adapter_1 = require("../../utils/cloud-adapter");
// @ts-ignore
const index_1 = __importStar(require("tdesign-miniprogram/toast/index"));
// @ts-ignore
const index_2 = __importDefault(require("tdesign-miniprogram/dialog/index"));
Page({
    data: {
        stocks: [],
        displayStocks: [],
        activeTab: 0,
        materials: ['全部', '白卡纸', '椴木板', '亚克力', '雪弗板']
    },
    onShow() {
        this.loadStocks();
    },
    onChangeTab(e) {
        this.setData({ activeTab: e.detail.value });
        this.filterStocks();
    },
    filterStocks() {
        if (this.data.activeTab === 0) {
            this.setData({ displayStocks: this.data.stocks });
        }
        else {
            const mat = this.data.materials[this.data.activeTab];
            this.setData({ displayStocks: this.data.stocks.filter((s) => s.group && s.group.material === mat) });
        }
    },
    async loadStocks() {
        (0, index_1.default)({ context: this, selector: '#t-toast', message: '加载中...', theme: 'loading' });
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('listStocks', {});
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            if (res && res.result && res.result.code === 200) {
                this.setData({ stocks: res.result.data || [] });
                getApp().globalData.stockList = res.result.data || [];
                this.filterStocks();
            }
            else {
                (0, index_1.default)({ context: this, selector: '#t-toast', message: '加载失败，请重试', theme: 'error' });
            }
        }
        catch (e) {
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '加载材料失败：' + (e.message || '网络错误'), theme: 'error' });
        }
    },
    showAddPopup() {
        wx.navigateTo({ url: '/pages/add-stock/add-stock' });
    },
    async deleteStock(e) {
        const id = e.currentTarget.dataset.id;
        index_2.default.confirm({ title: '确认删除', content: '删除后无法恢复' }).then(async () => {
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '删除中...', theme: 'loading' });
            await (0, cloud_adapter_1.callCloudFunction)('deleteStock', { stockId: id });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '已删除', theme: 'success' });
            this.loadStocks();
        }).catch(() => { });
    }
});
