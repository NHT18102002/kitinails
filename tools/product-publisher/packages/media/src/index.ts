import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import sharp from 'sharp';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
sharp.cache(false);

export interface StoredSourceAsset {
  storageKey: string;
  rawHash: string;
  contentHash: string;
  canonicalHash: string;
  perceptualHash: string;
  mimeType: 'image/webp';
  originalMimeType: string;
  byteSize: number;
  width: number;
  height: number;
  slot: 'SOURCE_1' | 'SOURCE_2';
}

export interface StoredGeneratedAsset {
  storageKey: string;
  contentHash: string;
  canonicalHash: string;
  perceptualHash: string;
  mimeType: 'image/webp';
  byteSize: number;
  width: number;
  height: number;
  role: 'HERO' | 'DETAIL' | 'LIFESTYLE' | 'SCALE' | 'PACKAGING';
}

export class MediaValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'MediaValidationError';
  }
}

export interface LocalMediaStoreOptions {
  rootDirectory: string;
  maxBytes?: number;
  minimumDimension?: number;
}

export interface MediaStore {
  ingest(stream: Readable, slot: StoredSourceAsset['slot']): Promise<StoredSourceAsset>;
  readBuffer(storageKey: string): Promise<Buffer>;
  storeGenerated(data: Buffer, role: StoredGeneratedAsset['role']): Promise<StoredGeneratedAsset>;
  createMockVariant(storageKey: string, role: StoredGeneratedAsset['role']): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}

export type MediaStoreOptions = LocalMediaStoreOptions & ({
  driver?: 'local';
} | {
  driver: 's3';
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
});

export function createMediaStore(options: MediaStoreOptions): MediaStore {
  if (options.driver !== 's3') return new LocalMediaStore(options);
  return new S3MediaStore(options);
}

export class LocalMediaStore {
  readonly rootDirectory: string;
  private readonly maxBytes: number;
  private readonly minimumDimension: number;

  constructor(options: LocalMediaStoreOptions) {
    this.rootDirectory = resolve(options.rootDirectory);
    this.maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
    this.minimumDimension = options.minimumDimension ?? 600;
  }

  async ingest(stream: Readable, slot: StoredSourceAsset['slot']): Promise<StoredSourceAsset> {
    const incomingDirectory = join(this.rootDirectory, '.incoming');
    await mkdir(incomingDirectory, { recursive: true });
    const uploadPath = join(incomingDirectory, `${randomUUID()}.upload`);
    const normalizedPath = join(incomingDirectory, `${randomUUID()}.webp`);
    const rawHasher = createHash('sha256');
    let byteSize = 0;

    const meter = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        byteSize += chunk.length;
        if (byteSize > this.maxBytes) {
          callback(new MediaValidationError('MEDIA_TOO_LARGE', `Image exceeds ${this.maxBytes} bytes`));
          return;
        }
        rawHasher.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(stream, meter, createWriteStream(uploadPath, { flags: 'wx' }));
      if (byteSize === 0) throw new MediaValidationError('MEDIA_EMPTY', 'Image is empty');

      const detected = await fileTypeFromFile(uploadPath);
      if (!detected || !allowedMimeTypes.has(detected.mime)) {
        throw new MediaValidationError('MEDIA_TYPE_UNSUPPORTED', 'Only JPEG, PNG and WebP images are accepted');
      }

      const metadata = await sharp(uploadPath, { failOn: 'error', limitInputPixels: 80_000_000 }).metadata();
      const orientedWidth = metadata.autoOrient.width ?? metadata.width ?? 0;
      const orientedHeight = metadata.autoOrient.height ?? metadata.height ?? 0;
      if (Math.min(orientedWidth, orientedHeight) < this.minimumDimension) {
        throw new MediaValidationError(
          'MEDIA_DIMENSIONS_TOO_SMALL',
          `Image must be at least ${this.minimumDimension}px on its shortest side`,
        );
      }

      await sharp(uploadPath, { failOn: 'error', limitInputPixels: 80_000_000 })
        .autoOrient()
        .toColourspace('srgb')
        .webp({ lossless: true, effort: 4 })
        .toFile(normalizedPath);

      const canonicalHash = await hashFile(normalizedPath);
      const perceptualHash = await differenceHash(normalizedPath);
      const storageKey = `source/${canonicalHash.slice(0, 2)}/${canonicalHash}-${randomUUID()}-${slot.toLowerCase()}.webp`;
      const finalPath = this.resolveStorageKey(storageKey);
      await mkdir(dirname(finalPath), { recursive: true });
      try {
        await rename(normalizedPath, finalPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await rm(normalizedPath, { force: true });
      }

      return {
        storageKey,
        rawHash: rawHasher.digest('hex'),
        contentHash: canonicalHash,
        canonicalHash,
        perceptualHash,
        mimeType: 'image/webp',
        originalMimeType: detected.mime,
        byteSize,
        width: orientedWidth,
        height: orientedHeight,
        slot,
      };
    } catch (error) {
      await Promise.allSettled([
        rm(uploadPath, { force: true }),
        rm(normalizedPath, { force: true }),
      ]);
      throw error;
    } finally {
      await rm(uploadPath, { force: true });
    }
  }

