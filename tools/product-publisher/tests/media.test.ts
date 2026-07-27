import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { createMediaStore, LocalMediaStore, MediaValidationError } from '@ersa/product-publisher-media';

const temporaryRoots: string[] = [];

async function makeStore(minimumDimension = 32): Promise<LocalMediaStore> {
  const root = await mkdtemp(join(tmpdir(), 'ersa-product-publisher-test-'));
  temporaryRoots.push(root);
  return new LocalMediaStore({ rootDirectory: root, minimumDimension, maxBytes: 2 * 1024 * 1024 });
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    const resolved = resolve(root);
    if (!resolved.startsWith(resolve(tmpdir()))) throw new Error('Refusing to remove a non-temporary test path');
    await rm(resolved, { recursive: true, force: true });
  }
});

describe('local streaming media pipeline', () => {
  it('validates, auto-normalizes and fingerprints an uploaded image', async () => {
    const store = await makeStore();
    const jpeg = await sharp({
      create: { width: 96, height: 64, channels: 3, background: { r: 220, g: 80, b: 120 } },
    }).jpeg().toBuffer();

    const asset = await store.ingest(Readable.from(jpeg), 'SOURCE_1');

    expect(asset.rawHash).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.perceptualHash).toMatch(/^[a-f0-9]{16}$/);
    expect(asset.originalMimeType).toBe('image/jpeg');
    expect(asset.mimeType).toBe('image/webp');
    expect(asset.width).toBe(96);
    expect(asset.height).toBe(64);
    expect((await readFile(join(store.rootDirectory, asset.storageKey))).length).toBeGreaterThan(0);
  });

  it('rejects spoofed image content and too-small images', async () => {
    const store = await makeStore(64);
    await expect(store.ingest(Readable.from(Buffer.from('not an image')), 'SOURCE_1'))
      .rejects.toMatchObject({ code: 'MEDIA_TYPE_UNSUPPORTED' } satisfies Partial<MediaValidationError>);

    const small = await sharp({
      create: { width: 32, height: 32, channels: 3, background: 'black' },
    }).png().toBuffer();
    await expect(store.ingest(Readable.from(small), 'SOURCE_2'))
      .rejects.toMatchObject({ code: 'MEDIA_DIMENSIONS_TOO_SMALL' } satisfies Partial<MediaValidationError>);
  });

  it('never resolves caller-controlled paths outside the storage root', async () => {
    const store = await makeStore();
    expect(() => store.createReadStream('../secret.webp'))
      .toThrowError(expect.objectContaining({ code: 'STORAGE_KEY_INVALID' }));
  });

  it('requires complete S3 configuration before constructing production storage', () => {
    expect(() => createMediaStore({
      driver: 's3',
      rootDirectory: 'unused',
      region: 'auto',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
    })).toThrowError(expect.objectContaining({ code: 'S3_CONFIG_INVALID' }));
  });

  it('creates five distinct deterministic mock views from one source', async () => {
    const store = await makeStore();
    const source = await sharp({
      create: { width: 96, height: 96, channels: 3, background: '#d8a0b4' },
    }).png().toBuffer();
    const asset = await store.ingest(Readable.from(source), 'SOURCE_1');
    const roles = ['HERO', 'DETAIL', 'LIFESTYLE', 'SCALE', 'PACKAGING'] as const;
    const variants = await Promise.all(roles.map((role) => store.createMockVariant(asset.storageKey, role)));
    expect(new Set(variants.map((variant) => variant.toString('base64')))).toHaveLength(5);
  });
});
