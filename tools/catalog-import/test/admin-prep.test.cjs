const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCollectionCreateInput,
  buildCollectionPreparationPlan,
  buildMetafieldDefinitionCreatePlan,
  normalizeCollectionRuleMap,
  normalizeConflictResolutionConfig,
} = require('../src/admin-prep.cjs');

test('normalizeConflictResolutionConfig builds an adopt allowlist keyed by handle', () => {
  const resolution = normalizeConflictResolutionConfig({
    conflicts: [
      {
        handle: 'seafoam',
        existingProductId: 'gid://shopify/Product/9650366644375',
        sourceUrl: 'https://ersanails.com/products/seafoam',
        action: 'adopt_existing',
      },
    ],
  });

  assert.equal(resolution.byHandle.get('seafoam').action, 'adopt_existing');
  assert.equal(resolution.byHandle.get('seafoam').existingProductId, 'gid://shopify/Product/9650366644375');
});

test('normalizeCollectionRuleMap validates rule-backed and pending collections', () => {
  const normalized = normalizeCollectionRuleMap({
    collections: [
      { handle: 'all', title: 'All', strategy: 'virtual_skip' },
      {
        handle: 'medium',
        title: 'Medium',
        strategy: 'auto_create_rule_backed',
        ruleSet: {
          appliedDisjunctively: false,
          rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'Length_Med' }],
        },
      },
      { handle: 'best-seller', title: 'Best Sellers', strategy: 'pending_merchant_rule' },
    ],
  });

  assert.equal(normalized.byHandle.get('all').strategy, 'virtual_skip');
  assert.equal(normalized.byHandle.get('medium').ruleSet.rules[0].condition, 'Length_Med');
  assert.equal(normalized.byHandle.get('best-seller').strategy, 'pending_merchant_rule');
});

test('buildCollectionCreateInput maps approved rules into Shopify sources payload', () => {
  const medium = buildCollectionCreateInput({
    handle: 'medium',
    title: 'Medium',
    strategy: 'auto_create_rule_backed',
    ruleSet: {
      appliedDisjunctively: false,
      rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'Length_Med' }],
    },
  });
  const ombre = buildCollectionCreateInput({
    handle: 'ombre',
    title: 'Ombre',
    strategy: 'auto_create_rule_backed',
    ruleSet: {
      appliedDisjunctively: false,
      rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'Style_Ombré' }],
    },
  });
  const under30 = buildCollectionCreateInput(
    {
      handle: 'nails-under-30',
      title: 'Nails Under $30',
      strategy: 'auto_create_rule_backed',
      ruleSet: {
        appliedDisjunctively: false,
        rules: [{ column: 'VARIANT_PRICE', relation: 'LESS_THAN', condition: '30' }],
      },
    },
    'USD'
  );
  const tools = buildCollectionCreateInput({
    handle: 'ersa-nails-tools',
    title: 'Ersa nails Tools',
    strategy: 'auto_create_rule_backed',
    ruleSet: {
      appliedDisjunctively: false,
      rules: [{ column: 'TYPE', relation: 'EQUALS', condition: 'TOOLS & ACCESSORIES' }],
    },
  });

  assert.equal(medium.handle, 'medium');
  assert.equal(medium.ruleSet.rules[0].condition, 'Length_Med');
  assert.equal(medium.sources[0].source.inclusion.conditions[0].productTag.values[0], 'Length_Med');
  assert.equal(ombre.ruleSet.rules[0].condition, 'Style_Ombré');
  assert.equal(ombre.sources[0].source.inclusion.conditions[0].productTag.values[0], 'Style_Ombré');
  assert.equal(under30.sources[0].source.inclusion.conditions[0].variantPrice.value.amount, '30');
  assert.equal(under30.sources[0].source.inclusion.conditions[0].variantPrice.value.currencyCode, 'USD');
  assert.equal(tools.sources[0].source.inclusion.matchType, 'ANY');
  assert.equal(tools.sources[0].source.inclusion.conditions[0].productType.matchType, 'ANY');
});

test('buildCollectionPreparationPlan separates create, pending, and virtual collections', () => {
  const result = buildCollectionPreparationPlan({
    approvedCollections: [
      { handle: 'all', title: 'All' },
      { handle: 'medium', title: 'Medium' },
      { handle: 'best-seller', title: 'Best Sellers' },
    ],
    resolvedByHandle: new Map(),
    collectionRuleMapByHandle: new Map([
      ['all', { handle: 'all', title: 'All', strategy: 'virtual_skip' }],
      [
        'medium',
        {
          handle: 'medium',
          title: 'Medium',
          strategy: 'auto_create_rule_backed',
          ruleSet: {
            appliedDisjunctively: false,
            rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'Length_Med' }],
          },
        },
      ],
      ['best-seller', { handle: 'best-seller', title: 'Best Sellers', strategy: 'pending_merchant_rule' }],
    ]),
  });

  assert.deepEqual(result.virtualSkips.map((item) => item.handle), ['all']);
  assert.deepEqual(result.toCreate.map((item) => item.handle), ['medium']);
  assert.deepEqual(result.pending.map((item) => item.handle), ['best-seller']);
});

test('buildMetafieldDefinitionCreatePlan creates only truly missing definitions and accepts list finish_style', () => {
  const result = buildMetafieldDefinitionCreatePlan({
    existingDefinitions: [
      { namespace: 'custom', key: 'finish_style', type: { name: 'list.single_line_text_field' } },
      { namespace: 'custom', key: 'nail_shape', type: { name: 'single_line_text_field' } },
      { namespace: 'custom', key: 'nail_length', type: { name: 'single_line_text_field' } },
    ],
  });

  assert.equal(result.toCreate.some((item) => item.key === 'source_url'), true);
  assert.equal(result.toCreate.some((item) => item.key === 'nail_color_values'), true);
  assert.equal(result.toCreate.some((item) => item.key === 'finish_style'), false);
  assert.deepEqual(result.typeMismatches, []);
});
