const crypto = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

const { paths } = require('../config.cjs');
const { writeJson } = require('../fs-utils.cjs');
const { sealManifest } = require('./manifest.cjs');

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const IMMUTABLE_COLLECTION_SLUGS = new Set(['3d', 'cute', 'nail-art', 'y2k']);
const DEFAULT_PRODUCTS_ROOT = path.join(paths.repoRoot, 'products');
const DEFAULT_OUTPUT_ROOT = path.join(paths.dataRoot, 'folder-import');

function normalizeFolderSlug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectionDisplayTitle(folderName) {
  return String(folderName || '')
    .trim()
    .split(/\s+/)
    .map((word) => (/\d/.test(word) ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`))
    .join(' ');
}

function parseProductImageName(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) return null;

  const stem = fileName.slice(0, -path.extname(fileName).length);
  const match = /^(\d+)(\.1)?$/.exec(stem);
  if (!match) {
    return {
      supportedImage: true,
      valid: false,
      reason: 'unsupported_image_name',
    };
  }

  const pairNumber = Number(match[1]);
  if (!Number.isSafeInteger(pairNumber) || pairNumber < 0) {
    return {
      supportedImage: true,
      valid: false,
      reason: 'invalid_pair_number',
    };
  }

  return {
    supportedImage: true,
    valid: true,
    pairKey: String(pairNumber),
    pairNumber,
    role: match[2] ? 'secondary' : 'primary',
    extension,
  };
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function toPosixPath(value) {
  return String(value).split(path.sep).join('/');
}

function logicalProductPath(collectionRoot, collectionFolder, filePath) {
  const relative = path.relative(collectionRoot, filePath);
  return toPosixPath(path.join('products', collectionFolder, relative));
}

async function listFilesRecursively(directoryPath, collectionRoot, collectionFolder, ignoredFiles) {
  const files = [];
  const entries = await fsPromises.readdir(directoryPath, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }));

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isSymbolicLink()) {
      ignoredFiles.push({
        path: logicalProductPath(collectionRoot, collectionFolder, entryPath),
        reason: 'symbolic_link',
      });
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(entryPath, collectionRoot, collectionFolder, ignoredFiles)));
      continue;
    }
    if (entry.isFile()) files.push(entryPath);
  }

  return files;
}

function buildPairError({ code, collectionFolder, pairKey = null, paths: filePaths = [], message }) {
  return {
    code,
    collectionFolder,
    pairKey,
    paths: filePaths,
    message,
  };
}

async function scanCollectionFolder({ productsRoot, collectionFolder, folderPath = path.join(productsRoot, collectionFolder), ignoredFiles }) {
  const filePaths = await listFilesRecursively(folderPath, folderPath, collectionFolder, ignoredFiles);
  const pairs = new Map();
  const blockingErrors = [];
  let supportedImageCount = 0;

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const parsed = parseProductImageName(fileName);
    const logicalPath = logicalProductPath(folderPath, collectionFolder, filePath);

    if (!parsed) {
      ignoredFiles.push({ path: logicalPath, reason: 'unsupported_extension' });
      continue;
    }

    supportedImageCount += 1;
    if (!parsed.valid) {
      blockingErrors.push(
        buildPairError({
          code: parsed.reason,
          collectionFolder,
          paths: [logicalPath],
          message: `Supported image does not match N.ext or N.1.ext: ${logicalPath}`,
        })
      );
      continue;
    }

    const pair = pairs.get(parsed.pairKey) || {
      pairKey: parsed.pairKey,
      pairNumber: parsed.pairNumber,
      primary: [],
      secondary: [],
    };
    pair[parsed.role].push(filePath);
    pairs.set(parsed.pairKey, pair);
  }

  const products = [];
  const sortedPairs = Array.from(pairs.values()).sort((left, right) => left.pairNumber - right.pairNumber);
  const folderSlug = normalizeFolderSlug(collectionFolder);
  const titlePrefix = collectionDisplayTitle(collectionFolder);

  for (const pair of sortedPairs) {
    const pairPaths = [...pair.primary, ...pair.secondary].map((filePath) => logicalProductPath(folderPath, collectionFolder, filePath));
    if (pair.primary.length !== 1 || pair.secondary.length !== 1) {
      const code = pair.primary.length > 1 || pair.secondary.length > 1 ? 'duplicate_pair_role' : 'incomplete_pair';
      blockingErrors.push(
        buildPairError({
          code,
          collectionFolder,
          pairKey: pair.pairKey,
          paths: pairPaths,
          message: `Pair ${collectionFolder}/${pair.pairKey} requires exactly one primary and one secondary image.`,
        })
      );
      continue;
    }

    const media = [];
    for (const [role, filePath] of [
      ['primary', pair.primary[0]],
      ['secondary', pair.secondary[0]],
    ]) {
      const [stat, sha256] = await Promise.all([fsPromises.stat(filePath), sha256File(filePath)]);
      media.push({
        role,
        path: logicalProductPath(folderPath, collectionFolder, filePath),
        bytes: stat.size,
        sha256,
      });
    }

    const pairHash = crypto
      .createHash('sha256')
      .update(`primary\0${media[0].sha256}\0secondary\0${media[1].sha256}`)
      .digest('hex');
    const numberLabel = String(pair.pairNumber).padStart(2, '0');

    products.push({
      sourceKey: `folder-import:${folderSlug}:${pair.pairKey}`,
      collectionFolder,
      collectionSlug: folderSlug,
      pairKey: pair.pairKey,
      title: `${titlePrefix} ${numberLabel}`,
      proposedHandle: `folder-import-${folderSlug}-${numberLabel}`,
      pairSha256: pairHash,
      media,
    });
  }

  return {
    collection: {
      folder: collectionFolder,
      slug: folderSlug,
      proposedTitle: titlePrefix,
      supportedImageCount,
      validProductCount: products.length,
      blockingErrorCount: blockingErrors.length,
    },
    products,
    blockingErrors,
  };
}

async function resolveCollectionSource(entryPath, entryName) {
  if (IMMUTABLE_COLLECTION_SLUGS.has(normalizeFolderSlug(entryName))) {
    return { collectionFolder: entryName, folderPath: entryPath };
  }
  const children = await fsPromises.readdir(entryPath, { withFileTypes: true });
  const directories = children.filter((child) => child.isDirectory() && !child.isSymbolicLink());
  const otherEntries = children.filter((child) => !child.isDirectory());
  if (
    directories.length === 1 &&
    otherEntries.length === 0 &&
    IMMUTABLE_COLLECTION_SLUGS.has(normalizeFolderSlug(directories[0].name))
  ) {
    return { collectionFolder: directories[0].name, folderPath: entryPath };
  }
  return { collectionFolder: entryName, folderPath: entryPath };
}

async function scanFolderProducts({ productsRoot = DEFAULT_PRODUCTS_ROOT, generatedAt = new Date().toISOString() } = {}) {
  const resolvedRoot = path.resolve(productsRoot);
  const rootStat = await fsPromises.stat(resolvedRoot).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Products root is missing or is not a directory: ${resolvedRoot}`);
  }

  const rootEntries = await fsPromises.readdir(resolvedRoot, { withFileTypes: true });
  rootEntries.sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }));
  const ignoredFiles = [];
  const blockingErrors = [];
  const collections = [];
  const products = [];
  const collectionFolderBySlug = new Map();

  for (const entry of rootEntries) {
    const entryPath = path.join(resolvedRoot, entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      ignoredFiles.push({
        path: toPosixPath(path.join('products', entry.name)),
        reason: entry.isSymbolicLink() ? 'symbolic_link' : 'top_level_non_directory',
      });
      continue;
    }

    const source = await resolveCollectionSource(entryPath, entry.name);
    const collectionSlug = normalizeFolderSlug(source.collectionFolder);
    const existingFolder = collectionFolderBySlug.get(collectionSlug);
    if (existingFolder) {
      blockingErrors.push(
        buildPairError({
          code: 'collection_slug_collision',
          collectionFolder: source.collectionFolder,
          message: `Collection folders ${existingFolder} and ${source.collectionFolder} normalize to the same slug: ${collectionSlug}.`,
        })
      );
    } else {
      collectionFolderBySlug.set(collectionSlug, source.collectionFolder);
    }

    const result = await scanCollectionFolder({
      productsRoot: resolvedRoot,
      collectionFolder: source.collectionFolder,
      folderPath: source.folderPath,
      ignoredFiles,
    });
    collections.push(result.collection);
    products.push(...result.products);
    blockingErrors.push(...result.blockingErrors);
    if (result.collection.supportedImageCount === 0) {
      blockingErrors.push(
        buildPairError({
          code: 'empty_collection_folder',
          collectionFolder: source.collectionFolder,
          message: `Collection folder does not contain any supported product images: ${source.collectionFolder}`,
        })
      );
      result.collection.blockingErrorCount += 1;
    }
  }

  ignoredFiles.sort((left, right) => left.path.localeCompare(right.path, 'en', { numeric: true }));
  const supportedImageCount = collections.reduce((sum, collection) => sum + collection.supportedImageCount, 0);
  const manifest = sealManifest({
    schemaVersion: 'folder-product-manifest-v1',
    generatedAt,
    productsRoot: 'products',
    readOnly: true,
    summary: {
      collectionFolderCount: collections.length,
      supportedImageCount,
      validProductCount: products.length,
      blockingErrorCount: blockingErrors.length,
      ignoredFileCount: ignoredFiles.length,
    },
    collections,
    products,
    blockingErrors,
    ignoredFiles,
  });

  return manifest;
}

