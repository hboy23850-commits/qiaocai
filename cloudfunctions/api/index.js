const cloud = require('wx-server-sdk')
// Use the bundled file directly. CloudBase does not reliably install local file:
// dependencies during CLI deployment, while this file is always uploaded with us.
const { solveCuttingPlan, validateCandidate } = require('./core.js')
const { runAgentTurn } = require('./agent.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function addProjectDocument(projectDoc) {
  try {
    return await db.collection('projects').add({ data: projectDoc });
  } catch (error) {
    const message = String(error && (error.message || error.errMsg || error));
    const missingCollection = message.includes('-502005') || message.includes('collection not exists') || message.includes('Db or Table not exist');
    if (!missingCollection || typeof db.createCollection !== 'function') throw error;
    try {
      await db.createCollection('projects');
    } catch (createError) {
      const createMessage = String(createError && (createError.message || createError.errMsg || createError));
      if (!createMessage.includes('already') && !createMessage.includes('exist')) throw createError;
    }
    return await db.collection('projects').add({ data: projectDoc });
  }
}

/**
 * 标准返回格式
 */
function success(data = {}, msg = 'success') {
  return { code: 200, data, msg, requestId: cloud.getWXContext().REQUESTID };
}
function fail(code = 500, msg = 'error') {
  return { code, data: null, msg, requestId: cloud.getWXContext().REQUESTID };
}

/**
 * 获取当前调用者用户信息
 */
async function getUser(openid) {
  try {
    const res = await db.collection('users').where({ openId: openid }).get();
    return res.data && res.data.length > 0 ? res.data[0] : null;
  } catch (e) {
    return null;
  }
}

/**
 * 生成 6 位唯一大写字母+数字邀请码
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 路由控制
 */
