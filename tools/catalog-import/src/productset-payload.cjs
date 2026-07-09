const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');

function mergeProductTags(existingTags, sourceTags) {
  const merged = [];
  const seen = new Set();

  for (const value of [...(existingTags || []), ...(sourceTags || [])]) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
  }

  return merged;
}

function buildProductMetafields(product) {
  const metafields = [
    buildMetafield('custom', 'source_url', 'url', product.sourceUrl),
    buildMetafield('custom', 'source_product_id', 'single_line_text_field', String(product.sourceProductId || '')),
    buildMetafield('custom', 'demo_inventory', 'boolean', 'true'),
  ].filter(Boolean);

  const color = listOrEmpty(product.taxonomy?.color);
  const shape = listOrEmpty(product.taxonomy?.shape);
  const length = listOrEmpty(product.taxonomy?.length);
  const style = listOrEmpty(product.taxonomy?.style);
  const finish = listOrEmpty(product.taxonomy?.finish);

  if (shape[0]) {
    metafields.push(buildMetafield('custom', 'nail_shape', 'single_line_text_field', shape[0]));
  }

  if (length[0]) {
    metafields.push(buildMetafield('custom', 'nail_length', 'single_line_text_field', length[0]));
  }

  if (finish.length) {
    metafields.push(buildMetafield('custom', 'finish_style', 'list.single_line_text_field', JSON.stringify(finish)));
  }

  if (color.length) {
    metafields.push(buildMetafield('custom', 'nail_color_values', 'list.single_line_text_field', JSON.stringify(color)));
  }

  if (shape.length) {
    metafields.push(buildMetafield('custom', 'nail_shape_values', 'list.single_line_text_field', JSON.stringify(shape)));
  }

  if (length.length) {
    metafields.push(buildMetafield('custom', 'nail_length_values', 'list.single_line_text_field', JSON.stringify(length)));
  }

  if (style.length) {
    metafields.push(buildMetafield('custom', 'nail_style_values', 'list.single_line_text_field', JSON.stringify(style)));
  }

  return metafields;
}

function buildProductSetRequest({ product, locationId, sourceTags, fileRecords }) {
  const tags = mergeProductTags(product.tags || [], sourceTags || []);
  const files = buildProductFileInputs({
    product,
    fileRecords,
  });
  const productOptions = (product.options || []).map((option) => ({
    name: option.name,
    position: option.position,
    values: (option.values || []).map((value) => ({ name: value })),
  }));

  return compactObject({
    identifier: {
      handle: product.handle,
    },
    input: {
      handle: product.handle,
      title: product.title,
      vendor: product.vendor || '',
      productType: product.productType || '',
      descriptionHtml: product.bodyHtml || '',
      status: 'DRAFT',
      giftCard: product.categoryHint === 'gift_card',
      tags,
      seo: buildSeoInput(product.seo),
      metafields: buildProductMetafields(product),
      files,
      productOptions,
      variants: buildVariantInputs({
        product,
        locationId,
      }),
    },
  });
}

