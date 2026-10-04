import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, voucherRow } from './helpers.js';

test('active voucher can be voided', async () => {
  const { http, db } = setup();
  const res = await http.post('/vouchers/RAYA-0001/void');
  assert.equal(res.status, 200);
  assert.equal(res.body.result, 'OK');
  assert.equal(voucherRow(db, 'RAYA-0001').status, 'VOID');
});

test('redeemed voucher cannot be voided (Java version allowed this)', async () => {
  const { http, db } = setup();
  const res = await http.post('/vouchers/RAYA-0004/void');
  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Cannot void a redeemed voucher');
  assert.equal(voucherRow(db, 'RAYA-0004').status, 'REDEEMED');
});

test('voiding an already void voucher returns 409', async () => {
  const { http } = setup();
  const res = await http.post('/vouchers/RAYA-0005/void');
  assert.equal(res.status, 409);
});

test('voiding an unknown voucher returns 404', async () => {
  const { http } = setup();
  assert.equal((await http.post('/vouchers/NOPE-0001/void')).status, 404);
});
