-- Compared with the original schema.sql:
--  * voucher.code is UNIQUE (findByCode assumed uniqueness but nothing enforced it)
--  * redemption.voucher_id is UNIQUE (a voucher can only ever be redeemed once)
--  * foreign keys between the three tables
--  * CHECK constraints so stock can never go negative / above total and status is a known value
--  * indexes for the lookups the service actually does (code, campaign_id, client_code)

CREATE TABLE IF NOT EXISTS campaign (
    id              INTEGER PRIMARY KEY,
    name            TEXT    NOT NULL,
    client_code     TEXT    NOT NULL,
    total_stock     INTEGER NOT NULL CHECK (total_stock >= 0),
    remaining_stock INTEGER NOT NULL CHECK (remaining_stock >= 0 AND remaining_stock <= total_stock),
    active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_campaign_client_code ON campaign (client_code);

CREATE TABLE IF NOT EXISTS voucher (
    id          INTEGER PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaign (id),
    code        TEXT    NOT NULL UNIQUE,
    status      TEXT    NOT NULL CHECK (status IN ('ACTIVE', 'REDEEMED', 'VOID')),
    redeemed_by TEXT,
    redeemed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_voucher_campaign_status ON voucher (campaign_id, status);

CREATE TABLE IF NOT EXISTS redemption (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id  INTEGER NOT NULL UNIQUE REFERENCES voucher (id),
    campaign_id INTEGER NOT NULL REFERENCES campaign (id),
    user_id     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_redemption_campaign ON redemption (campaign_id);
