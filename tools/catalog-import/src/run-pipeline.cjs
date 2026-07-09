const path = require('node:path');

const { processAssets } = require('./assets.cjs');
const { writeAuditOutputs } = require('./audit.cjs');
const { paths } = require('./config.cjs');
const { scanExistingProductsConflicts } = require('./conflicts.cjs');
const { crawlCatalog } = require('./crawl.cjs');
const { discoverCatalog } = require('./discovery.cjs');
const { ensureDir, writeJson } = require('./fs-utils.cjs');
const { normalizeProductRecord } = require('./normalize.cjs');

async function main() {
  const phase = readArgValue('--phase') || 'audit';

  if (phase !== 'audit') {
    throw new Error(`Unsupported phase: ${phase}`);
  }

  await Promise.all([
    ensureDir(paths.normalizedRoot),
    ensureDir(paths.manifestsRoot),
    ensureDir(paths.exportsRoot),
    ensureDir(paths.docsRoot),
  ]);

  const discovery = await discoverCatalog();
  await writeJson(path.join(paths.manifestsRoot, 'discovery.json'), discovery);

  const crawl = await crawlCatalog(discovery);
  await writeJson(path.join(paths.manifestsRoot, 'crawl.json'), {
    crawledAt: crawl.crawledAt,
    productCount: crawl.products.length,
    failures: crawl.failures,
  });

  const normalizedProducts = crawl.products.map((entry) =>
    normalizeProductRecord(entry.productJs, entry.productHtml, entry.collections)
  );

  const assetsResult = await processAssets(normalizedProducts);
  const conflictReport = await scanExistingProductsConflicts(normalizedProducts);
  const audit = await writeAuditOutputs({
    discovery,
    crawl,
    normalizedProducts,
    assetsResult,
    conflictReport,
  });

  process.stdout.write(`${JSON.stringify(audit.summary, null, 2)}\n`);
  process.stdout.write(`Manifest hash: ${audit.normalizedManifestSha256}\n`);
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