function buildScanReport(manifest) {
  return {
    schemaVersion: 'folder-product-scan-report-v1',
    generatedAt: manifest.generatedAt,
    manifestSha256: manifest.manifestSha256,
    readOnly: true,
    gate: manifest.summary.blockingErrorCount === 0 ? 'PASS' : 'BLOCKED',
    summary: manifest.summary,
    collections: manifest.collections,
    blockingErrors: manifest.blockingErrors,
    ignoredFiles: manifest.ignoredFiles,
  };
}

async function runFolderScan({
  productsRoot = DEFAULT_PRODUCTS_ROOT,
  outputRoot = DEFAULT_OUTPUT_ROOT,
  generatedAt,
} = {}) {
  const manifest = await scanFolderProducts({ productsRoot, generatedAt });
  const report = buildScanReport(manifest);
  const manifestPath = path.join(outputRoot, 'products-manifest.json');
  const reportPath = path.join(outputRoot, 'scan-report.json');
  await Promise.all([writeJson(manifestPath, manifest), writeJson(reportPath, report)]);
  return { manifest, report, manifestPath, reportPath };
}

module.exports = {
  DEFAULT_OUTPUT_ROOT,
  DEFAULT_PRODUCTS_ROOT,
  SUPPORTED_IMAGE_EXTENSIONS,
  buildScanReport,
  collectionDisplayTitle,
  normalizeFolderSlug,
  parseProductImageName,
  resolveCollectionSource,
  runFolderScan,
  scanFolderProducts,
  sha256File,
};
