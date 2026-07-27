import {
  BatchSchema,
  CollectionSnapshotSchema,
  type BatchDto,
  type CollectionSnapshot,
} from '@ersa/product-publisher-contracts';
import { z } from 'zod';
import {
  splitPairsIntoBatches,
  type ProductImagePair,
} from './folder-pairing.js';

const ACCESS_TOKEN_STORAGE_KEY = 'ersa.product-publisher.access-token';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
let apiAccessToken = typeof window === 'undefined'
  ? ''
  : window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '';

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function apiAccessTokenIsRequired(): boolean {
  return import.meta.env.VITE_AUTH_REQUIRED === 'true';
}

export function hasApiAccessToken(): boolean {
  return apiAccessToken.length > 0;
}

export function setApiAccessToken(token: string): void {
  apiAccessToken = token.trim();
  if (typeof window !== 'undefined') {
    if (apiAccessToken) window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, apiAccessToken);
    else window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export function clearApiAccessToken(): void {
  setApiAccessToken('');
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code = 'REQUEST_FAILED',
    readonly requestId: string | null = null,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const isFormData = init?.body instanceof FormData;
  const hasBody = init?.body !== undefined;
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(apiAccessToken ? { Authorization: `Bearer ${apiAccessToken}` } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null) as unknown;
  const message = typeof body === 'object' && body !== null && 'message' in body
    ? String(body.message)
    : 'Request failed';
  if (!response.ok) {
    const code = typeof body === 'object' && body !== null && 'code' in body
      ? String(body.code)
      : 'REQUEST_FAILED';
    const requestId = typeof body === 'object' && body !== null && 'requestId' in body
      ? String(body.requestId)
      : null;
    const retryable = typeof body === 'object' && body !== null && 'retryable' in body
      ? Boolean(body.retryable)
      : false;
    throw new ApiRequestError(message, code, requestId, retryable);
  }
  return body;
}

export async function listBatches(): Promise<BatchDto[]> {
  const body = await requestJson('/api/batches');
  return z.object({ batches: z.array(BatchSchema) }).parse(body).batches;
}

export async function listCollections(): Promise<CollectionSnapshot[]> {
  const body = await requestJson('/api/collections');
  return z.object({ collections: z.array(CollectionSnapshotSchema) }).parse(body).collections;
}

export async function createBatch(collection: CollectionSnapshot): Promise<BatchDto> {
  return BatchSchema.parse(await requestJson('/api/batches', {
    method: 'POST',
    body: JSON.stringify({ collection }),
  }));
}

export async function runBatch(batchId: string): Promise<BatchDto> {
  return BatchSchema.parse(await requestJson(`/api/batches/${batchId}/run`, { method: 'POST' }));
}

export async function resumeBatch(batchId: string): Promise<BatchDto> {
  return BatchSchema.parse(await requestJson(`/api/batches/${batchId}/resume`, { method: 'POST' }));
}

export async function cancelBatch(batchId: string): Promise<BatchDto> {
  return BatchSchema.parse(await requestJson(`/api/batches/${batchId}/cancel`, { method: 'POST' }));
}

export interface PublisherPreflight {
  status: 'mock_ready' | 'ready' | 'blocked';
  connected: boolean;
  shopDomain: string;
  apiVersion: string;
  liveShop?: {
    name: string;
    myshopifyDomain: string;
    currencyCode: string;
    primaryDomain?: { host: string } | undefined;
  } | undefined;
  openAiMode: 'mock' | 'live';
  openAiReady: boolean;
  shopifyWriteMode: 'off' | 'draft' | 'publish';
  publishKillSwitch: boolean;
  pipelineVersion: string;
  maxImageBytes: number;
  maxBatchItems: number;
  requiredScopes: string[];
  missingScopes: string[];
  publicationReady: boolean;
  externalIdDefinitionReady: boolean;
}

export async function getPreflight(): Promise<PublisherPreflight> {
  return z.object({
    status: z.enum(['mock_ready', 'ready', 'blocked']),
    connected: z.boolean(),
    shopDomain: z.string(),
    apiVersion: z.string(),
    liveShop: z.object({
      name: z.string(),
      myshopifyDomain: z.string(),
      currencyCode: z.string(),
      primaryDomain: z.object({ host: z.string() }).optional(),
    }).optional(),
    openAiMode: z.enum(['mock', 'live']),
    openAiReady: z.boolean(),
    shopifyWriteMode: z.enum(['off', 'draft', 'publish']),
    publishKillSwitch: z.boolean(),
    pipelineVersion: z.string(),
    maxImageBytes: z.number().positive(),
    maxBatchItems: z.number().int().positive(),
    requiredScopes: z.array(z.string()),
    missingScopes: z.array(z.string()),
    publicationReady: z.boolean(),
    externalIdDefinitionReady: z.boolean(),
  }).parse(await requestJson('/api/shop/preflight'));
}

export type CreateBatchStage = 'creating' | 'uploading' | 'sealing' | 'queueing';

export type FolderRunStage = CreateBatchStage | 'complete';

export interface FolderRunProgress {
  stage: FolderRunStage;
  batchIndex: number;
  batchCount: number;
  completedItems: number;
  totalItems: number;
  currentPairLabel?: string;
}

async function uploadBatchItem(batchId: string, files: readonly [File, File]): Promise<void> {
  const form = new FormData();
  for (const file of files) form.append('images', file, file.name);
  await requestJson(`/api/batches/${batchId}/items`, { method: 'POST', body: form });
}

async function sealBatch(batchId: string): Promise<BatchDto> {
  return BatchSchema.parse(await requestJson(`/api/batches/${batchId}/seal`, { method: 'POST' }));
}

export async function createAndRunFolderBatches(
  collection: CollectionSnapshot,
  pairs: readonly ProductImagePair<File>[],
  maxBatchItems: number,
  onProgress?: (progress: FolderRunProgress) => void,
): Promise<BatchDto[]> {
  if (pairs.length === 0) throw new Error('Thư mục chưa có cặp ảnh sản phẩm hợp lệ');
  const chunks = splitPairsIntoBatches(pairs, maxBatchItems);
  const prepared: BatchDto[] = [];
  let completedItems = 0;

  try {
    for (let batchIndex = 0; batchIndex < chunks.length; batchIndex += 1) {
      const chunk = chunks[batchIndex];
      if (!chunk) throw new Error('Không thể đọc batch ảnh đã chia');
      onProgress?.({
        stage: 'creating',
        batchIndex,
        batchCount: chunks.length,
        completedItems,
        totalItems: pairs.length,
      });
      const batch = await createBatch(collection);
      prepared.push(batch);

      for (const pair of chunk) {
        onProgress?.({
          stage: 'uploading',
          batchIndex,
          batchCount: chunks.length,
          completedItems,
          totalItems: pairs.length,
          currentPairLabel: pair.label,
        });
        await uploadBatchItem(batch.id, pair.files);
        completedItems += 1;
      }

      onProgress?.({
        stage: 'sealing',
        batchIndex,
        batchCount: chunks.length,
        completedItems,
        totalItems: pairs.length,
      });
      prepared[batchIndex] = await sealBatch(batch.id);
    }
  } catch (error) {
    await Promise.allSettled(prepared.map((batch) => cancelBatch(batch.id)));
    throw error;
  }

  const queued: BatchDto[] = [];
  try {
    for (let batchIndex = 0; batchIndex < prepared.length; batchIndex += 1) {
      const batch = prepared[batchIndex];
      if (!batch) throw new Error('Không thể đọc batch đã chuẩn bị');
      onProgress?.({
        stage: 'queueing',
        batchIndex,
        batchCount: prepared.length,
        completedItems: pairs.length,
        totalItems: pairs.length,
      });
      queued.push(await runBatch(batch.id));
    }
  } catch (error) {
    const queuedIds = new Set(queued.map((batch) => batch.id));
    await Promise.allSettled(
      prepared.filter((batch) => !queuedIds.has(batch.id)).map((batch) => cancelBatch(batch.id)),
    );
    throw error;
  }

  onProgress?.({
    stage: 'complete',
    batchIndex: Math.max(0, queued.length - 1),
    batchCount: queued.length,
    completedItems: pairs.length,
    totalItems: pairs.length,
  });
  return queued;
}

export async function createAndRunBatch(
  collection: CollectionSnapshot,
  files: readonly File[],
  onStage?: (stage: CreateBatchStage) => void,
): Promise<BatchDto> {
  if (files.length !== 2) throw new Error('Vui lòng chọn đúng 2 ảnh sản phẩm');
  let batch: BatchDto | null = null;
  try {
    onStage?.('creating');
    batch = await createBatch(collection);
    onStage?.('uploading');
    await uploadBatchItem(batch.id, files as [File, File]);
    onStage?.('sealing');
    await sealBatch(batch.id);
    onStage?.('queueing');
    return await runBatch(batch.id);
  } catch (error) {
    if (batch) {
      await cancelBatch(batch.id).catch(() => undefined);
    }
    throw error;
  }
}
