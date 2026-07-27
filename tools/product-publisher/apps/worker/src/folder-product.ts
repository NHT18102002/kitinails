import { CatalogSpecSchema, type CatalogSpec } from '@ersa/product-publisher-ai';
import type { AssetDto, BatchDto, BatchItemDto } from '@ersa/product-publisher-contracts';

export function buildFolderCatalogSpec(input: {
  batch: BatchDto;
  item: BatchItemDto;
  sourceAssets: readonly AssetDto[];
  currencyCode: string;
  defaultProductPrice: number;
}): CatalogSpec {
  const firstSource = input.sourceAssets
    .filter((asset) => asset.kind === 'SOURCE')
    .sort((left, right) => String(left.slot).localeCompare(String(right.slot)))[0];
  const originalFilename = typeof firstSource?.metadata.originalFilename === 'string'
    ? firstSource.metadata.originalFilename
    : '';
  const label = sourceProductLabel(originalFilename, input.item.position);
  const title = clipText(`${input.batch.collection.title} ${label}`, 255);
  const identitySuffix = (input.item.externalId || input.item.id).slice(0, 12);
  const safeCollectionHandle = slugify(input.batch.collection.handle) || 'collection';
  const handle = `ersa-${safeCollectionHandle}-${identitySuffix}`;
  const escapedCollectionTitle = escapeHtml(input.batch.collection.title);
  const descriptionHtml = `<p>Press-on nail design from the ${escapedCollectionTitle} collection, prepared by Ersa Nails.</p>`;
  const sizes = ['XS', 'S', 'M', 'L'] as const;
  const imageRoles = ['HERO', 'DETAIL', 'LIFESTYLE', 'SCALE', 'PACKAGING'] as const;

  return CatalogSpecSchema.parse({
    schemaVersion: 'catalog-spec-v1',
    title,
    handle,
    descriptionHtml,
    vendor: 'Ersa Nails',
    productType: 'Press-On Nails',
    price: { amount: input.defaultProductPrice, currencyCode: input.currencyCode },
    tags: ['press-on-nails', 'folder-import', input.batch.collection.handle],
    seo: {
      title: clipText(`${title} | Ersa Nails`, 70),
      description: clipText(
        `Shop ${title}, an Ersa Nails press-on nail design in the ${input.batch.collection.title} collection.`,
        320,
      ),
    },
    options: [{ name: 'Size', values: sizes }],
    variants: sizes.map((size) => ({
      skuSuffix: size,
      title: size,
      optionValues: { Size: size },
      price: { amount: input.defaultProductPrice, currencyCode: input.currencyCode },
    })),
    metafields: [],
    attributes: {
      shape: 'Unspecified',
      length: 'Unspecified',
      finish: 'Unspecified',
      colors: ['Unspecified'],
      style: ['Unspecified'],
    },
    confidence: { identity: 1, taxonomy: 1, copy: 1 },
    evidence: ['Deterministic folder import; no AI provider request was made.'],
    imageBriefs: imageRoles.map((role) => ({
      role,
      prompt: `Reserved ${role.toLowerCase()} role for the two-image direct folder import workflow.`,
      alt: `${title} ${role.toLowerCase()} view`,
    })),
  });
}

export function sourceProductLabel(originalFilename: string, position: number): string {
  const stem = originalFilename.replace(/\.[^.]+$/, '').replace(/\.1$/, '').trim();
  if (/^\d+$/.test(stem)) return stem.padStart(2, '0');
  const humanized = stem
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('vi'));
  return humanized ? clipText(humanized, 80) : String(position + 1).padStart(2, '0');
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clipText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
