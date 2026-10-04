// Same body shape as the Java RedeemResponse, so existing storefront clients
// that read `result` keep working. The difference is that failures now also
// come with a proper HTTP status instead of always 200.
export const redeemOk = (voucherCode, remainingStock) => ({
  result: 'OK',
  voucherCode,
  remainingStock,
  message: null,
});

export const fail = (message) => ({
  result: 'FAILED',
  voucherCode: null,
  remainingStock: null,
  message,
});
