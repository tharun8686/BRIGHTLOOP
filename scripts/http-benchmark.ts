import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createUser } from '../src/lib/users';
import { createSession } from '../src/lib/sessions';
import { closeDatabase } from '../src/lib/db';
const file = readdirSync('tmp')
  .filter((n) => /^benchmark-\d+\.sqlite$/.test(n))
  .sort()
  .at(-1);
if (!file) throw new Error('Run benchmark.ts first.');
process.env.SQLITE_PATH = path.resolve('tmp', file);
const u = createUser(
  'Demo performance administrator',
  'benchmark-' + Date.now() + '@example.test',
  'Aa!' + randomBytes(20).toString('hex'),
  'Admin',
  true,
);
const token = createSession(u.id);
closeDatabase();
const port = 3118,
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      SCHEDULER_ENABLED: 'false',
      SMTP_HOST: '',
      MAIL_FROM: '',
    },
    stdio: 'ignore',
  },
);
async function main() {
  for (let n = 0; n < 120; n++) {
    try {
      if ((await fetch(origin + '/auth/login')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const results: any = {
    method:
      'Authenticated loopback HTTP requests including complete streamed HTML body; development server; one warm-up then 20 sequential requests per route. Excludes browser hydration and network latency.',
    timings: {},
  };
  for (const route of [
    '/app',
    '/app/subscriptions?page=250',
    '/app/invoices?q=99&status=Confirmed&page=2',
    '/app/payments?page=250',
  ]) {
    const times = [];
    for (let i = 0; i < 21; i++) {
      const start = performance.now();
      const response = await fetch(origin + route, {
        headers: { Cookie: 'brightloop_session=' + token },
      });
      const body = await response.text();
      if (!response.ok || body.includes('Sign in to Brightloop'))
        throw new Error('Benchmark request failed.');
      if (i) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    results.timings[route] = { p50: times[10], p95: times[18], max: times[19] };
  }
  writeFileSync('tmp/http-benchmark-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => server.kill());
