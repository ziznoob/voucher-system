import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

test('list campaigns', async () => {
  const { http } = setup();
  const res = await http.get('/campaigns');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((c) => c.id), [1, 2, 3]);
  assert.deepEqual(res.body[2], {
    id: 3, name: 'Expired Test Campaign', clientCode: 'ACME', totalStock: 10, remainingStock: 0, active: false,
  });
});

test('list vouchers for a campaign', async () => {
  const { http } = setup();
  const res = await http.get('/campaigns/2/vouchers');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((v) => v.code), ['MRDK-0001', 'MRDK-0002']);
});

test('list vouchers for unknown or invalid campaign id', async () => {
  const { http } = setup();
  assert.equal((await http.get('/campaigns/999/vouchers')).status, 404);
  assert.equal((await http.get('/campaigns/abc/vouchers')).status, 400);
});

test('get voucher by code reflects redemption', async () => {
  const { http } = setup();
  await http.post('/vouchers/RAYA-0001/redeem?userId=u1');
  const res = await http.get('/vouchers/RAYA-0001');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'REDEEMED');
  assert.equal(res.body.redeemedBy, 'u1');
});

test('get unknown voucher returns 404', async () => {
  const { http } = setup();
  assert.equal((await http.get('/vouchers/NOPE-1')).status, 404);
});
