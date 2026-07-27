const fs = require('node:fs');
const path = require('node:path');

const { constants, paths } = require('./config.cjs');

function loadDotEnvText(text) {
  const values = {};

  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) values[key] = value;
  }

  return values;
}

function loadToolingEnv(filePath = path.join(paths.toolingRoot, '.env')) {
  if (!fs.existsSync(filePath)) return {};
  return loadDotEnvText(fs.readFileSync(filePath, 'utf8'));
}

function normalizeStoreDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return url.hostname.toLowerCase();
  } catch (error) {
    return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  }
}

function buildAdminGraphqlEndpoint(storeDomain) {
  const domain = normalizeStoreDomain(storeDomain);
  return `https://${domain}/admin/api/${constants.apiVersion}/graphql.json`;
}

function requireAdminEnv(env = {}) {
  const storeDomain = normalizeStoreDomain(env.SHOPIFY_STORE_DOMAIN || env.storeDomain);
  const accessToken = String(env.SHOPIFY_ADMIN_ACCESS_TOKEN || env.accessToken || '').trim();
  const locationId = String(env.SHOPIFY_LOCATION_ID || env.locationId || '').trim();

  if (!storeDomain) {
    throw new Error('Missing SHOPIFY_STORE_DOMAIN in tools/catalog-import/.env or process env.');
  }

  if (!accessToken) {
    throw new Error('Missing SHOPIFY_ADMIN_ACCESS_TOKEN in tools/catalog-import/.env or process env.');
  }

  return {
    storeDomain,
    accessToken,
    locationId,
    endpoint: buildAdminGraphqlEndpoint(storeDomain),
  };
}

function readAdminEnv() {
  const fileEnv = loadToolingEnv();
  return requireAdminEnv({
    ...fileEnv,
    ...process.env,
  });
}

function createAdminClient(env = readAdminEnv()) {
  const adminEnv = requireAdminEnv(env);

  async function graphql(query, variables = {}) {
    let lastError;
    for (let attempt = 0; attempt <= constants.maxRetries; attempt += 1) {
      try {
        const response = await fetch(adminEnv.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': adminEnv.accessToken,
          },
          body: JSON.stringify({ query, variables }),
        });
        const text = await response.text();
        let payload;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch (error) {
          const parseError = new Error(`Shopify Admin GraphQL returned non-JSON response: HTTP ${response.status}`);
          parseError.retryable = response.status >= 500;
          throw parseError;
        }
        if (!response.ok) {
          const httpError = new Error(`Shopify Admin GraphQL HTTP ${response.status}: ${safeGraphqlMessage(payload)}`);
          httpError.retryable = response.status === 429 || response.status >= 500;
          httpError.retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
          throw httpError;
        }
        if (Array.isArray(payload.errors) && payload.errors.length) {
          const graphqlError = new Error(`Shopify Admin GraphQL errors: ${safeGraphqlMessage(payload)}`);
          graphqlError.retryable = payload.errors.some(isRetryableGraphqlError);
          throw graphqlError;
        }
        return payload.data;
      } catch (error) {
        lastError = error;
        const retryable = error?.retryable === true || error?.name === 'TypeError';
        if (!retryable || attempt >= constants.maxRetries) throw error;
        const waitMs = error.retryAfterMs || constants.delayMs * (2 ** attempt);
        await delay(waitMs);
      }
    }
    throw lastError;
  }

  return {
    ...adminEnv,
    graphql,
  };
}

function isRetryableGraphqlError(error) {
  const code = String(error?.extensions?.code || '').toUpperCase();
  return ['THROTTLED', 'INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE'].includes(code);
}

function parseRetryAfterMs(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeGraphqlMessage(payload) {
  if (!payload) return 'Unknown error';
  if (Array.isArray(payload.errors)) {
    return payload.errors.map((error) => error.message || String(error)).join('; ');
  }
  return payload.message || JSON.stringify(payload);
}

module.exports = {
  buildAdminGraphqlEndpoint,
  createAdminClient,
  loadDotEnvText,
  loadToolingEnv,
  normalizeStoreDomain,
  parseRetryAfterMs,
  readAdminEnv,
  requireAdminEnv,
  isRetryableGraphqlError,
};
