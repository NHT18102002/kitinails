const path = require('node:path');

const toolingRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(toolingRoot, '..', '..');

const paths = {
  toolingRoot,
  repoRoot,
  dataRoot: path.join(repoRoot, 'data', 'catalog'),
  rawRoot: path.join(repoRoot, 'data', 'catalog', 'raw'),
  assetsRoot: path.join(repoRoot, 'data', 'catalog', 'assets'),
  normalizedRoot: path.join(repoRoot, 'data', 'catalog', 'normalized'),
  manifestsRoot: path.join(repoRoot, 'data', 'catalog', 'manifests'),
  exportsRoot: path.join(repoRoot, 'exports'),
  docsRoot: path.join(repoRoot, 'docs'),
};

const constants = {
  apiVersion: '2026-07',
  baseUrl: 'https://ersanails.com',
  pageSize: 250,
  delayMs: 600,
  maxRetries: 4,
};

module.exports = {
  paths,
  constants,
};
