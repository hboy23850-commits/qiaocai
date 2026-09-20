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

    const waitForPage = async (targetPath, maxAttempts = 30) => {
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        miniProgram.pageMap.clear();
        const p = await miniProgram.currentPage();
        if (p && p.path === targetPath) return p;
      }
      miniProgram.pageMap.clear();
      const finalP = await miniProgram.currentPage();
      throw new Error(`Expected page ${targetPath}, but current page is ${finalP ? finalP.path : 'null'}`);
    };

    // 1. 首页启动演示
    console.log('Relaunching to /pages/index/index...');
    await miniProgram.evaluate(async function () {
      return new Promise((resolve) => {
        wx.reLaunch({ url: '/pages/index/index', success: resolve, fail: resolve });
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    miniProgram.pageMap.clear();
    let page = await miniProgram.currentPage();
    console.log('Current page on index:', page.path);
    await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'flow-01-index.png') });

    // 2. 点击快速案例
    console.log('Triggering startDemo...');
    await page.callMethod('startDemo');
    page = await waitForPage('pages/requirement/requirement');
    console.log('Page after demo start:', page.path);
    await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'flow-02-requirement.png') });

    // 3. 进入尺寸微调页
    console.log('Navigating to flex page...');
    await page.callMethod('navToFlex');
    page = await waitForPage('pages/flex/flex');
    console.log('Page on flex:', page.path);
    await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'flow-03-flex.png') });

    // 4. 云端排料求解
    console.log('Solving layout...');
    await page.callMethod('solve');
    page = await waitForPage('pages/compare/compare', 40);
    console.log('Page after solve:', page.path);
    await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'flow-04-compare.png') });

    const compareData = await page.data();
    const candidate = (compareData.candidates || []).find((c) => c.isComplete && c.metrics.newSheetsUsed === 1);
    if (!candidate) {
      throw new Error(`Expected 1-sheet candidate, got: ${JSON.stringify(compareData.candidates)}`);
    }

    // 6. 选择 1 张材料方案并导航至裁切指导
    console.log('Selecting candidate id:', candidate.candidateId);
    await page.callMethod('selectCandidate', { currentTarget: { dataset: { id: candidate.candidateId } } });
    page = await waitForPage('pages/cut-view/cut-view');
    console.log('Page after candidate selection:', page.path);
    await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'flow-05-cut-view.png') });

    // 7. 进入结案与实测余料登记页
    console.log('Navigating to finish page...');
    await page.callMethod('navToFinish');
    page = await waitForPage('pages/finish/finish');
    console.log('Page finish:', page.path);
    await miniProgram.screenshot({ path: path.resolve(artifactsDir, 'flow-06-finish.png') });

    const finishData = await page.data();
    console.log('Finish data:', {
      planId: finishData.planId,
      candidateId: finishData.candidateId,
      offcutCount: finishData.offcutItems?.length,
      usedStocksCount: finishData.usedStocksCount,
    });

    if (!finishData.planId || !finishData.candidateId) {
      throw new Error('Finish page missing planId or candidateId');
    }

    if (runtimeErrors.length > 0) {
      throw new Error(`Detected ${runtimeErrors.length} runtime error(s): ${JSON.stringify(runtimeErrors)}`);
    }

    console.log('=== Full User Flow End-to-End Test Passed Successfully! ===');
    process.stdout.write(JSON.stringify({
      status: 'SUCCESS',
      flow: 'index -> requirement -> flex -> compare -> cut-view -> finish',
      sheetsUsed: candidate.metrics.newSheetsUsed,
      candidateId: candidate.candidateId,
      planId: finishData.planId,
      offcutsAvailable: finishData.offcutItems?.length || 0,
    }, null, 2));
  } finally {
    await miniProgram.disconnect();
  }
})().catch((err) => {
  console.error('[Full Flow Automator Error]', err);
  process.exitCode = 1;
});
