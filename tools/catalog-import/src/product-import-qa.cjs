const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');

const QUERY_PRODUCT_IMPORT_QA = `#graphql
query ProductImportQa($query: String!) {
  products(first: 10, query: $query) {
    nodes {
      id
      handle
      status
      tags
      sourceUrl: metafield(namespace: "custom", key: "source_url") {
        value
      }
      sourceProductId: metafield(namespace: "custom", key: "source_product_id") {
        value
      }
      demoInventory: metafield(namespace: "custom", key: "demo_inventory") {
        value
      }
      nailShape: metafield(namespace: "custom", key: "nail_shape") {
        value
      }
      nailLength: metafield(namespace: "custom", key: "nail_length") {
        value
      }
      finishStyle: metafield(namespace: "custom", key: "finish_style") {
        value
      }
      nailColorValues: metafield(namespace: "custom", key: "nail_color_values") {
        value
      }
      nailShapeValues: metafield(namespace: "custom", key: "nail_shape_values") {
        value
      }
      nailLengthValues: metafield(namespace: "custom", key: "nail_length_values") {
        value
      }
      nailStyleValues: metafield(namespace: "custom", key: "nail_style_values") {
        value
      }
      media(first: 250) {
        nodes {
          id
        }
      }
      variants(first: 250) {
        nodes {
          id
          sku
          price
          compareAtPrice
          inventoryPolicy
          selectedOptions {
            name
            value
          }
          inventoryItem {
            inventoryLevels(first: 10) {
              nodes {
                location {
                  id
                }
                quantities(names: ["available"]) {
                  name
                  quantity
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

function compareImportedProduct({ expectedRequest, importedProduct }) {
  const mismatches = [];
  if (!importedProduct) {
    return { handle: expectedRequest.identifier.handle, missing: true, mismatches };
  }

  if (importedProduct.status !== expectedRequest.input.status) mismatches.push('status');
  if (importedProduct.sourceUrl !== extractExpectedMetafield(expectedRequest, 'source_url')) mismatches.push('sourceUrl');
  if (!sameStringSet(importedProduct.tags, expectedRequest.input.tags)) mismatches.push('tags');
  if (Number(importedProduct.mediaCount) !== expectedMediaCount(expectedRequest)) mismatches.push('mediaCount');

  const expectedMetafields = Object.fromEntries(
    (expectedRequest.input.metafields || [])
      .filter((item) => item.key !== 'source_url')
      .map((item) => [item.key, item.value])
  );
  for (const [key, value] of Object.entries(expectedMetafields)) {
    if (String(importedProduct.metafields?.[key] || '') !== String(value || '')) {
      mismatches.push('metafields');
      break;
    }
  }

  if (Number(importedProduct.variants.length) !== Number(expectedRequest.input.variants?.length || 0)) {
    mismatches.push('variantCount');
  }

  for (const expectedVariant of expectedRequest.input.variants || []) {
    const importedVariant = findImportedVariant(importedProduct.variants || [], expectedVariant);
    if (!importedVariant) {
      mismatches.push('missingVariant');
      continue;
    }
    if (String(importedVariant.price) !== String(expectedVariant.price)) mismatches.push('variantPrice');
    if (String(importedVariant.compareAtPrice || '') !== String(expectedVariant.compareAtPrice || '')) {
      mismatches.push('variantCompareAtPrice');
    }

    const expectedInventory = expectedVariant.inventoryQuantities?.[0];
    if (expectedInventory) {
      const importedQuantity = importedVariant.inventoryByLocation?.[expectedInventory.locationId];
      if (Number(importedQuantity) !== Number(expectedInventory.quantity)) {
        mismatches.push('inventoryQuantities');
      }
    }
  }

  return {
    handle: expectedRequest.identifier.handle,
    missing: false,
    mismatches: Array.from(new Set(mismatches)),
  };
}

function buildQaSummary(records) {
  return {
    total: records.length,
    matched: records.filter((record) => !record.missing && record.mismatches.length === 0).length,
    mismatched: records.filter((record) => !record.missing && record.mismatches.length > 0).length,
    missing: records.filter((record) => record.missing).length,
  };
}

async function runProductSetImportQa({ graphql, logger = () => {} }) {
  const [dryRun, importManifest, preflight] = await Promise.all([
    readJsonIfExists(path.join(paths.manifestsRoot, 'productset-dry-run.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'productset-import.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'import-preflight.json')),
  ]);

  const requestsByHandle = new Map((dryRun?.requests || []).map((request) => [request.identifier.handle, request]));
  const qaHandles = (importManifest?.records || [])
    .filter((record) => ['complete', 'skipped_unchanged'].includes(record.status))
    .map((record) => record.handle);
  const locationId = preflight?.locations?.selected?.id || '';
  const records = [];

  logger(`QA checking ${qaHandles.length} imported products...`);

  await mapLimit(qaHandles, 2, async (handle, index) => {
    if (index > 0 && index % 50 === 0) {
      logger(`QA checked ${index}/${qaHandles.length} products...`);
    }

    const request = requestsByHandle.get(handle);
    const data = await runWithRetries(() =>
      graphql(QUERY_PRODUCT_IMPORT_QA, {
        query: `handle:${handle}`,
      })
    );
    const exact = (data.products?.nodes || []).find((item) => item.handle === handle);
    const imported = exact ? normalizeImportedProduct(exact, locationId) : null;
    records.push(compareImportedProduct({ expectedRequest: request, importedProduct: imported }));
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    summary: buildQaSummary(records),
    records,
  };

  await writeJson(path.join(paths.manifestsRoot, 'productset-import-qa.json'), manifest);
  return manifest;
}

function normalizeImportedProduct(product, locationId) {
  const variants = (product.variants?.nodes || []).map((variant) => ({
    sku: variant.sku || '',
    price: String(variant.price || ''),
    compareAtPrice: variant.compareAtPrice ? String(variant.compareAtPrice) : '',
    optionSignature: buildSelectedOptionSignature(
      (variant.selectedOptions || []).map((item) => ({
        optionName: item.name,
        name: item.value,
      }))
    ),
    inventoryByLocation: Object.fromEntries(
      (variant.inventoryItem?.inventoryLevels?.nodes || []).map((level) => [
        level.location?.id,
        Number((level.quantities || []).find((quantity) => quantity.name === 'available')?.quantity || 0),
      ])
    ),
  }));

  return {
    handle: product.handle,
    status: product.status,
    tags: product.tags || [],
    mediaCount: (product.media?.nodes || []).length,
    sourceUrl: product.sourceUrl?.value || '',
    metafields: {
      source_product_id: product.sourceProductId?.value || '',
      demo_inventory: product.demoInventory?.value || '',
      nail_shape: product.nailShape?.value || '',
      nail_length: product.nailLength?.value || '',
      finish_style: product.finishStyle?.value || '',
      nail_color_values: product.nailColorValues?.value || '',
      nail_shape_values: product.nailShapeValues?.value || '',
      nail_length_values: product.nailLengthValues?.value || '',
      nail_style_values: product.nailStyleValues?.value || '',
    },
    variants,
    locationId,
  };
}

function extractExpectedMetafield(request, key) {
  return request?.input?.metafields?.find((item) => item.key === key)?.value || '';
}

function expectedMediaCount(request) {
  return new Set((request?.input?.files || []).map((file) => String(file?.id || '').trim()).filter(Boolean)).size;
}

function findImportedVariant(importedVariants, expectedVariant) {
  const expectedSignature = buildSelectedOptionSignature(expectedVariant.optionValues || []);
  if (expectedSignature) {
    const bySignature = importedVariants.find((variant) => variant.optionSignature === expectedSignature);
    if (bySignature) return bySignature;
  }

  const expectedSku = String(expectedVariant?.sku || '').trim();
  if (expectedSku) {
    return importedVariants.find((variant) => String(variant.sku || '').trim() === expectedSku) || null;
  }

  return null;
}

function buildSelectedOptionSignature(optionValues) {
  return (optionValues || [])
    .map((item) => `${String(item.optionName || item.name || '').trim()}::${String(item.name || item.value || '').trim()}`)
    .filter(Boolean)
    .join('|');
}

function sameStringSet(left, right) {
  const leftSet = Array.from(new Set((left || []).map((value) => String(value).trim()).filter(Boolean))).sort();
  const rightSet = Array.from(new Set((right || []).map((value) => String(value).trim()).filter(Boolean))).sort();
  return JSON.stringify(leftSet) === JSON.stringify(rightSet);
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}

async function runWithRetries(operation, attempts = 5) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === attempts - 1) {
        break;
      }
      await delay(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError;
}

function isRetryableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('throttled') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    message.includes('fetch failed')
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  QUERY_PRODUCT_IMPORT_QA,
  buildQaSummary,
  compareImportedProduct,
  runProductSetImportQa,
};