  createReadStream(storageKey: string): Readable {
    return createReadStream(this.resolveStorageKey(storageKey));
  }

  async readBuffer(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveStorageKey(storageKey));
  }

  async createMockVariant(
    storageKey: string,
    role: StoredGeneratedAsset['role'],
  ): Promise<Buffer> {
    const source = await this.readBuffer(storageKey);
    return buildMockVariant(source, role);
  }

  async storeGenerated(
    data: Buffer,
    role: StoredGeneratedAsset['role'],
  ): Promise<StoredGeneratedAsset> {
    if (data.length === 0) throw new MediaValidationError('MEDIA_EMPTY', 'Generated image is empty');
    if (data.length > this.maxBytes) {
      throw new MediaValidationError('MEDIA_TOO_LARGE', `Generated image exceeds ${this.maxBytes} bytes`);
    }
    const detected = await fileTypeFromBuffer(data);
    if (!detected || !allowedMimeTypes.has(detected.mime)) {
      throw new MediaValidationError('MEDIA_TYPE_UNSUPPORTED', 'Generated output is not a supported image');
    }

    const incomingDirectory = join(this.rootDirectory, '.incoming');
    await mkdir(incomingDirectory, { recursive: true });
    const normalizedPath = join(incomingDirectory, `${randomUUID()}.generated.webp`);
    try {
      const metadata = await sharp(data, { failOn: 'error', limitInputPixels: 80_000_000 }).metadata();
      const width = metadata.autoOrient.width ?? metadata.width ?? 0;
      const height = metadata.autoOrient.height ?? metadata.height ?? 0;
      if (Math.min(width, height) < this.minimumDimension) {
        throw new MediaValidationError(
          'MEDIA_DIMENSIONS_TOO_SMALL',
          `Generated image must be at least ${this.minimumDimension}px on its shortest side`,
        );
      }
      await sharp(data, { failOn: 'error', limitInputPixels: 80_000_000 })
        .autoOrient()
        .toColourspace('srgb')
        .webp({ quality: 92, effort: 4 })
        .toFile(normalizedPath);
      const canonicalHash = await hashFile(normalizedPath);
      const perceptualHash = await differenceHash(normalizedPath);
      const storageKey = `generated/${canonicalHash.slice(0, 2)}/${canonicalHash}-${randomUUID()}-${role.toLowerCase()}.webp`;
      const finalPath = this.resolveStorageKey(storageKey);
      await mkdir(dirname(finalPath), { recursive: true });
      await rename(normalizedPath, finalPath);
      return {
        storageKey,
        contentHash: canonicalHash,
        canonicalHash,
        perceptualHash,
        mimeType: 'image/webp',
        byteSize: data.length,
        width,
        height,
        role,
      };
    } catch (error) {
      await rm(normalizedPath, { force: true });
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolveStorageKey(storageKey), { force: true });
  }

  private resolveStorageKey(storageKey: string): string {
    if (extname(storageKey).toLowerCase() !== '.webp') {
      throw new MediaValidationError('STORAGE_KEY_INVALID', 'Unexpected media extension');
    }
    const fullPath = resolve(this.rootDirectory, storageKey);
    const relativePath = relative(this.rootDirectory, fullPath);
    if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || relativePath === '') {
      throw new MediaValidationError('STORAGE_KEY_INVALID', 'Media path escapes storage root');
    }
    return fullPath;
  }
}

