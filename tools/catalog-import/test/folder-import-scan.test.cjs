const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  collectionDisplayTitle,
  normalizeFolderSlug,
  parseProductImageName,
  scanFolderProducts,
} = require('../src/folder-import/scan.cjs');

async function createProductsFixture() {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ersa-folder-scan-'));
  const productsRoot = path.join(fixtureRoot, 'products');
  await fs.mkdir(productsRoot, { recursive: true });
  return { fixtureRoot, productsRoot };
}

test('scanner pairs nested N and N.1 images and ignores non-image source files', async (t) => {
  const { fixtureRoot, productsRoot } = await createProductsFixture();
  t.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }));
  const collectionRoot = path.join(productsRoot, 'nail art', 'nail art');
  await fs.mkdir(collectionRoot, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(collectionRoot, '1.jpg'), 'primary-image'),
    fs.writeFile(path.join(collectionRoot, '1.1.JPG'), 'secondary-image'),
    fs.writeFile(path.join(collectionRoot, 'source.psd'), 'ignored-source'),
  ]);

  const manifest = await scanFolderProducts({ productsRoot, generatedAt: '2026-07-22T00:00:00.000Z' });

  assert.deepEqual(manifest.summary, {
    collectionFolderCount: 1,
    supportedImageCount: 2,
    validProductCount: 1,
    blockingErrorCount: 0,
    ignoredFileCount: 1,
  });
  assert.equal(manifest.products[0].sourceKey, 'folder-import:nail-art:1');
  assert.equal(manifest.products[0].title, 'Nail Art 01');
  assert.equal(manifest.products[0].media[0].path, 'products/nail art/nail art/1.jpg');
  assert.equal(manifest.products[0].media[1].role, 'secondary');
  assert.match(manifest.products[0].pairSha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.ignoredFiles[0].reason, 'unsupported_extension');

  const second = await scanFolderProducts({ productsRoot, generatedAt: '2026-07-23T00:00:00.000Z' });
  assert.equal(second.manifestSha256, manifest.manifestSha256);
});

test('scanner keeps immutable inner collection identity when a display wrapper folder is renamed', async (t) => {
  const firstFixture = await createProductsFixture();
  const secondFixture = await createProductsFixture();
  t.after(() => Promise.all([
    fs.rm(firstFixture.fixtureRoot, { recursive: true, force: true }),
    fs.rm(secondFixture.fixtureRoot, { recursive: true, force: true }),
  ]));
  const legacyRoot = path.join(firstFixture.productsRoot, '3d', '3d');
  const renamedRoot = path.join(secondFixture.productsRoot, '3D Nails', '3d');
  await Promise.all([fs.mkdir(legacyRoot, { recursive: true }), fs.mkdir(renamedRoot, { recursive: true })]);
  await Promise.all([
    fs.writeFile(path.join(legacyRoot, '1.jpg'), 'primary-image'),
    fs.writeFile(path.join(legacyRoot, '1.1.jpg'), 'secondary-image'),
    fs.writeFile(path.join(renamedRoot, '1.jpg'), 'primary-image'),
    fs.writeFile(path.join(renamedRoot, '1.1.jpg'), 'secondary-image'),
  ]);

  const legacy = await scanFolderProducts({ productsRoot: firstFixture.productsRoot, generatedAt: '2026-07-23T00:00:00Z' });
  const renamed = await scanFolderProducts({ productsRoot: secondFixture.productsRoot, generatedAt: '2026-07-23T00:00:00Z' });

  assert.equal(renamed.collections[0].folder, '3d');
  assert.equal(renamed.products[0].sourceKey, 'folder-import:3d:1');
  assert.equal(renamed.products[0].media[0].path, 'products/3d/3d/1.jpg');
  assert.equal(renamed.manifestSha256, legacy.manifestSha256);
});

test('scanner blocks incomplete pairs, duplicate roles, and malformed supported image names', async (t) => {
  const { fixtureRoot, productsRoot } = await createProductsFixture();
  t.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }));
  const collectionRoot = path.join(productsRoot, '3d');
  const nestedRoot = path.join(collectionRoot, 'nested');
  await fs.mkdir(nestedRoot, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(collectionRoot, '1.jpg'), 'missing-secondary'),
    fs.writeFile(path.join(collectionRoot, '2.jpg'), 'primary-one'),
    fs.writeFile(path.join(nestedRoot, '2.png'), 'primary-two'),
    fs.writeFile(path.join(collectionRoot, '2.1.jpg'), 'secondary'),
    fs.writeFile(path.join(collectionRoot, '3.2.jpg'), 'malformed-role'),
  ]);

  const manifest = await scanFolderProducts({ productsRoot });
  const codes = manifest.blockingErrors.map((error) => error.code).sort();

  assert.equal(manifest.summary.validProductCount, 0);
  assert.equal(manifest.summary.supportedImageCount, 5);
  assert.deepEqual(codes, ['duplicate_pair_role', 'incomplete_pair', 'unsupported_image_name']);
});

test('filename parsing and folder naming are deterministic', () => {
  assert.deepEqual(parseProductImageName('12.1.WebP'), {
    supportedImage: true,
    valid: true,
    pairKey: '12',
    pairNumber: 12,
    role: 'secondary',
    extension: '.webp',
  });
  assert.equal(parseProductImageName('12.psd'), null);
  assert.equal(parseProductImageName('hero.jpg').valid, false);
  assert.equal(normalizeFolderSlug('Nail Art'), 'nail-art');
  assert.equal(collectionDisplayTitle('y2k'), 'Y2K');
});

test('scanner blocks empty collection folders and normalized slug collisions', async (t) => {
  const { fixtureRoot, productsRoot } = await createProductsFixture();
  t.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }));
  await Promise.all([
    fs.mkdir(path.join(productsRoot, 'Nail Art')),
    fs.mkdir(path.join(productsRoot, 'nail_art')),
  ]);

  const manifest = await scanFolderProducts({ productsRoot });
  const codes = manifest.blockingErrors.map((error) => error.code);

  assert.equal(codes.filter((code) => code === 'empty_collection_folder').length, 2);
  assert.equal(codes.filter((code) => code === 'collection_slug_collision').length, 1);
  assert.equal(manifest.summary.blockingErrorCount, 3);
});
