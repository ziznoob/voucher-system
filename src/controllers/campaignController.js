import { Router } from 'express';
import * as validate from '../http/validation.js';

export function campaignController(campaignStatsService) {
  const router = Router();

  router.get('/:id/stats', (req, res) => {
    res.json(campaignStatsService.getStats(validate.campaignId(req.params.id)));
  });

  router.get('/by-client/:clientCode/stats', (req, res) => {
    res.json(campaignStatsService.getStatsForClient(validate.clientCode(req.params.clientCode)));
  });

  return router;
}
