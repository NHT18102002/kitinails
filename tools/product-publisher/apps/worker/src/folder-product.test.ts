import { describe, expect, it } from 'vitest';
import type { AssetDto, BatchDto, BatchItemDto } from '@ersa/product-publisher-contracts';
import { buildFolderCatalogSpec, sourceProductLabel } from './folder-product.js';

const now = '2026-07-27T00:00:00.000Z';
const itemId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const externalId = 'a'.repeat(64);

const batch: BatchDto = {
  id: batchId,
  shopId: '33333333-3333-4333-8333-333333333333',
  collection: {
    gid: 'gid://shopify/Collection/123',
    title: 'Nail Art',
    handle: 'nail-art',
    rulesHash: 'manual-v1',
    kind: 'MANUAL',
    compatibility: 'ASSIGNABLE',
  },
  state: 'DRAFT',
  version: 0,
  sealedAt: null,
  runAuthorizedAt: null,
  createdAt: now,
  updatedAt: now,
};

const item: BatchItemDto = {
  id: itemId,
  batchId,
  position: 0,
  state: 'NORMALIZED',
  externalId,
  productGid: null,
  errorCode: null,
  errorMessage: null,
  createdAt: now,
  updatedAt: now,
};

function sourceAsset(slot: 'SOURCE_1' | 'SOURCE_2', originalFilename: string): AssetDto {
  return {
    id: slot === 'SOURCE_1'
      ? '44444444-4444-4444-8444-444444444444'
      : '55555555-5555-4555-8555-555555555555',
    batchItemId: itemId,
    kind: 'SOURCE',
    slot,
    role: slot,
    status: 'READY',
    storageKey: `source/${slot}.webp`,
    rawHash: 'b'.repeat(64),
    contentHash: slot === 'SOURCE_1' ? 'c'.repeat(64) : 'd'.repeat(64),
    canonicalHash: slot === 'SOURCE_1' ? 'e'.repeat(64) : 'f'.repeat(64),
    perceptualHash: null,
    shopifyFileGid: null,
    metadata: { originalFilename },
    createdAt: now,
  };
}

describe('folder product catalog defaults', () => {
  it('derives a stable collection title and handle without calling AI', () => {
    const spec = buildFolderCatalogSpec({
      batch,
      item,
      sourceAssets: [
        sourceAsset('SOURCE_1', '1.jpg'),
        sourceAsset('SOURCE_2', '1.1.jpg'),
      ],
      currencyCode: 'USD',
      defaultProductPrice: 19.99,
    });

    expect(spec.title).toBe('Nail Art 01');
    expect(spec.handle).toBe(`ersa-nail-art-${externalId.slice(0, 12)}`);
    expect(spec.price).toEqual({ amount: 19.99, currencyCode: 'USD' });
    expect(spec.variants).toHaveLength(4);
    expect(spec.evidence).toContain('Deterministic folder import; no AI provider request was made.');
  });

  it('falls back to the product position when the original filename is unavailable', () => {
    expect(sourceProductLabel('', 6)).toBe('07');
    expect(sourceProductLabel('blue-flower_front.webp', 0)).toBe('Blue Flower Front');
  });
});
