const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { writeJson } = require('./fs-utils.cjs');

const PRODUCTSET_TYPE_NAMES = [
  'ProductSetIdentifiers',
  'ProductSetInput',
  'ProductVariantSetInput',
  'ProductSetInventoryInput',
  'FileSetInput',
  'VariantOptionValueInput',
  'OptionSetInput',
  'OptionValueSetInput',
  'MetafieldInput',
];

function flattenTypeRef(typeRef) {
  const wrappers = [];
  let current = typeRef;

  while (current && current.ofType) {
    wrappers.push(current.kind);
    current = current.ofType;
  }

  if (current) {
    return {
      baseKind: current.kind,
      baseName: current.name,
      wrappers,
    };
  }

  return {
    baseKind: '',
    baseName: '',
    wrappers,
  };
}

function summarizeInputType(typeDefinition) {
  const fields = (typeDefinition?.inputFields || [])
    .map((field) => ({
      name: field.name,
      defaultValue: field.defaultValue,
      type: flattenTypeRef(field.type),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    name: typeDefinition?.name || '',
    kind: typeDefinition?.kind || '',
    fields,
  };
}

async function runProductSetSchema({ graphql }) {
  const types = [];

  for (const name of PRODUCTSET_TYPE_NAMES) {
    const query = `#graphql
      query InputTypeContract($name: String!) {
        __type(name: $name) {
          kind
          name
          inputFields {
            name
            defaultValue
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }`;
    const data = await graphql(query, { name });
    if (data.__type) {
      types.push(summarizeInputType(data.__type));
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    types,
  };

  await writeJson(path.join(paths.manifestsRoot, 'productset-schema.json'), manifest);
  return manifest;
}

module.exports = {
  PRODUCTSET_TYPE_NAMES,
  flattenTypeRef,
  runProductSetSchema,
  summarizeInputType,
};
