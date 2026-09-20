const automator = require('miniprogram-automator');
const path = require('node:path');

(async () => {
  const miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9527' });
  const logs = [];
  miniProgram.on('console', entry => logs.push({ type: 'console', entry }));
  miniProgram.on('exception', entry => logs.push({ type: 'exception', entry }));
  try {
  await new Promise(resolve => setTimeout(resolve, 5000));
  let page = await miniProgram.currentPage();
  if (page.path !== 'pages/compare/compare') throw new Error(`Expected compare page, got ${page.path}`);
  const data = await page.data();
  const candidate = data.candidates
    .filter(item => item.isComplete)
    .sort((a, b) => a.metrics.newSheetsUsed - b.metrics.newSheetsUsed)[0];
  if (!candidate) throw new Error('No complete candidate');

  await page.callMethod('selectCandidate', {
    currentTarget: { dataset: { id: candidate.candidateId } }
  });
  await page.waitFor(3000);
  page = await miniProgram.currentPage();
  const result = {
    path: page.path,
    selectedCandidateId: candidate.candidateId,
    newSheetsUsed: candidate.metrics.newSheetsUsed,
    pageData: await page.data(),
    logs
  };
  await miniProgram.screenshot({ path: path.resolve('artifacts/debug-cut-view.png') });
  process.stdout.write(JSON.stringify(result, null, 2));
  } finally {
    await miniProgram.disconnect();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
