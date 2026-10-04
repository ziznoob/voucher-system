import { notFound } from '../http/errors.js';

export function createCampaignStatsService({ campaignRepository, voucherRepository }) {
  return {
    listCampaigns() {
      return campaignRepository.findAll();
    },
    listVouchers(campaignId) {
      if (!campaignRepository.findById(campaignId)) throw notFound('Campaign not found');
      return voucherRepository.findByCampaignId(campaignId);
    },

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
