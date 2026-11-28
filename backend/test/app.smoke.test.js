import test from 'node:test';
import assert from 'node:assert/strict';

// Load the application after selecting an isolated test environment so the
// middleware never attempts to connect to or mutate a developer database.
process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { closePool } = await import('../src/db/pool.js');
const { getClientIp } = await import('../src/middleware/rateLimiter.js');

let server;
let baseUrl;

test.before(async () => {
  const app = createApp();
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
  await closePool();
});

test('root health response includes request correlation and security headers', async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.service, 'BruClinic API');
  assert.match(response.headers.get('x-request-id') || '', /^[0-9a-f-]{36}$/i);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('protected API routes reject anonymous requests consistently', async () => {
  const response = await fetch(`${baseUrl}/api/patients`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: 'Authentication required' });
});

test('CORS preflight is handled before authentication', async () => {
  const response = await fetch(`${baseUrl}/api/patients`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('direct clients cannot spoof their address with forwarding headers', () => {
  const ip = getClientIp({
    headers: { 'x-forwarded-for': '203.0.113.99', 'cf-connecting-ip': '198.51.100.42' },
    socket: { remoteAddress: '127.0.0.1' },
  });

  assert.equal(ip, '127.0.0.1');
});
