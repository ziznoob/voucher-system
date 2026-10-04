/**
 * Sends redemption events to the internal audit service.
 *
 * Changes vs AuditClient.java:
 *  - URL and API key come from config/env, not hardcoded in source
 *  - API key goes in a header instead of the JSON payload
 *  - request has a timeout (RestTemplate had none, so a slow audit service could hang redemptions)
 *  - non-2xx responses are treated as failures
 */
export function createAuditClient({ url, apiKey, timeoutMs = 2000, logger = console, fetchImpl = fetch }) {
  return {
    async recordRedemption({ clientCode, voucherCode, userId }) {
      if (!url) {
        logger.warn?.('[audit] AUDIT_URL not set, skipping audit event', { voucherCode });
        return;
      }
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ clientCode, voucherCode, userId }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`audit service responded ${res.status}`);
      logger.info?.('[audit] event sent', { voucherCode });
    },
  };
}
