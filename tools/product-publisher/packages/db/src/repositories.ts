import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import type {
  AssetDto,
  BatchDto,
  BatchItemDto,
  BatchState,
  ItemState,
  CollectionSnapshot,
  WorkflowEvent,
} from '@ersa/product-publisher-contracts';
import { assertBatchTransition, assertItemTransition, sha256, stableStringify } from '@ersa/product-publisher-domain';
import { ShopEntity } from './entities/index.js';

type Row = Record<string, unknown>;

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function normalizeDmlRows(result: unknown): Row[] {
  if (!Array.isArray(result)) return [];
  if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[0] as Row[];
  }
  return result as Row[];
}

function mapBatchRow(row: Row): BatchDto {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    collection: {
      gid: String(row.collection_gid),
      title: String(row.collection_title),
      handle: String(row.collection_handle),
      rulesHash: String(row.collection_rules_hash),
      kind: String(row.collection_kind) as CollectionSnapshot['kind'],
      compatibility: String(row.collection_compatibility) as CollectionSnapshot['compatibility'],
    },
    state: String(row.state) as BatchState,
    version: Number(row.version),
    sealedAt: row.sealed_at ? asDate(row.sealed_at).toISOString() : null,
    runAuthorizedAt: row.run_authorized_at ? asDate(row.run_authorized_at).toISOString() : null,
    createdAt: asDate(row.created_at).toISOString(),
    updatedAt: asDate(row.updated_at).toISOString(),
  };
}

function mapEventRow(row: Row): WorkflowEvent {
  return {
    id: String(row.sequence),
    eventId: String(row.event_id),
    batchId: String(row.batch_id),
    itemId: row.batch_item_id ? String(row.batch_item_id) : null,
    type: String(row.event_type),
    data: (row.data ?? {}) as Record<string, unknown>,
    createdAt: asDate(row.created_at).toISOString(),
  };
}

function mapBatchItemRow(row: Row): BatchItemDto {
  return {
    id: String(row.id),
    batchId: String(row.batch_id),
    position: Number(row.position),
    state: String(row.state) as BatchItemDto['state'],
    externalId: row.external_id ? String(row.external_id) : null,
    productGid: row.shopify_product_gid ? String(row.shopify_product_gid) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: asDate(row.created_at).toISOString(),
    updatedAt: asDate(row.updated_at).toISOString(),
  };
}

function mapAssetRow(row: Row): AssetDto {
  return {
    id: String(row.id),
    batchItemId: String(row.batch_item_id),
    kind: String(row.kind) as AssetDto['kind'],
    slot: row.slot ? String(row.slot) : null,
    role: row.role ? String(row.role) : null,
    status: String(row.status),
    storageKey: String(row.storage_key),
    rawHash: String(row.raw_hash),
    contentHash: String(row.content_hash),
    canonicalHash: row.canonical_hash ? String(row.canonical_hash) : null,
    perceptualHash: row.perceptual_hash ? String(row.perceptual_hash) : null,
    shopifyFileGid: row.shopify_file_gid ? String(row.shopify_file_gid) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: asDate(row.created_at).toISOString(),
  };
}

export interface NormalizedSourceAssetInput {
  storageKey: string;
  rawHash: string;
  contentHash: string;
  canonicalHash: string;
  perceptualHash: string;
  slot: 'SOURCE_1' | 'SOURCE_2';
  metadata: Record<string, unknown>;
}

export interface GeneratedAssetInput {
  storageKey: string;
  contentHash: string;
  canonicalHash: string;
  perceptualHash: string;
  role: 'HERO' | 'DETAIL' | 'LIFESTYLE' | 'SCALE' | 'PACKAGING';
  metadata: Record<string, unknown>;
}

export interface AuthorizedTarget {
  itemId: string;
  batchId: string;
  externalId: string;
  productGid: string | null;
  decision: 'CREATE' | 'UPDATE_OWNED' | 'BLOCKED_DUPLICATE';
}

export class BatchRepository {
  constructor(private readonly dataSource: DataSource) {}

  async ensureShop(input: { shopDomain: string; apiVersion: string }): Promise<ShopEntity> {
    const id = randomUUID();
    await this.dataSource.query(
      `INSERT INTO shops (id, shop_domain, api_version)
       VALUES ($1, $2, $3)
       ON CONFLICT (shop_domain) DO UPDATE SET api_version = EXCLUDED.api_version, updated_at = now()
       RETURNING *`,
      [id, input.shopDomain, input.apiVersion],
    );

    return this.dataSource.getRepository(ShopEntity).findOneByOrFail({
      shopDomain: input.shopDomain,
    });
  }

