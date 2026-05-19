// ── Launcher: kills any process using our ports, then starts the server ──────
import { execSync, spawn } from 'child_process';
import { fileURLToPath }   from 'url';
import { join, dirname }   from 'path';

const __dir    = dirname(fileURLToPath(import.meta.url));
const INDEX    = join(__dir, 'index.js');
const PORTS    = [3001, 3002];

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`,
      { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] });
    const pids = new Set(
      out.split('\n')
         .map(l => l.trim().split(/\s+/).pop())
         .filter(p => /^\d+$/.test(p) && p !== '0')
    );
    pids.forEach(pid => {
      try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); } catch {}
    });
  } catch { /* port not in use — ok */ }
}

if (process.platform === 'win32') {
  console.log('🔄 Liberando puertos...');
  PORTS.forEach(killPort);
}

setTimeout(() => {
  const child = spawn(process.execPath, ['--no-warnings', INDEX], { stdio: 'inherit' });
  child.on('exit', code => process.exit(code ?? 0));
}, 600);
