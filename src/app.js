import express from 'express';
import { AppError } from './http/errors.js';
import { fail } from './http/responses.js';
import { createCampaignRepository } from './repositories/campaignRepository.js';
import { createVoucherRepository } from './repositories/voucherRepository.js';
import { createRedemptionRepository } from './repositories/redemptionRepository.js';
import { createVoucherService } from './services/voucherService.js';
import { createCampaignStatsService } from './services/campaignStatsService.js';
import { voucherController } from './controllers/voucherController.js';
import { campaignController } from './controllers/campaignController.js';

/**
 * Wires everything together (the equivalent of Spring's dependency injection).
 * Dependencies are passed in, so tests can give each test its own DB and a fake audit client.
 */
export function createApp({ db, auditClient, logger = console, now }) {
  const campaignRepository = createCampaignRepository(db);
  const voucherRepository = createVoucherRepository(db);
  const redemptionRepository = createRedemptionRepository(db);

  const voucherService = createVoucherService({
    db, voucherRepository, campaignRepository, redemptionRepository, auditClient, logger, now,
  });
  const campaignStatsService = createCampaignStatsService({ campaignRepository });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'UP' }));
  app.use('/vouchers', voucherController(voucherService));
  app.use('/campaigns', campaignController(campaignStatsService));

  app.use((_req, res) => res.status(404).json(fail('Not found')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json(fail(err.message));
    if (err.type === 'entity.parse.failed') return res.status(400).json(fail('Malformed JSON body'));
    logger.error?.('[http] unhandled error', err);
    res.status(500).json(fail('Internal server error'));
  });

  return { app, services: { voucherService, campaignStatsService } };
}