  async create(shopId: string, collection: CollectionSnapshot, actor = 'api'): Promise<BatchDto> {
    if (collection.compatibility !== 'ASSIGNABLE') {
      throw new RepositoryError('COLLECTION_NOT_ASSIGNABLE', 'Selected collection cannot receive products directly');
    }
    return this.dataSource.transaction(async (manager) => {
      const id = randomUUID();
      const rows = normalizeDmlRows(await manager.query(
        `INSERT INTO batches (
          id, shop_id, collection_gid, collection_title, collection_handle,
          collection_rules_hash, collection_kind, collection_compatibility
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [
          id,
          shopId,
          collection.gid,
          collection.title,
          collection.handle,
          collection.rulesHash,
          collection.kind,
          collection.compatibility,
        ],
      ));

      await appendEvent(manager, {
        batchId: id,
        type: 'BATCH_CREATED',
        actor,
        data: { collection },
      });

      return mapBatchRow(rows[0] as Row);
    });
  }

  async list(limit = 50): Promise<BatchDto[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM batches ORDER BY created_at DESC LIMIT $1`,
      [Math.max(1, Math.min(limit, 100))],
    ) as Row[];
    return rows.map(mapBatchRow);
  }

  async get(id: string): Promise<BatchDto | null> {
    const rows = await this.dataSource.query(`SELECT * FROM batches WHERE id = $1`, [id]) as Row[];
    return rows[0] ? mapBatchRow(rows[0]) : null;
  }

  async getWithItems(id: string): Promise<BatchDto | null> {
    const batch = await this.get(id);
    if (!batch) return null;
    return { ...batch, items: await this.listItems(id) };
  }

  async listItems(batchId: string): Promise<BatchItemDto[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM batch_items WHERE batch_id = $1 ORDER BY position ASC`,
      [batchId],
    ) as Row[];
    return rows.map(mapBatchItemRow);
  }

  async getItem(itemId: string): Promise<BatchItemDto | null> {
    const rows = await this.dataSource.query(`SELECT * FROM batch_items WHERE id = $1`, [itemId]) as Row[];
    return rows[0] ? mapBatchItemRow(rows[0]) : null;
  }

  async getAssets(itemId: string): Promise<AssetDto[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM assets WHERE batch_item_id = $1 ORDER BY created_at ASC`,
      [itemId],
    ) as Row[];
    return rows.map(mapAssetRow);
  }

  async addGeneratedAsset(itemId: string, asset: GeneratedAssetInput): Promise<AssetDto> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `INSERT INTO assets (
         id, batch_item_id, kind, slot, role, status, storage_key,
         raw_hash, content_hash, canonical_hash, perceptual_hash, metadata
       ) VALUES ($1,$2,'GENERATED',NULL,$3,'READY',$4,$5,$5,$6,$7,$8::jsonb)
       ON CONFLICT (batch_item_id, role, content_hash) DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [
        randomUUID(),
        itemId,
        asset.role,
        asset.storageKey,
        asset.contentHash,
        asset.canonicalHash,
        asset.perceptualHash,
        JSON.stringify(asset.metadata),
      ],
    ));
    if (!rows[0]) throw new RepositoryError('GENERATED_ASSET_SAVE_FAILED', 'Could not save generated asset');
    return mapAssetRow(rows[0]);
  }

  async authorizeLocalTarget(itemId: string, actor = 'worker'): Promise<AuthorizedTarget> {
    return this.dataSource.transaction(async (manager) => {
      const itemRows = await manager.query(
        `SELECT bi.*, b.shop_id
         FROM batch_items bi JOIN batches b ON b.id = bi.batch_id
         WHERE bi.id = $1 FOR UPDATE OF bi`,
        [itemId],
      ) as Row[];
      const item = itemRows[0];
      if (!item) throw new RepositoryError('ITEM_NOT_FOUND', 'Batch item not found');
      const externalId = String(item.external_id ?? '');
      if (!externalId) throw new RepositoryError('ITEM_EXTERNAL_ID_MISSING', 'Item has no external identity');

      const existingTarget = await manager.query(
        `SELECT * FROM batch_item_targets WHERE batch_item_id = $1`,
        [itemId],
      ) as Row[];
      if (existingTarget[0]) {
        return {
          itemId,
          batchId: String(item.batch_id),
          externalId,
          productGid: existingTarget[0].product_gid ? String(existingTarget[0].product_gid) : null,
          decision: existingTarget[0].product_gid ? 'UPDATE_OWNED' : 'CREATE',
        };
      }

      await manager.query(
        `INSERT INTO product_bindings (
           id, shop_id, external_id, state, owner_batch_item_id, source_fingerprint
         ) VALUES ($1,$2,$3,'RESERVED',$4,$3)
         ON CONFLICT (shop_id, external_id) DO NOTHING`,
        [randomUUID(), item.shop_id, externalId, itemId],
      );
      const bindingRows = await manager.query(
        `SELECT * FROM product_bindings WHERE shop_id = $1 AND external_id = $2 FOR UPDATE`,
        [item.shop_id, externalId],
      ) as Row[];
      const binding = bindingRows[0];
      if (!binding) throw new RepositoryError('PRODUCT_BINDING_FAILED', 'Could not reserve product identity');
      const productGid = binding.shopify_product_gid ? String(binding.shopify_product_gid) : null;
      if (String(binding.owner_batch_item_id) !== itemId && !productGid) {
        const blocked = normalizeDmlRows(await manager.query(
          `UPDATE batch_items
           SET state = 'BLOCKED_DUPLICATE', error_code = 'EXACT_DUPLICATE_IN_PROGRESS',
               error_message = 'An identical source pair is already reserved by another batch item',
               version = version + 1, updated_at = now()
           WHERE id = $1 AND state = 'NORMALIZED'
           RETURNING id`,
          [itemId],
        ));
        if (blocked[0]) {
          await appendEvent(manager, {
            batchId: String(item.batch_id),
            itemId,
            type: 'BATCH_ITEM_DUPLICATE_BLOCKED',
            actor,
            data: { externalId, bindingOwnerItemId: binding.owner_batch_item_id },
          });
        }
        return {
          itemId,
          batchId: String(item.batch_id),
          externalId,
          productGid: null,
          decision: 'BLOCKED_DUPLICATE',
        };
      }

      await manager.query(
        `INSERT INTO batch_item_targets (
           batch_item_id, batch_id, external_id, product_gid, ownership_snapshot_hash
         ) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (batch_item_id) DO NOTHING`,
        [itemId, item.batch_id, externalId, productGid, binding.managed_snapshot_hash ?? null],
      );
      if (String(item.state) === 'NORMALIZED') {
        assertItemTransition('NORMALIZED', 'DEDUPED');
        await manager.query(
          `UPDATE batch_items SET state = 'DEDUPED', version = version + 1, updated_at = now()
           WHERE id = $1 AND state = 'NORMALIZED'`,
          [itemId],
        );
        await appendEvent(manager, {
          batchId: String(item.batch_id),
          itemId,
          type: 'BATCH_ITEM_TARGET_AUTHORIZED',
          actor,
          data: { externalId, productGid, decision: productGid ? 'UPDATE_OWNED' : 'CREATE' },
        });
      }
      return {
        itemId,
        batchId: String(item.batch_id),
        externalId,
        productGid,
        decision: productGid ? 'UPDATE_OWNED' : 'CREATE',
      };
    });
  }

  async bindShopifyProduct(
    itemId: string,
    productGid: string,
    managedSnapshotHash: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const targets = await manager.query(
        `SELECT * FROM batch_item_targets WHERE batch_item_id = $1 FOR UPDATE`,
        [itemId],
      ) as Row[];
      const target = targets[0];
      if (!target) throw new RepositoryError('ITEM_TARGET_MISSING', 'Item has no authorized Shopify target');
      if (target.product_gid && String(target.product_gid) !== productGid) {
        throw new RepositoryError('TARGET_PRODUCT_DRIFT', 'Shopify product differs from the authorized target');
      }
      await manager.query(
        `UPDATE batch_item_targets SET product_gid = $2 WHERE batch_item_id = $1`,
        [itemId, productGid],
      );
      await manager.query(
        `UPDATE product_bindings
         SET shopify_product_gid = $2, state = 'BOUND', managed_snapshot_hash = $3, updated_at = now()
         WHERE external_id = $1
           AND shop_id = (
             SELECT b.shop_id FROM batch_items bi JOIN batches b ON b.id = bi.batch_id WHERE bi.id = $4
           )`,
        [String(target.external_id), productGid, managedSnapshotHash, itemId],
      );
      await manager.query(
        `UPDATE batch_items SET shopify_product_gid = $2, payload_hash = $3, version = version + 1, updated_at = now()
         WHERE id = $1`,
        [itemId, productGid, managedSnapshotHash],
      );
    });
  }

  async recordQaReport(input: {
    itemId: string;
    stage: string;
    passed: boolean;
    findings: readonly Record<string, unknown>[];
    snapshotHash?: string;
  }): Promise<string> {
    const id = randomUUID();
    await this.dataSource.query(
      `INSERT INTO qa_reports (id, batch_item_id, stage, passed, findings, snapshot_hash)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [id, input.itemId, input.stage, input.passed, JSON.stringify(input.findings), input.snapshotHash ?? null],
    );
    return id;
  }

