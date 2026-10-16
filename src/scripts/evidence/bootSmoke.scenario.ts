import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { Harness } from './harness';

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.once('error', rej);
    srv.listen(0, () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => res(port));
    });
  });
}

async function waitForHealth(url: string, attempts: number): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    try {
      return (await fetch(url)).status;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return 0;
}

export async function runBootSmoke(h: Harness, mongoUri: string): Promise<void> {
  const port = await freePort();
  const root = resolve(__dirname, '../../..');
  const child = spawn(resolve(root, 'node_modules/.bin/tsx'), ['src/server.ts'], {
    cwd: root,
    env: { ...process.env, MONGODB_URI: mongoUri, PORT: String(port), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d: Buffer) => (output += d.toString()));
  child.stderr.on('data', (d: Buffer) => (output += d.toString()));
  const exited = new Promise<number | null>((res) => child.on('exit', (code) => res(code)));

  const healthStatus = await waitForHealth(`http://127.0.0.1:${port}/health`, 40);
  child.kill('SIGINT');
  const exitCode = await Promise.race([
    exited,
    new Promise<string>((r) => setTimeout(() => r('TIMEOUT'), 15000)),
  ]);
  if (exitCode === 'TIMEOUT') child.kill('SIGKILL');

  h.record({
    name: 'Dev boot smoke: src/server.ts starts, /health OK, SIGINT shuts down gracefully',
    method: 'GET',
    path: `/health (child process on port ${port})`,
    status: healthStatus,
    responseBody: { exitCode, gracefulShutdownLogged: output.includes('Shutdown complete') },
    expected: '/health 200, exit code 0 after SIGINT, "Shutdown complete" logged',
    pass: healthStatus === 200 && exitCode === 0 && output.includes('Shutdown complete'),
  });
}
