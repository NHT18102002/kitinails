const fs = require('node:fs/promises');
const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { pathExists, readJsonIfExists, writeJson } = require('./fs-utils.cjs');
const {
  MUTATION_FILE_CREATE,
  MUTATION_STAGED_UPLOADS_CREATE,
  QUERY_FILES_BY_IDS,
} = require('./shopify-queries.cjs');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm']);

function dedupeUploadAssets(assets) {
  const bySha = new Map();

  for (const asset of assets || []) {
    const sha256 = String(asset.sha256 || '').trim();
    if (!sha256) continue;

    if (!bySha.has(sha256)) {
      bySha.set(sha256, {
        ...asset,
        dependents: [],
      });
    }

    bySha.get(sha256).dependents.push({
      productHandle: asset.productHandle,
      sourceUrl: asset.sourceUrl,
      localPath: asset.localPath,
      mediaType: asset.mediaType,
      order: asset.order,
      alt: asset.alt || '',
    });
  }

  return Array.from(bySha.values());
}

function classifyAssetUploadResource(asset) {
  const extension = path.extname(String(asset.localPath || '')).toLowerCase();
  const mediaType = String(asset.mediaType || '').toLowerCase();

  if (mediaType === 'video') {
    if (IMAGE_EXTENSIONS.has(extension) || String(asset.sourceUrl || '').includes('/preview_images/')) {
      return {
        resource: 'IMAGE',
        warning: 'video_source_missing',
      };
    }

    if (VIDEO_EXTENSIONS.has(extension)) {
      return {
      resource: 'VIDEO',
      };
    }
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      resource: 'IMAGE',
    };
  }

  return {
    resource: 'FILE',
    warning: 'unsupported_media_extension',
  };
}

function buildStagedUploadInput(asset) {
  const classification = classifyAssetUploadResource(asset);
  const input = {
    filename: path.basename(asset.localPath),
    mimeType: asset.mimeType || inferMimeType(asset.localPath),
    httpMethod: 'POST',
    resource: classification.resource,
  };

  if (classification.resource === 'VIDEO' && asset.byteSize) {
    input.fileSize = String(asset.byteSize);
  }

  return input;
}

function mapReadyFileBySha(records) {
  const ready = new Map();

  for (const record of records || []) {
    if (record?.sha256 && record.fileStatus === 'READY' && record.shopifyFileId) {
      ready.set(record.sha256, record.shopifyFileId);
    }
  }

  return ready;
}

async function runAssetUpload({ graphql, logger = () => {}, chunkSize = 20, pollAttempts = 30, pollDelayMs = 2000 }) {
  const assetsManifest = await readAssetsManifest();
  const uniqueAssets = dedupeUploadAssets(assetsManifest.assets);
  const existingManifest = await readJsonIfExists(shopifyFilesPath()) || {};
  const existingFiles = Array.isArray(existingManifest.files) ? existingManifest.files : [];
  const existingBySha = new Map(existingFiles.map((record) => [record.sha256, record]));
  const failures = Array.isArray(existingManifest.failures) ? existingManifest.failures : [];
  const uploadedFiles = [];

  for (const asset of uniqueAssets) {
    const existing = existingBySha.get(asset.sha256);

    if (existing?.fileStatus === 'READY' && existing.shopifyFileId) {
      uploadedFiles.push({
        ...existing,
        dependents: asset.dependents,
        dependentCount: asset.dependents.length,
      });
      continue;
    }

    if (existing?.shopifyFileId) {
      const polled = await pollFilesReady({
        graphql,
        fileIds: [existing.shopifyFileId],
        attempts: pollAttempts,
        delayMs: pollDelayMs,
      });
      const node = polled.get(existing.shopifyFileId);

      if (node?.fileStatus === 'READY') {
        uploadedFiles.push(
          buildShopifyFileRecord({
            asset,
            file: node,
            previousRecord: existing,
          })
        );
        continue;
      }

      uploadedFiles.push({
        ...existing,
        fileStatus: node?.fileStatus || existing.fileStatus || 'PROCESSING',
        dependents: asset.dependents,
        dependentCount: asset.dependents.length,
      });
      failures.push({
        type: 'processing_timeout',
        severity: 'error',
        sha256: asset.sha256,
        shopifyFileId: existing.shopifyFileId,
        message: `Existing Shopify file did not reach READY after polling.`,
      });
      continue;
    }

    uploadedFiles.push(null);
  }

  const uploadedBySha = new Map(uploadedFiles.filter(Boolean).map((record) => [record.sha256, record]));
  const pending = uniqueAssets.filter((asset) => !uploadedBySha.has(asset.sha256));
  let processed = 0;

  logger(`Uploading ${pending.length} unique assets (${uniqueAssets.length} total unique SHA records, ${assetsManifest.assets.length} media references)...`);

  for (const chunk of chunkArray(pending, chunkSize)) {
    const chunkResult = await uploadAssetChunk({
      graphql,
      assets: chunk,
      pollAttempts,
      pollDelayMs,
    });

    for (const record of chunkResult.files) {
      uploadedBySha.set(record.sha256, record);
    }
    failures.push(...chunkResult.failures);
    processed += chunk.length;

    await persistShopifyFilesManifest({
      assetsManifest,
      uniqueAssets,
      uploadedBySha,
      failures,
    });

    logger(`Uploaded/polled ${processed}/${pending.length} pending unique assets...`);
  }

  const finalManifest = await persistShopifyFilesManifest({
    assetsManifest,
    uniqueAssets,
    uploadedBySha,
    failures,
  });

  return finalManifest;
}

