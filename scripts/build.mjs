import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== [巧裁 QIAOCAI] 开始执行工程构建 ===');

// 1. 构建 packages/core
const coreDir = path.resolve(rootDir, 'packages/core');
console.log(`[1/3] 编译 @qiaocai/core (${coreDir})...`);
execSync('npx tsc -b', { cwd: coreDir, stdio: 'inherit' });

// 2. 验证 dist 产物是否存在
const distFile = path.resolve(coreDir, 'dist/index.js');
if (fs.existsSync(distFile)) {
  console.log(`[2/3] 核心产物构建成功: ${distFile}`);
} else {
  console.error(`[ERROR] 未找到构建产物: ${distFile}`);
  process.exit(1);
}

// 3. 为 CommonJS 云函数打包核心代码（兼容不支持 require(ESM) 的 Node 运行时）
console.log(`[3/3] 打包 CommonJS 核心代码至云函数目录...`);
const cfCoreDir = path.resolve(rootDir, 'cloudfunctions/api');
await build({
  entryPoints: [path.resolve(coreDir, 'src/index.ts')],
  outfile: path.resolve(cfCoreDir, 'core.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: false
});

// 同步打包产物至 cloudfunctions/api/core_module (如存在)
const cfCoreModuleDir = path.resolve(cfCoreDir, 'core_module');
if (fs.existsSync(cfCoreModuleDir)) {
  fs.copyFileSync(path.resolve(cfCoreDir, 'core.js'), path.resolve(cfCoreModuleDir, 'index.js'));
  fs.copyFileSync(path.resolve(cfCoreDir, 'core.js'), path.resolve(cfCoreModuleDir, 'index.cjs'));
  console.log('[+] 同步 CommonJS 核心代码至 cloudfunctions/api/core_module/');
}

console.log('=== [巧裁 QIAOCAI] 构建全部完成 ===');
console.log('[+] 复制核心代码至小程序目录...');
const mpCoreDir = path.resolve(rootDir, 'miniprogram/utils/core');
if (!fs.existsSync(mpCoreDir)) fs.mkdirSync(mpCoreDir, { recursive: true });
fs.cpSync(path.resolve(coreDir, 'dist'), mpCoreDir, {
  recursive: true,
  filter: (src) => !src.endsWith('.map')
});

function cleanMiniprogramCore(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanMiniprogramCore(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.map')) {
        fs.unlinkSync(fullPath);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const stripped = content.replace(/\/\/# sourceMappingURL=.*$/gm, '');
        if (stripped !== content) {
          fs.writeFileSync(fullPath, stripped, 'utf8');
        }
      }
    }
  }
}
cleanMiniprogramCore(mpCoreDir);

