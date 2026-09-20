const automator = require('miniprogram-automator');
const path = require('node:path');

(async () => {
  const miniProgram = await automator.connect({
    wsEndpoint: 'ws://127.0.0.1:9527',
  });

  const logs = [];
  miniProgram.on('console', (entry) => logs.push({ type: 'console', entry }));
  miniProgram.on('exception', (entry) => logs.push({ type: 'exception', entry }));

  const home = await miniProgram.reLaunch('/pages/index/index');
  await home.waitFor(2500);
  await miniProgram.screenshot({ path: path.resolve(__dirname, '../artifacts/debug-home.png') });

  const gridItems = await home.$$('t-grid-item');
  const labels = [];
  for (const item of gridItems) labels.push(await item.attribute('text'));

  const before = { path: home.path, data: await home.data(), labels };
  if (gridItems[2]) await gridItems[2].tap();
  await home.waitFor(8000);

  const current = await miniProgram.currentPage();
  await miniProgram.screenshot({ path: path.resolve(__dirname, '../artifacts/debug-after-demo.png') });
  const after = { path: current.path, data: await current.data() };

  process.stdout.write(JSON.stringify({ before, after, logs }, null, 2));
  miniProgram.disconnect();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
