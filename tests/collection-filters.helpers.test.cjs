const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REFERENCE_FILTER_LABELS,
  buildClearAllSearchParams,
  selectCollectionFilterGroups,
} = require('../assets/collection-filters.helpers.js');

test('selectCollectionFilterGroups returns only reference filters in reference order when all are present', () => {
  const groups = [
    { id: 'availability', label: 'Availability' },
    { id: 'shape', label: 'Shape' },
    { id: 'color', label: 'Color' },
    { id: 'style', label: 'Style' },
    { id: 'length', label: 'Length' },
    { id: 'price', label: 'Price' },
  ];

  const result = selectCollectionFilterGroups(groups, { preferredLabels: REFERENCE_FILTER_LABELS });

  assert.equal(result.strictReferenceMode, true);
  assert.deepEqual(
    result.groups.map((group) => group.label),
    ['Color', 'Length', 'Shape', 'Style']
  );
});

test('selectCollectionFilterGroups keeps original groups when the reference set is incomplete', () => {
  const groups = [
    { id: 'availability', label: 'Availability' },
    { id: 'color', label: 'Color' },
    { id: 'price', label: 'Price' },
  ];

  const result = selectCollectionFilterGroups(groups, { preferredLabels: REFERENCE_FILTER_LABELS });

  assert.equal(result.strictReferenceMode, false);
  assert.deepEqual(result.groups, groups);
});

test('buildClearAllSearchParams preserves sort_by and drops filter params', () => {
  const search = buildClearAllSearchParams([
    ['filter.v.option.color', 'pink'],
    ['filter.v.option.shape', 'almond'],
    ['sort_by', 'price-ascending'],
    ['page', '3'],
    ['filter.p.price.gte', '20'],
  ]);

  assert.equal(search, 'sort_by=price-ascending');
});

test('buildClearAllSearchParams ignores blank preserved values', () => {
  const search = buildClearAllSearchParams([
    ['sort_by', ''],
    ['filter.v.option.style', 'chrome'],
  ]);

  assert.equal(search, '');
});
