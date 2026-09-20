import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

describe('cloud function production package compatibility', () => {
  it('uses a relative bundled core entry so deployment does not depend on npm installing a file dependency', () => {
    const cloudEntry = fs.readFileSync(
      path.resolve(__dirname, '../../cloudfunctions/api/index.js'),
      'utf8'
    );

    expect(cloudEntry).toContain("require('./core.js')");
    expect(cloudEntry).not.toContain("require('@qiaocai/core')");
  });

  it('loads the packaged core from CommonJS exactly as the cloud function does', () => {
    const packagedCore = path.resolve(__dirname, '../../cloudfunctions/api/core.js');
    const output = execFileSync(
      process.execPath,
      ['--no-experimental-require-module', '-e', `const core=require(${JSON.stringify(packagedCore)}); process.stdout.write(typeof core.solveCuttingPlan+','+typeof core.validateCandidate)`],
      { encoding: 'utf8' }
    );

    expect(output).toBe('function,function');
  });
});
