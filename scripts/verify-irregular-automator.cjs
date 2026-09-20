const automator = require('miniprogram-automator');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  console.log('Connecting to WeChat Automator on ws://127.0.0.1:9527...');
  const miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9527' });
  const runtimeErrors = [];
  miniProgram.on('console', (entry) => {
    if (entry.type === 'error') runtimeErrors.push({ type: 'console', entry });
  });
  miniProgram.on('exception', (entry) => runtimeErrors.push({ type: 'exception', entry }));

  try {
    const artifactsDir = path.resolve(__dirname, '../artifacts');
    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
    // IDE 刚开启自动化时 WebView 元数据可能还未注册。
    await new Promise((resolve) => setTimeout(resolve, 5000));

  // 1. 打开首页并导航至需求录入页（建立真实导航栈：index -> requirement -> workbench）
  console.log('Relaunching to /pages/index/index...');
  let page = await miniProgram.reLaunch('/pages/index/index');
  await page.waitFor(2000);
  console.log('Navigating to /pages/requirement/requirement...');
  page = await miniProgram.navigateTo('/pages/requirement/requirement');
  await page.waitFor(2000);
  page = await miniProgram.currentPage();
  console.log('Current page:', page.path);

  // 2. 导航至异形工作台
  console.log('Navigating to /pages/workbench/workbench...');
  page = await miniProgram.navigateTo('/pages/workbench/workbench');
  await page.waitFor(2500);
  page = await miniProgram.currentPage();
  console.log('Now on workbench page:', page.path);
  await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'workbench-01-initial.png') });

  // 选择 L_SHAPE 模板
  console.log('Selecting L_SHAPE template...');
  await page.callMethod('selectTemplateKind', {
    currentTarget: { dataset: { kind: 'L_SHAPE' } }
  });
  await page.waitFor(1200);
  await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'workbench-02-lshape.png') });

  // 切换至自由绘制 TAB
  console.log('Switching to draw tab...');
  await page.callMethod('onTabChange', {
    detail: { value: 'draw' }
  });
  await page.waitFor(1200);
  await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'workbench-03-draw.png') });

  // 返回模板并保存 L 形；自由绘制在上一步已完成画布交互验证。
  await page.callMethod('onTabChange', { detail: { value: 'template' } });
  await page.callMethod('selectTemplateKind', { currentTarget: { dataset: { kind: 'L_SHAPE' } } });
  await page.waitFor(600);

  // 确认保存并返回
  console.log('Confirming shape...');
  await page.callMethod('confirmShape');
  await page.waitFor(2000);

  // 3. 需求录入页（已添加异形零件）
  miniProgram.pageMap.clear();
  page = await miniProgram.currentPage();
  console.log('Page after save:', page.path);
  await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'workbench-04-requirement.png') });

  // 删除页面默认矩形，只保留刚刚录入的 L 形，验证真实异形排料链路。
  const requirementData = await page.data();
  if (!requirementData.partGroups || !requirementData.partGroups.some((group) => group.geometry?.kind === 'L_SHAPE')) {
    throw new Error(`L_SHAPE was not returned to requirement page: ${JSON.stringify(requirementData.partGroups)}`);
  }
  if (requirementData.partGroups.length > 1) {
    await page.callMethod('removeGroup', { currentTarget: { dataset: { index: 0 } } });
  }
  const prepared = await miniProgram.evaluate(async function () {
    const result = await wx.cloud.callFunction({ name: 'api', data: { action: 'prepareDemo', payload: {} } });
    if (result?.result?.code === 200) getApp().globalData.stockList = result.result.data.stocks || [];
    return result;
  });
  if (prepared?.result?.code !== 200) throw new Error(`Unable to prepare stock: ${JSON.stringify(prepared)}`);
  await page.callMethod('navToFlex');
  await page.waitFor(3000);
  miniProgram.pageMap.clear();
  page = await miniProgram.currentPage();
  if (page.path !== 'pages/flex/flex') throw new Error(`Expected flex page, got ${page.path}`);
  await page.callMethod('solve');
  await page.waitFor(8000);
  miniProgram.pageMap.clear();
  page = await miniProgram.currentPage();
  if (page.path !== 'pages/compare/compare') {
    throw new Error(`Expected compare page, got ${page.path}; data=${JSON.stringify(await page.data())}; logs=${JSON.stringify(runtimeErrors)}`);
  }
  const compareData = await page.data();
  const profileCandidate = (compareData.candidates || []).find((candidate) => candidate.isComplete && candidate.layoutMode === 'PROFILE');
  if (!profileCandidate || !profileCandidate.profilePlacements?.length) {
    throw new Error(`No complete PROFILE candidate: ${JSON.stringify(compareData.candidates)}`);
  }
  await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'workbench-05-profile-result.png') });
  await page.callMethod('selectCandidate', { currentTarget: { dataset: { id: profileCandidate.candidateId } } });
  await page.waitFor(3000);
  miniProgram.pageMap.clear();
  page = await miniProgram.currentPage();
  if (page.path !== 'pages/cut-view/cut-view') throw new Error(`Expected cut-view page, got ${page.path}`);
  const cutData = await page.data();
  if (cutData.layoutMode !== 'PROFILE' || !cutData.steps?.length) {
    throw new Error(`Invalid profile cut guidance: ${JSON.stringify(cutData)}`);
  }
  await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'workbench-06-profile-cut.png') });

  // 4. 打开项目管理历史页
  console.log('Navigating to /pages/history/history...');
  await miniProgram.navigateTo('/pages/history/history');
  await page.waitFor(2000);
  miniProgram.pageMap.clear();
  page = await miniProgram.currentPage();
  console.log('Page history:', page.path);
  await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'workbench-07-projects.png') });

    if (runtimeErrors.length > 0) {
      throw new Error(`Detected ${runtimeErrors.length} runtime error(s): ${JSON.stringify(runtimeErrors)}`);
    }
    console.log('=== All Automator Screenshots Captured Successfully! ===');
  } finally {
    await miniProgram.disconnect();
  }
})().catch(err => {
  console.error('[Automator Error]', err);
  process.exitCode = 1;
});
