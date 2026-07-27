import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  BatchRepository,
  CheckpointRepository,
  createDataSource,
  EventRepository,
  JobQueueRepository,
  ResourceLeaseRepository,
} from '@ersa/product-publisher-db';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const dataSource = databaseUrl ? createDataSource({ databaseUrl }) : null;

function sourceAsset(slot: 'SOURCE_1' | 'SOURCE_2', seed: string) {
  const hash = seed.repeat(64).slice(0, 64);
  return {
    storageKey: `source/test/${seed}-${slot}.webp`,
    rawHash: hash,
    contentHash: hash,
    canonicalHash: hash,
    perceptualHash: seed.repeat(16).slice(0, 16),
    slot,
    metadata: { width: 1200, height: 1200 },
  } as const;
}

describePostgres('PostgreSQL repositories', () => {
  beforeAll(async () => {
    const parsed = new URL(databaseUrl!);
    if (!parsed.pathname.toLowerCase().includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test"');
    }
    await dataSource!.initialize();
    await dataSource!.runMigrations();
  });

  afterEach(async () => {
    await dataSource!.query(`
      TRUNCATE TABLE
        audit_events, provider_calls, qa_reports, checkpoints, jobs, resource_leases,
        remote_product_fingerprints, batch_item_targets, product_bindings, assets,
        batch_items, batches, shops
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('migrates an empty database and enforces immutable batch orchestration', async () => {
    const batches = new BatchRepository(dataSource!);
    const shop = await batches.ensureShop({ shopDomain: 'test.myshopify.com', apiVersion: '2026-07' });
    const batch = await batches.create(shop.id, {
      gid: 'gid://shopify/Collection/1',
      title: 'Press On Nails',
      handle: 'press-on-nails',
      rulesHash: 'rules-v1',
      kind: 'MANUAL',
      compatibility: 'ASSIGNABLE',
    });

    const item = await batches.addNormalizedItem(
      batch.id,
      [sourceAsset('SOURCE_1', 'a'), sourceAsset('SOURCE_2', 'b')],
      20,
    );
    expect(item.state).toBe('NORMALIZED');
    expect((await batches.getAssets(item.id))).toHaveLength(2);

    const sealed = await batches.seal(batch.id);
    expect(sealed.state).toBe('SEALED');
    await expect(batches.addNormalizedItem(
      batch.id,
      [sourceAsset('SOURCE_1', 'c'), sourceAsset('SOURCE_2', 'd')],
      20,
    )).rejects.toMatchObject({ code: 'BATCH_IMMUTABLE' });
  });

  it('deduplicates run authorization and allows only one worker to claim a job', async () => {
    const batches = new BatchRepository(dataSource!);
    const queue = new JobQueueRepository(dataSource!);
    const events = new EventRepository(dataSource!);
    const shop = await batches.ensureShop({ shopDomain: 'test.myshopify.com', apiVersion: '2026-07' });
    const batch = await batches.create(shop.id, {
      gid: 'gid://shopify/Collection/1',
      title: 'Press On Nails',
      handle: 'press-on-nails',
      rulesHash: 'rules-v1',
      kind: 'MANUAL',
      compatibility: 'ASSIGNABLE',
    });
    await batches.addNormalizedItem(
      batch.id,
      [sourceAsset('SOURCE_1', 'a'), sourceAsset('SOURCE_2', 'b')],
      20,
    );
    await batches.seal(batch.id);

    const [firstRun, secondRun] = await Promise.all([
      batches.authorizeMockRun(batch.id),
      batches.authorizeMockRun(batch.id),
    ]);
    expect(firstRun.state).toBe('RUNNING');
    expect(secondRun.state).toBe('RUNNING');

    const claims = await Promise.all([queue.claim('worker-a'), queue.claim('worker-b')]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await queue.claim('worker-c')).toBeNull();
    expect((await events.list(batch.id)).map((event) => event.type)).toEqual([
      'BATCH_CREATED',
      'BATCH_ITEM_NORMALIZED',
      'BATCH_SEALED',
      'BATCH_RUN_AUTHORIZED',
    ]);
  });

  it('uses fencing tokens to prevent stale resource owners from releasing a new lease', async () => {
    const leases = new ResourceLeaseRepository(dataSource!);
    const first = await leases.acquire({ resourceType: 'product', resourceId: 'external-1', leaseOwner: 'worker-a' });
    expect(first?.fencingToken).toBe('1');
    expect(await leases.acquire({ resourceType: 'product', resourceId: 'external-1', leaseOwner: 'worker-b' })).toBeNull();

    await dataSource!.query(`UPDATE resource_leases SET leased_until = now() - interval '1 second'`);
    const second = await leases.acquire({ resourceType: 'product', resourceId: 'external-1', leaseOwner: 'worker-b' });
    expect(second?.fencingToken).toBe('2');
    expect(await leases.release(first!)).toBe(false);
    expect(await leases.release(second!)).toBe(true);
  });

  it('resumes checkpoints idempotently without creating a second stage record', async () => {
    const batches = new BatchRepository(dataSource!);
    const checkpoints = new CheckpointRepository(dataSource!);
    const shop = await batches.ensureShop({ shopDomain: 'test.myshopify.com', apiVersion: '2026-07' });
    const batch = await batches.create(shop.id, {
      gid: 'gid://shopify/Collection/1',
      title: 'Press On Nails',
      handle: 'press-on-nails',
      rulesHash: 'rules-v1',
      kind: 'MANUAL',
      compatibility: 'ASSIGNABLE',
    });
    const item = await batches.addNormalizedItem(
      batch.id,
      [sourceAsset('SOURCE_1', 'a'), sourceAsset('SOURCE_2', 'b')],
      20,
    );

    const started = await checkpoints.begin({
      batchItemId: item.id,
      stage: 'dedupe',
      inputHash: 'c'.repeat(64),
      pipelineVersion: 'v1',
    });
    expect(started.attempt).toBe(1);
    const completed = await checkpoints.complete(started, { decision: 'unique' });
    expect(completed.state).toBe('COMPLETED');

    const resumed = await checkpoints.begin({
      batchItemId: item.id,
      stage: 'dedupe',
      inputHash: 'c'.repeat(64),
      pipelineVersion: 'v1',
    });
    expect(resumed.id).toBe(started.id);
    expect(resumed.state).toBe('COMPLETED');
    expect(resumed.attempt).toBe(1);
    const count = await dataSource!.query(`SELECT count(*)::integer AS count FROM checkpoints`);
    expect(Number(count[0].count)).toBe(1);
  });

  it('commits duplicate blocking instead of rolling the hold state back', async () => {
    const batches = new BatchRepository(dataSource!);
    const events = new EventRepository(dataSource!);
    const shop = await batches.ensureShop({ shopDomain: 'test.myshopify.com', apiVersion: '2026-07' });
    const collection = {
      gid: 'gid://shopify/Collection/1',
      title: 'Press On Nails',
      handle: 'press-on-nails',
      rulesHash: 'rules-v1',
      kind: 'MANUAL',
      compatibility: 'ASSIGNABLE',
    } as const;
    const firstBatch = await batches.create(shop.id, collection);
    const secondBatch = await batches.create(shop.id, collection);
    const first = await batches.addNormalizedItem(
      firstBatch.id,
      [sourceAsset('SOURCE_1', 'a'), sourceAsset('SOURCE_2', 'b')],
      20,
    );
    const second = await batches.addNormalizedItem(
      secondBatch.id,
      [sourceAsset('SOURCE_1', 'a'), sourceAsset('SOURCE_2', 'b')],
      20,
    );

    await expect(batches.authorizeLocalTarget(first.id)).resolves.toMatchObject({ decision: 'CREATE' });
    await expect(batches.authorizeLocalTarget(second.id)).resolves.toMatchObject({ decision: 'BLOCKED_DUPLICATE' });
    await expect(batches.getItem(second.id)).resolves.toMatchObject({
      state: 'BLOCKED_DUPLICATE',
      errorCode: 'EXACT_DUPLICATE_IN_PROGRESS',
    });
    expect((await events.list(secondBatch.id)).map((event) => event.type)).toContain('BATCH_ITEM_DUPLICATE_BLOCKED');
  });
});
