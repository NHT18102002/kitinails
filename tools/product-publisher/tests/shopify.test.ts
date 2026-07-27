import { describe, expect, it, vi } from 'vitest';
import {
  missingScopes,
  normalizeStoreDomain,
  requiredScopes,
  ShopifyAdminClient,
  ShopifyAdminError,
} from '@ersa/product-publisher-shopify';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('Shopify safety client', () => {
  it('accepts only myshopify admin hosts and computes required scopes by write mode', () => {
    expect(normalizeStoreDomain('https://Ersa-Test.myshopify.com/admin')).toBe('ersa-test.myshopify.com');
    expect(() => normalizeStoreDomain('example.com')).toThrow(ShopifyAdminError);
    expect(requiredScopes('off')).toEqual(['read_products', 'read_files', 'read_publications']);
    expect(requiredScopes('publish')).toContain('write_publications');
    expect(missingScopes(['read_products'], requiredScopes('off'))).toEqual(['read_files', 'read_publications']);
  });

  it('retries throttling without exposing the access token', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: 'token-secret' }, 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse({ data: { shop: { name: 'Ersa' } } }));
    const client = new ShopifyAdminClient({
      storeDomain: 'ersa-test.myshopify.com',
      accessToken: 'token-secret',
      apiVersion: '2026-07',
      fetchImpl,
      random: () => 0,
    });

    await expect(client.graphql<{ shop: { name: string } }>('query { shop { name } }'))
      .resolves.toEqual({ shop: { name: 'Ersa' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fetchImpl.mock.results)).not.toContain('token-secret');
  });

  it('maps manual collections as assignable and automated collections as blocked', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      data: {
        collections: {
          nodes: [
            { id: 'gid://shopify/Collection/1', title: 'Manual', handle: 'manual', ruleSet: null },
            {
              id: 'gid://shopify/Collection/2',
              title: 'Automated',
              handle: 'automated',
              ruleSet: {
                appliedDisjunctively: false,
                rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'new' }],
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    }));
    const client = new ShopifyAdminClient({
      storeDomain: 'ersa-test.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2026-07',
      fetchImpl,
    });

    const collections = await client.listCollections();
    expect(collections.map(({ kind, compatibility }) => ({ kind, compatibility }))).toEqual([
      { kind: 'MANUAL', compatibility: 'ASSIGNABLE' },
      { kind: 'AUTOMATED', compatibility: 'UNSUPPORTED_RULE' },
    ]);
  });

  it('blocks a token that authenticates a different shop', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      data: {
        shop: {
          name: 'Wrong Shop',
          myshopifyDomain: 'wrong-shop.myshopify.com',
          currencyCode: 'USD',
          primaryDomain: { host: 'wrong.example' },
        },
        appInstallation: { accessScopes: [] },
        publications: { nodes: [] },
      },
    }));
    const client = new ShopifyAdminClient({
      storeDomain: 'ersa-test.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2026-07',
      fetchImpl,
    });
    await expect(client.preflight()).rejects.toMatchObject({ code: 'SHOPIFY_STORE_MISMATCH' });
  });

  it('reconciles an existing content-hash file instead of uploading a duplicate', async () => {
    const hash = 'a'.repeat(64);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      data: {
        files: {
          nodes: [{ id: 'gid://shopify/MediaImage/1', fileStatus: 'READY', alt: 'Hero' }],
        },
      },
    }));
    const client = new ShopifyAdminClient({
      storeDomain: 'ersa-test.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2026-07',
      fetchImpl,
    });

    await expect(client.ensureImageFile({ contentHash: hash, data: Buffer.from('unused'), alt: 'Hero' }))
      .resolves.toMatchObject({ id: 'gid://shopify/MediaImage/1', fileStatus: 'READY' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toContain(`ersa-pp-${hash}.webp`);
  });

  it('rejects unsafe staged upload targets', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: { files: { nodes: [] } } }))
      .mockResolvedValueOnce(jsonResponse({
        data: {
          stagedUploadsCreate: {
            stagedTargets: [{ url: 'http://127.0.0.1/upload', resourceUrl: 'http://127.0.0.1/file', parameters: [] }],
            userErrors: [],
          },
        },
      }));
    const client = new ShopifyAdminClient({
      storeDomain: 'ersa-test.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2026-07',
      fetchImpl,
    });

    await expect(client.ensureImageFile({ contentHash: 'b'.repeat(64), data: Buffer.from('x'), alt: 'Hero' }))
      .rejects.toMatchObject({ code: 'SHOPIFY_STAGED_URL_UNSAFE' });
  });

  it('will not turn an existing active product into a draft during update', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      data: {
        productByIdentifier: {
          id: 'gid://shopify/Product/1',
          title: 'Existing',
          handle: 'existing',
          status: 'ACTIVE',
          updatedAt: '2026-07-19T00:00:00Z',
          publishedOnPublication: true,
          externalId: { value: 'external-1' },
          publisherId: { value: 'publisher-1' },
          payloadHash: { value: 'payload' },
          media: { nodes: [] },
        },
      },
    }));
    const client = new ShopifyAdminClient({
      storeDomain: 'ersa-test.myshopify.com',
      accessToken: 'test-token',
      apiVersion: '2026-07',
      fetchImpl,
    });

    await expect(client.upsertDraftProduct({
      externalId: 'external-1',
      publisherId: 'publisher-1',
      batchId: 'batch-1',
      pipelineVersion: 'v1',
      modelManifest: '{}',
      expectedProductGid: 'gid://shopify/Product/1',
      payload: {
        title: 'New title',
        handle: 'new-title',
        descriptionHtml: '<p>Description</p>',
        vendor: 'Ersa Nails',
        productType: 'Press-On Nails',
        tags: ['Nails'],
        seo: { title: 'New title', description: 'A complete SEO product description.' },
        collectionGid: 'gid://shopify/Collection/1',
        fileGids: [],
        options: [{ name: 'Size', values: ['S'] }],
        variants: [{ optionValues: { Size: 'S' }, price: 19.99 }],
        metafields: [],
      },
    })).rejects.toMatchObject({ code: 'SHOPIFY_ACTIVE_UPDATE_BLOCKED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