  async recordProviderCall(input: {
    itemId: string;
    provider: string;
    operation: string;
    model: string;
    providerRequestId: string | null;
    inputHash: string;
    promptHash?: string | null;
    state: 'COMPLETED' | 'FAILED';
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO provider_calls (
         id, batch_item_id, provider, operation, model, provider_request_id,
         input_hash, prompt_hash, state, duration_ms, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        randomUUID(), input.itemId, input.provider, input.operation, input.model,
        input.providerRequestId, input.inputHash, input.promptHash ?? null,
        input.state, input.durationMs ?? null, JSON.stringify(input.metadata ?? {}),
      ],
    );
  }

  async recordItemError(itemId: string, code: string, message: string, actor = 'worker'): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = normalizeDmlRows(await manager.query(
        `UPDATE batch_items SET error_code = $2, error_message = $3, updated_at = now()
         WHERE id = $1 RETURNING batch_id, state`,
        [itemId, code, message.slice(0, 4_000)],
      ));
      if (!rows[0]) return;
      await appendEvent(manager, {
        batchId: String(rows[0].batch_id),
        itemId,
        type: 'BATCH_ITEM_RETRYABLE_ERROR',
        actor,
        data: { state: rows[0].state, code, message },
      });
    });
  }

  async getQaReports(itemId: string): Promise<Array<Record<string, unknown>>> {
    return this.dataSource.query(
      `SELECT id, stage, passed, findings, snapshot_hash AS "snapshotHash", created_at AS "createdAt"
       FROM qa_reports WHERE batch_item_id = $1 ORDER BY created_at ASC`,
      [itemId],
    ) as Promise<Array<Record<string, unknown>>>;
  }

  async setAssetShopifyFile(assetId: string, fileGid: string): Promise<void> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `UPDATE assets SET shopify_file_gid = $2, status = 'SHOPIFY_READY', updated_at = now()
       WHERE id = $1 AND (shopify_file_gid IS NULL OR shopify_file_gid = $2)
       RETURNING id`,
      [assetId, fileGid],
    ));
    if (!rows[0]) throw new RepositoryError('ASSET_FILE_CONFLICT', 'Asset is already bound to another Shopify file');
  }

  async holdItem(
    itemId: string,
    expectedState: ItemState,
    holdState: Extract<ItemState, 'QA_HOLD' | 'DRAFT_QA_FAILED' | 'DRAFT_CONFLICT' | 'COMPENSATION_REQUIRED'>,
    code: string,
    message: string,
    actor = 'worker',
  ): Promise<BatchItemDto> {
    return this.dataSource.transaction(async (manager) => {
      assertItemTransition(expectedState, holdState);
      const rows = normalizeDmlRows(await manager.query(
        `UPDATE batch_items
         SET state = $3, error_code = $4, error_message = $5, version = version + 1, updated_at = now()
         WHERE id = $1 AND state = $2 RETURNING *`,
        [itemId, expectedState, holdState, code, message.slice(0, 4_000)],
      ));
      if (!rows[0]) throw new RepositoryError('ITEM_CONCURRENT_MODIFICATION', 'Item changed concurrently');
      await appendEvent(manager, {
        batchId: String(rows[0].batch_id),
        itemId,
        type: 'BATCH_ITEM_HELD',
        actor,
        data: { from: expectedState, to: holdState, code, message },
      });
      return mapBatchItemRow(rows[0]);
    });
  }

  async addNormalizedItem(
    batchId: string,
    sourceAssets: readonly NormalizedSourceAssetInput[],
    maxBatchItems: number,
    actor = 'api',
  ): Promise<BatchItemDto> {
    if (sourceAssets.length !== 2 || new Set(sourceAssets.map((asset) => asset.slot)).size !== 2) {
      throw new RepositoryError('SOURCE_IMAGE_COUNT_INVALID', 'Each product item requires exactly two source images');
    }

    return this.dataSource.transaction(async (manager) => {
      const batchRows = await manager.query(
        `SELECT * FROM batches WHERE id = $1 FOR UPDATE`,
        [batchId],
      ) as Row[];
      const batch = batchRows[0];
      if (!batch) throw new RepositoryError('BATCH_NOT_FOUND', 'Batch not found');
      if (batch.state !== 'DRAFT') {
        throw new RepositoryError('BATCH_IMMUTABLE', 'Items cannot be changed after the batch is sealed');
      }

      const positionRows = await manager.query(
        `SELECT count(*)::integer AS item_count, COALESCE(max(position), -1)::integer AS max_position
         FROM batch_items WHERE batch_id = $1`,
        [batchId],
      ) as Row[];
      const itemCount = Number(positionRows[0]?.item_count ?? 0);
      if (itemCount >= maxBatchItems) {
        throw new RepositoryError('BATCH_ITEM_LIMIT_REACHED', `Batch cannot exceed ${maxBatchItems} items`);
      }

      const canonicalHashes = sourceAssets.map((asset) => asset.canonicalHash).sort();
      const externalId = sha256(stableStringify({
        shopId: String(batch.shop_id),
        canonicalHashes,
      }));
      const duplicate = await manager.query(
        `SELECT id FROM batch_items WHERE batch_id = $1 AND external_id = $2`,
        [batchId, externalId],
      ) as Row[];
      if (duplicate[0]) {
        throw new RepositoryError('DUPLICATE_SOURCE_IN_BATCH', 'The same source image pair already exists in this batch');
      }

      const itemId = randomUUID();
      const sourceManifestHash = sha256(stableStringify(
        sourceAssets.map((asset) => ({ slot: asset.slot, canonicalHash: asset.canonicalHash })),
      ));
      const position = Number(positionRows[0]?.max_position ?? -1) + 1;
      const itemRows = normalizeDmlRows(await manager.query(
        `INSERT INTO batch_items (
           id, batch_id, position, state, external_id, source_manifest_hash
         ) VALUES ($1, $2, $3, 'NORMALIZED', $4, $5)
         RETURNING *`,
        [itemId, batchId, position, externalId, sourceManifestHash],
      ));

      for (const asset of sourceAssets) {
        await manager.query(
          `INSERT INTO assets (
             id, batch_item_id, kind, slot, role, status, storage_key,
             raw_hash, content_hash, canonical_hash, perceptual_hash, metadata
           ) VALUES ($1,$2,'SOURCE',$3,$3,'READY',$4,$5,$6,$7,$8,$9::jsonb)`,
          [
            randomUUID(),
            itemId,
            asset.slot,
            asset.storageKey,
            asset.rawHash,
            asset.contentHash,
            asset.canonicalHash,
            asset.perceptualHash,
            JSON.stringify(asset.metadata),
          ],
        );
      }

      await appendEvent(manager, {
        batchId,
        itemId,
        type: 'BATCH_ITEM_NORMALIZED',
        actor,
        data: { position, externalId, sourceManifestHash },
      });
      return mapBatchItemRow(itemRows[0] as Row);
    });
  }

  async seal(batchId: string, actor = 'api'): Promise<BatchDto> {
    return this.dataSource.transaction(async (manager) => {
      const batchRows = await manager.query(
        `SELECT * FROM batches WHERE id = $1 FOR UPDATE`,
        [batchId],
      ) as Row[];
      const batch = batchRows[0];
      if (!batch) throw new RepositoryError('BATCH_NOT_FOUND', 'Batch not found');
      if (batch.state === 'SEALED') return mapBatchRow(batch);
      if (batch.state !== 'DRAFT') {
        throw new RepositoryError('BATCH_NOT_SEALABLE', `Batch in ${String(batch.state)} cannot be sealed`);
      }

      const manifestRows = await manager.query(
        `SELECT bi.id, bi.position, bi.external_id, bi.source_manifest_hash, count(a.id)::integer AS source_count
         FROM batch_items bi
         LEFT JOIN assets a ON a.batch_item_id = bi.id AND a.kind = 'SOURCE' AND a.status = 'READY'
         WHERE bi.batch_id = $1
         GROUP BY bi.id, bi.position, bi.external_id, bi.source_manifest_hash
         ORDER BY bi.position ASC`,
        [batchId],
      ) as Row[];
      if (manifestRows.length === 0) throw new RepositoryError('BATCH_EMPTY', 'Add at least one product before running');
      if (manifestRows.some((row) => Number(row.source_count) !== 2)) {
        throw new RepositoryError('SOURCE_IMAGE_COUNT_INVALID', 'Every product must have exactly two valid source images');
      }

      assertBatchTransition('DRAFT', 'SEALED');
      const sourceManifestHash = sha256(stableStringify(manifestRows.map((row) => ({
        itemId: String(row.id),
        position: Number(row.position),
        externalId: String(row.external_id),
        sourceManifestHash: String(row.source_manifest_hash),
      }))));
      const updated = normalizeDmlRows(await manager.query(
        `UPDATE batches
         SET state = 'SEALED', source_manifest_hash = $2, sealed_at = now(), version = version + 1, updated_at = now()
         WHERE id = $1 AND state = 'DRAFT'
         RETURNING *`,
        [batchId, sourceManifestHash],
      ));
      if (!updated[0]) throw new RepositoryError('BATCH_CONCURRENT_MODIFICATION', 'Batch changed concurrently');

      await appendEvent(manager, {
        batchId,
        type: 'BATCH_SEALED',
        actor,
        data: { sourceManifestHash, itemCount: manifestRows.length },
      });
      return mapBatchRow(updated[0]);
    });
  }

  async advanceItemState(
    itemId: string,
    expectedState: ItemState,
    nextState: ItemState,
    actor = 'worker',
  ): Promise<BatchItemDto> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.query(
        `SELECT * FROM batch_items WHERE id = $1 FOR UPDATE`,
        [itemId],
      ) as Row[];
      const row = locked[0];
      if (!row) throw new RepositoryError('ITEM_NOT_FOUND', 'Batch item not found');
      const current = String(row.state) as ItemState;
      if (current === nextState) return mapBatchItemRow(row);
      if (current !== expectedState) {
        throw new RepositoryError('ITEM_CONCURRENT_MODIFICATION', `Expected ${expectedState}, found ${current}`);
      }
      assertItemTransition(current, nextState);

      const updated = normalizeDmlRows(await manager.query(
        `UPDATE batch_items
         SET state = $3, version = version + 1, updated_at = now(), error_code = NULL, error_message = NULL
         WHERE id = $1 AND state = $2
         RETURNING *`,
        [itemId, expectedState, nextState],
      ));
      if (!updated[0]) throw new RepositoryError('ITEM_CONCURRENT_MODIFICATION', 'Item changed concurrently');
      await appendEvent(manager, {
        batchId: String(row.batch_id),
        itemId,
        type: 'BATCH_ITEM_STATE_CHANGED',
        actor,
        data: { from: current, to: nextState },
      });
      return mapBatchItemRow(updated[0]);
    });
  }

  async authorizeRun(
    batchId: string,
    runMode: 'off' | 'draft' | 'publish',
    pipelineVersion: string,
    actor = 'api',
  ): Promise<BatchDto> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.query(`SELECT * FROM batches WHERE id = $1 FOR UPDATE`, [batchId]) as Row[];
      const row = locked[0];
      if (!row) throw new RepositoryError('BATCH_NOT_FOUND', 'Batch not found');

      const current = String(row.state) as BatchState;
      if (['RUNNING', 'COMPLETED', 'PARTIAL_SUCCESS'].includes(current)) return mapBatchRow(row);
      if (current !== 'SEALED') {
        throw new RepositoryError('BATCH_NOT_RUNNABLE', `Batch in ${current} cannot run`);
      }

      assertBatchTransition('SEALED', 'RUNNING');

      const rows = normalizeDmlRows(await manager.query(
        `UPDATE batches
         SET state = 'RUNNING', sealed_at = COALESCE(sealed_at, now()),
             run_authorized_at = COALESCE(run_authorized_at, now()),
             version = version + 1, updated_at = now()
         WHERE id = $1 AND state = 'SEALED'
         RETURNING *`,
        [batchId],
      ));
      if (!rows[0]) throw new RepositoryError('BATCH_CONCURRENT_MODIFICATION', 'Batch changed concurrently');

      await enqueueWithManager(manager, {
        jobType: 'process-batch',
        idempotencyKey: `process-batch:${batchId}:${pipelineVersion}:${runMode}`,
        payload: { batchId, runMode, pipelineVersion },
      });
      await appendEvent(manager, {
        batchId,
        type: 'BATCH_RUN_AUTHORIZED',
        actor,
        data: { runMode, pipelineVersion },
      });
      return mapBatchRow(rows[0]);
    });
  }

  async authorizeMockRun(batchId: string, actor = 'api'): Promise<BatchDto> {
    return this.authorizeRun(batchId, 'off', 'foundation-v1', actor);
  }

  async resumeRun(
    batchId: string,
    runMode: 'off' | 'draft' | 'publish',
    pipelineVersion: string,
    actor = 'api',
  ): Promise<BatchDto> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM batches WHERE id = $1 FOR UPDATE`, [batchId]) as Row[];
      const batch = rows[0];
      if (!batch) throw new RepositoryError('BATCH_NOT_FOUND', 'Batch not found');
      if (String(batch.state) !== 'RUNNING') {
        throw new RepositoryError('BATCH_NOT_RESUMABLE', 'Only a RUNNING batch can be resumed');
      }
      const resumeId = randomUUID();
      await enqueueWithManager(manager, {
        jobType: 'process-batch',
        idempotencyKey: `process-batch:${batchId}:${pipelineVersion}:${runMode}:resume:${resumeId}`,
        payload: { batchId, runMode, pipelineVersion },
      });
      await appendEvent(manager, {
        batchId,
        type: 'BATCH_RESUME_REQUESTED',
        actor,
        data: { runMode, pipelineVersion, resumeId },
      });
      return mapBatchRow(batch);
    });
  }

  async cancel(batchId: string, actor = 'api'): Promise<BatchDto> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM batches WHERE id = $1 FOR UPDATE`, [batchId]) as Row[];
      const batch = rows[0];
      if (!batch) throw new RepositoryError('BATCH_NOT_FOUND', 'Batch not found');
      const current = String(batch.state) as BatchState;
      if (current === 'CANCELLED') return mapBatchRow(batch);
      if (!['DRAFT', 'SEALED', 'RUNNING'].includes(current)) {
        throw new RepositoryError('BATCH_NOT_CANCELLABLE', `Batch in ${current} cannot be cancelled`);
      }
      assertBatchTransition(current, 'CANCELLED');
      const updated = normalizeDmlRows(await manager.query(
        `UPDATE batches SET state = 'CANCELLED', cancel_requested_at = now(), version = version + 1, updated_at = now()
         WHERE id = $1 AND state = $2 RETURNING *`,
        [batchId, current],
      ));
      if (!updated[0]) throw new RepositoryError('BATCH_CONCURRENT_MODIFICATION', 'Batch changed concurrently');
      await manager.query(
        `UPDATE jobs SET state = 'CANCELLED', updated_at = now()
         WHERE state = 'PENDING' AND payload->>'batchId' = $1`,
        [batchId],
      );
      await appendEvent(manager, { batchId, type: 'BATCH_CANCELLED', actor, data: { from: current } });
      return mapBatchRow(updated[0]);
    });
  }

  async isCancelled(batchId: string): Promise<boolean> {
    const rows = await this.dataSource.query(`SELECT state FROM batches WHERE id = $1`, [batchId]) as Row[];
    return String(rows[0]?.state ?? '') === 'CANCELLED';
  }

  async completeMockRun(batchId: string, actor = 'worker'): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const unfinished = await manager.query(
        `SELECT id FROM batch_items WHERE batch_id = $1 AND state <> 'FILES_READY' LIMIT 1`,
        [batchId],
      ) as Row[];
      if (unfinished[0]) return false;
      const rows = normalizeDmlRows(await manager.query(
        `UPDATE batches SET state = 'COMPLETED', version = version + 1, updated_at = now()
         WHERE id = $1 AND state = 'RUNNING'
         RETURNING id`,
        [batchId],
      ));
      if (!rows[0]) return false;
      await appendEvent(manager, {
        batchId,
        type: 'BATCH_COMPLETED',
        actor,
        data: { mode: 'mock' },
      });
      return true;
    });
  }

  async finalizeRun(
    batchId: string,
    successState: Extract<ItemState, 'FILES_READY' | 'DRAFT_SYNCED' | 'SHOPIFY_QA_PASSED' | 'PUBLISHED'>,
    actor = 'worker',
  ): Promise<BatchState | null> {
    return this.dataSource.transaction(async (manager) => {
      const batchRows = await manager.query(`SELECT * FROM batches WHERE id = $1 FOR UPDATE`, [batchId]) as Row[];
      const batch = batchRows[0];
      if (!batch || String(batch.state) !== 'RUNNING') return null;
      const counts = await manager.query(
        `SELECT
           count(*)::integer AS total,
           count(*) FILTER (WHERE state = $2)::integer AS succeeded,
           count(*) FILTER (WHERE state IN (
             'BLOCKED_DUPLICATE','QA_HOLD','DRAFT_QA_FAILED','DRAFT_CONFLICT','FAILED_FINAL','COMPENSATION_REQUIRED'
           ))::integer AS failed
         FROM batch_items WHERE batch_id = $1`,
        [batchId, successState],
      ) as Row[];
      const total = Number(counts[0]?.total ?? 0);
      const succeeded = Number(counts[0]?.succeeded ?? 0);
      const failed = Number(counts[0]?.failed ?? 0);
      if (total === 0 || succeeded + failed !== total) return null;
      const nextState: BatchState = succeeded === total
        ? 'COMPLETED'
        : succeeded > 0
          ? 'PARTIAL_SUCCESS'
          : 'FAILED';
      assertBatchTransition('RUNNING', nextState);
      await manager.query(
        `UPDATE batches SET state = $2, version = version + 1, updated_at = now()
         WHERE id = $1 AND state = 'RUNNING'`,
        [batchId, nextState],
      );
      await appendEvent(manager, {
        batchId,
        type: `BATCH_${nextState}`,
        actor,
        data: { successState, total, succeeded, failed },
      });
      return nextState;
    });
  }
}

