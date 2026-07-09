const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { paths } = require('./config.cjs');
const { ensureDir } = require('./fs-utils.cjs');

async function processAssets(normalizedProducts) {
  const byHash = new Map();
  const assets = [];
  const failures = [];
  const concurrency = 6;
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (nextIndex < normalizedProducts.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const product = normalizedProducts[currentIndex];
        const result = await processProductAssets(product, byHash);
        assets.push(...result.assets);
        failures.push(...result.failures);
      }
    })
  );

  return {
    processedAt: new Date().toISOString(),
    assets,
    failures,
    duplicates: assets.filter((asset) => asset.duplicate),
  };
}

async function processProductAssets(product, byHash) {
  const productDir = path.join(paths.assetsRoot, product.handle);
  const manifestPath = path.join(productDir, '_manifest.json');
  await ensureDir(productDir);

  try {
    const cachedManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    for (const asset of cachedManifest.assets) {
      if (!byHash.has(asset.sha256)) {
        byHash.set(asset.sha256, {
          sha256: asset.sha256,
          filePath: asset.localPath,
          duplicateCount: asset.duplicate ? 1 : 0,
        });
      }
    }

    return {
      assets: cachedManifest.assets,
      failures: [],
    };
  } catch (error) {
    // Product has not completed asset processing yet.
  }

  const productAssets = [];
  const productFailures = [];

  for (const media of product.media) {
    if (!media.src) continue;

    try {
      const response = await fetch(media.src);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const extension = inferExtension(media.src, response.headers.get('content-type'));
      const fileName = `${String(media.position).padStart(2, '0')}-${product.handle}-${sha256.slice(0, 8)}.${extension}`;
      const filePath = path.join(productDir, fileName);

      if (!byHash.has(sha256)) {
        await fs.writeFile(filePath, buffer);
        byHash.set(sha256, {
          sha256,
          filePath,
          duplicateCount: 0,
        });
      } else {
        byHash.get(sha256).duplicateCount += 1;
      }

      productAssets.push({
        productHandle: product.handle,
        sourceUrl: media.src,
        alt: media.alt || `${product.title} - image ${media.position}`,
        localPath: byHash.get(sha256).filePath,
        mediaType: media.mediaType,
        order: media.position,
        sha256,
        duplicate: byHash.get(sha256).duplicateCount > 0,
      });
    } catch (error) {
      productFailures.push({
        productHandle: product.handle,
        sourceUrl: media.src,
        error: error.message,
      });
    }
  }

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({ productHandle: product.handle, assets: productAssets }, null, 2)}\n`,
    'utf8'
  );

  return {
    assets: productAssets,
    failures: productFailures,
  };
}

function inferExtension(url, contentType) {
  const pathname = new URL(url).pathname;
  const explicit = path.extname(pathname).replace(/^\./, '');

  if (explicit) return explicit;
  if (contentType?.includes('jpeg')) return 'jpg';
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('mp4')) return 'mp4';
  return 'bin';
}

module.exports = {
  processAssets,
};
