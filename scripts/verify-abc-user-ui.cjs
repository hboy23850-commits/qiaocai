const automator = require('miniprogram-automator');
const path = require('node:path');
const fs = require('node:fs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9527' });
  const runtimeErrors = [];
  miniProgram.on('console', (entry) => {
    if (entry.type === 'error') runtimeErrors.push({ type: 'console', entry });
  });
  miniProgram.on('exception', (entry) => runtimeErrors.push({ type: 'exception', entry }));

  const artifactsDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const currentPage = async (expected, attempts = 30) => {
    for (let i = 0; i < attempts; i++) {
      await sleep(300);
      miniProgram.pageMap.clear();
      const page = await miniProgram.currentPage();
      if (page && page.path === expected) return page;
    }
    const page = await miniProgram.currentPage();
    throw new Error(`Expected ${expected}, got ${page ? page.path : 'null'}`);
  };

  const openHome = async () => {
    await miniProgram.reLaunch('/pages/index/index');
    return currentPage('pages/index/index');
  };

  const tapMode = async (selector, expectedTab) => {
    const home = await openHome();
    const element = await home.$(selector);
    if (!element) throw new Error(`Missing clickable homepage entry ${selector}`);
    await element.tap();
    const workbench = await currentPage('pages/workbench/workbench');
    const data = await workbench.data();
    if (data.currentTab !== expectedTab) {
      throw new Error(`${selector} opened tab ${data.currentTab}, expected ${expectedTab}`);
    }
    return { workbench, data };
  };

  try {
    await sleep(3000);
    let home = await openHome();
    await miniProgram.screenshot({ path: path.join(artifactsDir, 'abc-01-home-entry.png') });

    const a = await tapMode('#mode-a-template', 'template');
    if (!a.data.templateList || a.data.templateList.length !== 9 || a.data.vertexCount < 3) {
      throw new Error('A template mode did not expose 9 working templates');
    }
    await miniProgram.screenshot({ path: path.join(artifactsDir, 'abc-02-template.png') });

    const b = await tapMode('#mode-b-trace', 'draw');
    if (b.data.geometrySource !== 'DRAW' || b.data.drawPoints.length < 3 || !b.data.isClosed) {
      throw new Error(`B template trace was not initialized: ${JSON.stringify(b.data)}`);
    }
    await miniProgram.screenshot({ path: path.join(artifactsDir, 'abc-03-template-trace.png') });
    const blank = await b.workbench.$('#blank-draw-button');
    if (!blank) throw new Error('B blank drawing button is missing');
    await blank.tap();
    await sleep(300);
    const blankData = await b.workbench.data();
    if (blankData.drawPoints.length !== 0 || blankData.isClosed) {
      throw new Error('Blank point drawing did not start with an empty open contour');
    }
    await miniProgram.screenshot({ path: path.join(artifactsDir, 'abc-04-blank-draw.png') });

    const c = await tapMode('#mode-c-photo', 'photo');
    if (c.data.geometrySource !== 'PHOTO' || c.data.photoStatus !== '尚未选择图片') {
      throw new Error(`C photo mode was not ready: ${JSON.stringify(c.data)}`);
    }
    const choosePhoto = await c.workbench.$('#choose-photo-button');
    if (!choosePhoto) throw new Error('C choose-photo button is missing');
    await miniProgram.screenshot({ path: path.join(artifactsDir, 'abc-05-photo.png') });
    const samplePhoto = await c.workbench.$('#sample-photo-button');
    if (!samplePhoto) throw new Error('C sample-photo button is missing');
    await samplePhoto.tap();
    await sleep(2500);
    const recognized = await c.workbench.data();
    if (recognized.currentTab !== 'draw' || recognized.geometrySource !== 'PHOTO' || recognized.drawPoints.length < 3) {
      throw new Error(`C sample recognition failed: ${JSON.stringify(recognized)}`);
    }
    await miniProgram.screenshot({ path: path.join(artifactsDir, 'abc-06-photo-recognized.png') });

    if (runtimeErrors.length) throw new Error(JSON.stringify(runtimeErrors));
    console.log(JSON.stringify({
      status: 'SUCCESS',
      interaction: 'real element tap only',
      A: { templates: a.data.templateList.length, tab: a.data.currentTab },
      B: { tracedVertices: b.data.drawPoints.length, blankStartsEmpty: true },
      C: { tab: c.data.currentTab, choosePhotoButton: true, sampleRecognizedVertices: recognized.drawPoints.length },
    }, null, 2));
  } finally {
    await miniProgram.disconnect();
  }
})().catch((error) => {
  console.error('[ABC UI verification failed]', error);
  process.exitCode = 1;
});
