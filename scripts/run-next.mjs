// Next.js を起動するラッパー。
// Node.js 25 は Web Storage を既定で有効にしており、その localStorage に getItem が無いため
// Next.js のサーバー描画が 500 になる。この実験機能を無効にして起動する（Windows / macOS / Linux 共通）。
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const args = process.argv.slice(2);

const flag = '--no-experimental-webstorage';
const existing = process.env.NODE_OPTIONS ?? '';
const env = {
  ...process.env,
  NODE_OPTIONS: existing.includes(flag) ? existing : `${existing} ${flag}`.trim(),
};

const child = spawn(process.execPath, [nextBin, ...args], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
