const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyProductCategoryHint,
  extractTaxonomyFromBodyHtml,
  normalizeMerchantInputFlags,
  extractTaxonomyFromTags,
} = require('../src/normalize.cjs');

test('extractTaxonomyFromBodyHtml reads shape, length, style, and finish from public body html', () => {
  const taxonomy = extractTaxonomyFromBodyHtml(`
    <div>NAIL SHAPE: Short Almond</div>
    <div>NAIL LENGTH: Short</div>
    <div>STYLE: Cat Eye</div>
    <div>FINISH: Glossy</div>
    <div>COLOR: Green</div>
  `);

  assert.deepEqual(taxonomy, {
    shape: 'Short Almond',
    length: 'Short',
    style: 'Cat Eye',
    finish: 'Glossy',
    color: 'Green',
  });
});

test('normalizeMerchantInputFlags records only fields that are still missing', () => {
  const flags = normalizeMerchantInputFlags({
    title: 'Seafoam',
    bodyHtml: '<p>Ready</p>',
    color: '',
    shape: 'Almond',
    length: '',
    style: 'Cat Eye',
  });

  assert.deepEqual(flags, ['color', 'length']);
});

test('extractTaxonomyFromTags prefers structured Shopify tag prefixes', () => {
  const taxonomy = extractTaxonomyFromTags([
    'Color_Blue',
    'Color_Nude',
    'Length_Short',
    'Shape_Almond',
    'Style_Cat Eye',
    'Style_Mermaid',
  ]);

  assert.deepEqual(taxonomy, {
    color: ['Blue', 'Nude'],
    length: ['Short'],
    shape: ['Almond'],
    style: ['Cat Eye', 'Mermaid'],
  });
});

test('classifyProductCategoryHint separates nails from accessories, bundles, and service-like products', () => {
  assert.equal(
    classifyProductCategoryHint({ productType: 'Press On Nails', tags: ['Press On Nails'], title: 'Seafoam', handle: 'seafoam' }),
    'press_on_nails'
  );
  assert.equal(
    classifyProductCategoryHint({ productType: 'TOOLS & ACCESSORIES', tags: ['TOOLS & ACCESSORIES'], title: 'ProTouch Kit', handle: 'protouch-kit' }),
    'tool_accessory'
  );
  assert.equal(
    classifyProductCategoryHint({ productType: 'Bundle', tags: ['Bundle'], title: 'Elegance Trio', handle: 'elegance-trio' }),
    'bundle'
  );
  assert.equal(
    classifyProductCategoryHint({ productType: '', tags: [], title: 'Customization Request', handle: 'customization-request' }),
    'service_or_custom'
  );
  assert.equal(
    classifyProductCategoryHint({ productType: '', tags: ['Valentine'], title: 'Ersa Nails Gift Card', handle: 'ersa-nails-gift-card' }),
    'gift_card'
  );
});
