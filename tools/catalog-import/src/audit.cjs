const path = require('node:path');

const { paths } = require('./config.cjs');
const { writeJson, writeText } = require('./fs-utils.cjs');

function createManifestHash(value) {
  const crypto = require('node:crypto');
  const serialized = stableStringify(value);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

async function writeAuditOutputs({ discovery, crawl, normalizedProducts, assetsResult, conflictReport }) {
  const summary = buildAuditSummary({
    discovery,
    crawl,
    normalizedProducts,
    assetsResult,
    conflictReport,
  });

  const catalogAudit = {
    summary,
    discovery,
    crawlFailures: crawl.failures,
    collections: discovery.collections,
    conflictReport,
    merchantInputRequired: collectMerchantInputRequired(normalizedProducts),
  };

  const normalizedManifest = {
    products: normalizedProducts,
    generatedAt: new Date().toISOString(),
  };

  const normalizedManifestSha256 = createManifestHash(normalizedManifest);

  await writeJson(path.join(paths.normalizedRoot, 'products.json'), normalizedManifest);
  await writeJson(path.join(paths.manifestsRoot, 'catalog-audit.json'), catalogAudit);
  await writeJson(path.join(paths.manifestsRoot, 'assets.json'), assetsResult);
  await writeJson(path.join(paths.manifestsRoot, 'conflict-report.json'), conflictReport);
  await writeJson(path.join(paths.manifestsRoot, 'normalized-manifest.json'), normalizedManifest);
  await writeJson(path.join(paths.manifestsRoot, 'normalized-manifest-hash.json'), {
    normalizedManifestSha256,
  });
  await writeJson(path.join(paths.toolingRoot, 'config', 'collection-map.proposed.json'), {
    generatedAt: new Date().toISOString(),
    include: summary.collectionMap.filter((collection) => collection.decision === 'include'),
    review: summary.collectionMap.filter((collection) => collection.decision === 'review'),
    exclude: summary.collectionMap.filter((collection) => collection.decision === 'exclude'),
  });
  await writeText(path.join(paths.exportsRoot, 'catalog-audit.csv'), toCsv(normalizedProducts));
  await writeText(path.join(paths.docsRoot, 'catalog-import-report.md'), toMarkdownReport(summary, conflictReport));

  return {
    summary,
    normalizedManifestSha256,
  };
}

function buildAuditSummary({ discovery, crawl, normalizedProducts, assetsResult, conflictReport }) {
  const productClassCounts = normalizedProducts.reduce((accumulator, product) => {
    accumulator[product.categoryHint] = (accumulator[product.categoryHint] || 0) + 1;
    return accumulator;
  }, {});
  const filterRelevantProducts = normalizedProducts.filter((product) => product.categoryHint === 'press_on_nails');

  return {
    validProducts: normalizedProducts.length,
    totalVariants: normalizedProducts.reduce((sum, product) => sum + product.variants.length, 0),
    totalAssets: assetsResult.assets.length,
    duplicateAssets: assetsResult.duplicates.length,
    failedAssets: assetsResult.failures.length,
    failedProductCrawls: crawl.failures.length,
    taxonomyCoverage: computeTaxonomyCoverage(normalizedProducts),
    filterRelevantCoverage: computeTaxonomyCoverage(filterRelevantProducts),
    productClassCounts,
    collectionMap: discovery.collections.map((collection) => ({
      handle: collection.handle,
      title: collection.title,
      productsCount: collection.products_count,
      decision: collection.decision,
      reason: collection.reason,
    })),
    merchantInputRequired: collectMerchantInputRequired(normalizedProducts),
    filterRelevantMissingTaxonomy: collectMerchantInputRequired(filterRelevantProducts),
    conflictReport,
  };
}

function computeTaxonomyCoverage(products) {
  const total = products.length || 1;
  const keys = ['color', 'shape', 'length', 'style'];
  const coverage = {};

  for (const key of keys) {
    const covered = products.filter((product) => (product.taxonomy[key] || []).length > 0).length;
    coverage[key] = {
      covered,
      total: products.length,
      percent: Number(((covered / total) * 100).toFixed(2)),
    };
  }

  return coverage;
}

function collectMerchantInputRequired(products) {
  return products
    .filter((product) => product.merchantInputRequired.length)
    .map((product) => ({
      handle: product.handle,
      title: product.title,
      fields: product.merchantInputRequired,
    }));
}

function toCsv(products) {
  const header = [
    'handle',
    'title',
    'vendor',
    'productType',
    'variantCount',
    'assetCount',
    'collections',
    'colors',
    'shapes',
    'lengths',
    'styles',
    'merchantInputRequired',
  ];

  const rows = products.map((product) => [
    product.handle,
    product.title,
    product.vendor,
    product.productType,
    String(product.variants.length),
    String(product.media.length),
    product.collections.join('|'),
    product.taxonomy.color.join('|'),
    product.taxonomy.shape.join('|'),
    product.taxonomy.length.join('|'),
    product.taxonomy.style.join('|'),
    product.merchantInputRequired.join('|'),
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function toMarkdownReport(summary, conflictReport) {
  return [
    '# Catalog Import Audit Report',
    '',
    `- Valid products: ${summary.validProducts}`,
    `- Total variants: ${summary.totalVariants}`,
    `- Total assets: ${summary.totalAssets}`,
    `- Duplicate assets: ${summary.duplicateAssets}`,
    `- Failed assets: ${summary.failedAssets}`,
    `- Failed product crawls: ${summary.failedProductCrawls}`,
    `- Conflict scan: ${conflictReport.status} (${conflictReport.reason || 'ok'})`,
    `- Product class counts: ${Object.entries(summary.productClassCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`,
    '',
    '## Taxonomy Coverage',
    ...Object.entries(summary.taxonomyCoverage).map(
      ([key, value]) => `- ${key}: ${value.covered}/${value.total} (${value.percent}%)`
    ),
    '',
    '## Filter-Relevant Coverage (Press On Nails)',
    ...Object.entries(summary.filterRelevantCoverage).map(
      ([key, value]) => `- ${key}: ${value.covered}/${value.total} (${value.percent}%)`
    ),
    '',
    '## Merchant Input Required',
    ...summary.merchantInputRequired.slice(0, 50).map(
      (item) => `- ${item.handle}: ${item.fields.join(', ')}`
    ),
    '',
    '## Filter-Relevant Missing Taxonomy',
    ...summary.filterRelevantMissingTaxonomy.slice(0, 50).map(
      (item) => `- ${item.handle}: ${item.fields.join(', ')}`
    ),
  ].join('\n');
}

module.exports = {
  buildAuditSummary,
  createManifestHash,
  writeAuditOutputs,
};