export interface CheckpointRecord {
  id: string;
  batchItemId: string;
  stage: string;
  inputHash: string;
  pipelineVersion: string;
  state: 'STARTED' | 'COMPLETED' | 'FAILED';
  attempt: number;
  output: Record<string, unknown> | null;
}

function mapCheckpointRow(row: Row): CheckpointRecord {
  return {
    id: String(row.id),
    batchItemId: String(row.batch_item_id),
    stage: String(row.stage),
    inputHash: String(row.input_hash),
    pipelineVersion: String(row.pipeline_version),
    state: String(row.state) as CheckpointRecord['state'],
    attempt: Number(row.attempt),
    output: row.output_json ? row.output_json as Record<string, unknown> : null,
  };
}

export class CheckpointRepository {
  constructor(private readonly dataSource: DataSource) {}

  async begin(input: {
    batchItemId: string;
    stage: string;
    inputHash: string;
    pipelineVersion: string;
  }): Promise<CheckpointRecord> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `INSERT INTO checkpoints (
         id, batch_item_id, stage, input_hash, pipeline_version, state, attempt
       ) VALUES ($1,$2,$3,$4,$5,'STARTED',1)
       ON CONFLICT (batch_item_id, stage, input_hash, pipeline_version) DO UPDATE
       SET state = CASE WHEN checkpoints.state = 'COMPLETED' THEN 'COMPLETED' ELSE 'STARTED' END,
           attempt = CASE WHEN checkpoints.state = 'COMPLETED' THEN checkpoints.attempt ELSE checkpoints.attempt + 1 END,
           error_code = CASE WHEN checkpoints.state = 'COMPLETED' THEN checkpoints.error_code ELSE NULL END,
           updated_at = now()
       RETURNING *`,
      [randomUUID(), input.batchItemId, input.stage, input.inputHash, input.pipelineVersion],
    ));
    if (!rows[0]) throw new RepositoryError('CHECKPOINT_BEGIN_FAILED', 'Could not start checkpoint');
    return mapCheckpointRow(rows[0]);
  }

  async complete(
    checkpoint: CheckpointRecord,
    output: Record<string, unknown>,
  ): Promise<CheckpointRecord> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `UPDATE checkpoints
       SET state = 'COMPLETED', output_json = $2::jsonb, error_code = NULL, updated_at = now()
       WHERE id = $1 AND state = 'STARTED'
       RETURNING *`,
      [checkpoint.id, JSON.stringify(output)],
    ));
    if (!rows[0]) {
      const existing = await this.get(checkpoint.batchItemId, checkpoint.stage, checkpoint.inputHash, checkpoint.pipelineVersion);
      if (existing?.state === 'COMPLETED') return existing;
      throw new RepositoryError('CHECKPOINT_CONCURRENT_MODIFICATION', 'Checkpoint changed concurrently');
    }
    return mapCheckpointRow(rows[0]);
  }

  async fail(checkpoint: CheckpointRecord, errorCode: string): Promise<boolean> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `UPDATE checkpoints SET state = 'FAILED', error_code = $2, updated_at = now()
       WHERE id = $1 AND state = 'STARTED'
       RETURNING id`,
      [checkpoint.id, errorCode],
    ));
    return Boolean(rows[0]);
  }

  async get(
    batchItemId: string,
    stage: string,
    inputHash: string,
    pipelineVersion: string,
  ): Promise<CheckpointRecord | null> {
    const rows = await this.dataSource.query(
      `SELECT * FROM checkpoints
       WHERE batch_item_id = $1 AND stage = $2 AND input_hash = $3 AND pipeline_version = $4`,
      [batchItemId, stage, inputHash, pipelineVersion],
    ) as Row[];
    return rows[0] ? mapCheckpointRow(rows[0]) : null;
  }
}

