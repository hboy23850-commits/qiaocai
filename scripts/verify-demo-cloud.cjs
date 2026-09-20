const automator = require('miniprogram-automator');
const path = require('node:path');

(async () => {
  const miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9527' });
  const logs = [];
  miniProgram.on('console', entry => logs.push({ type: 'console', entry }));
  miniProgram.on('exception', entry => logs.push({ type: 'exception', entry }));
  try {
  // DevTools 刚建立 WS 连接时页面元数据仍可能为空。
  await new Promise(resolve => setTimeout(resolve, 5000));
  let page = await miniProgram.reLaunch('/pages/index/index');
  await page.waitFor(2000);
  await page.callMethod('startDemo');
  await page.waitFor(2500);

  page = await miniProgram.currentPage();
  const requirement = { path: page.path, data: await page.data() };
  if (page.path === 'pages/requirement/requirement') {
    await page.callMethod('navToFlex');
    await page.waitFor(1200);
  }

  page = await miniProgram.currentPage();
  const flex = { path: page.path, data: await page.data() };
  if (page.path === 'pages/flex/flex') {
    await page.callMethod('solve');
    await page.waitFor(7000);
  }

  page = await miniProgram.currentPage();
  const result = { path: page.path, data: await page.data() };
  await miniProgram.screenshot({ path: path.resolve('artifacts/debug-demo-result.png') });
  process.stdout.write(JSON.stringify({ requirement, flex, result, logs }, null, 2));
  } finally {
    await miniProgram.disconnect();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
