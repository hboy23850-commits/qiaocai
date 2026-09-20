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
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_adapter_1 = require("../../utils/cloud-adapter");
// @ts-ignore
const index_1 = __importStar(require("tdesign-miniprogram/toast/index"));
const PRESET_TEMPLATES = [
    { name: 'A4 卡纸', mat: '卡纸', thick: 0.3, color: '白色', w: 297, h: 210, price: 1 },
    { name: 'A3 卡纸', mat: '卡纸', thick: 0.3, color: '白色', w: 420, h: 297, price: 2 },
    { name: '瓦楞纸箱板', mat: '瓦楞纸', thick: 3, color: '牛皮色', w: 600, h: 400, price: 5 },
    { name: '高密泡沫板', mat: '泡沫板', thick: 5, color: '白色', w: 500, h: 500, price: 8 },
    { name: '标准椴木整板', mat: '木板', thick: 3, color: '原木色', w: 2440, h: 1220, price: 45 },
    { name: '透明亚克力', mat: '亚克力', thick: 2, color: '透明', w: 1000, h: 1000, price: 30 },
];
Page({
    data: {
        material: '木板',
        thickness: 3,
        color: '原木色',
        width: 2440,
        height: 1220,
        price: 45,
        qty: 1,
        safetyMarginMm: 2,
        // 常用材料模板
        presets: PRESET_TEMPLATES,
        materialOptions: ['卡纸', '瓦楞纸', '泡沫板', '木板', '亚克力', '自定义'],
        // 禁排/破损区
        hasDefect: false,
        defectX: 0,
        defectY: 0,
        defectW: 100,
        defectH: 100,
    },
    applyPreset(e) {
        const idx = Number(e.currentTarget.dataset.idx);
        const p = PRESET_TEMPLATES[idx];
        if (p) {
            this.setData({
                material: p.mat,
                thickness: p.thick,
                color: p.color,
                width: p.w,
                height: p.h,
                price: p.price,
            });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: `已应用: ${p.name}`, theme: 'success' });
        }
    },
    selectMaterial(e) {
        const mat = e.currentTarget.dataset.mat;
        this.setData({ material: mat });
    },
    updateMat(e) { this.setData({ material: e.detail.value }); },
    updateThick(e) { this.setData({ thickness: parseFloat(e.detail.value) || 0 }); },
    updateColor(e) { this.setData({ color: e.detail.value }); },
    updateW(e) { this.setData({ width: parseFloat(e.detail.value) || 0 }); },
    updateH(e) { this.setData({ height: parseFloat(e.detail.value) || 0 }); },
    updatePrice(e) { this.setData({ price: parseFloat(e.detail.value) || 0 }); },
    updateQty(e) { this.setData({ qty: parseInt(e.detail.value) || 1 }); },
    updateSafetyMargin(e) { this.setData({ safetyMarginMm: parseFloat(e.detail.value) || 0 }); },
    toggleDefect(e) { this.setData({ hasDefect: e.detail.value }); },
    updateDefectX(e) { this.setData({ defectX: parseFloat(e.detail.value) || 0 }); },
    updateDefectY(e) { this.setData({ defectY: parseFloat(e.detail.value) || 0 }); },
    updateDefectW(e) { this.setData({ defectW: parseFloat(e.detail.value) || 0 }); },
    updateDefectH(e) { this.setData({ defectH: parseFloat(e.detail.value) || 0 }); },
    async submit() {
        if (this.data.width <= 0 || this.data.height <= 0) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: '请输入正确的板材长宽尺寸' });
        }
        (0, index_1.default)({ context: this, selector: '#t-toast', message: '材料入库中...', theme: 'loading' });
        const defects = [];
        if (this.data.hasDefect && this.data.defectW > 0 && this.data.defectH > 0) {
            defects.push({
                x: Math.round(this.data.defectX * 10),
                y: Math.round(this.data.defectY * 10),
                width: Math.round(this.data.defectW * 10),
                height: Math.round(this.data.defectH * 10),
            });
        }
        const stocks = [];
        for (let i = 0; i < this.data.qty; i++) {
            stocks.push({
                code: 'STD-' + Date.now().toString().slice(-6) + i,
                group: {
                    material: this.data.material,
                    thicknessMm: this.data.thickness,
                    color: this.data.color,
                    pricePerSqm: this.data.price
                },
                width: Math.round(this.data.width * 10), // internal is 0.1mm
                height: Math.round(this.data.height * 10),
                isOffcut: false,
                status: 'AVAILABLE',
                defects: defects.length > 0 ? defects : undefined,
            });
        }
        const res = await (0, cloud_adapter_1.callCloudFunction)('saveStocks', { stocks });
        (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
        if (res.result && res.result.code === 200) {
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '材料入库成功', theme: 'success' });
            setTimeout(() => wx.navigateBack(), 800);
        }
        else {
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '入库失败，请重试', theme: 'error' });
        }
    }
});
