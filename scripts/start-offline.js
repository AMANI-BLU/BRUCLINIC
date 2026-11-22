import { spawn } from 'node:child_process';
import { Socket } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function checkPort(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = new Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function main() {
  console.log(`\n${C.cyan}${C.bold}╔══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}║           BruClinic — Local Offline Environment              ║${C.reset}`);
  console.log(`${C.cyan}${C.bold}╚══════════════════════════════════════════════════════════════╝${C.reset}\n`);

  // 1. Check local PostgreSQL
  process.stdout.write(`  [1/3] Checking local database (localhost:5432)... `);
  const dbRunning = await checkPort(5432);
  if (dbRunning) {
    console.log(`${C.green}${C.bold}READY${C.reset}`);
  } else {
    console.log(`${C.yellow}${C.bold}NOT DETECTED${C.reset}`);
    console.log(`\n  ${C.yellow}⚠ Warning: Local PostgreSQL is not listening on port 5432.${C.reset}`);
    console.log(`    To start it locally:`);
    console.log(`    • Option A (Windows Service): ${C.bold}net start postgresql-x64-18${C.reset} (in an Administrator terminal)`);
    console.log(`    • Option B (Docker):          ${C.bold}docker compose up -d${C.reset}`);
    console.log(`    (The backend and frontend will start, but database queries require PostgreSQL)\n`);
  }

  // 2. Start backend
  console.log(`  [2/3] Starting backend API on ${C.cyan}http://localhost:4000${C.reset}...`);
  const isWin = process.platform === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';

  const backend = spawn(npmCmd, ['run', 'start'], {
    cwd: path.join(ROOT, 'backend'),
    stdio: 'pipe',
    shell: true,
  });

  backend.stdout.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(l => {
      if (l) console.log(`${C.blue}[API]${C.reset} ${l}`);
    });
  });

  backend.stderr.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(l => {
      if (l) console.log(`${C.red}[API ERR]${C.reset} ${l}`);
    });
  });

  // 3. Start frontend
  console.log(`  [3/3] Starting frontend web app on ${C.cyan}http://localhost:5173${C.reset}...\n`);
  const frontend = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(ROOT, 'frontend'),
    stdio: 'pipe',
    shell: true,
  });

  frontend.stdout.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(l => {
      if (l) console.log(`${C.magenta}[UI]${C.reset}  ${l}`);
    });
  });

  frontend.stderr.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(l => {
      if (l) console.log(`${C.yellow}[UI LOG]${C.reset} ${l}`);
    });
  });

  const shutdown = () => {
    console.log(`\n${C.yellow}Shutting down local BruClinic...${C.reset}`);
    backend.kill();
    frontend.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
