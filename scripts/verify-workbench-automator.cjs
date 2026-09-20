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
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 1. 打开需求页并导航至异形工作台
    console.log('Opening requirement page...');
    let page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(2000);
    console.log('Navigating to /pages/requirement/requirement...');
    page = await miniProgram.navigateTo('/pages/requirement/requirement');
    await page.waitFor(2000);

    console.log('Navigating to workbench...');
    page = await miniProgram.navigateTo('/pages/workbench/workbench');
    await page.waitFor(2000);

    // 2. 验证参数模板：RECT
    console.log('Testing RECT template...');
    await page.callMethod('selectTemplateKind', { currentTarget: { dataset: { kind: 'RECT' } } });
    await page.waitFor(500);
    let data = await page.data();
    if (data.selectedKind !== 'RECT' || data.vertexCount !== 4) {
      throw new Error(`RECT template verification failed: ${JSON.stringify(data)}`);
    }

    // 3. 验证参数模板：CIRCLE
    console.log('Testing CIRCLE template...');
    await page.callMethod('selectTemplateKind', { currentTarget: { dataset: { kind: 'CIRCLE' } } });
    await page.waitFor(500);
    data = await page.data();
    if (data.selectedKind !== 'CIRCLE' || data.vertexCount < 16) {
      throw new Error(`CIRCLE template verification failed: ${JSON.stringify(data)}`);
    }

    // 4. 验证参数模板：L_SHAPE
    console.log('Testing L_SHAPE template...');
    await page.callMethod('selectTemplateKind', { currentTarget: { dataset: { kind: 'L_SHAPE' } } });
    await page.waitFor(500);
    data = await page.data();
    if (data.selectedKind !== 'L_SHAPE' || data.vertexCount !== 6) {
      throw new Error(`L_SHAPE template verification failed: ${JSON.stringify(data)}`);
    }

    // 5. 验证自由绘制：切换 Tab
    console.log('Switching to draw tab...');
    await page.callMethod('onTabChange', { detail: { value: 'draw' } });
    await page.waitFor(800);

    // 清空画布
    await page.callMethod('clearDraw');
    await page.waitFor(400);

    // 注入一个自相交的多边形 (Bowtie: 4点自交)
    const bowtiePts = [
      { x: 50, y: 50 },
      { x: 250, y: 250 },
      { x: 250, y: 50 },
      { x: 50, y: 250 },
    ];
    await page.setData({ drawPoints: bowtiePts, isClosed: true });
    await page.callMethod('syncGeometryInfo', bowtiePts, 'POLYGON', '自相交测试');
    await page.waitFor(500);
    data = await page.data();
    if (!data.selfIntersecting) {
      throw new Error('Expected selfIntersecting to be true for bowtie');
    }

    // 尝试保存自相交多边形，必须被拦截，不会离开当前页
    console.log('Attempting to confirm self-intersecting polygon (should be intercepted)...');
    await page.callMethod('confirmShape');
    await page.waitFor(1000);
    page = await miniProgram.currentPage();
    if (page.path !== 'pages/workbench/workbench') {
      throw new Error(`Self-intersecting polygon was not intercepted! Navigated to: ${page.path}`);
    }
    console.log('Self-intersection correctly intercepted!');

    // 6. 验证撤销与重做
    console.log('Testing undo and redo...');
    await page.callMethod('clearDraw');
    const validPts1 = [{ x: 50, y: 50 }, { x: 200, y: 50 }];
    const validPts2 = [{ x: 50, y: 50 }, { x: 200, y: 50 }, { x: 100, y: 200 }];
    await page.setData({ drawPoints: validPts1 });
    await page.callMethod('pushDrawHistory', validPts1);
    await page.setData({ drawPoints: validPts2, isClosed: true });
    await page.callMethod('pushDrawHistory', validPts2);
    await page.waitFor(400);

    // 撤销
    await page.callMethod('drawUndo');
    await page.waitFor(400);
    data = await page.data();
    if (data.drawPoints.length !== 2) {
      throw new Error(`Undo failed, expected 2 points, got ${data.drawPoints.length}`);
    }

    // 重做
    await page.callMethod('drawRedo');
    await page.waitFor(400);
    data = await page.data();
    if (data.drawPoints.length !== 3) {
      throw new Error(`Redo failed, expected 3 points, got ${data.drawPoints.length}`);
    }

    // 7. 保存合法多边形，应成功返回 requirement 页
    console.log('Confirming valid drawn shape...');
    await page.callMethod('confirmShape');
    await page.waitFor(1500);
    page = await miniProgram.currentPage();
    if (page.path !== 'pages/requirement/requirement') {
      throw new Error(`Expected requirement page after valid save, got ${page.path}`);
    }

    const reqData = await page.data();
    const lastGroup = reqData.partGroups[reqData.partGroups.length - 1];
    if (!lastGroup || lastGroup.shape !== 'POLYGON') {
      throw new Error(`Part group was not saved: ${JSON.stringify(lastGroup)}`);
    }

    console.log('=== Workbench Interactive Automator Verification Passed Successfully! ===');
    process.stdout.write(JSON.stringify({
      status: 'SUCCESS',
      templatesTested: ['RECT', 'CIRCLE', 'L_SHAPE'],
      drawTested: ['add', 'undo', 'redo', 'selfIntersectionIntercept', 'confirmValid'],
      savedPart: lastGroup.name,
    }, null, 2));
  } finally {
    await miniProgram.disconnect();
  }
})().catch((err) => {
  console.error('[Workbench Automator Error]', err);
  process.exitCode = 1;
});
