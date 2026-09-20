import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function collectTypeScriptFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(target);
    return entry.isFile() && entry.name.endsWith('.ts') ? [target] : [];
  });
}

describe('TDesign toast API compatibility', () => {
  it('does not call the unsupported Toast.clear method', () => {
    const pagesRoot = path.resolve(__dirname, '../../miniprogram/pages');
    const offenders = collectTypeScriptFiles(pagesRoot)
      .filter(file => fs.readFileSync(file, 'utf8').includes('Toast.clear'));

    expect(offenders).toEqual([]);
  });
});
