export function createRedemptionRepository(db) {
  const insert = db.prepare(
    'INSERT INTO redemption (voucher_id, campaign_id, user_id, created_at) VALUES (?, ?, ?, ?)',
  );
  const byVoucher = db.prepare('SELECT * FROM redemption WHERE voucher_id = ?');

  return {
    create: ({ voucherId, campaignId, userId, createdAt }) =>
      Number(insert.run(voucherId, campaignId, userId, createdAt).lastInsertRowid),
    findByVoucherId: (voucherId) => byVoucher.all(voucherId),
  };
}
