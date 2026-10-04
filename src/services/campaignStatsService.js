import { notFound } from '../http/errors.js';

export function createCampaignStatsService({ campaignRepository }) {
  return {
    // Java used Optional.get() here -> unknown id = NoSuchElementException = HTTP 500.
    getStats(campaignId) {
      const stats = campaignRepository.getStats(campaignId);
      if (!stats) throw notFound('Campaign not found');
      return stats;
    },
    getStatsForClient(clientCode) {
      return campaignRepository.getStatsForClient(clientCode);
    },
  };
}
