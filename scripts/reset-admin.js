#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const child = spawn('node', ['scripts/reset-admin.js', ...args], {
  cwd: path.join(ROOT, 'backend'),
  stdio: 'inherit',
});

child.on('exit', code => {
  process.exit(code ?? 0);
});
