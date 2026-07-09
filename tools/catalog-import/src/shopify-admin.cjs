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
      throw new Error(`Shopify Admin GraphQL returned non-JSON response: HTTP ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(`Shopify Admin GraphQL HTTP ${response.status}: ${safeGraphqlMessage(payload)}`);
    }

    if (Array.isArray(payload.errors) && payload.errors.length) {
      throw new Error(`Shopify Admin GraphQL errors: ${safeGraphqlMessage(payload)}`);
    }

    return payload.data;
  }

  return {
    ...adminEnv,
    graphql,
  };
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
  readAdminEnv,
  requireAdminEnv,
};
