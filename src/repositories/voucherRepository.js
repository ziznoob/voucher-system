const toVoucher = (row) =>
  row && {
    id: row.id,
    campaignId: row.campaign_id,
    code: row.code,
    status: row.status,
    redeemedBy: row.redeemed_by,
    redeemedAt: row.redeemed_at,
  };

export function createVoucherRepository(db) {
  const byCode = db.prepare('SELECT * FROM voucher WHERE code = ?');
  // Guarded state transitions: the UPDATE only applies if the voucher is still ACTIVE,
  // so two concurrent requests can never both redeem (or void) the same voucher.
  const redeem = db.prepare(
    "UPDATE voucher SET status = 'REDEEMED', redeemed_by = ?, redeemed_at = ? WHERE id = ? AND status = 'ACTIVE'",
  );
  const voidStmt = db.prepare("UPDATE voucher SET status = 'VOID' WHERE id = ? AND status = 'ACTIVE'");

  return {
    findByCode: (code) => toVoucher(byCode.get(code)),
    /** @returns {boolean} true if this call moved the voucher ACTIVE -> REDEEMED */
    markRedeemed: (id, userId, at) => redeem.run(userId, at, id).changes === 1,
    /** @returns {boolean} true if this call moved the voucher ACTIVE -> VOID */
    markVoid: (id) => voidStmt.run(id).changes === 1,
  };
}
