// All environment-specific values live here (the Java version hardcoded the
// audit URL and API key in AuditClient.java).
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 8080),
    db: {
      path: env.DB_PATH || ':memory:',
      seed: (env.DB_SEED ?? 'true') === 'true',
    },
    audit: {
      url: env.AUDIT_URL || '',
      apiKey: env.AUDIT_API_KEY || '',
      timeoutMs: Number(env.AUDIT_TIMEOUT_MS ?? 2000),
    },
  };
}
