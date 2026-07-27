import { ShopifyAdminClient } from './index.js';

const storeDomain = process.env.SHOPIFY_STORE_DOMAIN ?? '';
const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '';
const apiVersion = process.env.SHOPIFY_API_VERSION ?? '2026-07';
if (!storeDomain || !accessToken) {
  throw new Error('SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN are required');
}

const client = new ShopifyAdminClient({ storeDomain, accessToken, apiVersion });
const result = await client.bootstrapExternalIdDefinition();
process.stdout.write(`${JSON.stringify({
  ok: true,
  created: result.created,
  definitionId: result.definitionId,
  storeDomain: client.storeDomain,
})}\n`);
