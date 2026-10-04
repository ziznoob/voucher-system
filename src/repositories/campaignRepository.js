const toCampaign = (row) =>
  row && {
    id: row.id,
    name: row.name,
    clientCode: row.client_code,
    totalStock: row.total_stock,
    remainingStock: row.remaining_stock,
    active: row.active === 1,
  };

const toStats = (row) => ({
  campaignId: row.id,
  name: row.name,
  totalStock: row.total_stock,
  remainingStock: row.remaining_stock,
  redeemedCount: row.redeemed_count,
  activeVoucherCount: row.active_voucher_count,
});

// One query for all the stats. The Java version did 1 query for the vouchers
// plus 1 query PER voucher for redemptions (N+1), and per client it repeated
// that for every campaign.
const STATS_SELECT = `
  SELECT c.id, c.name, c.total_stock, c.remaining_stock,
         (SELECT COUNT(DISTINCT r.voucher_id) FROM redemption r WHERE r.campaign_id = c.id) AS redeemed_count,
         (SELECT COUNT(*) FROM voucher v WHERE v.campaign_id = c.id AND v.status = 'ACTIVE') AS active_voucher_count
  FROM campaign c`;

export function createCampaignRepository(db) {
  const byId = db.prepare('SELECT * FROM campaign WHERE id = ?');
  const all = db.prepare('SELECT * FROM campaign ORDER BY id');
  // Guarded decrement: only succeeds while the campaign is active and has stock.
  // This is what stops overselling when two requests race for the last unit.
  const decrement = db.prepare(
    'UPDATE campaign SET remaining_stock = remaining_stock - 1 WHERE id = ? AND active = 1 AND remaining_stock > 0',
  );
  const statsById = db.prepare(`${STATS_SELECT} WHERE c.id = ?`);
  const statsByClient = db.prepare(`${STATS_SELECT} WHERE c.client_code = ? ORDER BY c.id`);

  return {
    findById: (id) => toCampaign(byId.get(id)),
    findAll: () => all.all().map(toCampaign),
    /** @returns {boolean} true if a unit of stock was taken */
    decrementStock: (id) => decrement.run(id).changes === 1,
    getStats: (id) => {
      const row = statsById.get(id);
      return row ? toStats(row) : null;
    },
    getStatsForClient: (clientCode) => statsByClient.all(clientCode).map(toStats),
  };
}
