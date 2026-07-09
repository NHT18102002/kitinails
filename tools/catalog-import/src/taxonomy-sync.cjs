const path = require('node:path');

const { assertCurrentManifestApproved } = require('./approval.cjs');
const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');
const {
  MUTATION_METAFIELDS_SET,
  QUERY_PRODUCT_TAXONOMY_BY_HANDLE,
} = require('./shopify-queries.cjs');

const TAXONOMY_FIELD_KEYS = ['color', 'shape', 'length', 'style'];
const TAXONOMY_REQUIRED_CATEGORIES = new Set(['press_on_nails', 'bundle']);

const SHAPE_RULES = [
  { expression: /\bsquoval\b/i, value: 'Squoval' },
  { expression: /\bcoffin\b/i, value: 'Coffin' },
  { expression: /\balmond\b/i, value: 'Almond' },
  { expression: /\boval\b/i, value: 'Oval' },
  { expression: /\bsquare\b/i, value: 'Square' },
];

const STYLE_ALIASES = new Map(
  Object.entries({
    '3d': '3D',
    aura: 'Aura',
    'cat eye': 'Cat Eye',
    chrome: 'Chrome',
    glitter: 'Glitter',
    gothic: 'Gothic',
    'french tip': 'French Tip',
    'hand painted': 'Hand Painted',
    matte: 'Matte',
    mermaid: 'Mermaid',
    metallic: 'Metallic',
    ombre: 'Ombre',
    'ombré': 'Ombre',
    pearl: 'Pearl',
    'rhine stone': 'Rhinestone',
    rhinestone: 'Rhinestone',
  })
);

function normalizeTaxonomyForSync(product) {
  const rawTaxonomy = product?.taxonomy || {};
  const rawShapeValues = normalizeRawValues(rawTaxonomy.shape);
  const rawLengthValues = normalizeRawValues(rawTaxonomy.length);

  const shape = uniqueValues(rawShapeValues.map(normalizeShapeValue).filter(Boolean));
  const length = uniqueValues(
    [
      ...rawLengthValues.map(normalizeLengthValue).filter(Boolean),
      ...rawShapeValues.map(deriveLengthFromShapeValue).filter(Boolean),
    ]
  );

  const normalized = {
    color: uniqueValues(normalizeRawValues(rawTaxonomy.color).map(normalizeColorValue).filter(Boolean)),
    shape,
    length,
    style: uniqueValues(normalizeRawValues(rawTaxonomy.style).map(normalizeStyleValue).filter(Boolean)),
  };

  return {
    ...normalized,
    merchantInputRequired: requiresTaxonomy(product)
      ? TAXONOMY_FIELD_KEYS.filter((field) => normalized[field].length === 0)
      : [],
  };
}

function buildTaxonomyMetafieldsInput({ productId, taxonomy }) {
  const metafields = [];

  if (taxonomy.shape[0]) {
    metafields.push(buildMetafieldInput(productId, 'nail_shape', 'single_line_text_field', taxonomy.shape[0]));
  }

  if (taxonomy.length[0]) {
    metafields.push(buildMetafieldInput(productId, 'nail_length', 'single_line_text_field', taxonomy.length[0]));
  }

  if (taxonomy.color.length) {
    metafields.push(
      buildMetafieldInput(productId, 'nail_color_values', 'list.single_line_text_field', JSON.stringify(taxonomy.color))
    );
  }

  if (taxonomy.shape.length) {
    metafields.push(
      buildMetafieldInput(productId, 'nail_shape_values', 'list.single_line_text_field', JSON.stringify(taxonomy.shape))
    );
  }

  if (taxonomy.length.length) {
    metafields.push(
      buildMetafieldInput(productId, 'nail_length_values', 'list.single_line_text_field', JSON.stringify(taxonomy.length))
    );
  }

  if (taxonomy.style.length) {
    metafields.push(
      buildMetafieldInput(productId, 'nail_style_values', 'list.single_line_text_field', JSON.stringify(taxonomy.style))
    );
  }

  return metafields;
}

