const test = require('node:test');
const assert = require('node:assert/strict');

const {
  flattenTypeRef,
  summarizeInputType,
} = require('../src/productset-schema.cjs');

test('flattenTypeRef unwraps nested non-null and list GraphQL type references', () => {
  assert.deepEqual(
    flattenTypeRef({
      kind: 'NON_NULL',
      name: null,
      ofType: {
        kind: 'LIST',
        name: null,
        ofType: {
          kind: 'NON_NULL',
          name: null,
          ofType: {
            kind: 'INPUT_OBJECT',
            name: 'FileSetInput',
            ofType: null,
          },
        },
      },
    }),
    {
      baseKind: 'INPUT_OBJECT',
      baseName: 'FileSetInput',
      wrappers: ['NON_NULL', 'LIST', 'NON_NULL'],
    }
  );
});

test('summarizeInputType reduces introspection input fields into a readable contract', () => {
  const summary = summarizeInputType({
    name: 'ProductSetIdentifiers',
    inputFields: [
      { name: 'handle', defaultValue: null, type: { kind: 'SCALAR', name: 'String', ofType: null } },
      { name: 'id', defaultValue: null, type: { kind: 'SCALAR', name: 'ID', ofType: null } },
    ],
  });

  assert.equal(summary.name, 'ProductSetIdentifiers');
  assert.deepEqual(summary.fields.map((field) => field.name), ['handle', 'id']);
  assert.equal(summary.fields[0].type.baseName, 'String');
});
