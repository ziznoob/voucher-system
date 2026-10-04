import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuditClient } from '../src/services/auditClient.js';

const quiet = { info() {}, warn() {} };

test('sends api key as a header, not in the payload', async () => {
  let captured;
  const client = createAuditClient({
    url: 'http://audit.test/events', apiKey: 'secret', logger: quiet,
    fetchImpl: async (url, opts) => { captured = { url, opts }; return { ok: true, status: 200 }; },
  });
  await client.recordRedemption({ clientCode: 'ACME', voucherCode: 'RAYA-0001', userId: 'u1' });

  assert.equal(captured.url, 'http://audit.test/events');
  assert.equal(captured.opts.headers['X-Api-Key'], 'secret');
  assert.deepEqual(JSON.parse(captured.opts.body), { clientCode: 'ACME', voucherCode: 'RAYA-0001', userId: 'u1' });
  assert.ok(captured.opts.signal, 'request has a timeout signal');
});

test('non-2xx response is an error', async () => {
  const client = createAuditClient({ url: 'http://x', apiKey: 'k', logger: quiet, fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(client.recordRedemption({}), /503/);
});

test('no URL configured -> skipped, no request made', async () => {
  let called = false;
  const client = createAuditClient({ url: '', apiKey: '', logger: quiet, fetchImpl: async () => { called = true; } });
  await client.recordRedemption({ voucherCode: 'X' });
  assert.equal(called, false);
});
