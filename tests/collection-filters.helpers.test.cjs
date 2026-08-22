const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REFERENCE_FILTER_LABELS,
  buildClearAllSearchParams,
  selectCollectionFilterGroups,
} = require('../assets/collection-filters.helpers.js');

test('selectCollectionFilterGroups places reference filters first without hiding supported extras', () => {
  const groups = [
    { element: 'availability', label: 'Availability' },
    { element: 'shape', label: 'Shape' },
    { element: 'color', label: 'Color' },
    { element: 'style', label: 'Style' },
    { element: 'length', label: 'Length' },
    { element: 'price', label: 'Price' },
  ];

  const result = selectCollectionFilterGroups(groups, { preferredLabels: REFERENCE_FILTER_LABELS });

  assert.equal(result.strictReferenceMode, false);
  assert.deepEqual(
    result.groups.map((group) => group.label),
    ['Color', 'Length', 'Shape', 'Style', 'Availability', 'Price']
  );
});

test('selectCollectionFilterGroups keeps available reference filters first when the set is incomplete', () => {
  const groups = [
    { element: 'availability', label: 'Availability' },
    { element: 'color', label: 'Color' },
    { element: 'price', label: 'Price' },
  ];

  const result = selectCollectionFilterGroups(groups, { preferredLabels: REFERENCE_FILTER_LABELS });

  assert.equal(result.strictReferenceMode, false);
  assert.deepEqual(
    result.groups.map((group) => group.label),
    ['Color', 'Availability', 'Price']
  );
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
