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
const DEFAULT_BOSS_OPENID = 'boss_simulated_judge';
const DEFAULT_WORKER_OPENID = 'worker_simulated_judge';
Page({
    data: {
        loading: false,
        inFactory: false,
        factory: null,
        role: '',
        members: [],
        // Form inputs
        activeTab: 0, // 0: 创建工厂, 1: 加入工厂
        newFactoryName: '',
        joinInviteCode: '',
        // Contest Judge Simulator state
        simulatedRole: 'BOSS',
        currentOpenId: ''
    },
    onLoad() {
        this.initSimulatorState();
    },
    onShow() {
        this.loadFactoryInfo();
    },
    /**
     * 初始化模拟测试舱状态
     */
    initSimulatorState() {
        let currentOpenId = (0, cloud_adapter_1.getSimulatedOpenId)();
        if (!currentOpenId || currentOpenId === 'test_mock_openid_001') {
            const savedOpenId = wx.getStorageSync('qiaocai_simulated_openid');
            if (savedOpenId) {
                currentOpenId = savedOpenId;
                (0, cloud_adapter_1.setSimulatedOpenId)(currentOpenId);
            }
            else {
                currentOpenId = DEFAULT_BOSS_OPENID;
                (0, cloud_adapter_1.setSimulatedOpenId)(currentOpenId);
                wx.setStorageSync('qiaocai_simulated_openid', currentOpenId);
            }
        }
        const simulatedRole = currentOpenId.includes('worker') ? 'WORKER' : 'BOSS';
        this.setData({
            currentOpenId,
            simulatedRole
        });
    },
    /**
     * 加载当前用户的工厂状态及成员列表
     */
    async loadFactoryInfo() {
        this.setData({ loading: true });
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('getFactory', {});
            if (res && res.result && res.result.code === 200) {
                const inFactory = Boolean(res.result.data && res.result.data.inFactory);
                if (inFactory) {
                    const factory = res.result.data.factory || {};
                    const role = factory.role || (this.data.simulatedRole === 'BOSS' ? 'BOSS' : 'WORKER');
                    this.setData({
                        inFactory: true,
                        factory,
                        role,
                        simulatedRole: role
                    });
                    // 如果是老板，持久化保存老板的 OpenID 以供角色切换时精确唤回
                    if (role === 'BOSS') {
                        wx.setStorageSync('qiaocai_last_boss_openid', this.data.currentOpenId);
                        if (factory.inviteCode) {
                            wx.setStorageSync('qiaocai_last_factory_invite_code', factory.inviteCode);
                        }
                    }
                    // 加载花名册
                    await this.loadMembers();
                }
                else {
                    this.setData({
                        inFactory: false,
                        factory: null,
                        role: '',
                        members: []
                    });
                }
            }
        }
        catch (err) {
            console.error('[Factory] loadFactoryInfo error:', err);
        }
        finally {
            this.setData({
                loading: false,
                currentOpenId: (0, cloud_adapter_1.getSimulatedOpenId)()
            });
        }
    },
    /**
     * 加载工厂成员列表
     */
    async loadMembers() {
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('getMembers', {});
            if (res && res.result && res.result.code === 200) {
                const rawMembers = res.result.data.members || [];
                const formatted = rawMembers.map(m => {
                    let dateStr = m.joinedAt || '';
                    if (dateStr && dateStr.includes('T')) {
                        dateStr = dateStr.replace('T', ' ').substring(0, 19);
                    }
                    return {
                        ...m,
                        joinedAt: dateStr || '刚刚加入'
                    };
                });
                this.setData({ members: formatted });
            }
        }
        catch (err) {
            console.error('[Factory] loadMembers error:', err);
        }
    },
    /**
     * 切换创建/加入工厂 Tab
     */
    onTabChange(e) {
        this.setData({ activeTab: Number(e.detail.value) });
    },
    /**
     * 工厂名称输入
     */
    onFactoryNameInput(e) {
        this.setData({ newFactoryName: e.detail.value });
    },
    /**
     * 邀请码输入
     */
    onInviteCodeInput(e) {
        const code = (e.detail.value || '').toUpperCase();
        this.setData({ joinInviteCode: code });
    },
    /**
     * 老板创建工厂
     */
    async onCreateFactory() {
        const name = this.data.newFactoryName.trim();
        if (!name) {
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: '请输入工厂名称',
                theme: 'warning'
            });
            return;
        }
        (0, index_1.default)({
            context: this,
            selector: '#t-toast',
            message: '正在创建工厂...',
            theme: 'loading',
            duration: 0
        });
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('createFactory', { name });
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            if (res && res.result && res.result.code === 200) {
                const created = res.result.data.factory;
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: `工厂【${created.name}】创建成功！`,
                    theme: 'success'
                });
                // 记录老板 OpenID
                wx.setStorageSync('qiaocai_last_boss_openid', this.data.currentOpenId);
                if (created.inviteCode) {
                    wx.setStorageSync('qiaocai_last_factory_invite_code', created.inviteCode);
                }
                this.setData({
                    newFactoryName: '',
                    simulatedRole: 'BOSS'
                });
                await this.loadFactoryInfo();
            }
            else {
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: (res && res.result && res.result.msg) || '创建失败，请重试',
                    theme: 'error'
                });
            }
        }
        catch (err) {
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: '网络异常，创建失败',
                theme: 'error'
            });
        }
    },
    /**
     * 工人加入工厂
     */
    async onJoinFactory() {
        const code = this.data.joinInviteCode.trim().toUpperCase();
        if (!code) {
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: '请输入6位邀请码',
                theme: 'warning'
            });
            return;
        }
        (0, index_1.default)({
            context: this,
            selector: '#t-toast',
            message: '正在验证邀请码...',
            theme: 'loading',
            duration: 0
        });
        try {
            const res = await (0, cloud_adapter_1.callCloudFunction)('joinFactory', { inviteCode: code });
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            if (res && res.result && res.result.code === 200) {
                const fac = res.result.data.factory;
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: `已成功加入【${fac.name}】！`,
                    theme: 'success'
                });
                this.setData({
                    joinInviteCode: '',
                    simulatedRole: 'WORKER'
                });
                await this.loadFactoryInfo();
            }
            else {
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: (res && res.result && res.result.msg) || '邀请码无效或工厂不存在',
                    theme: 'error'
                });
            }
        }
        catch (err) {
            (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: '加入失败，请检查网络',
                theme: 'error'
            });
        }
    },
    /**
     * 一键复制邀请码到剪贴板
     */
    onCopyInviteCode() {
        const inviteCode = this.data.factory && this.data.factory.inviteCode;
        if (!inviteCode) {
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: '未获取到邀请码',
                theme: 'warning'
            });
            return;
        }
        wx.setClipboardData({
            data: inviteCode,
            success: () => {
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: `邀请码 ${inviteCode} 已复制到剪贴板！`,
                    theme: 'success'
                });
            },
            fail: () => {
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: '复制失败，请手动长按复制',
                    theme: 'error'
                });
            }
        });
    },
    /**
     * 评委演示 / 角色模拟切换器 (Contest Judge Simulator)
     */
    async onSwitchSimulatedRole(e) {
        const targetRole = e.currentTarget.dataset.role;
        if (targetRole === this.data.simulatedRole) {
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: `当前已是【${targetRole === 'BOSS' ? '老板/厂长' : '车间工人'}视角】`,
                theme: 'default'
            });
            return;
        }
        let targetOpenId = '';
        if (targetRole === 'BOSS') {
            const savedBossOpenId = wx.getStorageSync('qiaocai_last_boss_openid');
            targetOpenId = savedBossOpenId || DEFAULT_BOSS_OPENID;
        }
        else {
            const savedWorkerOpenId = wx.getStorageSync('qiaocai_last_worker_openid');
            targetOpenId = savedWorkerOpenId || DEFAULT_WORKER_OPENID;
        }
        // 切换 OpenID 并持久化
        (0, cloud_adapter_1.setSimulatedOpenId)(targetOpenId);
        wx.setStorageSync('qiaocai_simulated_openid', targetOpenId);
        // 如果切换到工人视角且尚未加入工厂，自动将之前老板的邀请码填入输入框方便评委一键测试
        let prefillInviteCode = this.data.joinInviteCode;
        if (targetRole === 'WORKER') {
            const lastCode = wx.getStorageSync('qiaocai_last_factory_invite_code');
            if (lastCode && !prefillInviteCode) {
                prefillInviteCode = lastCode;
            }
        }
        this.setData({
            currentOpenId: targetOpenId,
            simulatedRole: targetRole,
            joinInviteCode: prefillInviteCode,
            activeTab: targetRole === 'WORKER' ? 1 : 0
        });
        (0, index_1.default)({
            context: this,
            selector: '#t-toast',
            message: `已切换为【${targetRole === 'BOSS' ? '老板视角 (BOSS)' : '工人视角 (WORKER)'}】`,
            theme: 'success'
        });
        // 重新获取该角色的工厂状态
        await this.loadFactoryInfo();
    },
    /**
     * 评委一键生成双端协同演示数据 (Contest Quick Demo Setup)
     */
    async onQuickSetupDemo() {
        index_2.default.confirm({
            title: '一键生成协同演示数据',
            content: '该功能将自动模拟老板创建“巧裁东莞精工智造厂”，并让工人输入邀请码加入，同时导入共享板材供双端协同测试。是否继续？'
        }).then(async () => {
            (0, index_1.default)({
                context: this,
                selector: '#t-toast',
                message: '正在建立协同环境...',
                theme: 'loading',
                duration: 0
            });
            try {
                // 1. 模拟 Boss 创建工厂
                (0, cloud_adapter_1.setSimulatedOpenId)(DEFAULT_BOSS_OPENID);
                wx.setStorageSync('qiaocai_simulated_openid', DEFAULT_BOSS_OPENID);
                wx.setStorageSync('qiaocai_last_boss_openid', DEFAULT_BOSS_OPENID);
                const createRes = await (0, cloud_adapter_1.callCloudFunction)('createFactory', {
                    name: '巧裁东莞精工智造厂 (示范基地)'
                });
                const inviteCode = createRes.result.data.factory.inviteCode;
                wx.setStorageSync('qiaocai_last_factory_invite_code', inviteCode);
                // 2. Boss 注入 2 张共享板材
                await (0, cloud_adapter_1.callCloudFunction)('saveStocks', {
                    stocks: [
                        {
                            code: 'ST-WOOD-2440',
                            group: { material: '椴木板', thicknessMm: 3, color: '原木色', pricePerSqm: 45 },
                            width: 24400,
                            height: 12200,
                            isOffcut: false,
                            status: 'AVAILABLE'
                        },
                        {
                            code: 'ST-ACRY-1200',
                            group: { material: '亚克力', thicknessMm: 5, color: '高透', pricePerSqm: 88 },
                            width: 12000,
                            height: 6000,
                            isOffcut: false,
                            status: 'AVAILABLE'
                        }
                    ]
                });
                // 3. 模拟 Worker 加入工厂
                (0, cloud_adapter_1.setSimulatedOpenId)(DEFAULT_WORKER_OPENID);
                wx.setStorageSync('qiaocai_last_worker_openid', DEFAULT_WORKER_OPENID);
                await (0, cloud_adapter_1.callCloudFunction)('joinFactory', { inviteCode });
                // 4. 切回 Boss 视角呈现完整体系
                (0, cloud_adapter_1.setSimulatedOpenId)(DEFAULT_BOSS_OPENID);
                wx.setStorageSync('qiaocai_simulated_openid', DEFAULT_BOSS_OPENID);
                (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: '协同环境建立成功！已处于老板视角',
                    theme: 'success'
                });
                this.setData({
                    currentOpenId: DEFAULT_BOSS_OPENID,
                    simulatedRole: 'BOSS'
                });
                await this.loadFactoryInfo();
            }
            catch (err) {
                (0, index_1.hideToast)({ context: this, selector: '#t-toast' });
                (0, index_1.default)({
                    context: this,
                    selector: '#t-toast',
                    message: '演示数据初始化异常',
                    theme: 'error'
                });
            }
        }).catch(() => { });
    },
    /**
     * 页面跳转导航
     */
    navToStock() {
        wx.navigateTo({ url: '/pages/stock/stock' });
    },
    navToRequirement() {
        wx.navigateTo({ url: '/pages/requirement/requirement' });
    }
});
