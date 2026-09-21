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
        isDemo: false,
        aiText: '',
        kerfMm: 2,
        isParsing: false,
        activeProjectId: '',
        projectName: '',
        saveState: '',
        partGroups: [
            {
                id: 'g1',
                name: '展签A',
                targetWidth: 1050, // 105.0 mm
                targetHeight: 700, // 70.0 mm
                quantity: 8,
                allowRotation: false
            }
        ]
    },
    onLoad(options) {
        const defaultK = wx.getStorageSync('defaultKerf');
        if (defaultK !== '' && !isNaN(parseFloat(defaultK))) {
            this.setData({ kerfMm: parseFloat(defaultK) });
        }
        const app = getApp();
        if (options.agentDraft && app.globalData.agentDraft?.partGroups?.length) {
            const draft = app.globalData.agentDraft;
            const groups = draft.partGroups.map((group) => {
                const clean = { ...group };
                delete clean.widthMm;
                delete clean.heightMm;
                delete clean.shrinkMm;
                return clean;
            });
            this.setData({ kerfMm: draft.kerfMm, partGroups: groups });
            wx.setNavigationBarTitle({ title: '人工核对智能体草稿' });
            return;
        }
        if (options.demo) {
            this.setData({
                isDemo: true,
                kerfMm: 2,
                partGroups: [
                    {
                        id: 'g1',
                        name: '社团展签 (8个)',
                        targetWidth: 1050, // 105.0 mm
                        targetHeight: 700, // 70.0 mm
                        quantity: 8,
                        allowRotation: false // 演示案例明确禁止旋转
                    }
                ]
            });
            wx.setNavigationBarTitle({ title: 'A4 校园展签演示' });
            return;
        }
        const project = app.globalData && app.globalData.activeProject;
        if (options.project && project) {
            this.setData({
                activeProjectId: project._id || project.id || '',
                projectName: project.name || '未命名工程',
                kerfMm: project.settings?.kerfMm ?? this.data.kerfMm,
                partGroups: Array.isArray(project.partGroups) ? project.partGroups : [],
                saveState: '已载入云端工程',
            });
            wx.setNavigationBarTitle({ title: project.name || '巧裁工程' });
        }
    },
    onShow() {
        const app = getApp();
        if (app.globalData && app.globalData.customPartGroups && app.globalData.customPartGroups.length > 0) {
            const added = app.globalData.customPartGroups;
            app.globalData.customPartGroups = [];
            this.setData({ partGroups: [...this.data.partGroups, ...added] }, () => this.scheduleProjectSave());
            (0, index_1.default)({ context: this, selector: '#t-toast', message: `已从工作台添加 ${added.length} 个异形零件`, theme: 'success' });
        }
    },
    navToWorkbench() {
        wx.navigateTo({ url: '/pages/workbench/workbench' });
    },
    updateAiText(e) {
        this.setData({ aiText: e.detail.value });
    },
    updateKerf(e) {
        const val = parseFloat(e.detail.value);
        this.setData({ kerfMm: isNaN(val) ? 0 : Math.max(0, Math.min(5, val)) }, () => this.scheduleProjectSave());
    },
    // --- 规则辅助文本解析 ---
    async parseAi() {
        if (!this.data.aiText.trim()) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: '请先输入制作需求描述', theme: 'error' });
        }
        this.setData({ isParsing: true });
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('parseRequirements', { text: this.data.aiText });
            this.setData({ isParsing: false });
            if (res && res.result && res.result.code === 200 && res.result.data.draftGroups?.length > 0) {
                const newGroups = res.result.data.draftGroups.map((g) => ({
                    ...g,
                    allowRotation: false // 默认关闭旋转
                }));
                this.setData({ partGroups: newGroups }, () => this.scheduleProjectSave());
                (0, index_1.default)({ context: this, selector: '#t-toast', message: '已提取零件尺寸，请核对', theme: 'success' });
            }
            else {
                (0, index_1.default)({ context: this, selector: '#t-toast', message: '未匹配到明确的规格数量（例：8张105x70）', theme: 'warning' });
            }
        }
        catch (e) {
            this.setData({ isParsing: false });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '解析服务暂时不可用', theme: 'error' });
        }
    },
    addGroup() {
        const nextIdx = this.data.partGroups.length + 1;
        const newGroup = {
            id: 'g_' + Date.now().toString().slice(-4),
            name: '零件' + nextIdx,
            targetWidth: 1000,
            targetHeight: 500,
            quantity: 1,
            allowRotation: false
        };
        this.setData({ partGroups: [...this.data.partGroups, newGroup] }, () => this.scheduleProjectSave());
    },
    removeGroup(e) {
        const idx = e.currentTarget.dataset.index;
        const list = [...this.data.partGroups];
        list.splice(idx, 1);
        this.setData({ partGroups: list }, () => this.scheduleProjectSave());
    },
    updateName(e) {
        const idx = e.currentTarget.dataset.index;
        this.setData({ [`partGroups[${idx}].name`]: e.detail.value }, () => this.scheduleProjectSave());
    },
    updateWidth(e) {
        const idx = e.currentTarget.dataset.index;
        const valMm = parseFloat(e.detail.value);
        const scaled = isNaN(valMm) ? 0 : Math.round(valMm * 10);
        this.setData({ [`partGroups[${idx}].targetWidth`]: scaled }, () => this.scheduleProjectSave());
    },
    updateHeight(e) {
        const idx = e.currentTarget.dataset.index;
        const valMm = parseFloat(e.detail.value);
        const scaled = isNaN(valMm) ? 0 : Math.round(valMm * 10);
        this.setData({ [`partGroups[${idx}].targetHeight`]: scaled }, () => this.scheduleProjectSave());
    },
    updateQty(e) {
        const idx = e.currentTarget.dataset.index;
        this.setData({ [`partGroups[${idx}].quantity`]: parseInt(e.detail.value, 10) || 1 }, () => this.scheduleProjectSave());
    },
    toggleRotation(e) {
        const idx = e.currentTarget.dataset.index;
        this.setData({ [`partGroups[${idx}].allowRotation`]: e.detail.value }, () => this.scheduleProjectSave());
    },
    saveTimer: null,
    scheduleProjectSave() {
        if (!this.data.activeProjectId || this.data.isDemo)
            return;
        this.setData({ saveState: '正在自动保存…' });
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.saveActiveProject(true), 800);
    },
    async saveActiveProject(silentOrEvent = false) {
        const silent = silentOrEvent === true;
        if (!this.data.activeProjectId || this.data.isDemo)
            return true;
        try {
            const response = await (0, cloud_adapter_1.callCloudFunction)('saveProject', {
                projectId: this.data.activeProjectId,
                name: this.data.projectName,
                partGroups: this.data.partGroups,
                settings: { kerfMm: this.data.kerfMm },
            });
            if (!response?.result || response.result.code !== 200) {
                throw new Error(response?.result?.msg || '云端保存失败');
            }
            const app = getApp();
            app.globalData.activeProject = {
                ...(app.globalData.activeProject || {}),
                _id: this.data.activeProjectId,
                name: this.data.projectName,
                partGroups: this.data.partGroups,
                settings: { kerfMm: this.data.kerfMm },
            };
            wx.setStorageSync(`project_draft_${this.data.activeProjectId}`, app.globalData.activeProject);
            this.setData({ saveState: '已自动保存到云端' });
            if (!silent)
                (0, index_1.default)({ context: this, selector: '#t-toast', message: '工程已保存', theme: 'success' });
            return true;
        }
        catch (error) {
            wx.setStorageSync(`project_draft_${this.data.activeProjectId}`, {
                _id: this.data.activeProjectId,
                name: this.data.projectName,
                partGroups: this.data.partGroups,
                settings: { kerfMm: this.data.kerfMm },
            });
            this.setData({ saveState: '云端不可用，草稿已保存在本机' });
            if (!silent)
                (0, index_1.default)({ context: this, selector: '#t-toast', message: error.message || '云端保存失败', theme: 'error' });
            return false;
        }
    },
    onHide() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        this.saveActiveProject(true);
    },
    async navToFlex() {
        let hasInvalid = false;
        let totalQty = 0;
        this.data.partGroups.forEach(g => {
            if (!g.targetWidth || g.targetWidth <= 0 || !g.targetHeight || g.targetHeight <= 0 || !g.quantity || g.quantity <= 0) {
                hasInvalid = true;
            }
            totalQty += g.quantity;
        });
        if (totalQty === 0) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: '请先添加至少一个零件', theme: 'error' });
        }
        if (hasInvalid) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: '请检查零件长、宽、数量是否为正数', theme: 'error' });
        }
        if (totalQty > 20) {
            return (0, index_1.default)({ context: this, selector: '#t-toast', message: `单次任务最多支持 20 个零件 (当前: ${totalQty})`, theme: 'error' });
        }
        const app = getApp();
        app.globalData.reqContext = {
            isDemo: this.data.isDemo,
            kerfMm: this.data.kerfMm,
            partGroups: this.data.partGroups
        };
        await this.saveActiveProject(true);
        wx.navigateTo({ url: '/pages/flex/flex' });
    }
});
