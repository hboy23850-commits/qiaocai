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
Page({
    data: {
        partGroups: [],
        selectedFlexibleGroupId: '',
        maxShrinkMm: 0,
        sliderMarks: { 0: '0 mm', 1: '1 mm', 2: '2 mm' }
    },
    onLoad() {
        const app = getApp();
        const req = app.globalData.reqContext;
        if (!req || !req.partGroups || req.partGroups.length === 0) {
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '请先填写零件需求', theme: 'error' });
            return;
        }
        const groups = req.partGroups.map((g) => ({
            ...g,
            // 默认锁定，除非已明确设置
            isFlexible: Boolean(g.flexibleRange && g.flexibleRange.maxShrinkMm > 0)
        }));
        let selectedId = '';
        let shrink = 0;
        const existingFlexible = groups.find((g) => g.isFlexible);
        if (existingFlexible) {
            selectedId = existingFlexible.id;
            shrink = existingFlexible.flexibleRange.maxShrinkMm;
        }
        else if (req.isDemo && groups.length > 0) {
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
    selectGroup(e) {
        const groupId = e.currentTarget.dataset.id;
        let newSelectedId = groupId;
        let newShrink = this.data.maxShrinkMm != null ? this.data.maxShrinkMm : 1;
        // 如果点击已选中的组，则取消选中并全部锁定
        if (this.data.selectedFlexibleGroupId === groupId) {
            newSelectedId = '';
            newShrink = 0;
        }
        const updatedGroups = this.data.partGroups.map((g) => ({
            ...g,
            isFlexible: g.id === newSelectedId
        }));
        this.setData({
            partGroups: updatedGroups,
            selectedFlexibleGroupId: newSelectedId,
            maxShrinkMm: newShrink
        });
    },
    updateShrink(e) {
        const val = Number(e.detail.value);
        // 强制严格限制在 0, 1, 2 mm
        const clamped = Math.max(0, Math.min(2, Math.round(val)));
        this.setData({ maxShrinkMm: clamped });
    },
    async solve() {
        const app = getApp();
        const req = app.globalData.reqContext;
        if (!req || !req.partGroups) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: '请先填写需求', theme: 'error' });
        }
        const { selectedFlexibleGroupId, maxShrinkMm } = this.data;
        // 严格确保最多仅有一个组开启柔性调整，其余组全部锁定
        let flexibleCount = 0;
        let hasInvalid = false;
        const normalizedPartGroups = req.partGroups.map((g) => {
            const isTargetFlexible = g.id === selectedFlexibleGroupId && maxShrinkMm > 0;
            if (isTargetFlexible) {
                flexibleCount++;
                g.flexibleRange = {
                    maxShrinkMm: maxShrinkMm,
                    stepMm: 1
                };
            }
            else {
                delete g.flexibleRange;
            }
            if (!g.targetWidth || g.targetWidth <= 0 || !g.targetHeight || g.targetHeight <= 0 || !g.quantity || g.quantity <= 0) {
                hasInvalid = true;
            }
            return g;
        });
        if (hasInvalid) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: '请检查零件尺寸和数量是否有效', theme: 'error' });
        }
        if (flexibleCount > 1) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: '规则约束：最多只允许一个零件组开启尺寸微调', theme: 'error' });
        }
        req.partGroups = normalizedPartGroups;
        (0, index_1.default)({ context: this, selector: '#t-toast', message: '正在计算最优下料排版...', theme: 'loading', duration: 0 });
        try {
            const stockIds = app.globalData.stockList ? app.globalData.stockList.map((s) => s._id || s.id) : [];
            const res = await (0, cloud_adapter_1.callCloudFunction)('solvePlan', {
                partGroups: req.partGroups,
                kerfMm: req.kerfMm,
                stockIds: stockIds,
                isDemo: req.isDemo
            });
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            if (res && res.result && res.result.code === 200 && res.result.data) {
                app.globalData.planData = res.result.data;
                wx.navigateTo({ url: '/pages/compare/compare' });
            }
            else {
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: res?.result?.msg || '未找到可行方案，请调整输入或材料',
                    theme: 'error'
                });
            }
        }
        catch (err) {
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: err.message || '网络或计算异常', theme: 'error' });
        }
    }
});
