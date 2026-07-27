const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdminGraphqlEndpoint,
  loadDotEnvText,
  normalizeStoreDomain,
  parseRetryAfterMs,
  requireAdminEnv,
  isRetryableGraphqlError,
} = require('../src/shopify-admin.cjs');

test('normalizeStoreDomain accepts a myshopify domain or admin URL', () => {
  assert.equal(
    normalizeStoreDomain('https://develop-store-5y6bipog.myshopify.com/admin'),
    'develop-store-5y6bipog.myshopify.com'
  );
  assert.equal(
    normalizeStoreDomain('develop-store-5y6bipog.myshopify.com'),
    'develop-store-5y6bipog.myshopify.com'
  );
});

test('Shopify retry helpers recognize throttling and Retry-After seconds', () => {
  assert.equal(isRetryableGraphqlError({ extensions: { code: 'THROTTLED' } }), true);
  assert.equal(isRetryableGraphqlError({ extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }), false);
  assert.equal(parseRetryAfterMs('2'), 2000);
  assert.equal(parseRetryAfterMs('invalid'), 0);
});

test('buildAdminGraphqlEndpoint pins API version 2026-07', () => {
  assert.equal(
    buildAdminGraphqlEndpoint('develop-store-5y6bipog.myshopify.com'),
    'https://develop-store-5y6bipog.myshopify.com/admin/api/2026-07/graphql.json'
  );
});

test('requireAdminEnv rejects missing access token', () => {
  assert.throws(
    () => requireAdminEnv({ SHOPIFY_STORE_DOMAIN: 'develop-store-5y6bipog.myshopify.com' }),
    /SHOPIFY_ADMIN_ACCESS_TOKEN/
  );
});

test('loadDotEnvText parses dotenv content without exposing comments', () => {
  assert.deepEqual(
    loadDotEnvText('# nope\nSHOPIFY_STORE_DOMAIN=example.myshopify.com\nSHOPIFY_ADMIN_ACCESS_TOKEN=<test-token-placeholder>\n'),
    {
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: '<test-token-placeholder>',
    }
  );
});
