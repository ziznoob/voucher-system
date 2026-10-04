import { transaction } from '../db/database.js';
import { conflict, notFound, unprocessable } from '../http/errors.js';

export function createVoucherService({ db, voucherRepository, campaignRepository, redemptionRepository, auditClient, logger = console, now = () => new Date() }) {
  return {
    getVoucher(code) {
      const voucher = voucherRepository.findByCode(code);
      if (!voucher) throw notFound('Voucher not found');
      return voucher;
    },

    /**
     * Redeems a voucher for a user.
     *
     * Fixes vs VoucherService.java:
     *  - all writes happen in ONE transaction (no half-applied redemptions)
     *  - state changes are guarded UPDATEs (WHERE status='ACTIVE' / remaining_stock > 0),
     *    so concurrent requests cannot double-redeem a voucher or oversell a campaign
     *  - the audit call runs AFTER commit and never blocks or fails the redemption
     *  - audit failures are logged with the actual error and context
     */
    redeem(code, userId) {
      const outcome = transaction(db, () => {
        const voucher = voucherRepository.findByCode(code);
        if (!voucher) throw notFound('Voucher not found');
        if (voucher.status === 'REDEEMED') throw conflict('Voucher already redeemed');
        if (voucher.status === 'VOID') throw conflict('Voucher is void');

        const campaign = campaignRepository.findById(voucher.campaignId);
        if (!campaign) throw notFound('Campaign not found');
        if (!campaign.active) throw unprocessable('Campaign is not active');
        if (campaign.remainingStock <= 0) throw conflict('Campaign out of stock');

        const at = now().toISOString();

        // The checks above give friendly messages; these guarded writes are what
        // actually guarantee correctness if another request got in first.
        if (!voucherRepository.markRedeemed(voucher.id, userId, at)) {
          throw conflict('Voucher already redeemed');
        }
        if (!campaignRepository.decrementStock(campaign.id)) {
          throw conflict('Campaign out of stock'); // rolls back the voucher update too
        }
        redemptionRepository.create({ voucherId: voucher.id, campaignId: campaign.id, userId, createdAt: at });

        return {
          voucherCode: voucher.code,
          remainingStock: campaign.remainingStock - 1,
          clientCode: campaign.clientCode,
        };
      });

      // Fire-and-forget after commit.
      auditClient
        .recordRedemption({ clientCode: outcome.clientCode, voucherCode: outcome.voucherCode, userId })
        .catch((err) =>
          logger.error?.('[audit] failed to record redemption', { voucherCode: outcome.voucherCode, error: err.message }),
        );

      return { voucherCode: outcome.voucherCode, remainingStock: outcome.remainingStock };
    },

    /**
     * Voids a voucher.
     *
     * Fix vs Java: only ACTIVE vouchers can be voided. The original would happily
     * flip a REDEEMED voucher to VOID (and report success), corrupting history.
     * Stock is not changed (same as before) - see README "Open questions".
     */
    voidVoucher(code) {
      return transaction(db, () => {
        const voucher = voucherRepository.findByCode(code);
        if (!voucher) throw notFound('Voucher not found');
        if (voucher.status === 'VOID') throw conflict('Voucher is already void');
        if (voucher.status === 'REDEEMED') throw conflict('Cannot void a redeemed voucher');
        if (!voucherRepository.markVoid(voucher.id)) throw conflict('Voucher is no longer active');
        return { voucherCode: voucher.code };
      });
    },
  };
}
