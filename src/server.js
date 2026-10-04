import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createAuditClient } from './services/auditClient.js';
import { createApp } from './app.js';

const config = loadConfig();
const db = openDatabase(config.db);
const auditClient = createAuditClient(config.audit);
const { app } = createApp({ db, auditClient });

const server = app.listen(config.port, () => {
  console.log(`voucher-service listening on http://localhost:${config.port} (db: ${config.db.path})`);
});

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
