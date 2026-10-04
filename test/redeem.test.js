import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, voucherRow, campaignRow, redemptionCount } from './helpers.js';

// --- the three original Java tests ---------------------------------------

test('redeem active voucher succeeds', async () => {
  const { http, db } = setup();
  const res = await http.post('/vouchers/RAYA-0001/redeem?userId=user-1');

  assert.equal(res.status, 200);
  assert.equal(res.body.result, 'OK');
  assert.equal(res.body.voucherCode, 'RAYA-0001');
  assert.equal(res.body.remainingStock, 99);

  const v = voucherRow(db, 'RAYA-0001');
  assert.equal(v.status, 'REDEEMED');
  assert.equal(v.redeemed_by, 'user-1');
  assert.ok(v.redeemed_at);
  assert.equal(campaignRow(db, 1).remaining_stock, 99);
  assert.equal(redemptionCount(db, v.id), 1);
});

test('redeem already-redeemed voucher fails with 409', async () => {
  const { http } = setup();
  const res = await http.post('/vouchers/RAYA-0004/redeem?userId=user-2');
  assert.equal(res.status, 409);
  assert.equal(res.body.result, 'FAILED');
  assert.equal(res.body.message, 'Voucher already redeemed');
});

test('redeem unknown code fails with 404', async () => {
  const { http } = setup();
  const res = await http.post('/vouchers/NOPE-9999/redeem?userId=user-3');
  assert.equal(res.status, 404);
  assert.equal(res.body.result, 'FAILED');
});

// --- cases the Java tests did not cover ----------------------------------

test('void voucher cannot be redeemed', async () => {
  const { http } = setup();
  const res = await http.post('/vouchers/RAYA-0005/redeem?userId=user-1');
  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Voucher is void');
});

test('voucher in inactive campaign cannot be redeemed', async () => {
  const { http, db } = setup();
  const res = await http.post('/vouchers/EXPD-0001/redeem?userId=user-1');
  assert.equal(res.status, 422);
  assert.equal(res.body.message, 'Campaign is not active');
  assert.equal(voucherRow(db, 'EXPD-0001').status, 'ACTIVE');
});

test('out-of-stock campaign rejects redemption and changes nothing', async () => {
  const { http, db } = setup();
  db.exec('UPDATE campaign SET remaining_stock = 0 WHERE id = 1');

  const res = await http.post('/vouchers/RAYA-0001/redeem?userId=user-1');
  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Campaign out of stock');
  assert.equal(voucherRow(db, 'RAYA-0001').status, 'ACTIVE');
});

test('userId is required and validated', async () => {
  const { http } = setup();
  assert.equal((await http.post('/vouchers/RAYA-0001/redeem')).status, 400);
  assert.equal((await http.post('/vouchers/RAYA-0001/redeem?userId=%20%20')).status, 400);
  assert.equal((await http.post(`/vouchers/RAYA-0001/redeem?userId=${'x'.repeat(81)}`)).status, 400);
});

test('userId can also be sent in the JSON body', async () => {
  const { http, db } = setup();
  const res = await http.post('/vouchers/RAYA-0002/redeem').send({ userId: 'user-7' });
  assert.equal(res.status, 200);
  assert.equal(voucherRow(db, 'RAYA-0002').redeemed_by, 'user-7');
});

test('invalid voucher code format is rejected with 400', async () => {
  const { http } = setup();
  const res = await http.post(`/vouchers/${'A'.repeat(41)}/redeem?userId=u`);
  assert.equal(res.status, 400);
});

// --- concurrency / integrity ----------------------------------------------

test('same voucher redeemed concurrently: exactly one succeeds, stock drops by one', async () => {
  const { http, db } = setup();
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => http.post(`/vouchers/RAYA-0003/redeem?userId=user-${i}`)),
  );

  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 9);
  assert.equal(campaignRow(db, 1).remaining_stock, 99);
  assert.equal(redemptionCount(db, voucherRow(db, 'RAYA-0003').id), 1);
});

test('last unit of stock cannot be oversold', async () => {
  const { http, db } = setup();
  db.exec('UPDATE campaign SET remaining_stock = 1 WHERE id = 1');

  const results = await Promise.all([
    http.post('/vouchers/RAYA-0001/redeem?userId=a'),
    http.post('/vouchers/RAYA-0002/redeem?userId=b'),
    http.post('/vouchers/RAYA-0003/redeem?userId=c'),
  ]);

  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(campaignRow(db, 1).remaining_stock, 0);
  const redeemed = db.prepare("SELECT COUNT(*) AS n FROM voucher WHERE campaign_id = 1 AND status = 'REDEEMED'").get().n;
  assert.equal(redeemed, 2); // RAYA-0004 from seed + the one winner
});

test('guarded stock decrement rolls back the voucher update when it loses the race', () => {
  // Simulates another request taking the last unit between our check and our write.
  const { db, services } = setup();
  db.exec('UPDATE campaign SET remaining_stock = 1 WHERE id = 1');
  db.exec(`CREATE TRIGGER steal_stock BEFORE UPDATE OF status ON voucher
           BEGIN UPDATE campaign SET remaining_stock = 0 WHERE id = 1; END`);

  assert.throws(() => services.voucherService.redeem('RAYA-0001', 'user-1'), { status: 409, message: 'Campaign out of stock' });
  db.exec('DROP TRIGGER steal_stock');

  // Whole transaction rolled back: voucher still ACTIVE, no redemption row, stock untouched.
  assert.equal(voucherRow(db, 'RAYA-0001').status, 'ACTIVE');
  assert.equal(redemptionCount(db, 1), 0);
  assert.equal(campaignRow(db, 1).remaining_stock, 1);
});

// --- audit ----------------------------------------------------------------

test('audit event is sent with the right payload after a redemption', async () => {
  const { http, auditCalls } = setup();
  await http.post('/vouchers/MRDK-0001/redeem?userId=user-5');
  assert.deepEqual(auditCalls, [{ clientCode: 'NOVA', voucherCode: 'MRDK-0001', userId: 'user-5' }]);
});

test('audit failure does not fail the redemption and is logged with details', async () => {
  const { http, db, logger } = setup({ auditImpl: async () => { throw new Error('audit down'); } });
  const res = await http.post('/vouchers/RAYA-0006/redeem?userId=user-8');

  assert.equal(res.status, 200);
  assert.equal(voucherRow(db, 'RAYA-0006').status, 'REDEEMED');
  await new Promise((r) => setImmediate(r));
  assert.equal(logger.errors.length, 1);
  assert.match(JSON.stringify(logger.errors[0]), /audit down/);
});

test('failed redemption does not send an audit event', async () => {
  const { http, auditCalls } = setup();
  await http.post('/vouchers/RAYA-0004/redeem?userId=user-2');
  assert.equal(auditCalls.length, 0);
});
