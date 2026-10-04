import { badRequest } from './errors.js';

const CODE_RE = /^[A-Za-z0-9-]{1,40}$/; // voucher.code was VARCHAR(40)
const USER_ID_MAX = 80; // redemption.user_id was VARCHAR(80)
const CLIENT_CODE_RE = /^[A-Za-z0-9_-]{1,50}$/;

export function voucherCode(value) {
  if (typeof value !== 'string' || !CODE_RE.test(value)) throw badRequest('Invalid voucher code');
  return value;
}

export function userId(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) throw badRequest('userId is required');
  if (v.length > USER_ID_MAX) throw badRequest(`userId must be at most ${USER_ID_MAX} characters`);
  return v;
}

export function campaignId(value) {
  if (!/^[1-9]\d{0,15}$/.test(String(value))) throw badRequest('Invalid campaign id');
  return Number(value);
}

export function clientCode(value) {
  if (typeof value !== 'string' || !CLIENT_CODE_RE.test(value)) throw badRequest('Invalid client code');
  return value;
}
