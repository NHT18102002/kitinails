const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalizeProductUrl,
  dedupeProducts,
  proposeCollectionDecision,
} = require('../src/discovery.cjs');

test('canonicalizeProductUrl keeps only canonical English product path', () => {
  assert.equal(
    canonicalizeProductUrl('https://ersanails.com/products/seafoam?variant=123&utm_source=test'),
    'https://ersanails.com/products/seafoam'
  );
  assert.equal(
    canonicalizeProductUrl('https://ersanails.com/de/products/seafoam'),
    null
  );
  assert.equal(
    canonicalizeProductUrl('https://ersanails.com/collections/all'),
    null
  );
});

test('dedupeProducts keeps the first canonical record per handle', () => {
  const deduped = dedupeProducts([
    { handle: 'seafoam', source: 'products-json', url: 'https://ersanails.com/products/seafoam' },
    { handle: 'seafoam', source: 'sitemap', url: 'https://ersanails.com/products/seafoam?variant=1' },
    { handle: 'lost-in-paradise', source: 'sitemap', url: 'https://ersanails.com/products/lost-in-paradise' },
  ]);

  assert.equal(deduped.products.length, 2);
  assert.deepEqual(
    deduped.products.map((product) => product.handle),
    ['seafoam', 'lost-in-paradise']
  );
  assert.equal(deduped.duplicates.length, 1);
  assert.equal(deduped.duplicates[0].handle, 'seafoam');
});

test('proposeCollectionDecision excludes locale, hidden, stale campaign, and copy handles', () => {
  assert.deepEqual(
    proposeCollectionDecision({ handle: 'bloom-for-yourself-copy', title: 'Bloom For Yourself Copy' }),
    { decision: 'exclude', reason: 'copy_handle' }
  );
  assert.deepEqual(
    proposeCollectionDecision({ handle: 'valentines-collection-副本', title: 'Valentines Collection Copy' }),
    { decision: 'exclude', reason: 'copy_handle' }
  );
  assert.deepEqual(
    proposeCollectionDecision({ handle: 'best-selling-30-feb20', title: 'Best Selling 30 Feb20' }),
    { decision: 'exclude', reason: 'dated_campaign_handle' }
  );
  assert.deepEqual(
    proposeCollectionDecision({ handle: 'flash-sale', title: 'Flash Sale' }),
    { decision: 'exclude', reason: 'campaign_collection' }
  );
  assert.deepEqual(
    proposeCollectionDecision({ handle: 'all', title: 'All' }),
    { decision: 'include', reason: 'core_storefront_collection' }
  );
  assert.deepEqual(
    proposeCollectionDecision({ handle: 'coffin', title: 'Coffin' }),
    { decision: 'include', reason: 'core_storefront_collection' }
  );
  assert.deepEqual(
    proposeCollectionDecision({ handle: 'ersa-nails-tools', title: 'Ersa nails Tools' }),
    { decision: 'include', reason: 'core_storefront_collection' }
  );
});
