// Runs the API (http://localhost:8080) and the Vite dev server (http://localhost:5173) together.
import { spawn } from 'node:child_process';

const run = (name, cwd, cmd, args, color) => {
  const p = spawn(cmd, args, { cwd, shell: process.platform === 'win32', env: { ...process.env, FORCE_COLOR: '1' } });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  for (const s of [p.stdout, p.stderr]) s.on('data', d => process.stdout.write(d.toString().replace(/^(?=.)/gm, tag)));
  p.on('exit', code => { console.log(`${tag}exited with ${code}`); process.exit(code ?? 0); });
  return p;
};
const procs = [
  run('api', 'server', 'npx', ['tsx', 'watch', 'src/main.ts'], 35),
  run('web', 'web', 'npx', ['vite'], 36),
];
process.on('SIGINT', () => { procs.forEach(p => p.kill('SIGINT')); process.exit(0); });
