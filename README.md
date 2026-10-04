# voucher-service (Node.js)

Internal campaign voucher redemption service, ported from the original Spring Boot
(`voucher-service`, v1.4.2) to Node.js + Express. Along the way it fixes a number of
correctness, concurrency, security and performance issues in the original. They're listed below.

Clients run promotional campaigns, and each campaign has a fixed stock of vouchers.
End users redeem a voucher code via the storefront, which calls this service.

## Requirements

- Node.js **22.13+** (uses the built-in `node:sqlite`, so there are no native modules to compile)

## Running

```bash
npm install
cp .env.example .env     # optional, defaults work for local dev
npm start                # http://localhost:8080
npm test                 # 28 tests, node:test + supertest
```

By default the DB is in-memory SQLite, seeded with the same sample data as the original
(`src/db/schema.sql` + `seed.sql`), the equivalent of the H2 setup. Set `DB_PATH=./voucher.db`
to persist the data.

| Env var | Default | Notes |
|---|---|---|
| `PORT` | `8080` | |
| `DB_PATH` | `:memory:` | |
| `DB_SEED` | `true` | Seeds only when the DB is empty |
| `AUDIT_URL` | *(empty)* | Empty means audit calls are skipped (logged as a warning) |
| `AUDIT_API_KEY` | *(empty)* | Sent as the `X-Api-Key` header |
| `AUDIT_TIMEOUT_MS` | `2000` | |

## Endpoints

The paths and the response body shape are the same as the original:
`{ result: "OK" | "FAILED", voucherCode, remainingStock, message }`.

| Method | Path | Success | Failures |
|---|---|---|---|
| POST | `/vouchers/{code}/redeem?userId=...` | 200 | 400 invalid input, 404 not found, 409 already redeemed / void / out of stock, 422 campaign inactive |
| POST | `/vouchers/{code}/void` | 200 | 404, 409 already void / already redeemed |
| GET | `/campaigns/{id}/stats` | 200 | 400 bad id, 404 unknown campaign |
| GET | `/campaigns/by-client/{clientCode}/stats` | 200 (list, may be empty) | 400 |
| GET | `/health` | 200 | |

`userId` for redeem can come from the query string (as before) or a JSON body `{ "userId": "..." }`.

## Project layout

```
src/
  server.js              entry point (config -> db -> app -> listen)
  app.js                 wiring / dependency injection + error handler
  config.js              env config
  db/                    schema.sql, seed.sql, openDatabase(), transaction()
  repositories/          SQL lives here only
  services/              business rules (voucherService, campaignStatsService, auditClient)
  controllers/           HTTP routes, input validation, response mapping
  http/                  errors, validation, response helpers
test/                    one fresh in-memory DB per test
```

## What changed compared with the Java version

### Correctness and concurrency
1. **Double redemption and overselling (race condition).** `redeem()` did read, check, then save,
   with no locking and no transaction. Two concurrent requests could both see `ACTIVE`, both
   redeem the same voucher, and both decrement stock. Stock could also go below zero.
   **Fix:** guarded atomic updates, `UPDATE voucher ... WHERE id=? AND status='ACTIVE'` and
   `UPDATE campaign SET remaining_stock = remaining_stock - 1 WHERE id=? AND active=1 AND remaining_stock > 0`.
   If the affected row count is 0, the request lost the race and gets a 409.
   This is the same pattern you'd use on MySQL/Postgres.
2. **No transaction.** The voucher, campaign and redemption writes were three separate commits,
   so a failure in the middle left the data inconsistent. **Fix:** a single transaction that rolls back on any error.
3. **Void could overwrite a redeemed voucher**, and it also reported success when voiding an
   already-void voucher. Seed voucher `RAYA-0005` (VOID, with a redemption record) looks like the
   result of exactly this. **Fix:** only `ACTIVE` vouchers can be voided. Anything else returns 409.
4. **Unknown campaign id on stats crashed with a 500** (`Optional.get()` threw `NoSuchElementException`). **Fix:** it now returns 404.
5. **Every failure returned HTTP 200.** Failures now return proper 4xx statuses. The body is
   unchanged, so clients that check `result` keep working.
6. **No input validation** (`userId` could be blank or longer than the column). **Fix:** voucher code, `userId`, campaign id and client code are validated (400).

### Database integrity
7. The schema had no constraints. Added: `UNIQUE(voucher.code)` (`findByCode` assumed this),
   `UNIQUE(redemption.voucher_id)`, foreign keys, a `CHECK` that keeps stock between 0 and the
   total, a `CHECK` on status values, and indexes on `voucher.code`, `voucher(campaign_id, status)`,
   `redemption.campaign_id` and `campaign.client_code`.

### Performance
8. **N+1 queries in stats.** The Java version ran one query per voucher to check redemptions,
   and the per-client endpoint repeated that for every campaign. **Fix:** a single aggregate
   query per endpoint. `redeemedCount` keeps its original meaning (vouchers that have a redemption record).

### Security and external calls
9. **Hardcoded audit API key and URL in source** (`pzm_audit_7f3a91c4`). Both now come from
   env vars, and the key is sent in a header instead of the JSON body.
   ⚠️ The old key was in the repo, so it should be rotated.
10. **Synchronous audit call inside the redemption, with no timeout.** A slow audit service would hang
    redemptions. **Fix:** the call runs after commit (fire-and-forget) with a timeout, non-2xx
    responses count as failures, and errors are logged with context. The original logged
    only `"audit call failed"` and dropped the exception.

### Tests
11. The Java tests shared one DB across tests, so they depended on execution order (redeeming
    `RAYA-0001` mutated state for later tests). Now each test gets a fresh DB. Coverage grew from
    3 to 28 tests, including concurrent redemption, the last unit of stock, rollback on a lost
    race, void rules, stats, and audit failure handling.

## Open questions / next steps

These are product decisions or larger changes, so I left them out of this pass:

- **Per-user redemption limit.** The sample data notes that `user-99` already has redemption
  history on campaign 1, which hints at a "one redemption per user per campaign" rule. There's
  no such rule today. If it's wanted, it would need a guarded check plus a unique index on
  `(campaign_id, user_id)`.
- **Should voiding an ACTIVE voucher reduce `remaining_stock`?** It doesn't (same as before).
  Also note that `total_stock` (100) doesn't match the number of voucher rows (6) in the sample data.
- **Audit delivery is best-effort.** If the audit service is down, the event is lost (only logged).
  For guaranteed delivery, use a transactional **outbox table** written in the same transaction, plus a retry worker.
- **`/void` has no authentication.** It's an admin action. Auth is probably handled upstream
  (gateway or internal network), but that needs confirming.
- **Idempotency key on redeem**, so storefront retries after a timeout return the original result.
- SQLite is fine for this exercise. For production, swap the repositories onto MySQL/Postgres.
  The guarded-UPDATE approach carries over unchanged.
# voucher-system
