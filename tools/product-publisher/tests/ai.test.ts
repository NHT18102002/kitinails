import { describe, expect, it } from 'vitest';
import { CatalogSpecSchema, MockProductAnalyzer } from '@ersa/product-publisher-ai';

const baseInput = {
  images: [
    { data: Buffer.from('source-one'), mimeType: 'image/webp' as const, canonicalHash: 'a'.repeat(64) },
    { data: Buffer.from('source-two'), mimeType: 'image/webp' as const, canonicalHash: 'b'.repeat(64) },
  ] as const,
  collection: {
    gid: 'gid://shopify/Collection/1',
    title: 'Press On Nails',
    handle: 'press-on-nails',
    rulesHash: 'rules-v1',
    kind: 'MANUAL' as const,
    compatibility: 'ASSIGNABLE' as const,
  },
  currencyCode: 'USD',
  taxonomy: {
    shapes: ['Almond', 'Square'],
    lengths: ['Medium'],
    finishes: ['Glossy'],
    styles: ['Minimal'],
  },
};

describe('CatalogSpec AI boundary', () => {
  it('creates deterministic strict mock output with five image briefs', async () => {
    const analyzer = new MockProductAnalyzer();
    const first = await analyzer.analyze(baseInput);
    const second = await analyzer.analyze({
      ...baseInput,
      images: [baseInput.images[1], baseInput.images[0]],
    });

    expect(first.inputHash).toBe(second.inputHash);
    expect(first.spec.imageBriefs).toHaveLength(5);
    expect(first.spec.variants).toHaveLength(4);
    expect(CatalogSpecSchema.parse(first.spec)).toEqual(first.spec);
  });

  it('rejects malformed prices, extra fields and incomplete image briefs', () => {
    const invalid = {
      schemaVersion: 'catalog-spec-v1',
      price: { amount: -1, currencyCode: 'usd' },
      imageBriefs: [],
      arbitraryProductUpdate: true,
    };
    expect(CatalogSpecSchema.safeParse(invalid).success).toBe(false);
  });
});