const controllers = {
  // 解析需求 (规则辅助文本提取)
  async parseRequirements(payload, wxContext) {
    const text = (payload && payload.text) ? payload.text.trim() : '';
    if (!text) {
      return fail(400, '请输入待提取的零件规格文本（例：8张105x70）');
    }

    const pattern = /(\d+)[\s*个块张件]*(\d+)[\s*xX乘\*]+(\d+)/g;
    let draftGroups = [];
    let match;
    let count = 1;
    
    while ((match = pattern.exec(text)) !== null) {
      const qty = parseInt(match[1], 10);
      const w = parseInt(match[2], 10) * 10;
      const h = parseInt(match[3], 10) * 10;
      draftGroups.push({ 
        id: 'g_rule_' + count++, 
        name: '零件组' + (count - 1), 
        targetWidth: w, 
        targetHeight: h, 
        quantity: qty, 
        allowRotation: false // 默认锁定旋转
      });
    }

    if (draftGroups.length === 0) {
      const numbers = text.match(/\d+/g);
      if (numbers && numbers.length >= 3) {
        draftGroups.push({ 
          id: 'g_rule_1', 
          name: '提取零件组1', 
          targetWidth: parseInt(numbers[1], 10) * 10, 
          targetHeight: parseInt(numbers[2], 10) * 10, 
          quantity: parseInt(numbers[0], 10), 
          allowRotation: false // 默认锁定旋转
        });
      }
    }

    return success({ draftGroups, source: 'rule-extractor' });
  },

  // 1. 创建工厂 (Boss)
  async createFactory(payload, wxContext) {
    const name = (payload && (payload.name || payload.factoryName)) ? (payload.name || payload.factoryName).trim() : '';
    if (!name) return fail(400, 'Factory name is required');

    let inviteCode = generateInviteCode();
    let existing = await db.collection('factories').where({ inviteCode }).get();
    let attempts = 0;
    while (existing.data && existing.data.length > 0 && attempts < 5) {
      inviteCode = generateInviteCode();
      existing = await db.collection('factories').where({ inviteCode }).get();
      attempts++;
    }

    const factoryDoc = {
      name,
      ownerId: wxContext.OPENID,
      ownerOpenId: wxContext.OPENID,
      inviteCode,
      memberCount: 1,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    const facRes = await db.collection('factories').add({ data: factoryDoc });
    const factoryId = facRes._id;

    const user = await getUser(wxContext.OPENID);
    if (user) {
      await db.collection('users').doc(user._id).update({
        data: {
          factoryId,
          role: 'BOSS',
          updatedAt: db.serverDate()
        }
      });
    } else {
      await db.collection('users').add({
        data: {
          openId: wxContext.OPENID,
          factoryId,
          role: 'BOSS',
          nickName: (payload && payload.nickName) || '厂长',
          joinedAt: db.serverDate(),
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }

    return success({
      success: true,
      factory: {
        id: factoryId,
        name,
        inviteCode,
        ownerOpenId: wxContext.OPENID
      }
    }, 'Factory created successfully');
  },

  // 2. 加入工厂 (Worker)
  async joinFactory(payload, wxContext) {
    const inviteCode = (payload && payload.inviteCode ? payload.inviteCode : '').trim().toUpperCase();
    if (!inviteCode) return fail(400, 'Invite code is required');

    const facRes = await db.collection('factories').where({ inviteCode }).get();
    if (!facRes.data || facRes.data.length === 0) {
      return fail(404, 'Factory not found with invite code');
    }

    const factory = facRes.data[0];
    const factoryId = factory._id;

    const user = await getUser(wxContext.OPENID);
    if (user) {
      await db.collection('users').doc(user._id).update({
        data: {
          factoryId,
          role: 'WORKER',
          updatedAt: db.serverDate()
        }
      });
    } else {
      await db.collection('users').add({
        data: {
          openId: wxContext.OPENID,
          factoryId,
          role: 'WORKER',
          nickName: (payload && payload.nickName) || '车间工人',
          joinedAt: db.serverDate(),
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }

    try {
      await db.collection('factories').doc(factoryId).update({
        data: {
          memberCount: _.inc(1),
          updatedAt: db.serverDate()
        }
      });
    } catch (e) {
      // Ignore if update fails
    }

    return success({
      success: true,
      factory: {
        id: factoryId,
        name: factory.name
      }
    }, 'Joined factory successfully');
  },

  // 3. 获取当前工厂信息与角色
  async getFactory(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    if (!user || !user.factoryId) {
      return success({ inFactory: false });
    }

    const facRes = await db.collection('factories').doc(user.factoryId).get().catch(() => ({ data: null }));
    if (!facRes || !facRes.data) {
      return success({ inFactory: false });
    }

    const factory = facRes.data;
    const membersRes = await db.collection('users').where({ factoryId: user.factoryId }).get().catch(() => ({ data: [] }));
    const membersCount = membersRes.data && membersRes.data.length > 0 ? membersRes.data.length : (factory.memberCount || 1);

    const factoryData = {
      id: factory._id,
      name: factory.name,
      role: user.role,
      membersCount
    };
    if (user.role === 'BOSS') {
      factoryData.inviteCode = factory.inviteCode;
    }

    return success({
      inFactory: true,
      factory: factoryData
    });
  },

  // 4. 获取工厂成员花名册
  async getMembers(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    if (!user || !user.factoryId) {
      return success({ members: [] });
    }

    const membersRes = await db.collection('users').where({ factoryId: user.factoryId }).get();
    const members = (membersRes.data || []).map(u => ({
      openid: u.openId || u.openid,
      role: u.role,
      nickName: u.nickName,
      joinedAt: u.joinedAt ? (typeof u.joinedAt.toISOString === 'function' ? u.joinedAt.toISOString() : String(u.joinedAt)) : new Date().toISOString()
    }));

    return success({ members });
  },

  // 5. 获取工厂库存 (多租户隔离，未入厂向后兼容)
  async getFactoryStocks(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    let query = {};
    if (user && user.factoryId) {
      query.factoryId = user.factoryId;
    } else {
      query.ownerId = wxContext.OPENID;
    }
    if (payload && payload.status) {
      query.status = payload.status;
    }

    const res = await db.collection('stocks').where(query).get();
    const stocks = (res.data || []).map(s => ({
      ...s,
      id: s.id || s._id
    }));
    return success({ stocks });
  },

  // 6. 添加单个库存材料
  async addStock(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    const rawStock = payload.stock || payload;
    if (!rawStock.width || rawStock.width <= 0 || !rawStock.height || rawStock.height <= 0) {
      return fail(400, 'Invalid dimensions');
    }

    const stockDoc = {
      code: rawStock.code || 'S-' + Math.floor(Math.random() * 10000),
      ownerId: wxContext.OPENID,
      group: rawStock.group || { material: '椴木板', thicknessMm: 3, color: '原色' },
      width: rawStock.width,
      height: rawStock.height,
      isOffcut: Boolean(rawStock.isOffcut),
      status: rawStock.status || 'AVAILABLE',
      version: 1,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    if (user && user.factoryId) {
      stockDoc.factoryId = user.factoryId;
    }
    if (rawStock.defects) {
      stockDoc.defects = rawStock.defects;
    }

    const addRes = await db.collection('stocks').add({ data: stockDoc });
    stockDoc.id = addRes._id;
    stockDoc._id = addRes._id;

    return success({ success: true, stock: stockDoc, stockId: addRes._id }, 'Stock added');
  },

  // 7. 扣减库存 (按 factoryId 隔离并发乐观锁)
  async deductStock(payload, wxContext) {
    const stockId = payload.stockId;
    if (!stockId) return fail(400, 'stockId is required');

    const user = await getUser(wxContext.OPENID);
    const stockRes = await db.collection('stocks').doc(stockId).get().catch(() => ({ data: null }));
    if (!stockRes || !stockRes.data) {
      return fail(404, 'Stock not found');
    }
    const stock = stockRes.data;

    // 租户隔离权限校验
    if (user && user.factoryId) {
      if (stock.factoryId !== user.factoryId) {
        return fail(403, 'Permission denied: stock belongs to another factory');
      }
    } else {
      if (stock.ownerId !== wxContext.OPENID || stock.factoryId) {
        return fail(403, 'Permission denied');
      }
    }

    if (stock.status !== 'AVAILABLE') {
      return fail(400, 'Stock is not available');
    }

    const usedLength = payload.usedLength !== undefined ? Number(payload.usedLength) : stock.width;
    const usedWidth = payload.usedWidth !== undefined ? Number(payload.usedWidth) : stock.height;

    if (isNaN(usedLength) || usedLength <= 0 || usedLength > stock.width ||
        isNaN(usedWidth) || usedWidth <= 0 || usedWidth > stock.height) {
      return fail(400, 'Invalid deduction dimensions: must be within stock boundaries');
    }

    const whereCondition = {
      _id: stockId,
      version: stock.version || 1,
      status: 'AVAILABLE'
    };
    if (user && user.factoryId) {
      whereCondition.factoryId = user.factoryId;
    } else {
      whereCondition.ownerId = wxContext.OPENID;
    }

    const updateRes = await db.collection('stocks').where(whereCondition).update({
      data: {
        status: 'CONSUMED',
        version: _.inc(1),
        usedLength,
        usedWidth,
        updatedAt: db.serverDate()
      }
    });

    if (updateRes.stats.updated === 0) {
      return fail(409, 'Stock version conflict or already consumed');
    }

    stock.status = 'CONSUMED';
    stock.version = (stock.version || 1) + 1;
    stock.usedLength = usedLength;
    stock.usedWidth = usedWidth;
    stock.id = stock._id;
    return success({ success: true, stock });
  },

  // 8. 保存 ERP 报价单
  async saveQuote(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    const quote = payload.quote || payload;

    const quoteDoc = {
      quoteNo: quote.quoteNo || ('QT-' + Date.now().toString(36).toUpperCase()),
      factoryId: (user && user.factoryId) ? user.factoryId : null,
      operatorId: wxContext.OPENID,
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
      planId: quote.planId || null,
      candidateId: quote.candidateId || null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    const addRes = await db.collection('quotes').add({ data: quoteDoc });
    return success({ success: true, quoteId: addRes._id }, 'Quote saved successfully');
  },

  // 9. 查询 ERP 报价单列表
  async getQuotes(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    let query = {};
    if (user && user.factoryId) {
      query.factoryId = user.factoryId;
    } else {
      query.operatorId = wxContext.OPENID;
    }

    const res = await db.collection('quotes').where(query).orderBy('createdAt', 'desc').get().catch(async () => {
      return await db.collection('quotes').where(query).get();
    });
    const quotes = (res.data || []).map(q => ({
      ...q,
      id: q._id
    }));
    return success({ quotes });
  },

  // Prepare an idempotent A4 data set for the guided first-use experience.
  async prepareDemo(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    const demoQuery = {
      demoKey: 'A4_BADGES_V1',
      status: 'AVAILABLE'
    };
    if (user && user.factoryId) {
      demoQuery.factoryId = user.factoryId;
    } else {
      demoQuery.ownerId = wxContext.OPENID;
    }

    const existingRes = await db.collection('stocks').where(demoQuery).get();
    const stocks = (existingRes.data || []).slice(0, 2);
    while (stocks.length < 2) {
      const index = stocks.length + 1;
      const stock = {
        code: `DEMO-A4-${index}`,
        demoKey: 'A4_BADGES_V1',
        ownerId: wxContext.OPENID,
        group: { material: '标准白卡纸', thicknessMm: 0.3, color: '白色' },
        width: 2100,
        height: 2970,
        isOffcut: false,
        status: 'AVAILABLE',
        version: 1,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      if (user && user.factoryId) {
        stock.factoryId = user.factoryId;
      }
      const addRes = await db.collection('stocks').add({ data: stock });
      stocks.push({ ...stock, _id: addRes._id, id: addRes._id });
    }

    return success({
      stocks: stocks.map(stock => ({ ...stock, id: stock.id || stock._id }))
    }, '演示材料已准备');
  },

  // 存材料 (向后兼容且自动赋予 factoryId)
  async saveStocks(payload, wxContext) {
    const { stocks } = payload;
    const user = await getUser(wxContext.OPENID);
    for (const stock of stocks) {
      if (!stock.width || stock.width <= 0 || !stock.height || stock.height <= 0) {
        return fail(400, 'Invalid dimensions');
      }
      stock.ownerId = wxContext.OPENID;
      if (user && user.factoryId) {
        stock.factoryId = user.factoryId;
      } else {
        delete stock.factoryId;
      }
      stock.version = 1;
      stock.status = stock.status || 'AVAILABLE';
      stock.createdAt = db.serverDate();
      await db.collection('stocks').add({ data: stock });
    }
    return success({}, 'Saved successfully');
  },

  // 查材料 (向后兼容)
  async listStocks(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    const query = { status: 'AVAILABLE' };
    if (user && user.factoryId) {
      query.factoryId = user.factoryId;
    } else {
      query.ownerId = wxContext.OPENID;
    }
    const res = await db.collection('stocks').where(query).get();
    return success(res.data);
  },

  // 删材料 (向后兼容)
  async deleteStock(payload, wxContext) {
    const stockId = payload.stockId;
    if (!stockId) return fail(400, 'stockId is required');

    const user = await getUser(wxContext.OPENID);
    const stockRes = await db.collection('stocks').doc(stockId).get().catch(() => ({ data: null }));
    if (!stockRes || !stockRes.data) {
      return fail(404, 'Stock not found');
    }
    const stock = stockRes.data;

    if (user && user.factoryId) {
      if (stock.factoryId !== user.factoryId) {
        return fail(403, 'Permission denied: stock belongs to another factory');
      }
    } else {
      if (stock.ownerId !== wxContext.OPENID || stock.factoryId) {
        return fail(403, 'Permission denied');
      }
    }

    let query = { _id: stockId };
    if (user && user.factoryId) {
      query.factoryId = user.factoryId;
    } else {
      query.ownerId = wxContext.OPENID;
    }
    const res = await db.collection('stocks').where(query).remove();
    if (res.stats.removed === 0) return fail(403, 'Permission denied or not found');
    return success({}, 'Deleted');
  },

  // 智能排版演算 (向后兼容)
  async solvePlan(payload, wxContext) {
    const { partGroups, kerfMm, stockIds } = payload;
    const user = await getUser(wxContext.OPENID);
    const query = {
      _id: _.in(stockIds),
      status: 'AVAILABLE'
    };
    if (user && user.factoryId) {
      query.factoryId = user.factoryId;
    } else {
      query.ownerId = wxContext.OPENID;
    }
    const res = await db.collection('stocks').where(query).get();
    const normalizedStocks = (res.data || []).map(s => ({ ...s, id: s.id || s._id }));
    
    const solverOutput = solveCuttingPlan({ stocks: normalizedStocks, partGroups, kerfMm });
    const planRecord = {
      ownerId: wxContext.OPENID,
      inputSnapshot: { partGroups, kerfMm },
      stockVersions: res.data.map(s => ({ id: s._id, version: s.version })),
      solverOutput,
      createdAt: db.serverDate()
    };
    if (user && user.factoryId) {
      planRecord.factoryId = user.factoryId;
    }
    const addRes = await db.collection('plans').add({ data: planRecord });
    return success({ planId: addRes._id, solverOutput });
  },

  // 确认并接受方案候选 (selectPlan)
  async selectPlan(payload, wxContext) {
    const { planId, candidateId } = payload || {};
    if (!planId || !candidateId) {
      return fail(400, '缺少 planId 或 candidateId');
    }

    const planRes = await db.collection('plans').doc(planId).get();
    const plan = planRes.data;
    if (!plan) {
      return fail(404, '未找到指定的方案记录');
    }

    const user = await getUser(wxContext.OPENID);
    if (user && user.factoryId) {
      if (plan.factoryId && plan.factoryId !== user.factoryId) {
        return fail(403, '无权操作其他工坊的方案');
      }
    } else if (plan.ownerId && plan.ownerId !== wxContext.OPENID) {
      return fail(403, '无权操作其他用户的方案');
    }

    const candidates = plan.solverOutput?.candidates || [];
    const targetCandidate = candidates.find(c => c.candidateId === candidateId);
    if (!targetCandidate) {
      return fail(404, '方案中未找到指定的候选方案');
    }

    if (!targetCandidate.isComplete) {
      return fail(400, '不可接受未完整放置所有零件的候选方案');
    }

    const inputSnapshot = plan.inputSnapshot;
    if (!inputSnapshot || !Array.isArray(inputSnapshot.partGroups)) {
      return fail(409, '方案缺少独立校验所需的输入快照，请重新计算');
    }

    const stockVersionIds = new Set((plan.stockVersions || []).map(sv => sv.id));
    const usedStockIds = [...new Set((targetCandidate.usedStocks || []).map(us => us.stockId))];
    if (usedStockIds.length === 0 || usedStockIds.some(id => !stockVersionIds.has(id))) {
      return fail(409, '候选方案引用的材料与求解快照不一致，请重新计算');
    }

    const validationStocks = [];
    for (const stockId of usedStockIds) {
      const stockRes = await db.collection('stocks').doc(stockId).get().catch(() => null);
      const stock = stockRes && stockRes.data;
      if (!stock) {
        return fail(409, `候选方案使用的材料不存在：${stockId}`);
      }
      if (user && user.factoryId) {
        if (stock.factoryId !== user.factoryId) {
          return fail(403, '候选方案引用了其他工坊的材料');
        }
      } else if (stock.ownerId !== wxContext.OPENID || stock.factoryId) {
        return fail(403, '候选方案引用了其他用户的材料');
      }
      validationStocks.push({ ...stock, id: stock.id || stock._id });
    }

    const validation = validateCandidate(
      targetCandidate,
      inputSnapshot.partGroups,
      validationStocks,
      inputSnapshot.kerfMm
    );
    if (!validation.valid) {
      return fail(400, `方案独立校验失败：${validation.errors[0] || '几何或业务约束不合法'}`);
    }

    await db.collection('plans').doc(planId).update({
      data: {
        selectedCandidateId: candidateId,
        selectedCandidate: targetCandidate,
        selectedAt: db.serverDate(),
        appliedDeltaMm: targetCandidate.appliedDeltaMm || 0,
        status: 'ACCEPTED'
      }
    });

    return success({
      planId,
      selectedCandidateId: candidateId,
      appliedDeltaMm: targetCandidate.appliedDeltaMm || 0
    }, '方案候选已确认接受');
  },

  // 结案执行 (commitExecution)
  async commitExecution(payload, wxContext) {
    const { planId, candidateId, actualOffcuts, idempotencyKey } = payload || {};
    if (!planId || !candidateId) {
      return fail(400, '缺少 planId 或 candidateId');
    }
    if (!idempotencyKey) {
      return fail(400, '缺少幂等键 idempotencyKey');
    }

    const user = await getUser(wxContext.OPENID);

    // 1. 幂等检查：防网络重试与并发重复提交
    const execCheck = await db.collection('executions').where({ idempotencyKey }).get();
    if (execCheck.data && execCheck.data.length > 0) {
      const existing = execCheck.data[0];
      if (existing.planId !== planId || existing.candidateId !== candidateId) {
        return fail(409, '幂等键冲突：该键已用于其他方案或候选');
      }
      return success(existing, '方案已结案（幂等返回原结果）');
    }

    // 2. 获取并核验方案记录
    const planRes = await db.collection('plans').doc(planId).get();
    const plan = planRes.data;
    if (!plan) return fail(404, '未找到指定的方案记录');

    if (user && user.factoryId) {
      if (plan.factoryId && plan.factoryId !== user.factoryId) {
        return fail(403, '无权操作其他工坊的方案');
      }
    } else if (plan.ownerId !== wxContext.OPENID) {
      return fail(403, '无权操作其他用户的方案');
    }

    if (plan.status === 'COMMITTED') {
      return fail(409, '该方案已结案提交，材料已扣减，不可重复提交');
    }

    if (plan.status !== 'ACCEPTED' || plan.selectedCandidateId !== candidateId) {
      return fail(409, '该候选方案尚未确认接受，不能执行结案');
    }

    if (!plan.solverOutput || !Array.isArray(plan.solverOutput.candidates)) {
      return fail(400, '方案数据结构无效');
    }

    const candidate = plan.solverOutput.candidates.find(c => c.candidateId === candidateId);
    if (!candidate) return fail(400, '方案中未找到该候选');
    if (!candidate.isComplete) return fail(400, '未切全的缺件方案不可执行结案');

    // 3. 严格限制仅消耗选中候选实际使用的材料 (usedStocks)
    const usedStocks = candidate.usedStocks || [];
    const usedStockIds = usedStocks.map(us => us.stockId);
    if (usedStockIds.length === 0) {
      return fail(400, '选中的方案未包含任何实际消耗的材料');
    }

    const uniqueUsedStockIds = [...new Set(usedStockIds)];
    if (uniqueUsedStockIds.length !== usedStockIds.length) {
      return fail(400, '选中方案包含重复的材料引用');
    }

    // 每一张实际使用材料都必须存在于求解时保存的版本快照中。
    const stockVersionMap = new Map((plan.stockVersions || []).map(sv => [sv.id, sv]));
    const missingSnapshotIds = uniqueUsedStockIds.filter(id => !stockVersionMap.has(id));
    if (missingSnapshotIds.length > 0) {
      return fail(409, `方案材料快照不完整，请重新计算：${missingSnapshotIds.join(', ')}`);
    }
    const stocksToConsume = uniqueUsedStockIds.map(id => stockVersionMap.get(id));

    // 4. 读取来源材料属性，用于余料属性继承（材质、厚度、颜色）
    const sourceStocksMap = new Map();
    for (const sv of stocksToConsume) {
      const sDoc = await db.collection('stocks').doc(sv.id).get().catch(() => null);
      if (sDoc && sDoc.data) {
        sourceStocksMap.set(sv.id, sDoc.data);
      }
    }

    // 5. 严格核验实测余料尺寸与预测范围
    const validatedOffcuts = [];
    const claimedPredictedOffcuts = new Set();
    for (let i = 0; i < (actualOffcuts || []).length; i++) {
      const o = actualOffcuts[i];
      if (!Number.isInteger(o.width) || o.width <= 0 || !Number.isInteger(o.height) || o.height <= 0) {
        return fail(400, `余料 #${i + 1} 实测长宽必须为正整数 (0.1 mm精度)`);
      }

      const source = sourceStocksMap.get(o.sourceStockId);
      const sourcePlan = usedStocks.find(us => us.stockId === o.sourceStockId);
      if (!source || !source.group || !sourcePlan) {
        return fail(400, `余料 #${i + 1} 找不到对应的来源材料属性`);
      }

      if (!Number.isInteger(o.predictedOffcutIndex) || o.predictedOffcutIndex < 0) {
        return fail(400, `余料 #${i + 1} 缺少有效的预测余料区域编号`);
      }
      const predictionKey = `${o.sourceStockId}:${o.predictedOffcutIndex}`;
      if (claimedPredictedOffcuts.has(predictionKey)) {
        return fail(400, `余料 #${i + 1} 重复引用同一预测余料区域`);
      }
      claimedPredictedOffcuts.add(predictionKey);

      // 预测范围只从服务端保存的候选方案读取，不信任客户端上传的预测尺寸。
      const predicted = (sourcePlan.remainingOffcuts || [])[o.predictedOffcutIndex];
      if (!predicted) {
        return fail(400, `余料 #${i + 1} 引用的预测余料区域不存在`);
      }
      const fitsNormal = o.width <= predicted.width && o.height <= predicted.height;
      const fitsRotated = o.width <= predicted.height && o.height <= predicted.width;
      if (!fitsNormal && !fitsRotated) {
        return fail(400, `余料 #${i + 1} 实测尺寸 (${o.width/10}x${o.height/10}mm) 超出预测可用区域 (${predicted.width/10}x${predicted.height/10}mm)`);
      }

      validatedOffcuts.push({
        ownerId: wxContext.OPENID,
        factoryId: (user && user.factoryId) ? user.factoryId : undefined,
        code: `OFC-${Date.now().toString().slice(-4)}${i + 1}`,
        width: o.width,
        height: o.height,
        group: {
          material: source.group.material,
          thicknessMm: source.group.thicknessMm,
          color: source.group.color,
          pricePerSqm: source.group.pricePerSqm || 10
        },
        isOffcut: true,
        status: 'AVAILABLE',
        version: 1,
        sourceStockId: o.sourceStockId,
        predictedOffcutIndex: o.predictedOffcutIndex,
        predictedRect: {
          x: predicted.x,
          y: predicted.y,
          width: predicted.width,
          height: predicted.height
        },
        createdAt: db.serverDate()
      });
    }

    // 6. 原子执行事务 (支持 db.runTransaction，若无事务引擎则提供等效补偿回滚保护)
    const execDoc = {
      planId,
      candidateId,
      idempotencyKey,
      ownerId: wxContext.OPENID,
      factoryId: (user && user.factoryId) ? user.factoryId : undefined,
      consumedStockIds: usedStockIds,
      partsCount: candidate.placedParts.length,
      createdAt: db.serverDate()
    };

    if (typeof db.runTransaction === 'function') {
      try {
        await db.runTransaction(async transaction => {
          // A. 逐张核验并消耗实际使用的材料
          for (const sv of stocksToConsume) {
            const stockRef = transaction.collection('stocks').doc(sv.id);
            const sGet = await stockRef.get();
            const sData = sGet.data;
            if (!sData || sData.status !== 'AVAILABLE' || sData.version !== sv.version) {
              await transaction.rollback('材料状态冲突或已被其他任务消耗');
              // 不依赖具体 SDK 的 rollback 是否会抛异常，避免事务已回滚却误报成功。
              throw new Error('材料状态冲突或已被其他任务消耗');
            }
            await stockRef.update({
              data: { status: 'CONSUMED', version: sv.version + 1, updatedAt: db.serverDate() }
            });
          }

          // B. 批量写入实测余料
          for (const off of validatedOffcuts) {
            await transaction.collection('stocks').add({ data: off });
          }

          // C. 写入执行记录
          await transaction.collection('executions').add({ data: execDoc });

          // D. 更新方案状态
          await transaction.collection('plans').doc(planId).update({
            data: { status: 'COMMITTED', committedAt: db.serverDate() }
          });
        });

        return success(execDoc, '结案提交成功，库存已原子扣减');
      } catch (txErr) {
        console.error('[commitExecution Transaction Error]', txErr);
        return fail(409, txErr.message || '材料并发冲突或事务回滚');
      }
    } else {
      // 补偿式安全机制：模拟环境与非事务环境
      const consumedLogs = [];
      const createdOffcutIds = [];

      try {
        for (const sv of stocksToConsume) {
          const stockWhere = { _id: sv.id, version: sv.version, status: 'AVAILABLE' };
          const uRes = await db.collection('stocks').where(stockWhere).update({
            data: { status: 'CONSUMED', version: _.inc(1), updatedAt: db.serverDate() }
          });
          if (!uRes || uRes.stats.updated === 0) {
            throw new Error(`材料 ${sv.id} 版本冲突或已被消耗`);
          }
          consumedLogs.push(sv);
        }

        for (const off of validatedOffcuts) {
          const addRes = await db.collection('stocks').add({ data: off });
          createdOffcutIds.push(addRes._id);
        }

        await db.collection('executions').add({ data: execDoc });
        await db.collection('plans').doc(planId).update({
          data: { status: 'COMMITTED', committedAt: db.serverDate() }
        });

        return success(execDoc, '结案提交成功');
      } catch (err) {
        // 发生失败，执行安全补偿回滚
        for (const sv of consumedLogs) {
          await db.collection('stocks').doc(sv.id).update({
            data: { status: 'AVAILABLE', version: sv.version }
          }).catch(() => {});
        }
        for (const offId of createdOffcutIds) {
          await db.collection('stocks').doc(offId).remove().catch(() => {});
        }
        return fail(409, err.message || '提交失败，操作已全部回滚');
      }
    }
  },

  // 1. 新建工程项目
  async createProject(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    const name = (payload && payload.name) ? payload.name.trim() : '新工程项目';
    const projectDoc = {
      name,
      ownerId: wxContext.OPENID,
      factoryId: user ? user.factoryId : undefined,
      description: payload?.description || '',
      partGroups: payload?.partGroups || [],
      stocks: payload?.stocks || [],
      settings: payload?.settings || {},
      thumbnail: payload?.thumbnail || '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    };
    const res = await addProjectDocument(projectDoc);
    return success({ projectId: res._id, project: projectDoc }, '项目创建成功');
  },

  // 2. 保存/自动保存工程项目
  async saveProject(payload, wxContext) {
    const { projectId, name, partGroups, stocks, settings, thumbnail, description } = payload || {};
    if (!projectId) return fail(400, 'projectId is required');
    const updateData = {
      updatedAt: db.serverDate(),
    };
    if (name) updateData.name = name.trim();
    if (partGroups) updateData.partGroups = partGroups;
    if (stocks) updateData.stocks = stocks;
    if (settings) updateData.settings = settings;
    if (thumbnail) updateData.thumbnail = thumbnail;
    if (description !== undefined) updateData.description = description;

    const query = { _id: projectId, ownerId: wxContext.OPENID };
    const updated = await db.collection('projects').where(query).update({ data: updateData });
    if (!updated.stats || updated.stats.updated !== 1) return fail(404, 'Project not found');
    return success({ projectId }, '项目保存成功');
  },

  // 3. 项目列表（含缩略图、更新时间）
  async listProjects(payload, wxContext) {
    const query = { ownerId: wxContext.OPENID };

    const res = await db.collection('projects').where(query).orderBy('updatedAt', 'desc').get().catch(async () => {
      return await db.collection('projects').where(query).get();
    });
    return success(res.data || []);
  },

  // 4. 打开/获取单个项目
  async getProject(payload, wxContext) {
    const projectId = payload?.projectId;
    if (!projectId) return fail(400, 'projectId is required');
    const query = { _id: projectId, ownerId: wxContext.OPENID };
    const res = await db.collection('projects').where(query).get();
    if (!res.data || res.data.length === 0) return fail(404, 'Project not found');
    return success(res.data[0]);
  },

  // 5. 复制项目
  async copyProject(payload, wxContext) {
    const projectId = payload?.projectId;
    if (!projectId) return fail(400, 'projectId is required');
    const query = { _id: projectId, ownerId: wxContext.OPENID };
    const res = await db.collection('projects').where(query).get();
    if (!res.data || res.data.length === 0) return fail(404, 'Project not found');
    const original = res.data[0];
    const copyDoc = {
      ...original,
      _id: undefined,
      id: undefined,
      name: (payload.newName || `${original.name} (副本)`).trim(),
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    };
    delete copyDoc._id;
    delete copyDoc.id;
    const addRes = await db.collection('projects').add({ data: copyDoc });
    return success({ projectId: addRes._id, project: copyDoc }, '项目复制成功');
  },

  // 6. 重命名项目
  async renameProject(payload, wxContext) {
    const { projectId, name } = payload || {};
    if (!projectId || !name) return fail(400, 'projectId and name are required');
    const query = { _id: projectId, ownerId: wxContext.OPENID };
    const updated = await db.collection('projects').where(query).update({
      data: { name: name.trim(), updatedAt: db.serverDate() }
    });
    if (!updated.stats || updated.stats.updated !== 1) return fail(404, 'Project not found');
    return success({ projectId, name: name.trim() }, '重命名成功');
  },

  // 7. 删除项目
  async deleteProject(payload, wxContext) {
    const projectId = payload?.projectId;
    if (!projectId) return fail(400, 'projectId is required');
    const query = { _id: projectId, ownerId: wxContext.OPENID };
    const removed = await db.collection('projects').where(query).remove();
    if (!removed.stats || removed.stats.removed !== 1) return fail(404, 'Project not found');
    return success({ projectId }, '项目删除成功');
  },

  // 8. 本地缓存与云端同步
  async syncProjects(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    const localProjects = payload?.projects || [];
    const query = { ownerId: wxContext.OPENID };

    for (const p of localProjects) {
      if (!p.id && !p._id) {
        await db.collection('projects').add({
          data: {
            ...p,
            ownerId: wxContext.OPENID,
            factoryId: user ? user.factoryId : undefined,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
          }
        });
      }
    }
    const refreshed = await db.collection('projects').where(query).get();
    return success({ projects: refreshed.data || [] }, '同步完成');
  },

  // 查询历史
  async listHistory(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    const query = {};
    if (user && user.factoryId) {
      query.factoryId = user.factoryId;
    } else {
      query.ownerId = wxContext.OPENID;
    }
    const execRes = await db.collection('executions').where(query).orderBy('createdAt', 'desc').limit(20).get().catch(async () => {
      return await db.collection('executions').where(query).get();
    });
    return success(execRes.data);
  },

  // 清理数据
  async clearUserData(payload, wxContext) {
    const user = await getUser(wxContext.OPENID);
    if (user && user.factoryId) {
      if (user.role !== 'BOSS') {
        return fail(403, 'Only BOSS can clear factory data');
      }
      await db.collection('stocks').where({ factoryId: user.factoryId }).remove();
      await db.collection('plans').where({ factoryId: user.factoryId }).remove();
      await db.collection('executions').where({ factoryId: user.factoryId }).remove();
      await db.collection('quotes').where({ factoryId: user.factoryId }).remove();
      await db.collection('projects').where({ factoryId: user.factoryId }).remove();
    } else {
      await db.collection('stocks').where({ ownerId: wxContext.OPENID }).remove();
      await db.collection('plans').where({ ownerId: wxContext.OPENID }).remove();
      await db.collection('executions').where({ ownerId: wxContext.OPENID }).remove();
      await db.collection('quotes').where({ operatorId: wxContext.OPENID }).remove();
      await db.collection('projects').where({ ownerId: wxContext.OPENID }).remove();
    }
    return success({}, 'User data cleared');
  },

  // 智能体单轮对话与工具调度
  async agentTurn(payload, wxContext) {
    const data = await runAgentTurn(payload, wxContext, { db, getUser });
    return success(data);
  }
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return fail(401, 'User not authenticated');

  const { action, payload } = event;
  if (!controllers[action]) return fail(404, 'Action not found');

  try {
    return await controllers[action](payload, wxContext);
  } catch (err) {
    console.error(`[Error] Action: ${action}`, err);
    return fail(err.statusCode || 500, err.message);
  }
};
