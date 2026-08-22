const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSearchParams } = require('../assets/facets.helpers.js');

test('buildSearchParams keeps repeated filter values and ignores blanks', () => {
  const result = buildSearchParams([
    [
      ['filter.v.option.color', 'Pink'],
      ['filter.v.option.color', 'Red'],
      ['filter.v.option.shape', ''],
    ],
  ]);

  assert.equal(result, 'filter.v.option.color=Pink&filter.v.option.color=Red');
});

test('buildSearchParams keeps only the last value for singleton keys', () => {
  const result = buildSearchParams(
    [
      [
        ['q', 'nails*'],
        ['sort_by', 'relevance'],
      ],
      [
        ['sort_by', 'price-ascending'],
        ['filter.v.availability', '1'],
      ],
    ],
    { singletonKeys: ['q', 'sort_by'] }
  );

  assert.equal(result, 'q=nails*&sort_by=price-ascending&filter.v.availability=1');
});