function buildTaxonomySyncRecord({ product, existing }) {
  const normalizedTaxonomy = normalizeTaxonomyForSync(product);

  if (!existing?.id) {
    return {
      handle: product.handle,
      title: product.title,
      categoryHint: product.categoryHint || '',
      productId: '',
      decision: 'missing_product',
      status: 'skipped',
      merchantInputRequired: normalizedTaxonomy.merchantInputRequired,
      normalizedTaxonomy,
      metafields: [],
      changedKeys: [],
      errors: [],
    };
  }

  const desiredMetafields = buildTaxonomyMetafieldsInput({
    productId: existing.id,
    taxonomy: normalizedTaxonomy,
  });

  if (!desiredMetafields.length) {
    return {
      handle: product.handle,
      title: product.title,
      categoryHint: product.categoryHint || '',
      productId: existing.id,
      decision: normalizedTaxonomy.merchantInputRequired.length ? 'skip_merchant_input_required' : 'skip_not_applicable',
      status: 'skipped',
      merchantInputRequired: normalizedTaxonomy.merchantInputRequired,
      normalizedTaxonomy,
      metafields: [],
      changedKeys: [],
      errors: [],
    };
  }

  const changedMetafields = desiredMetafields.filter((metafield) => !metafieldMatchesExistingValue(metafield, existing));

  return {
    handle: product.handle,
    title: product.title,
    categoryHint: product.categoryHint || '',
    productId: existing.id,
    decision: changedMetafields.length ? 'update' : 'skipped_unchanged',
    status: changedMetafields.length ? 'pending' : 'skipped',
    merchantInputRequired: normalizedTaxonomy.merchantInputRequired,
    normalizedTaxonomy,
    metafields: changedMetafields,
    changedKeys: changedMetafields.map((metafield) => metafield.key),
    errors: [],
  };
}

function buildTaxonomySyncSummary(records, confirmSync) {
  const summary = {
    total: records.length,
    mode: confirmSync ? 'apply' : 'dry-run',
    missingProductCount: 0,
    updateCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    skippedNotApplicableCount: 0,
    skippedMerchantInputCount: 0,
    failedCount: 0,
    merchantInputRequiredCount: 0,
  };

  for (const record of records) {
    if (record.decision === 'missing_product') summary.missingProductCount += 1;
    if (record.decision === 'update') summary.updateCount += 1;
    if (record.status === 'updated') summary.updatedCount += 1;
    if (record.decision === 'skipped_unchanged') summary.unchangedCount += 1;
    if (record.decision === 'skip_not_applicable') summary.skippedNotApplicableCount += 1;
    if (record.decision === 'skip_merchant_input_required') summary.skippedMerchantInputCount += 1;
    if (record.status === 'failed') summary.failedCount += 1;
    if (record.merchantInputRequired.length) summary.merchantInputRequiredCount += 1;
  }

  return summary;
}

async function runTaxonomySync({
  graphql,
  logger = () => {},
  handleFilter = '',
  limit = 0,
  confirmSync = false,
  concurrency = 4,
}) {
  await assertCurrentManifestApproved();
  const products = await readNormalizedProducts();
  const selectedProducts = selectProducts({ products, handleFilter, limit });
  const records = [];
  const failures = [];

  logger(
    `${confirmSync ? 'Applying' : 'Planning'} taxonomy sync for ${selectedProducts.length} products with concurrency ${concurrency}...`
  );

  await mapLimit(selectedProducts, Number(concurrency) || 4, async (product, index) => {
    if (index > 0 && index % 50 === 0) {
      logger(`Checked ${index}/${selectedProducts.length} products for taxonomy sync...`);
    }

    const existing = await resolveExistingProduct({ graphql, handle: product.handle });
    const record = buildTaxonomySyncRecord({ product, existing });

    if (confirmSync && record.decision === 'update') {
      try {
        const data = await runWithRetries(() =>
          graphql(MUTATION_METAFIELDS_SET, {
            metafields: record.metafields,
          })
        );
        const userErrors = data.metafieldsSet?.userErrors || [];

        if (userErrors.length) {
          record.status = 'failed';
          record.errors = userErrors;
          failures.push({
            handle: record.handle,
            productId: record.productId,
            type: 'metafields_set_user_errors',
            errors: userErrors,
          });
        } else {
          record.status = 'updated';
        }
      } catch (error) {
        record.status = 'failed';
        record.errors = [{ message: error.message }];
        failures.push({
          handle: record.handle,
          productId: record.productId,
          type: 'runtime_error',
          message: error.message,
        });
      }
    } else if (!confirmSync && record.decision === 'update') {
      record.status = 'planned_update';
    }

    records.push(record);
  });

  records.sort((left, right) => left.handle.localeCompare(right.handle));
  const summary = buildTaxonomySyncSummary(records, confirmSync);
  const manifest = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    summary,
    records,
  };

  if (confirmSync) {
    await Promise.all([
      writeJson(path.join(paths.manifestsRoot, 'taxonomy-sync.json'), manifest),
      writeJson(path.join(paths.manifestsRoot, 'taxonomy-sync-failures.json'), {
        generatedAt: manifest.generatedAt,
        failures,
      }),
    ]);
  } else {
    await writeJson(path.join(paths.manifestsRoot, 'taxonomy-sync-plan.json'), manifest);
  }

  return {
    ...manifest,
    failures,
  };
}

