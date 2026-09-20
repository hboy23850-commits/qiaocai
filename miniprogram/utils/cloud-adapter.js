"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockDatabase = void 0;
exports.setSimulatedOpenId = setSimulatedOpenId;
exports.getSimulatedOpenId = getSimulatedOpenId;
exports.resetMockDatabase = resetMockDatabase;
exports.callCloudFunction = callCloudFunction;
const index_js_1 = require("./core/solver/index.js");
const a4_demo_js_1 = require("./core/demo/a4-demo.js");
exports.mockDatabase = {
    factories: [],
    users: [],
    stocks: [],
    plans: [],
    executions: [],
    quotes: []
};
let currentSimulatedOpenId = 'test_mock_openid_001';
/**
 * 设置仿真测试 OpenID (供评审智能体和角色切换器使用)
 */
function setSimulatedOpenId(openid) {
    currentSimulatedOpenId = openid;
}
/**
 * 获取当前仿真测试 OpenID
 */
function getSimulatedOpenId() {
    return currentSimulatedOpenId;
}
/**
 * 重置本地模拟数据库
 */
function resetMockDatabase() {
    exports.mockDatabase.factories = [];
    exports.mockDatabase.users = [];
    exports.mockDatabase.stocks = [];
    exports.mockDatabase.plans = [];
    exports.mockDatabase.executions = [];
    exports.mockDatabase.quotes = [];
    currentSimulatedOpenId = 'test_mock_openid_001';
}
function generateMockInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
function findCurrentUser() {
    return exports.mockDatabase.users.find(u => u.openId === currentSimulatedOpenId);
}
/**
 * 本地仿真执行各业务 Action
 */