async function uploadAssetChunk({ graphql, assets, pollAttempts, pollDelayMs }) {
  const failures = [];
  const prepared = [];

  for (const asset of assets) {
    const exists = await pathExists(asset.localPath);

    if (!exists) {
      failures.push({
        type: 'local_file_missing',
        severity: 'error',
        sha256: asset.sha256,
        localPath: asset.localPath,
        productHandle: asset.productHandle,
      });
      continue;
    }

    const stats = await fs.stat(asset.localPath);
    const classification = classifyAssetUploadResource(asset);
    const enrichedAsset = {
      ...asset,
      byteSize: stats.size,
      mimeType: asset.mimeType || inferMimeType(asset.localPath),
    };

    if (classification.warning) {
      failures.push({
        type: classification.warning,
        severity: classification.warning === 'video_source_missing' ? 'warning' : 'error',
        sha256: asset.sha256,
        localPath: asset.localPath,
        sourceUrl: asset.sourceUrl,
        mediaType: asset.mediaType,
        message:
          classification.warning === 'video_source_missing'
            ? 'Source media was marked video publicly, but only a preview image was available in the crawl; uploading the thumbnail as an image.'
            : 'Asset file extension cannot be mapped to a product image or video upload resource.',
      });
    }

    if (classification.resource === 'FILE') {
      continue;
    }

    prepared.push({
      asset: enrichedAsset,
      classification,
      stagedInput: buildStagedUploadInput(enrichedAsset),
    });
  }

  if (!prepared.length) {
    return { files: [], failures };
  }

  const stagedData = await graphql(MUTATION_STAGED_UPLOADS_CREATE, {
    input: prepared.map((item) => item.stagedInput),
  });
  const stagedPayload = stagedData.stagedUploadsCreate;

  if (stagedPayload.userErrors?.length) {
    return {
      files: [],
      failures: failures.concat(
        stagedPayload.userErrors.map((error) => ({
          type: 'staged_uploads_create',
          severity: 'error',
          field: error.field || [],
          message: error.message,
        }))
      ),
    };
  }

  const uploaded = [];
  const targets = stagedPayload.stagedTargets || [];

  for (let index = 0; index < prepared.length; index += 1) {
    const item = prepared[index];
    const target = targets[index];

    if (!target) {
      failures.push({
        type: 'staged_target_missing',
        severity: 'error',
        sha256: item.asset.sha256,
        message: 'Shopify did not return a staged upload target for this asset.',
      });
      continue;
    }

    try {
      await uploadToStagedTarget(target, item.asset);
      uploaded.push({
        ...item,
        target,
      });
    } catch (error) {
      failures.push({
        type: 'multipart_upload',
        severity: 'error',
        sha256: item.asset.sha256,
        localPath: item.asset.localPath,
        message: error.message,
      });
    }
  }

  if (!uploaded.length) {
    return { files: [], failures };
  }

  const fileCreateData = await graphql(MUTATION_FILE_CREATE, {
    files: uploaded.map((item) => buildFileCreateInput(item)),
  });
  const fileCreatePayload = fileCreateData.fileCreate;

  if (fileCreatePayload.userErrors?.length) {
    failures.push(
      ...fileCreatePayload.userErrors.map((error) => ({
        type: 'file_create',
        severity: 'error',
        field: error.field || [],
        code: error.code || '',
        message: error.message,
      }))
    );
  }

  const createdFiles = fileCreatePayload.files || [];
  const filesById = await pollFilesReady({
    graphql,
    fileIds: createdFiles.map((file) => file?.id).filter(Boolean),
    attempts: pollAttempts,
    delayMs: pollDelayMs,
  });
  const fileRecords = [];

  for (let index = 0; index < createdFiles.length; index += 1) {
    const file = createdFiles[index];
    const item = uploaded[index];

    if (!file?.id) {
      failures.push({
        type: 'file_create_missing_file',
        severity: 'error',
        sha256: item?.asset?.sha256,
        message: 'Shopify fileCreate did not return a file ID.',
      });
      continue;
    }

    const polledFile = filesById.get(file.id) || file;
    const record = buildShopifyFileRecord({
      asset: item.asset,
      file: polledFile,
      stagedResourceUrl: item.target.resourceUrl,
    });
    fileRecords.push(record);

    if (record.fileStatus !== 'READY') {
      failures.push({
        type: 'processing_timeout',
        severity: 'error',
        sha256: item.asset.sha256,
        shopifyFileId: file.id,
        fileStatus: record.fileStatus,
        message: 'Shopify file did not reach READY within the polling window.',
      });
    }
  }

  return {
    files: fileRecords,
    failures,
  };
}