export class EventRepository {
  constructor(private readonly dataSource: DataSource) {}

  async list(batchId: string, afterSequence = '0', limit = 100): Promise<WorkflowEvent[]> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `SELECT * FROM audit_events
       WHERE batch_id = $1 AND sequence > $2::bigint
       ORDER BY sequence ASC LIMIT $3`,
      [batchId, afterSequence, Math.max(1, Math.min(limit, 500))],
    ));
    return rows.map(mapEventRow);
  }
}

export interface EnqueueJobInput {
  jobType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
}

export interface ClaimedJob {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  leaseUntil: Date;
}

export class JobQueueRepository {
  constructor(private readonly dataSource: DataSource) {}

  async enqueue(input: EnqueueJobInput): Promise<string> {
    return enqueueWithManager(this.dataSource.manager, input);
  }

  async claim(workerId: string, leaseSeconds = 120): Promise<ClaimedJob | null> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `WITH candidate AS (
         SELECT id FROM jobs
         WHERE attempts < max_attempts
           AND run_at <= now()
           AND (state = 'PENDING' OR (state = 'RUNNING' AND lease_until < now()))
         ORDER BY priority DESC, run_at ASC, created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE jobs j
       SET state = 'RUNNING', attempts = attempts + 1, lease_owner = $1,
           lease_until = now() + ($2 * interval '1 second'), heartbeat_at = now(), updated_at = now()
       FROM candidate
       WHERE j.id = candidate.id
       RETURNING j.*`,
      [workerId, leaseSeconds],
    ));
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      jobType: String(row.job_type),
      payload: row.payload as Record<string, unknown>,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      leaseUntil: asDate(row.lease_until),
    };
  }

  async heartbeat(jobId: string, workerId: string, leaseSeconds = 120): Promise<boolean> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `UPDATE jobs SET heartbeat_at = now(), lease_until = now() + ($3 * interval '1 second'), updated_at = now()
       WHERE id = $1 AND state = 'RUNNING' AND lease_owner = $2
       RETURNING id`,
      [jobId, workerId, leaseSeconds],
    ));
    return Boolean(rows[0]);
  }

  async complete(jobId: string, workerId: string): Promise<boolean> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `UPDATE jobs SET state = 'COMPLETED', lease_owner = NULL, lease_until = NULL, heartbeat_at = NULL, updated_at = now()
       WHERE id = $1 AND state = 'RUNNING' AND lease_owner = $2
       RETURNING id`,
      [jobId, workerId],
    ));
    return Boolean(rows[0]);
  }

  async fail(job: ClaimedJob, workerId: string, error: string, retryDelayMs = 1_000): Promise<boolean> {
    const retryable = job.attempts < job.maxAttempts;
    const rows = normalizeDmlRows(await this.dataSource.query(
      `UPDATE jobs
       SET state = $3, lease_owner = NULL, lease_until = NULL, heartbeat_at = NULL,
           run_at = CASE WHEN $3 = 'PENDING' THEN now() + ($4 * interval '1 millisecond') ELSE run_at END,
           last_error = $5, updated_at = now()
       WHERE id = $1 AND state = 'RUNNING' AND lease_owner = $2
       RETURNING id`,
      [job.id, workerId, retryable ? 'PENDING' : 'FAILED', retryDelayMs, error.slice(0, 4_000)],
    ));
    return Boolean(rows[0]);
  }
}

