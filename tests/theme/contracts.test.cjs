const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const expectedSchemaSignatures = require('./schema-contract.json');
const { buildSchemaSignatures, parseShopifyJson, walkFiles } = require('./theme-contract-utils.cjs');

const root = path.resolve(__dirname, '..', '..');
const liquidFiles = ['layout', 'sections', 'snippets', 'templates'].flatMap((directory) =>
  walkFiles(path.join(root, directory), (filename) => filename.endsWith('.liquid'))
);

test('section schema setting and block contracts match the approved baseline', () => {
  assert.deepEqual(buildSchemaSignatures(root), expectedSchemaSignatures);
});

test('JSON templates reference existing section types', () => {
  const availableSections = new Set(
    walkFiles(path.join(root, 'sections'), (filename) => filename.endsWith('.liquid')).map((filename) => path.basename(filename, '.liquid'))
  );
  const managedSectionTypes = new Set(['_blocks']);
  const unresolved = [];

  for (const filename of walkFiles(path.join(root, 'templates'), (candidate) => candidate.endsWith('.json'))) {
    const template = parseShopifyJson(fs.readFileSync(filename, 'utf8'));
    for (const section of Object.values(template.sections || {})) {
      if (!availableSections.has(section.type) && !managedSectionTypes.has(section.type)) {
        unresolved.push(`${path.relative(root, filename)} -> ${section.type}`);
      }
    }
  }

  assert.deepEqual(unresolved, []);
});

test('literal snippet and theme-asset references resolve', () => {
  const unresolved = [];

  for (const filename of liquidFiles) {
    const source = fs.readFileSync(filename, 'utf8');
    for (const match of source.matchAll(/\brender\s+['"]([^'"]+)['"]/g)) {
      const target = path.join(root, 'snippets', `${match[1]}.liquid`);
      if (!fs.existsSync(target)) unresolved.push(`${path.relative(root, filename)} -> snippet:${match[1]}`);
    }
    for (const match of source.matchAll(/['"]([^'"]+\.(?:css|js|svg|png|jpe?g|webp|avif|gif|mp4))['"]\s*\|\s*asset_url/g)) {
      const target = path.join(root, 'assets', match[1]);
      if (!fs.existsSync(target)) unresolved.push(`${path.relative(root, filename)} -> asset:${match[1]}`);
    }
  }

  assert.deepEqual([...new Set(unresolved)].sort(), []);
});

test('custom element names have a single definition owner', () => {
  const owners = new Map();
  for (const filename of walkFiles(path.join(root, 'assets'), (candidate) => candidate.endsWith('.js'))) {
    const source = fs.readFileSync(filename, 'utf8');
    for (const match of source.matchAll(/customElements\.define\(\s*['"]([^'"]+)['"]/g)) {
      const entries = owners.get(match[1]) || [];
      entries.push(path.relative(root, filename));
      owners.set(match[1], entries);
    }
  }

  const duplicates = [...owners.entries()].filter(([, entries]) => entries.length > 1);
  assert.deepEqual(duplicates, []);
});

test('unified product cards keep their shared hover-media and quick-buy contracts', () => {
  const card = fs.readFileSync(path.join(root, 'snippets', 'card-product.liquid'), 'utf8');
  const media = fs.readFileSync(path.join(root, 'snippets', 'product-card-media.liquid'), 'utf8');
  const quickAdd = fs.readFileSync(path.join(root, 'snippets', 'product-card-quick-add.liquid'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'assets', 'component-product-card-cascade.css'), 'utf8');

  assert.match(card, /product-card-wrapper--has-secondary-media/);
  assert.match(card, /product-card__quick-buy/);
  assert.match(media, /product-card__image--secondary/);
  assert.match(quickAdd, /unified_card/);
  assert.match(styles, /product-card-wrapper--has-secondary-media:hover/);
  assert.match(styles, /product-card__quick-buy-button:hover/);
});

test('brand cascade has ordered feature owners and no catch-all stylesheet', () => {
  const entrypoint = fs.readFileSync(path.join(root, 'snippets', 'theme-brand-styles.liquid'), 'utf8');
  const brandAssets = [...entrypoint.matchAll(/['"](brand-(\d{2})-[^'"]+\.css)['"]\s*\|\s*asset_url/g)].map(
    (match) => ({ asset: match[1], order: Number(match[2]) })
  );
  const expectedOrder = Array.from({ length: 41 }, (_, index) => index + 1);

  assert.deepEqual(brandAssets.map(({ order }) => order), expectedOrder);
  assert.equal(new Set(brandAssets.map(({ asset }) => asset)).size, brandAssets.length);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'custom-theme.css')), false);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'legacy-compat.css')), false);

  const layout = fs.readFileSync(path.join(root, 'layout', 'theme.liquid'), 'utf8');
  const lateOwner = fs.readFileSync(path.join(root, 'sections', 'ersa-reviews-carousel.liquid'), 'utf8');
  assert.match(layout, /content_for_layout contains 'theme-brand-styles-anchor'/);
  assert.match(lateOwner, /theme-brand-styles-anchor.*render 'theme-brand-styles'/);
});