async function runProductSetDryRun() {
  const [normalized, preflight, sourceTagsManifest, shopifyFiles] = await Promise.all([
    readJsonIfExists(path.join(paths.normalizedRoot, 'products.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'import-preflight.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'product-source-tags.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'shopify-files.json')),
  ]);

  const products = Array.isArray(normalized) ? normalized : normalized?.products || [];
  const sourceTagsByHandle = new Map(
    (sourceTagsManifest?.records || []).map((record) => [record.handle, record.sourceTags || []])
  );
  const fileRecords = Array.isArray(shopifyFiles?.files) ? shopifyFiles.files : [];
  const locationId = preflight?.locations?.selected?.id || '';

  if (!products.length) {
    throw new Error(`Missing normalized products at ${path.join(paths.normalizedRoot, 'products.json')}. Run audit first.`);
  }

  if (!locationId) {
    throw new Error(`Missing selected location in ${path.join(paths.manifestsRoot, 'import-preflight.json')}.`);
  }

  const requests = [];
  const buildErrors = [];
  let variantCount = 0;

  for (const product of products) {
    try {
      const request = buildProductSetRequest({
        product,
        locationId,
        sourceTags: sourceTagsByHandle.get(product.handle) || [],
        fileRecords,
      });
      requests.push(request);
      variantCount += request.input.variants.length;
    } catch (error) {
      buildErrors.push({
        handle: product.handle,
        message: error.message,
      });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    summary: {
      productCount: requests.length,
      variantCount,
      payloadStatus: 'DRAFT',
      buildErrors,
    },
    requests,
  };

  await writeJson(path.join(paths.manifestsRoot, 'productset-dry-run.json'), manifest);
  return manifest;
}

function buildProductFileInputs({ product, fileRecords }) {
  const bySourceUrl = new Map();

  for (const record of fileRecords || []) {
    if (record.fileStatus !== 'READY' || !record.shopifyFileId) continue;

    for (const dependent of record.dependents || []) {
      if (dependent.productHandle !== product.handle) continue;
      const sourceUrl = String(dependent.sourceUrl || '').trim();
      if (!sourceUrl) continue;
      bySourceUrl.set(sourceUrl, {
        id: record.shopifyFileId,
        alt: dependent.alt || record.alt || '',
        filename: record.filename || path.basename(record.localPath || sourceUrl),
        contentType: record.contentType || 'IMAGE',
        order: Number(dependent.order || 0),
      });
    }
  }

  const files = [];
  const seenFileIds = new Set();

  for (const media of [...(product.media || [])].sort((left, right) => Number(left.position || 0) - Number(right.position || 0))) {
    const matched = bySourceUrl.get(String(media.src || '').trim());
    if (!matched) continue;
    if (seenFileIds.has(matched.id)) continue;
    seenFileIds.add(matched.id);
    files.push({
      id: matched.id,
    });
  }

  return files;
}

function buildVariantInputs({ product, locationId }) {
  const optionNames = (product.options || []).map((option) => option.name);

  return (product.variants || []).map((variant, index) =>
    compactObject({
      price: normalizeMoneyValue(variant.price),
      compareAtPrice: normalizeOptionalMoneyValue(variant.compareAtPrice),
      sku: String(variant.sku || '').trim() || null,
      optionValues: optionNames.map((optionName, optionIndex) => ({
        optionName,
        name: String(variant.options?.[optionIndex] || '').trim() || String(variant.title || '').trim(),
      })),
      inventoryPolicy: 'DENY',
      inventoryQuantities: [
        {
          locationId,
          name: 'available',
          quantity: variant.available ? 50 : 0,
        },
      ],
      position: index + 1,
    })
  );
}

function buildSeoInput(seo) {
  const title = String(seo?.title || '').trim();
  const description = String(seo?.description || '').trim();
  if (!title && !description) return null;
  return {
    title,
    description,
  };
}

function buildMetafield(namespace, key, type, value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return {
    namespace,
    key,
    type,
    value: normalized,
  };
}

function normalizeMoneyValue(value) {
  return normalizeSourceMoney(value).toFixed(2);
}

function normalizeOptionalMoneyValue(value) {
  if (value === null || value === undefined || value === '') return null;
  return normalizeSourceMoney(value).toFixed(2);
}

function listOrEmpty(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeSourceMoney(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    if (trimmed.includes('.')) return Number(trimmed);
    return Number(trimmed) / 100;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return Number.isInteger(value) ? value / 100 : value;
  }

  return Number(value || 0) || 0;
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => compactObject(item))
      .filter((item) => item !== null && item !== undefined);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const output = {};

  for (const [key, current] of Object.entries(value)) {
    if (current === null || current === undefined) continue;
    if (Array.isArray(current) && current.length === 0) continue;

    const nextValue = compactObject(current);
    if (nextValue === null || nextValue === undefined) continue;
    if (Array.isArray(nextValue) && nextValue.length === 0) continue;
    output[key] = nextValue;
  }

  return output;
}

module.exports = {
  buildProductMetafields,
  buildProductSetRequest,
  mergeProductTags,
  runProductSetDryRun,
};
