import { describe, expect, it } from 'vitest';
import {
  BatchSchema,
  CollectionSnapshotSchema,
  CreateBatchInputSchema,
} from '@ersa/product-publisher-contracts';

const collection = {
  gid: 'gid://shopify/Collection/1',
  title: 'Press On Nails',
  handle: 'press-on-nails',
  rulesHash: 'rules-v1',
  kind: 'MANUAL',
  compatibility: 'ASSIGNABLE',
} as const;

describe('public API contracts', () => {
  it('accepts a compatible collection snapshot', () => {
    expect(CollectionSnapshotSchema.parse(collection)).toEqual(collection);
    expect(CreateBatchInputSchema.parse({ collection })).toEqual({ collection });
  });

  it('rejects unknown input fields and unsafe collection compatibility values', () => {
    expect(() => CreateBatchInputSchema.parse({ collection, productGid: 'arbitrary-update' })).toThrow();
    expect(() => CollectionSnapshotSchema.parse({ ...collection, compatibility: 'FORCE' })).toThrow();
  });

  it('requires explicit nullable lifecycle fields in batch responses', () => {
    const result = BatchSchema.safeParse({
      id: '2a56c779-2100-4e51-b594-ff4019b96e5f',
      shopId: '36cb1d8c-fc17-4cc3-aa0b-b2f63521ac6f',
      collection,
      state: 'DRAFT',
      version: 1,
      sealedAt: null,
      runAuthorizedAt: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});