export interface ResourceLease {
  resourceType: string;
  resourceId: string;
  leaseOwner: string;
  fencingToken: string;
  leasedUntil: Date;
}

export class ResourceLeaseRepository {
  constructor(private readonly dataSource: DataSource) {}

  async acquire(input: {
    resourceType: string;
    resourceId: string;
    leaseOwner: string;
    leaseSeconds?: number;
  }): Promise<ResourceLease | null> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `INSERT INTO resource_leases (
         resource_type, resource_id, lease_owner, fencing_token, leased_until, heartbeat_at
       ) VALUES ($1, $2, $3, 1, now() + ($4 * interval '1 second'), now())
       ON CONFLICT (resource_type, resource_id) DO UPDATE
       SET lease_owner = EXCLUDED.lease_owner,
           fencing_token = resource_leases.fencing_token + 1,
           leased_until = EXCLUDED.leased_until,
           heartbeat_at = now(),
           version = resource_leases.version + 1
       WHERE resource_leases.leased_until < now() OR resource_leases.lease_owner = EXCLUDED.lease_owner
       RETURNING *`,
      [input.resourceType, input.resourceId, input.leaseOwner, input.leaseSeconds ?? 120],
    ));
    const row = rows[0];
    if (!row) return null;
    return {
      resourceType: String(row.resource_type),
      resourceId: String(row.resource_id),
      leaseOwner: String(row.lease_owner),
      fencingToken: String(row.fencing_token),
      leasedUntil: asDate(row.leased_until),
    };
  }

  async release(lease: ResourceLease): Promise<boolean> {
    const rows = normalizeDmlRows(await this.dataSource.query(
      `DELETE FROM resource_leases
       WHERE resource_type = $1 AND resource_id = $2 AND lease_owner = $3 AND fencing_token = $4::bigint
       RETURNING resource_id`,
      [lease.resourceType, lease.resourceId, lease.leaseOwner, lease.fencingToken],
    ));
    return Boolean(rows[0]);
  }
}

async function enqueueWithManager(manager: EntityManager, input: EnqueueJobInput): Promise<string> {
  const id = randomUUID();
  const rows = normalizeDmlRows(await manager.query(
    `INSERT INTO jobs (id, job_type, idempotency_key, payload, priority, run_at, max_attempts)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
     ON CONFLICT (job_type, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
     RETURNING id`,
    [
      id,
      input.jobType,
      input.idempotencyKey,
      JSON.stringify(input.payload),
      input.priority ?? 0,
      input.runAt ?? new Date(),
      input.maxAttempts ?? 5,
    ],
  ));
  return String(rows[0]?.id);
}

async function appendEvent(
  manager: EntityManager,
  input: {
    batchId: string;
    itemId?: string;
    type: string;
    actor: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await manager.query(
    `INSERT INTO audit_events (
       event_id, batch_id, batch_item_id, event_type, actor, data
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      randomUUID(),
      input.batchId,
      input.itemId ?? null,
      input.type,
      input.actor,
      JSON.stringify(input.data ?? {}),
    ],
  );
}

export class RepositoryError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}
