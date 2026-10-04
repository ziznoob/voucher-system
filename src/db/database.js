import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaSql = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8');
const seedSql = readFileSync(join(import.meta.dirname, 'seed.sql'), 'utf8');

/**
 * Opens the database, applies the schema and (optionally) seeds sample data.
 * Uses Node's built-in SQLite (node:sqlite) so there are no native modules to compile.
 */
export function openDatabase({ path = ':memory:', seed = true } = {}) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schemaSql);

  if (seed) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM campaign').get();
    if (n === 0) db.exec(seedSql);
  }
  return db;
}

/**
 * Runs fn inside a single transaction (the Java version had no @Transactional,
 * so a failure half way through redeem() left voucher/campaign/redemption out of sync).
 * Any thrown error rolls everything back.
 */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