async function readNormalizedProducts() {
  const normalized = await readJsonIfExists(path.join(paths.normalizedRoot, 'products.json'));
  const products = Array.isArray(normalized) ? normalized : normalized?.products || [];

  if (!products.length) {
    throw new Error(`Missing normalized products at ${path.join(paths.normalizedRoot, 'products.json')}. Run audit first.`);
  }

  return products;
}

async function resolveExistingProduct({ graphql, handle }) {
  const data = await runWithRetries(() =>
    graphql(QUERY_PRODUCT_TAXONOMY_BY_HANDLE, {
      query: `handle:${handle}`,
    })
  );
  return (data.products?.nodes || []).find((item) => item.handle === handle) || null;
}

function selectProducts({ products, handleFilter = '', limit = 0 }) {
  const selected = (products || []).filter((product) => {
    const handle = String(product?.handle || '').trim();
    return handle && (!handleFilter || handle === handleFilter);
  });

  return Number(limit) > 0 ? selected.slice(0, Number(limit)) : selected;
}

function buildMetafieldInput(ownerId, key, type, value) {
  return {
    ownerId,
    namespace: 'custom',
    key,
    type,
    value,
  };
}

function normalizeRawValues(input) {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  const normalized = [];

  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;

    for (const part of text.split(/\s*\/\s*|\s*;\s*/)) {
      const trimmed = String(part || '').trim();
      if (trimmed) normalized.push(trimmed);
    }
  }

  return normalized;
}

function normalizeShapeValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  for (const rule of SHAPE_RULES) {
    if (rule.expression.test(raw)) {
      return rule.value;
    }
  }

  return titleCase(raw);
}

function normalizeLengthValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase().replace(/\./g, '').trim();

  if (normalized === 'short') return 'Short';
  if (normalized === 'medium' || normalized === 'med') return 'Med';
  if (normalized === 'long') return 'Long';

  return '';
}

function deriveLengthFromShapeValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();

  if (normalized.includes('short')) return 'Short';
  if (normalized.includes('medium') || normalized.includes('med')) return 'Med';
  if (normalized.includes('long')) return 'Long';

  return '';
}

function normalizeColorValue(value) {
  return titleCase(String(value || '').trim());
}

function normalizeStyleValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const alias = STYLE_ALIASES.get(raw.toLowerCase());
  if (alias) return alias;

  return titleCase(raw);
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => {
      const lower = part.toLowerCase();
      return lower ? `${lower[0].toUpperCase()}${lower.slice(1)}` : '';
    })
    .join(' ');
}

function uniqueValues(values) {
  const output = [];
  const seen = new Set();

  for (const value of values || []) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function requiresTaxonomy(product) {
  return TAXONOMY_REQUIRED_CATEGORIES.has(String(product?.categoryHint || '').trim());
}

function metafieldMatchesExistingValue(metafield, existing) {
  const currentValue = readExistingMetafieldValue(existing, metafield.key);
  return currentValue === metafield.value;
}

function readExistingMetafieldValue(existing, key) {
  if (!existing) return '';

  if (key === 'nail_shape') return String(existing.shape?.value || '').trim();
  if (key === 'nail_length') return String(existing.length?.value || '').trim();
  if (key === 'nail_color_values') return String(existing.colorValues?.value || '').trim();
  if (key === 'nail_shape_values') return String(existing.shapeValues?.value || '').trim();
  if (key === 'nail_length_values') return String(existing.lengthValues?.value || '').trim();
  if (key === 'nail_style_values') return String(existing.styleValues?.value || '').trim();

  return '';
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  buildTaxonomyMetafieldsInput,
  buildTaxonomySyncRecord,
  buildTaxonomySyncSummary,
  normalizeTaxonomyForSync,
  resolveExistingProduct,
  runTaxonomySync,
};
