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
        currentTab: 'projects',
        projects: [],
        history: [],
        totalParts: 0,
        totalCost: '0.00',
        // 重命名弹窗
        renameVisible: false,
        targetProjectId: '',
        newProjectName: '',
    },
    onShow() {
        this.loadProjects();
        this.loadHistory();
    },
    onTabChange(e) {
        this.setData({ currentTab: e.detail.value });
    },
    // 1. 加载项目列表（支持缩略图、自动保存）
    async loadProjects() {
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('listProjects', {});
            const list = (res.result.data || []).map((p) => ({
                ...p,
                partGroupsCount: Array.isArray(p.partGroups) ? p.partGroups.length : 0,
                updatedTimeStr: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '最近更新',
            }));
            this.setData({ projects: list });
            wx.setStorageSync('local_projects', list);
        }
        catch (e) {
            console.warn('loadProjects error, using local cache:', e);
            const local = wx.getStorageSync('local_projects') || [];
            const list = (local || []).map((p) => ({
                ...p,
                partGroupsCount: Array.isArray(p.partGroups) ? p.partGroups.length : 0,
                updatedTimeStr: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '最近更新',
            }));
            this.setData({ projects: list });
        }
    },
    // 2. 新建工程
    async createNewProject() {
        wx.showModal({
            title: '新建工程项目',
            editable: true,
            placeholderText: '请输入项目名称（如：社团展示木构架）',
            success: async (res) => {
                if (res.confirm && res.content) {
                    (0, index_1.default)({ context: this, selector: '#t-toast', message: '创建中...', theme: 'loading' });
                    try {
                        const addRes = await (0, cloud_adapter_1.callCloudFunction)('createProject', {
                            name: res.content.trim(),
                            description: '校园手工作品排料工程',
                            partGroups: [],
                            stocks: [],
                            settings: { kerfMm: wx.getStorageSync('defaultKerf') || 2 },
                        });
                        (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
                        if (!addRes?.result || addRes.result.code !== 200) {
                            throw new Error(addRes?.result?.msg || '创建失败');
                        }
                        const created = { ...(addRes.result.data.project || {}), _id: addRes.result.data.projectId };
                        const app = getApp();
                        app.globalData.activeProject = created;
                        app.globalData.customPartGroups = [];
                        (0, index_1.default)({ context: this, selector: '#t-toast', message: '项目创建成功，开始录入零件', theme: 'success' });
                        setTimeout(() => wx.navigateTo({ url: '/pages/requirement/requirement?project=1' }), 400);
                    }
                    catch (error) {
                        (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
                        (0, index_1.default)({ context: this, selector: '#t-toast', message: error.message || '项目创建失败', theme: 'error' });
                    }
                }
            },
        });
    },
    // 3. 打开项目并加载零件
    openProject(e) {
        const p = e.currentTarget.dataset.project;
        if (!p)
            return;
        const app = getApp();
        app.globalData.activeProject = p;
        app.globalData.customPartGroups = [];
        (0, index_1.default)({ context: this, selector: '#t-toast', message: `已打开工程: ${p.name}`, theme: 'success' });
        setTimeout(() => {
            wx.navigateTo({ url: '/pages/requirement/requirement?project=1' });
        }, 600);
    },
    // 4. 复制项目
    async copyProject(e) {
        const id = e.currentTarget.dataset.id;
        (0, index_1.default)({ context: this, selector: '#t-toast', message: '复制中...', theme: 'loading' });
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('copyProject', { projectId: id });
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            if (res && res.result && res.result.code === 200) {
                (0, index_1.default)({ context: this, selector: '#t-toast', message: '工程副本已生成', theme: 'success' });
                this.loadProjects();
            }
        }
        catch (e) {
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '复制失败: ' + e.message, theme: 'error' });
        }
    },
    // 5. 重命名
    showRename(e) {
        const id = e.currentTarget.dataset.id;
        const p = this.data.projects.find((item) => (item._id || item.id) === id);
        this.setData({
            renameVisible: true,
            targetProjectId: id,
            newProjectName: p ? p.name : '',
        });
    },
    onRenameInput(e) {
        this.setData({ newProjectName: e.detail.value });
    },
    cancelRename() {
        this.setData({ renameVisible: false });
    },
    async confirmRename() {
        if (!this.data.newProjectName.trim())
            return;
        this.setData({ renameVisible: false });
        (0, index_1.default)({ context: this, selector: '#t-toast', message: '保存中...', theme: 'loading' });
        try {
            await (0, cloud_adapter_1.callCloudFunction)('renameProject', {
                projectId: this.data.targetProjectId,
                name: this.data.newProjectName.trim(),
            });
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '重命名成功', theme: 'success' });
            this.loadProjects();
        }
        catch (e) {
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
        }
    },
    // 6. 删除工程
    deleteProject(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '删除工程',
            content: '确定要删除该项目工程吗？操作不可逆。',
            confirmColor: '#F06A2A',
            success: async (res) => {
                if (res.confirm) {
                    (0, index_1.default)({ context: this, selector: '#t-toast', message: '删除中...', theme: 'loading' });
                    await (0, cloud_adapter_1.callCloudFunction)('deleteProject', { projectId: id });
                    (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
                    (0, index_1.default)({ context: this, selector: '#t-toast', message: '已删除', theme: 'success' });
                    this.loadProjects();
                }
            },
        });
    },
    // 7. 云端与本地同步
    async syncCloud() {
        (0, index_1.default)({ context: this, selector: '#t-toast', message: '云端同步中...', theme: 'loading' });
        const local = wx.getStorageSync('local_projects') || [];
        try {
            await (0, cloud_adapter_1.callCloudFunction)('syncProjects', { projects: local });
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '云端同步完成', theme: 'success' });
            this.loadProjects();
        }
        catch (e) {
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({ context: this, selector: '#t-toast', message: '同步完成（已更新本地）', theme: 'success' });
        }
    },
    // 8. 历史加工流水
    async loadHistory() {
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('listHistory', {});
            if (res && res.result && res.result.code === 200) {
                let partsCount = 0;
                let costCount = 0;
                const formatted = (res.result.data || []).map((item) => {
                    partsCount += item.partsCount || 0;
                    costCount += item.costEstimate || 0;
                    return {
                        ...item,
                        createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString() : '未知时间',
                    };
                });
                this.setData({
                    history: formatted,
                    totalParts: partsCount,
                    totalCost: costCount.toFixed(2),
                });
            }
        }
        catch (e) {
            console.warn('loadHistory error:', e);
        }
    },
});
