import request from 'supertest';
import { openDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';

const silentLogger = { info() {}, warn() {}, error() {} };

/**
 * Fresh in-memory DB + app per test, so tests never depend on each other's
 * state (the Java tests shared one Spring context / H2 DB, so order mattered).
 */
export function setup({ auditImpl } = {}) {
  const db = openDatabase({ path: ':memory:', seed: true });
  const auditCalls = [];
  const auditClient = {
    async recordRedemption(evt) {
      auditCalls.push(evt);
      if (auditImpl) return auditImpl(evt);
    },
  };
  const logger = { ...silentLogger, errors: [], error(...args) { this.errors.push(args); } };
  const { app, services } = createApp({ db, auditClient, logger });
  return { db, app, services, auditCalls, logger, http: request(app) };
}

export const voucherRow = (db, code) => db.prepare('SELECT * FROM voucher WHERE code = ?').get(code);
export const campaignRow = (db, id) => db.prepare('SELECT * FROM campaign WHERE id = ?').get(id);
export const redemptionCount = (db, voucherId) =>
  db.prepare('SELECT COUNT(*) AS n FROM redemption WHERE voucher_id = ?').get(voucherId).n;
