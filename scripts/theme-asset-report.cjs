const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assetsDirectory = path.join(root, 'assets');
const layoutSource = fs.readFileSync(path.join(root, 'layout', 'theme.liquid'), 'utf8');
const globalAssets = new Set(
  [...layoutSource.matchAll(/['"]([^'"]+\.(?:css|js))['"]\s*\|\s*asset_url/g)].map((match) => match[1])
);

const rows = fs
  .readdirSync(assetsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:css|js)$/.test(entry.name))
  .map((entry) => {
    const bytes = fs.statSync(path.join(assetsDirectory, entry.name)).size;
    return { asset: entry.name, bytes, global: globalAssets.has(entry.name) };
  })
  .sort((left, right) => right.bytes - left.bytes || left.asset.localeCompare(right.asset));

const totals = rows.reduce(
  (result, row) => {
    result.allBytes += row.bytes;
    if (row.global) result.globalBytes += row.bytes;
    return result;
  },
  { allBytes: 0, globalBytes: 0 }
);

process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), totals, assets: rows }, null, 2)}\n`);
