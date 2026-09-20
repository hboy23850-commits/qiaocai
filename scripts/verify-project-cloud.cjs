const automator = require('miniprogram-automator');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9527' });
  const errors = [];
  miniProgram.on('console', entry => {
    if (entry.type === 'error') errors.push({ type: 'console', entry });
  });
  miniProgram.on('exception', entry => errors.push({ type: 'exception', entry }));

  const waitForPage = async (targetPath, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(500);
      miniProgram.pageMap.clear();
      try {
        const p = await miniProgram.currentPage();
        if (p && p.path === targetPath) return p;
      } catch (e) {}
    }
    miniProgram.pageMap.clear();
    const finalP = await miniProgram.currentPage();
    throw new Error(`Expected page ${targetPath}, but current page is ${finalP ? finalP.path : 'null'}`);
  };

  try {
    await sleep(3000);
    console.log('[Project Test] Relaunching to index...');
    let page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(2000);

    console.log('[Project Test] Listing projects...');
    const existing = await miniProgram.evaluate(async function () {
      return await wx.cloud.callFunction({ name: 'api', data: { action: 'listProjects', payload: {} } });
    });
    for (const item of existing?.result?.data || []) {
      if (item.name === '自动化保存验证') {
        console.log('[Project Test] Deleting old project...');
        await miniProgram.evaluate(async function (projectId) {
          return await wx.cloud.callFunction({ name: 'api', data: { action: 'deleteProject', payload: { projectId } } });
        }, item._id || item.id);
      }
    }
    console.log('[Project Test] Creating project...');
    const createResult = await miniProgram.evaluate(async function () {
      return await wx.cloud.callFunction({
        name: 'api',
        data: {
          action: 'createProject',
          payload: { name: '自动化保存验证', partGroups: [], settings: { kerfMm: 2 } },
        },
      });
    });
    if (!createResult?.result || createResult.result.code !== 200) {
      throw new Error(`createProject failed: ${JSON.stringify(createResult)}`);
    }
    const project = {
      ...(createResult.result.data.project || {}),
      _id: createResult.result.data.projectId,
    };
    console.log('[Project Test] Setting activeProject in globalData...');
    await miniProgram.evaluate(function (value) {
      getApp().globalData.activeProject = value;
      getApp().globalData.customPartGroups = [];
    }, project);

    console.log('[Project Test] Navigating to requirement?project=1...');
    await miniProgram.evaluate(function () {
      wx.navigateTo({ url: '/pages/requirement/requirement?project=1' });
    });
    page = await waitForPage('pages/requirement/requirement');
    console.log('[Project Test] Reading requirement page data...');
    const loaded = await page.data();
    if (loaded.activeProjectId !== project._id || loaded.partGroups.length !== 0) {
      throw new Error(`project load mismatch: ${JSON.stringify(loaded)}`);
    }

    console.log('[Project Test] Adding group...');
    await page.callMethod('addGroup');
    console.log('[Project Test] Updating name...');
    await page.callMethod('updateName', { currentTarget: { dataset: { index: 0 } }, detail: { value: '自动保存零件' } });
    console.log('[Project Test] Updating width...');
    await page.callMethod('updateWidth', { currentTarget: { dataset: { index: 0 } }, detail: { value: '88' } });
    console.log('[Project Test] Updating height...');
    await page.callMethod('updateHeight', { currentTarget: { dataset: { index: 0 } }, detail: { value: '42' } });
    console.log('[Project Test] Waiting for autosave...');
    await sleep(2500);

    console.log('[Project Test] Checking saved project from cloud...');

    const saved = await miniProgram.evaluate(async function (projectId) {
      return await wx.cloud.callFunction({
        name: 'api',
        data: { action: 'getProject', payload: { projectId } },
      });
    }, project._id);
    const savedProject = saved?.result?.data;
    if (!savedProject || savedProject.partGroups?.[0]?.name !== '自动保存零件') {
      throw new Error(`autosave mismatch: ${JSON.stringify(saved)}`);
    }
    if (savedProject.partGroups[0].targetWidth !== 880 || savedProject.partGroups[0].targetHeight !== 420) {
      throw new Error(`saved dimensions mismatch: ${JSON.stringify(savedProject.partGroups[0])}`);
    }
    if (errors.length) throw new Error(`runtime errors: ${JSON.stringify(errors)}`);
    const finalState = (await page.data()).saveState;
    const cleanup = await miniProgram.evaluate(async function (projectId) {
      return await wx.cloud.callFunction({ name: 'api', data: { action: 'deleteProject', payload: { projectId } } });
    }, project._id);
    if (cleanup?.result?.code !== 200) throw new Error(`cleanup failed: ${JSON.stringify(cleanup)}`);
    process.stdout.write(JSON.stringify({
      projectId: project._id,
      saveState: finalState,
      savedPart: savedProject.partGroups[0],
      cleanup: 'deleted',
    }, null, 2));
  } finally {
    await miniProgram.disconnect();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
