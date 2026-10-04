import { Router } from 'express';
import * as validate from '../http/validation.js';
import { redeemOk } from '../http/responses.js';

export function voucherController(voucherService) {
  const router = Router();

  // GET /vouchers/:code
  router.get('/:code', (req, res) => {
    res.json(voucherService.getVoucher(validate.voucherCode(req.params.code)));
  });

  // POST /vouchers/:code/redeem?userId=...   (userId in JSON body also accepted)
  router.post('/:code/redeem', (req, res) => {
    const code = validate.voucherCode(req.params.code);
    const userId = validate.userId(req.query.userId ?? req.body?.userId);
    const { voucherCode, remainingStock } = voucherService.redeem(code, userId);
    res.json(redeemOk(voucherCode, remainingStock));
  });

  // POST /vouchers/:code/void
  router.post('/:code/void', (req, res) => {
    const code = validate.voucherCode(req.params.code);
    const { voucherCode } = voucherService.voidVoucher(code);
    res.json(redeemOk(voucherCode, null));
  });

  return router;
}
