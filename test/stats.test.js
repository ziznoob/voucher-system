import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

test('campaign stats', async () => {
  const { http } = setup();
  const res = await http.get('/campaigns/1/stats');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    campaignId: 1,
    name: 'Raya Flash Deal',
    totalStock: 100,
    remainingStock: 100,
    redeemedCount: 2, // vouchers with a redemption record (same meaning as the Java version)
    activeVoucherCount: 4,
  });
});

test('stats reflect a new redemption', async () => {
  const { http } = setup();
  await http.post('/vouchers/RAYA-0001/redeem?userId=u1');
  const res = await http.get('/campaigns/1/stats');
  assert.equal(res.body.remainingStock, 99);
  assert.equal(res.body.redeemedCount, 3);
  assert.equal(res.body.activeVoucherCount, 3);
});

test('unknown campaign returns 404 (Java threw NoSuchElementException -> 500)', async () => {
  const { http } = setup();
  const res = await http.get('/campaigns/999/stats');
  assert.equal(res.status, 404);
  assert.equal(res.body.result, 'FAILED');
});

test('non-numeric campaign id returns 400', async () => {
  const { http } = setup();
  assert.equal((await http.get('/campaigns/abc/stats')).status, 400);
});

test('stats by client', async () => {
  const { http } = setup();
  const res = await http.get('/campaigns/by-client/ACME/stats');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((s) => s.campaignId), [1, 3]);
  assert.equal(res.body[1].activeVoucherCount, 1);
});

test('stats by unknown client returns an empty list', async () => {
  const { http } = setup();
  const res = await http.get('/campaigns/by-client/NOBODY/stats');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});
