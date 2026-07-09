const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStagedUploadInput,
  classifyAssetUploadResource,
  dedupeUploadAssets,
  mapReadyFileBySha,
} = require('../src/asset-upload.cjs');

test('dedupeUploadAssets uploads one file per sha256', () => {
  const assets = [
    { sha256: 'a', localPath: 'a.jpg', mediaType: 'image' },
    { sha256: 'a', localPath: 'a-copy.jpg', mediaType: 'image' },
    { sha256: 'b', localPath: 'b.jpg', mediaType: 'image' },
  ];

  assert.equal(dedupeUploadAssets(assets).length, 2);
});

test('buildStagedUploadInput maps image files to Shopify Files IMAGE uploads', () => {
  assert.deepEqual(
    buildStagedUploadInput({
      localPath: 'D:\\work\\shopify\\ersanails\\data\\catalog\\assets\\seafoam\\01-seafoam-aabbccdd.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      mediaType: 'image',
    }),
    {
      filename: '01-seafoam-aabbccdd.jpg',
      mimeType: 'image/jpeg',
      httpMethod: 'POST',
      resource: 'IMAGE',
    }
  );
});

test('classifyAssetUploadResource treats video thumbnail jpg as image with warning', () => {
  assert.deepEqual(
    classifyAssetUploadResource({
      localPath: 'thumbnail.jpg',
      mediaType: 'video',
      sourceUrl: 'https://cdn.shopify.com/files/preview_images/sample.thumbnail.0000000000.jpg',
    }),
    {
      resource: 'IMAGE',
      warning: 'video_source_missing',
    }
  );
});

test('mapReadyFileBySha keeps only READY files', () => {
  const result = mapReadyFileBySha([
    { sha256: 'a', shopifyFileId: 'gid://shopify/MediaImage/1', fileStatus: 'READY' },
    { sha256: 'b', shopifyFileId: 'gid://shopify/MediaImage/2', fileStatus: 'PROCESSING' },
  ]);

  assert.equal(result.get('a'), 'gid://shopify/MediaImage/1');
  assert.equal(result.has('b'), false);
});