async function uploadToStagedTarget(target, asset) {
  const buffer = await fs.readFile(asset.localPath);
  const form = new FormData();

  for (const parameter of target.parameters || []) {
    form.append(parameter.name, parameter.value);
  }

  form.append('file', new Blob([buffer], { type: asset.mimeType || inferMimeType(asset.localPath) }), path.basename(asset.localPath));

  const response = await fetch(target.url, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Staged upload failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
}

function buildFileCreateInput(item) {
  const resource = item.classification.resource;

  return {
    originalSource: item.target.resourceUrl,
    contentType: resource === 'VIDEO' ? 'VIDEO' : 'IMAGE',
    alt: item.asset.alt || defaultAlt(item.asset),
    filename: path.basename(item.asset.localPath),
    duplicateResolutionMode: 'APPEND_UUID',
  };
}

async function pollFilesReady({ graphql, fileIds, attempts, delayMs }) {
  const ids = Array.from(new Set(fileIds || [])).filter(Boolean);
  const byId = new Map();
  if (!ids.length) return byId;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const data = await graphql(QUERY_FILES_BY_IDS, { ids });

    for (const node of data.nodes || []) {
      if (node?.id) {
        byId.set(node.id, normalizeFileNode(node));
      }
    }

    const pending = ids.filter((id) => byId.get(id)?.fileStatus !== 'READY');
    if (!pending.length) break;

    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }

  return byId;
}

function buildShopifyFileRecord({ asset, file, previousRecord = {}, stagedResourceUrl = '' }) {
  const normalizedFile = normalizeFileNode(file);
  const classification = classifyAssetUploadResource(asset);

  return {
    sha256: asset.sha256,
    shopifyFileId: normalizedFile.id || previousRecord.shopifyFileId || '',
    fileStatus: normalizedFile.fileStatus || previousRecord.fileStatus || '',
    contentType: classification.resource === 'VIDEO' ? 'VIDEO' : 'IMAGE',
    resource: classification.resource,
    warning: classification.warning || '',
    cdnUrl: normalizedFile.url || previousRecord.cdnUrl || '',
    stagedResourceUrl: stagedResourceUrl || previousRecord.stagedResourceUrl || '',
    sourceUrl: asset.sourceUrl,
    localPath: asset.localPath,
    alt: asset.alt || defaultAlt(asset),
    dependentCount: asset.dependents?.length || previousRecord.dependentCount || 0,
    dependents: asset.dependents || previousRecord.dependents || [],
    uploadedAt: previousRecord.uploadedAt || new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
  };
}

function normalizeFileNode(file) {
  if (!file) return {};
  return {
    id: file.id || '',
    fileStatus: file.fileStatus || '',
    alt: file.alt || '',
    url: file.image?.url || file.sources?.[0]?.url || file.url || '',
  };
}

async function persistShopifyFilesManifest({ assetsManifest, uniqueAssets, uploadedBySha, failures }) {
  const files = uniqueAssets.map((asset) => uploadedBySha.get(asset.sha256)).filter(Boolean);
  const manifest = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    sourceAssetManifestProcessedAt: assetsManifest.processedAt || '',
    sourceAssetRecords: assetsManifest.assets.length,
    uniqueAssetHashes: uniqueAssets.length,
    readyFileCount: files.filter((file) => file.fileStatus === 'READY').length,
    files,
    failures,
  };

  await writeJson(shopifyFilesPath(), manifest);
  await writeJson(shopifyFilesFailuresPath(), {
    generatedAt: manifest.generatedAt,
    failures,
  });

  return manifest;
}

async function readAssetsManifest() {
  const assetsManifest = await readJsonIfExists(path.join(paths.manifestsRoot, 'assets.json'));

  if (!assetsManifest || !Array.isArray(assetsManifest.assets)) {
    throw new Error(`Missing asset manifest at ${path.join(paths.manifestsRoot, 'assets.json')}. Run audit first.`);
  }

  return assetsManifest;
}

function inferMimeType(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.mov') return 'video/quicktime';
  if (extension === '.m4v') return 'video/x-m4v';
  if (extension === '.webm') return 'video/webm';
  return 'application/octet-stream';
}

function defaultAlt(asset) {
  return asset.productHandle ? `${asset.productHandle} image` : path.basename(asset.localPath || 'Catalog image');
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shopifyFilesPath() {
  return path.join(paths.manifestsRoot, 'shopify-files.json');
}

function shopifyFilesFailuresPath() {
  return path.join(paths.manifestsRoot, 'shopify-files-failures.json');
}

module.exports = {
  buildStagedUploadInput,
  classifyAssetUploadResource,
  dedupeUploadAssets,
  inferMimeType,
  mapReadyFileBySha,
  pollFilesReady,
  runAssetUpload,
};