export class S3MediaStore implements MediaStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly localProcessor: LocalMediaStore;

  constructor(options: Extract<MediaStoreOptions, { driver: 's3' }>) {
    this.bucket = options.bucket;
    if (!this.bucket || !options.region || !options.accessKeyId || !options.secretAccessKey) {
      throw new MediaValidationError('S3_CONFIG_INVALID', 'S3 bucket, region and credentials are required');
    }
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      forcePathStyle: options.forcePathStyle ?? false,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
    this.localProcessor = new LocalMediaStore({
      rootDirectory: join(tmpdir(), 'ersa-product-publisher-media-processing'),
      ...(options.maxBytes ? { maxBytes: options.maxBytes } : {}),
      ...(options.minimumDimension ? { minimumDimension: options.minimumDimension } : {}),
    });
  }

  async ingest(stream: Readable, slot: StoredSourceAsset['slot']): Promise<StoredSourceAsset> {
    const stored = await this.localProcessor.ingest(stream, slot);
    await this.uploadAndRemoveLocal(stored.storageKey, 'image/webp');
    return stored;
  }

  async storeGenerated(data: Buffer, role: StoredGeneratedAsset['role']): Promise<StoredGeneratedAsset> {
    const stored = await this.localProcessor.storeGenerated(data, role);
    await this.uploadAndRemoveLocal(stored.storageKey, 'image/webp');
    return stored;
  }

  async readBuffer(storageKey: string): Promise<Buffer> {
    assertStorageKeyShape(storageKey);
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    if (!response.Body) throw new MediaValidationError('S3_OBJECT_EMPTY', 'S3 object has no body');
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async createMockVariant(storageKey: string, role: StoredGeneratedAsset['role']): Promise<Buffer> {
    return buildMockVariant(await this.readBuffer(storageKey), role);
  }

  async remove(storageKey: string): Promise<void> {
    assertStorageKeyShape(storageKey);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  private async uploadAndRemoveLocal(storageKey: string, contentType: string): Promise<void> {
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: await this.localProcessor.readBuffer(storageKey),
        ContentType: contentType,
        Metadata: { managedBy: 'ersa-product-publisher' },
      }));
    } finally {
      await this.localProcessor.remove(storageKey);
    }
  }
}

async function hashFile(path: string): Promise<string> {
  const hasher = createHash('sha256');
  for await (const chunk of createReadStream(path)) hasher.update(chunk as Buffer);
  return hasher.digest('hex');
}

async function differenceHash(path: string): Promise<string> {
  const { data } = await sharp(path)
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const offset = row * 9 + column;
      bits += (data[offset] ?? 0) > (data[offset + 1] ?? 0) ? '1' : '0';
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

async function buildMockVariant(data: Buffer, role: StoredGeneratedAsset['role']): Promise<Buffer> {
  const backgrounds: Record<StoredGeneratedAsset['role'], string> = {
    HERO: '#fff8fa',
    DETAIL: '#f4f0ed',
    LIFESTYLE: '#f7efe5',
    SCALE: '#f1f4f7',
    PACKAGING: '#f5eef8',
  };
  return sharp(data, { failOn: 'error', limitInputPixels: 80_000_000 })
    .autoOrient()
    .resize(920, 920, {
      fit: role === 'DETAIL' ? 'cover' : 'contain',
      position: 'centre',
      background: backgrounds[role],
    })
    .extend({ top: 52, bottom: 52, left: 52, right: 52, background: backgrounds[role] })
    .modulate({
      brightness: role === 'LIFESTYLE' ? 1.04 : role === 'PACKAGING' ? 0.98 : 1,
      saturation: role === 'SCALE' ? 0.9 : role === 'HERO' ? 1.03 : 1,
    })
    .webp({ quality: 92, effort: 4 })
    .toBuffer();
}

function assertStorageKeyShape(storageKey: string): void {
  if (!/^(source|generated)\/[a-f0-9]{2}\/[a-zA-Z0-9._-]+\.webp$/.test(storageKey)) {
    throw new MediaValidationError('STORAGE_KEY_INVALID', 'Unexpected object storage key');
  }
}