function executeMockAction(action, payload = {}) {
    const openId = currentSimulatedOpenId;
    const user = findCurrentUser();
    switch (action) {
        // SaaS: 创建工厂
        case 'createFactory': {
            const name = (payload.name || payload.factoryName || '').trim();
            if (!name)
                return { code: 400, msg: 'Factory name is required' };
            const inviteCode = generateMockInviteCode();
            const factoryId = 'fac_' + Date.now() + Math.floor(Math.random() * 1000);
            const factoryDoc = {
                _id: factoryId,
                id: factoryId,
                name,
                ownerId: openId,
                ownerOpenId: openId,
                inviteCode,
                memberCount: 1,
                createdAt: new Date().toISOString()
            };
            exports.mockDatabase.factories.push(factoryDoc);
            if (user) {
                user.factoryId = factoryId;
                user.role = 'BOSS';
            }
            else {
                exports.mockDatabase.users.push({
                    openId,
                    factoryId,
                    role: 'BOSS',
                    nickName: payload.nickName || '厂长',
                    joinedAt: new Date().toISOString()
                });
            }
            return {
                code: 200,
                data: {
                    success: true,
                    factory: {
                        id: factoryId,
                        name,
                        inviteCode,
                        ownerOpenId: openId
                    }
                },
                msg: 'Factory created'
            };
        }
        // SaaS: 加入工厂
        case 'joinFactory': {
            const inviteCode = (payload.inviteCode || '').trim().toUpperCase();
            if (!inviteCode)
                return { code: 400, msg: 'Invite code is required' };
            const factory = exports.mockDatabase.factories.find(f => f.inviteCode === inviteCode);
            if (!factory) {
                return { code: 404, data: { success: false }, msg: 'Factory not found with invite code' };
            }
            if (user) {
                user.factoryId = factory._id;
                user.role = 'WORKER';
            }
            else {
                exports.mockDatabase.users.push({
                    openId,
                    factoryId: factory._id,
                    role: 'WORKER',
                    nickName: payload.nickName || '车间工人',
                    joinedAt: new Date().toISOString()
                });
            }
            factory.memberCount = (factory.memberCount || 1) + 1;
            return {
                code: 200,
                data: {
                    success: true,
                    factory: {
                        id: factory._id,
                        name: factory.name
                    }
                },
                msg: 'Joined factory'
            };
        }
        // SaaS: 获取当前用户的工厂信息
        case 'getFactory': {
            if (!user || !user.factoryId) {
                return { code: 200, data: { inFactory: false } };
            }
            const factory = exports.mockDatabase.factories.find(f => f._id === user.factoryId);
            if (!factory) {
                return { code: 200, data: { inFactory: false } };
            }
            const membersCount = exports.mockDatabase.users.filter(u => u.factoryId === user.factoryId).length;
            const factoryData = {
                id: factory._id,
                name: factory.name,
                role: user.role,
                membersCount: membersCount || factory.memberCount || 1
            };
            if (user.role === 'BOSS') {
                factoryData.inviteCode = factory.inviteCode;
            }
            return {
                code: 200,
                data: {
                    inFactory: true,
                    factory: factoryData
                }
            };
        }
        // SaaS: 获取工厂成员花名册
        case 'getMembers': {
            if (!user || !user.factoryId) {
                return { code: 200, data: { members: [] } };
            }
            const members = exports.mockDatabase.users
                .filter(u => u.factoryId === user.factoryId)
                .map(u => ({
                openid: u.openId,
                role: u.role,
                nickName: u.nickName,
                joinedAt: u.joinedAt || new Date().toISOString()
            }));
            return { code: 200, data: { members } };
        }
        // SaaS: 共享库存列表查询
        case 'getFactoryStocks': {
            let stocks = exports.mockDatabase.stocks;
            if (user && user.factoryId) {
                stocks = stocks.filter(s => s.factoryId === user.factoryId);
            }
            else {
                stocks = stocks.filter(s => s.ownerId === openId);
            }
            if (payload.status) {
                stocks = stocks.filter(s => s.status === payload.status);
            }
            return {
                code: 200,
                data: {
                    stocks: stocks.map(s => ({ ...s, id: s._id || s.id }))
                }
            };
        }
        // SaaS: 添加单个材料
        case 'addStock': {
            const rawStock = payload.stock || payload;
            if (!rawStock.width || rawStock.width <= 0 || !rawStock.height || rawStock.height <= 0) {
                return { code: 400, msg: 'Invalid dimensions' };
            }
            const stockId = 'stock_' + Date.now() + Math.floor(Math.random() * 1000);
            const stockDoc = {
                _id: stockId,
                id: stockId,
                code: rawStock.code || 'S-' + Math.floor(Math.random() * 10000),
                ownerId: openId,
                factoryId: user ? user.factoryId : undefined,
                group: rawStock.group || { material: '椴木板', thicknessMm: 3, color: '原色' },
                width: rawStock.width,
                height: rawStock.height,
                isOffcut: Boolean(rawStock.isOffcut),
                status: rawStock.status || 'AVAILABLE',
                version: 1,
                createdAt: Date.now()
            };
            exports.mockDatabase.stocks.push(stockDoc);
            return {
                code: 200,
                data: {
                    success: true,
                    stock: stockDoc,
                    stockId
                },
                msg: 'Stock added'
            };
        }
        // SaaS: 原子扣减库存
        case 'deductStock': {
            const stockId = payload.stockId;
            if (!stockId)
                return { code: 400, msg: 'stockId is required' };
            const stock = exports.mockDatabase.stocks.find(s => s._id === stockId || s.id === stockId);
            if (!stock)
                return { code: 404, msg: 'Stock not found' };
            if (user && user.factoryId) {
                if (stock.factoryId !== user.factoryId) {
                    return { code: 403, msg: 'Permission denied: belongs to another factory' };
                }
            }
            else {
                if (stock.ownerId !== openId || stock.factoryId) {
                    return { code: 403, msg: 'Permission denied' };
                }
            }
            if (stock.status !== 'AVAILABLE') {
                return { code: 400, msg: 'Stock already consumed or unavailable' };
            }
            const usedLength = payload.usedLength !== undefined ? Number(payload.usedLength) : stock.width;
            const usedWidth = payload.usedWidth !== undefined ? Number(payload.usedWidth) : stock.height;
            if (isNaN(usedLength) || usedLength <= 0 || usedLength > stock.width ||
                isNaN(usedWidth) || usedWidth <= 0 || usedWidth > stock.height) {
                return { code: 400, msg: 'Invalid deduction dimensions: must be within stock boundaries' };
            }
            stock.status = 'CONSUMED';
            stock.version = (stock.version || 1) + 1;
            stock.usedLength = usedLength;
            stock.usedWidth = usedWidth;
            return {
                code: 200,
                data: {
                    success: true,
                    stock: { ...stock, id: stock._id }
                }
            };
        }
        // ERP: 保存报价单
        case 'saveQuote': {
            const quote = payload.quote || payload;
            const quoteId = 'quote_' + Date.now() + Math.floor(Math.random() * 1000);
            const quoteDoc = {
                _id: quoteId,
                id: quoteId,
                quoteNo: quote.quoteNo || ('QT-' + Date.now().toString(36).toUpperCase()),
                factoryId: (user && user.factoryId) ? user.factoryId : null,
                operatorId: openId,
                creatorRole: user ? user.role : 'WORKER',
                customerName: quote.customerName || '散客',
                projectName: quote.projectName || '切板加工项目',
                materialCost: Number(quote.materialCost) || 0,
                processingFee: Number(quote.processingFee) || 0,
                miscFee: Number(quote.miscFee) || 0,
                totalPrice: Number(quote.totalPrice) || 0,
                totalInputAreaSqm: Number(quote.totalInputAreaSqm) || 0,
                pricePerSqm: Number(quote.pricePerSqm) || 0,
                items: quote.items || [],
                createdAt: new Date().toISOString()
            };
            exports.mockDatabase.quotes.push(quoteDoc);
            return {
                code: 200,
                data: {
                    success: true,
                    quoteId
                },
                msg: 'Quote saved'
            };
        }
        // ERP: 获取报价单列表
        case 'getQuotes': {
            let list = exports.mockDatabase.quotes;
            if (user && user.factoryId) {
                list = list.filter(q => q.factoryId === user.factoryId);
            }
            else {
                list = list.filter(q => q.operatorId === openId);
            }
            return {
                code: 200,
                data: {
                    quotes: list.map(q => ({ ...q, id: q._id || q.id }))
                }
            };
        }
        // 规则辅助文本解析
        case 'parseRequirements': {
            const text = (payload && payload.text) ? payload.text.trim() : '';
            if (!text)
                return { code: 400, msg: '请输入需求文本' };
            const pattern = /(\d+)[\s*个块张件]*(\d+)[\s*xX乘\*]+(\d+)/g;
            let draftGroups = [];
            let match;
            let count = 1;
            while ((match = pattern.exec(text)) !== null) {
                const qty = parseInt(match[1], 10);
                const w = parseInt(match[2], 10) * 10;
                const h = parseInt(match[3], 10) * 10;
                draftGroups.push({ id: 'g_rule_' + count++, name: '零件组' + (count - 1), targetWidth: w, targetHeight: h, quantity: qty, allowRotation: false });
            }
            if (draftGroups.length === 0) {
                const numbers = text.match(/\d+/g);
                if (numbers && numbers.length >= 3) {
                    draftGroups.push({ id: 'g_rule_1', name: '提取零件组1', targetWidth: parseInt(numbers[1], 10) * 10, targetHeight: parseInt(numbers[2], 10) * 10, quantity: parseInt(numbers[0], 10), allowRotation: false });
                }
            }
            return { code: 200, data: { draftGroups, source: 'rule-extractor' } };
        }
        // 原有能力兼容: 批量存材料
        case 'saveStocks': {
            const { stocks } = payload;
            for (const s of stocks) {
                s._id = 'stock_' + Date.now() + Math.floor(Math.random() * 1000);
                s.id = s._id;
                s.version = 1;
                s.ownerId = openId;
                if (user && user.factoryId) {
                    s.factoryId = user.factoryId;
                }
                else {
                    delete s.factoryId;
                }
                s.status = s.status || 'AVAILABLE';
                exports.mockDatabase.stocks.push(s);
            }
            return { code: 200, msg: 'Saved' };
        }
        // 原有能力兼容: 材料列表
        case 'listStocks': {
            let filtered = exports.mockDatabase.stocks.filter(s => s.status === 'AVAILABLE');
            if (user && user.factoryId) {
                filtered = filtered.filter(s => s.factoryId === user.factoryId);
            }
            else {
                filtered = filtered.filter(s => s.ownerId === openId);
            }
            return { code: 200, data: filtered.map(s => ({ ...s, id: s._id || s.id })) };
        }
        // 原有能力兼容: 删除材料
        case 'deleteStock': {
            const stockId = payload.stockId;
            if (!stockId)
                return { code: 400, msg: 'stockId is required' };
            const stock = exports.mockDatabase.stocks.find(s => s._id === stockId || s.id === stockId);
            if (!stock)
                return { code: 404, msg: 'Stock not found' };
            if (user && user.factoryId) {
                if (stock.factoryId !== user.factoryId) {
                    return { code: 403, msg: 'Permission denied: stock belongs to another factory' };
                }
            }
            else {
                if (stock.ownerId !== openId || stock.factoryId) {
                    return { code: 403, msg: 'Permission denied' };
                }
            }
            exports.mockDatabase.stocks = exports.mockDatabase.stocks.filter(s => (s._id !== stockId && s.id !== stockId));
            return { code: 200, msg: 'Deleted' };
        }
        // 原有能力兼容: 方案求解
        case 'solvePlan': {
            const { partGroups, kerfMm, stockIds, isDemo } = payload;
            let solverOutput;
            if (isDemo) {
                const options = (0, a4_demo_js_1.createA4DemoOptions)();
                options.partGroups.forEach(g => {
                    g.flexibleRange = partGroups[0]?.flexibleRange || g.flexibleRange;
                });
                solverOutput = (0, index_js_1.solveCuttingPlan)(options);
            }
            else {
                const stocks = exports.mockDatabase.stocks.filter(s => stockIds.includes(s._id || s.id) && s.status === 'AVAILABLE');
                solverOutput = (0, index_js_1.solveCuttingPlan)({ stocks, partGroups, kerfMm });
            }
            const planRecord = {
                _id: 'plan_' + Date.now(),
                factoryId: user ? user.factoryId : undefined,
                ownerId: openId,
                solverOutput
            };
            exports.mockDatabase.plans.push(planRecord);
            return { code: 200, data: { planId: planRecord._id, solverOutput } };
        }
        // 确认接受方案候选 (selectPlan)
        case 'selectPlan': {
            const { planId, candidateId } = payload || {};
            if (!planId || !candidateId) {
                return { code: 400, msg: '缺少 planId 或 candidateId' };
            }
            const plan = exports.mockDatabase.plans.find(p => p._id === planId || p.id === planId);
            if (!plan) {
                return { code: 404, msg: '未找到指定方案' };
            }
            if (user && user.factoryId) {
                if (plan.factoryId && plan.factoryId !== user.factoryId) {
                    return { code: 403, msg: '无权操作其他工坊的方案' };
                }
            }
            else if (plan.ownerId && plan.ownerId !== openId) {
                return { code: 403, msg: '无权操作其他用户的方案' };
            }
            const candidates = plan.solverOutput?.candidates || [];
            const targetCandidate = candidates.find((c) => c.candidateId === candidateId);
            if (!targetCandidate) {
                return { code: 404, msg: '方案中未找到该候选' };
            }
            if (!targetCandidate.isComplete) {
                return { code: 400, msg: '不可接受未完整放置所有零件的方案' };
            }
            plan.selectedCandidateId = candidateId;
            plan.selectedCandidate = targetCandidate;
            plan.selectedAt = new Date().toISOString();
            plan.status = 'ACCEPTED';
            return {
                code: 200,
                data: { planId, selectedCandidateId: candidateId, appliedDeltaMm: targetCandidate.appliedDeltaMm || 0 },
                msg: '方案候选已确认接受'
            };
        }
        // 结案执行 (commitExecution)
        case 'commitExecution': {
            const { actualOffcuts, planId, candidateId, idempotencyKey } = payload || {};
            if (!planId || !candidateId) {
                return { code: 400, msg: '缺少 planId 或 candidateId' };
            }
            if (!idempotencyKey) {
                return { code: 400, msg: '缺少幂等键 idempotencyKey' };
            }
            // 幂等检查
            const existingExec = exports.mockDatabase.executions.find(e => e.idempotencyKey === idempotencyKey);
            if (existingExec) {
                if (existingExec.planId !== planId || existingExec.candidateId !== candidateId) {
                    return { code: 409, msg: '幂等冲突：该键已用于其他方案或候选' };
                }
                return { code: 200, data: existingExec, msg: '方案已结案（幂等安全返回）' };
            }
            const plan = exports.mockDatabase.plans.find(p => p._id === planId || p.id === planId);
            if (!plan)
                return { code: 404, msg: '未找到方案记录' };
            if (plan.status === 'COMMITTED') {
                return { code: 409, msg: '该方案已结案，不可重复消耗材料' };
            }
            if (plan.status !== 'ACCEPTED' || plan.selectedCandidateId !== candidateId) {
                return { code: 409, msg: '该候选方案尚未确认接受，不能执行结案' };
            }
            const candidate = (plan.solverOutput?.candidates || []).find((c) => c.candidateId === candidateId);
            if (!candidate)
                return { code: 400, msg: '未找到该候选方案' };
            if (!candidate.isComplete)
                return { code: 400, msg: '未切全的方案不可结案' };
            // 仅消耗实际使用的材料
            const usedStockIds = (candidate.usedStocks || []).map((us) => us.stockId);
            if (usedStockIds.length === 0) {
                return { code: 400, msg: '方案未包含实际消耗材料' };
            }
            const uniqueUsedStockIds = [...new Set(usedStockIds)];
            if (uniqueUsedStockIds.length !== usedStockIds.length) {
                return { code: 400, msg: '方案包含重复的材料引用' };
            }
            const snapshotIds = new Set((plan.stockVersions || []).map((sv) => sv.id));
            const missingSnapshotIds = uniqueUsedStockIds.filter((id) => !snapshotIds.has(id));
            if (missingSnapshotIds.length > 0) {
                return { code: 409, msg: `方案材料快照不完整，请重新计算：${missingSnapshotIds.join(', ')}` };
            }
            // 检查并消耗材料
            for (const stockId of uniqueUsedStockIds) {
                const stock = exports.mockDatabase.stocks.find(s => s._id === stockId || s.id === stockId);
                if (!stock || stock.status !== 'AVAILABLE') {
                    return { code: 409, msg: `材料 ${stockId} 不可用或已被消耗` };
                }
                stock.status = 'CONSUMED';
                stock.version = (stock.version || 1) + 1;
            }
            // 校验并录入实测余料
            const claimedPredictedOffcuts = new Set();
            for (let i = 0; i < (actualOffcuts || []).length; i++) {
                const o = actualOffcuts[i];
                if (!Number.isInteger(o.width) || o.width <= 0 || !Number.isInteger(o.height) || o.height <= 0) {
                    return { code: 400, msg: `余料 #${i + 1} 实测尺寸必须为正整数` };
                }
                const sourceStock = exports.mockDatabase.stocks.find(s => s._id === o.sourceStockId || s.id === o.sourceStockId);
                const sourcePlan = (candidate.usedStocks || []).find((us) => us.stockId === o.sourceStockId);
                if (!sourceStock?.group || !sourcePlan) {
                    return { code: 400, msg: `余料 #${i + 1} 找不到来源材料` };
                }
                if (!Number.isInteger(o.predictedOffcutIndex) || o.predictedOffcutIndex < 0) {
                    return { code: 400, msg: `余料 #${i + 1} 缺少有效的预测余料区域编号` };
                }
                const predictionKey = `${o.sourceStockId}:${o.predictedOffcutIndex}`;
                if (claimedPredictedOffcuts.has(predictionKey)) {
                    return { code: 400, msg: `余料 #${i + 1} 重复引用同一预测余料区域` };
                }
                claimedPredictedOffcuts.add(predictionKey);
                const predicted = (sourcePlan.remainingOffcuts || [])[o.predictedOffcutIndex];
                if (!predicted) {
                    return { code: 400, msg: `余料 #${i + 1} 引用的预测余料区域不存在` };
                }
                const fitsNormal = o.width <= predicted.width && o.height <= predicted.height;
                const fitsRotated = o.width <= predicted.height && o.height <= predicted.width;
                if (!fitsNormal && !fitsRotated) {
                    return { code: 400, msg: `余料 #${i + 1} 实测尺寸超出预测可用区域` };
                }
                const group = sourceStock.group;
                const newOffcut = {
                    _id: 'stock_' + Date.now() + Math.floor(Math.random() * 1000) + '_' + i,
                    id: 'stock_' + Date.now() + Math.floor(Math.random() * 1000) + '_' + i,
                    code: `OFC-${Date.now().toString().slice(-4)}${i + 1}`,
                    width: o.width,
                    height: o.height,
                    group: { ...group },
                    isOffcut: true,
                    status: 'AVAILABLE',
                    version: 1,
                    sourceStockId: o.sourceStockId,
                    predictedOffcutIndex: o.predictedOffcutIndex,
                    predictedRect: { ...predicted },
                    ownerId: openId,
                    factoryId: user ? user.factoryId : undefined,
                    createdAt: new Date().toISOString()
                };
                exports.mockDatabase.stocks.push(newOffcut);
            }
            const execDoc = {
                _id: 'exec_' + Date.now(),
                planId,
                candidateId,
                idempotencyKey,
                ownerId: openId,
                factoryId: user ? user.factoryId : undefined,
                consumedStockIds: uniqueUsedStockIds,
                partsCount: candidate.placedParts?.length || 0,
                createdAt: new Date().toISOString()
            };
            exports.mockDatabase.executions.push(execDoc);
            plan.status = 'COMMITTED';
            plan.committedAt = new Date().toISOString();
            return { code: 200, data: execDoc, msg: '结案执行成功' };
        }
        // 原有能力兼容: 历史查询
        case 'listHistory': {
            let history = exports.mockDatabase.executions;
            if (user && user.factoryId) {
                history = history.filter(e => e.factoryId === user.factoryId);
            }
            else {
                history = history.filter(e => e.ownerId === openId);
            }
            const sorted = [...history].reverse().slice(0, 20);
            return { code: 200, data: sorted };
        }
        // 原有能力兼容: 清除数据
        case 'clearUserData': {
            if (user && user.factoryId) {
                if (user.role === 'BOSS') {
                    exports.mockDatabase.stocks = exports.mockDatabase.stocks.filter(s => s.factoryId !== user.factoryId);
                    exports.mockDatabase.plans = exports.mockDatabase.plans.filter(p => p.factoryId !== user.factoryId);
                    exports.mockDatabase.executions = exports.mockDatabase.executions.filter(e => e.factoryId !== user.factoryId);
                    exports.mockDatabase.quotes = exports.mockDatabase.quotes.filter(q => q.factoryId !== user.factoryId);
                }
            }
            else {
                exports.mockDatabase.stocks = exports.mockDatabase.stocks.filter(s => s.ownerId !== openId);
                exports.mockDatabase.plans = exports.mockDatabase.plans.filter(p => p.ownerId !== openId);
                exports.mockDatabase.executions = exports.mockDatabase.executions.filter(e => e.ownerId !== openId);
                exports.mockDatabase.quotes = exports.mockDatabase.quotes.filter(q => q.operatorId !== openId);
            }
            return { code: 200, msg: 'Cleared' };
        }
        default:
            return { code: 404, msg: 'Unknown action: ' + action };
    }
}
/**
 * 前端 CloudBase 通信适配器 (R3 规范)
 * 优先调用真实 wx.cloud.callFunction；在无云环境或自动化测试下优雅降级使用内存驱动
 */
async function callCloudFunction(action, payload = {}) {
    // 1. 如果在真机或微信开发者工具中且已启用 wx.cloud，发起真实云函数调用
    if (typeof wx !== 'undefined' && wx && wx.cloud && typeof wx.cloud.callFunction === 'function') {
        try {
            const res = await wx.cloud.callFunction({
                name: 'api',
                data: { action, payload }
            });
            return res;
        }
        catch (err) {
            console.error(`[CloudAdapter] wx.cloud.callFunction('${action}') 远程调用失败:`, err);
            // 禁止真实调用失败后静默转入内存伪造成功！严格向调用方抛出真实网络/云端错误
            throw new Error(`云端服务通信失败: ${err.errMsg || err.message || '网络连接超时，未扣减库存'}`);
        }
    }
    // 2. 仅在自动化测试 (Node.js) 或未初始化云环境的开发沙盒下，进行沙盒仿真执行
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const res = executeMockAction(action, payload);
                resolve({ result: res });
            }
            catch (err) {
                resolve({ result: { code: 500, msg: err.message } });
            }
        }, 5);
    });
}
