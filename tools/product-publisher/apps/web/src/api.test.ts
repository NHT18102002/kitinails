import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BatchDto, CollectionSnapshot } from '@ersa/product-publisher-contracts';
import {
  clearApiAccessToken,
  createAndRunFolderBatches,
  listCollections,
  setApiAccessToken,
  type FolderRunProgress,
} from './api.js';
import { scanFolderFiles } from './folder-pairing.js';

const collection: CollectionSnapshot = {
  gid: 'gid://shopify/Collection/1',
  title: 'Nail Art',
  handle: 'nail-art',
  rulesHash: 'manual-v1',
  kind: 'MANUAL',
  compatibility: 'ASSIGNABLE',
};

function batch(id: string, state: BatchDto['state']): BatchDto {
  return {
    id,
    shopId: '00000000-0000-4000-8000-000000000099',
    collection,
    state,
    version: 1,
    sealedAt: state === 'DRAFT' ? null : '2026-07-27T00:00:00.000Z',
    runAuthorizedAt: state === 'RUNNING' ? '2026-07-27T00:00:01.000Z' : null,
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
  };
}

afterEach(() => {
  clearApiAccessToken();
  vi.unstubAllGlobals();
});

describe('folder batch API orchestration', () => {
  it('sends the team access token only in the Authorization header', async () => {
    const fetchMock = vi.fn(async () => Response.json({ collections: [collection] }));
    vi.stubGlobal('fetch', fetchMock);
    setApiAccessToken('team-access-token');

    await listCollections();

    expect(fetchMock).toHaveBeenCalledWith('/api/collections', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer team-access-token' }),
    }));
  });

  it('uploads all pairs, splits safe batches, seals them, then queues every batch', async () => {
    const files = Array.from({ length: 10 }, (_, index) => {
      const file = new File([`image-${index}`], `${index + 1}.jpg`, { type: 'image/jpeg' });
      Object.defineProperty(file, 'webkitRelativePath', { value: `folder/${index + 1}.jpg` });
      return file;
    });
    const pairs = scanFolderFiles(files).pairs;
    const calls: string[] = [];
    let createIndex = 0;
    const ids = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
    ];

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      if (url === '/api/batches') {
        const id = ids[createIndex++];
        return Response.json(batch(id!, 'DRAFT'), { status: 201 });
      }
      const id = ids.find((candidate) => url.includes(candidate));
      if (!id) return Response.json({ message: 'not found' }, { status: 404 });
      if (url.endsWith('/items')) return Response.json({ ok: true }, { status: 201 });
      if (url.endsWith('/seal')) return Response.json(batch(id, 'SEALED'));
      if (url.endsWith('/run')) return Response.json(batch(id, 'RUNNING'));
      if (url.endsWith('/cancel')) return Response.json(batch(id, 'CANCELLED'));
      return Response.json({ message: 'not found' }, { status: 404 });
    }));

    const progress: FolderRunProgress[] = [];
    const result = await createAndRunFolderBatches(collection, pairs, 2, (event) => progress.push(event));

    expect(result).toHaveLength(3);
    expect(calls.filter((call) => call === 'POST /api/batches')).toHaveLength(3);
    expect(calls.filter((call) => call.endsWith('/items'))).toHaveLength(5);
    expect(calls.filter((call) => call.endsWith('/seal'))).toHaveLength(3);
    expect(calls.filter((call) => call.endsWith('/run'))).toHaveLength(3);
    expect(calls.findIndex((call) => call.endsWith('/run'))).toBeGreaterThan(
      calls.map((call) => call.endsWith('/seal')).lastIndexOf(true),
    );
    expect(progress.at(-1)).toMatchObject({ stage: 'complete', completedItems: 5, totalItems: 5 });
  });
});
