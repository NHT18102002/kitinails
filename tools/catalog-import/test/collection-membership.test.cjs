const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCollectionPopulationForecast,
  buildSourceCollectionTag,
  deriveProductSourceTags,
  extractSourceMembershipHandles,
  parseCollectionProductHandlesFromHtml,
} = require('../src/collection-membership.cjs');

test('extractSourceMembershipHandles collects handles from SrcCollection tag rules', () => {
  const handles = extractSourceMembershipHandles([
    {
      handle: 'baroque',
      ruleSet: {
        rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'SrcCollection_baroque' }],
      },
    },
    {
      handle: 'medium',
      ruleSet: {
        rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'Length_Med' }],
      },
    },
    {
      handle: 'soft-glam',
      ruleSet: {
        rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'SrcCollection_soft-glam' }],
      },
    },
  ]);

  assert.deepEqual(handles, ['baroque', 'soft-glam']);
});

test('parseCollectionProductHandlesFromHtml extracts unique product handles from collection markup', () => {
  const handles = parseCollectionProductHandlesFromHtml(`
    <a href="/products/fairy-garden">Fairy Garden</a>
    <a href="/products/fairy-garden?variant=1">Duplicate</a>
    <a href="/products/green-muse#details">Green Muse</a>
    <a href="/collections/all">Ignore collection links</a>
  `);

  assert.deepEqual(handles, ['fairy-garden', 'green-muse']);
});

test('deriveProductSourceTags builds per-product source collection tags', () => {
  const sourceTags = deriveProductSourceTags({
    normalizedProducts: [
      { handle: 'fairy-garden', tags: ['Style_Floral'] },
      { handle: 'green-muse', tags: ['Style_Floral'] },
      { handle: 'seafoam', tags: ['Style_Mermaid'] },
    ],
    productMemberships: new Map([
      ['fairy-garden', ['bloom-for-yourself', 'fairy']],
      ['green-muse', ['bloom-for-yourself']],
    ]),
  });

  assert.deepEqual(sourceTags.byHandle.get('fairy-garden').sourceTags, [
    buildSourceCollectionTag('bloom-for-yourself'),
    buildSourceCollectionTag('fairy'),
  ]);
  assert.equal(sourceTags.byHandle.get('seafoam').sourceTags.length, 0);
});

test('buildCollectionPopulationForecast uses product tags, type, price, and source tags', () => {
  const forecast = buildCollectionPopulationForecast({
    approvedCollections: [
      { handle: 'medium', title: 'Medium' },
      { handle: 'bloom-for-yourself', title: 'Bloom For Yourself' },
      { handle: 'tools-accessories', title: 'Tools & Accessories' },
      { handle: 'nails-under-30', title: 'Nails Under $30' },
      { handle: 'all', title: 'All' },
    ],
    collectionRules: [
      { handle: 'all', strategy: 'virtual_skip' },
      {
        handle: 'medium',
        strategy: 'auto_create_rule_backed',
        ruleSet: {
          appliedDisjunctively: false,
          rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'Length_Med' }],
        },
      },
      {
        handle: 'bloom-for-yourself',
        strategy: 'auto_create_rule_backed',
        ruleSet: {
          appliedDisjunctively: false,
          rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'SrcCollection_bloom-for-yourself' }],
        },
      },
      {
        handle: 'tools-accessories',
        strategy: 'auto_create_rule_backed',
        ruleSet: {
          appliedDisjunctively: false,
          rules: [{ column: 'TYPE', relation: 'EQUALS', condition: 'TOOLS & ACCESSORIES' }],
        },
      },
      {
        handle: 'nails-under-30',
        strategy: 'auto_create_rule_backed',
        ruleSet: {
          appliedDisjunctively: false,
          rules: [{ column: 'VARIANT_PRICE', relation: 'LESS_THAN', condition: '30' }],
        },
      },
    ],
    normalizedProducts: [
      {
        handle: 'fairy-garden',
        productType: 'Press On Nails',
        tags: ['Length_Med'],
        variants: [{ price: 2800 }],
      },
      {
        handle: 'tool-kit',
        productType: 'TOOLS & ACCESSORIES',
        tags: [],
        variants: [{ price: 1200 }],
      },
    ],
    productSourceTagsByHandle: new Map([
      ['fairy-garden', [buildSourceCollectionTag('bloom-for-yourself')]],
    ]),
  });

  assert.equal(forecast.byHandle.get('medium').forecastProductCount, 1);
  assert.equal(forecast.byHandle.get('bloom-for-yourself').forecastProductCount, 1);
  assert.equal(forecast.byHandle.get('tools-accessories').forecastProductCount, 1);
  assert.equal(forecast.byHandle.get('nails-under-30').forecastProductCount, 2);
  assert.equal(forecast.byHandle.get('all').strategy, 'virtual_skip');
});
