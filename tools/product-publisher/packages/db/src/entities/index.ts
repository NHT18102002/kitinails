import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import type { BatchState, CheckpointState, ItemState, JobState } from '@ersa/product-publisher-contracts';

@Entity({ name: 'shops' })
export class ShopEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ name: 'shop_domain', type: 'varchar', length: 255 }) shopDomain!: string;
  @Index({ unique: true }) @Column({ name: 'shop_gid', type: 'varchar', length: 255, nullable: true }) shopGid!: string | null;
  @Column({ name: 'primary_locale', type: 'varchar', length: 16, default: 'en' }) primaryLocale!: string;
  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'USD' }) currencyCode!: string;
  @Column({ name: 'api_version', type: 'varchar', length: 16, default: '2026-07' }) apiVersion!: string;
  @Column({ name: 'online_store_publication_gid', type: 'varchar', length: 255, nullable: true }) onlineStorePublicationGid!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'batches' })
export class BatchEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index() @Column({ name: 'shop_id', type: 'uuid' }) shopId!: string;
  @Column({ name: 'collection_gid', type: 'varchar', length: 255 }) collectionGid!: string;
  @Column({ name: 'collection_title', type: 'varchar', length: 255 }) collectionTitle!: string;
  @Column({ name: 'collection_handle', type: 'varchar', length: 255 }) collectionHandle!: string;
  @Column({ name: 'collection_rules_hash', type: 'varchar', length: 128 }) collectionRulesHash!: string;
  @Column({ name: 'collection_kind', type: 'varchar', length: 32 }) collectionKind!: string;
  @Column({ name: 'collection_compatibility', type: 'varchar', length: 32 }) collectionCompatibility!: string;
  @Index() @Column({ type: 'varchar', length: 32, default: 'DRAFT' }) state!: BatchState;
  @VersionColumn({ type: 'integer', default: 1 }) version!: number;
  @Column({ name: 'source_manifest_hash', type: 'varchar', length: 64, nullable: true }) sourceManifestHash!: string | null;
  @Column({ name: 'sealed_at', type: 'timestamptz', nullable: true }) sealedAt!: Date | null;
  @Column({ name: 'run_authorized_at', type: 'timestamptz', nullable: true }) runAuthorizedAt!: Date | null;
  @Column({ name: 'cancel_requested_at', type: 'timestamptz', nullable: true }) cancelRequestedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'batch_items' })
@Index(['batchId', 'position'], { unique: true })
@Index(['batchId', 'externalId'], { unique: true })
export class BatchItemEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index() @Column({ name: 'batch_id', type: 'uuid' }) batchId!: string;
  @Column({ type: 'integer' }) position!: number;
  @Index() @Column({ type: 'varchar', length: 48, default: 'RECEIVED' }) state!: ItemState;
  @VersionColumn({ type: 'integer', default: 1 }) version!: number;
  @Index() @Column({ name: 'external_id', type: 'varchar', length: 96, nullable: true }) externalId!: string | null;
  @Column({ name: 'shopify_product_gid', type: 'varchar', length: 255, nullable: true }) shopifyProductGid!: string | null;
  @Column({ name: 'source_manifest_hash', type: 'varchar', length: 64, nullable: true }) sourceManifestHash!: string | null;
  @Column({ name: 'payload_hash', type: 'varchar', length: 64, nullable: true }) payloadHash!: string | null;
  @Column({ name: 'error_code', type: 'varchar', length: 96, nullable: true }) errorCode!: string | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'assets' })
@Index(['batchItemId', 'role', 'contentHash'], { unique: true })
export class AssetEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index() @Column({ name: 'batch_item_id', type: 'uuid' }) batchItemId!: string;
  @Column({ type: 'varchar', length: 24 }) kind!: string;
  @Column({ type: 'varchar', length: 24, nullable: true }) slot!: string | null;
  @Column({ type: 'varchar', length: 48, nullable: true }) role!: string | null;
  @Index() @Column({ type: 'varchar', length: 32 }) status!: string;
  @Column({ name: 'storage_key', type: 'text' }) storageKey!: string;
  @Column({ name: 'raw_hash', type: 'varchar', length: 64 }) rawHash!: string;
  @Column({ name: 'content_hash', type: 'varchar', length: 64 }) contentHash!: string;
  @Column({ name: 'canonical_hash', type: 'varchar', length: 64, nullable: true }) canonicalHash!: string | null;
  @Column({ name: 'perceptual_hash', type: 'varchar', length: 64, nullable: true }) perceptualHash!: string | null;
  @Column({ name: 'shopify_file_gid', type: 'varchar', length: 255, nullable: true }) shopifyFileGid!: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata!: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'product_bindings' })
@Index(['shopId', 'externalId'], { unique: true })
export class ProductBindingEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'shop_id', type: 'uuid' }) shopId!: string;
  @Column({ name: 'external_id', type: 'varchar', length: 96 }) externalId!: string;
  @Index({ unique: true }) @Column({ name: 'shopify_product_gid', type: 'varchar', length: 255, nullable: true }) shopifyProductGid!: string | null;
  @Column({ type: 'varchar', length: 24 }) state!: string;
  @Column({ name: 'owner_batch_item_id', type: 'uuid' }) ownerBatchItemId!: string;
  @Column({ name: 'source_fingerprint', type: 'varchar', length: 64 }) sourceFingerprint!: string;
  @Column({ name: 'managed_snapshot_hash', type: 'varchar', length: 64, nullable: true }) managedSnapshotHash!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'checkpoints' })
@Index(['batchItemId', 'stage', 'inputHash', 'pipelineVersion'], { unique: true })
export class CheckpointEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index() @Column({ name: 'batch_item_id', type: 'uuid' }) batchItemId!: string;
  @Column({ type: 'varchar', length: 64 }) stage!: string;
  @Column({ name: 'input_hash', type: 'varchar', length: 64 }) inputHash!: string;
  @Column({ name: 'pipeline_version', type: 'varchar', length: 64 }) pipelineVersion!: string;
  @Column({ type: 'varchar', length: 16 }) state!: CheckpointState;
  @Column({ type: 'integer', default: 1 }) attempt!: number;
  @Column({ name: 'output_json', type: 'jsonb', nullable: true }) outputJson!: Record<string, unknown> | null;
  @Column({ name: 'error_code', type: 'varchar', length: 96, nullable: true }) errorCode!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'jobs' })
@Index(['jobType', 'idempotencyKey'], { unique: true })
export class JobEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'job_type', type: 'varchar', length: 64 }) jobType!: string;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 }) idempotencyKey!: string;
  @Index() @Column({ type: 'varchar', length: 16, default: 'PENDING' }) state!: JobState;
  @Column({ type: 'jsonb' }) payload!: Record<string, unknown>;
  @Column({ type: 'integer', default: 0 }) priority!: number;
  @Index() @Column({ name: 'run_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) runAt!: Date;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ name: 'max_attempts', type: 'integer', default: 5 }) maxAttempts!: number;
  @Column({ name: 'lease_owner', type: 'varchar', length: 128, nullable: true }) leaseOwner!: string | null;
  @Index() @Column({ name: 'lease_until', type: 'timestamptz', nullable: true }) leaseUntil!: Date | null;
  @Column({ name: 'heartbeat_at', type: 'timestamptz', nullable: true }) heartbeatAt!: Date | null;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'qa_reports' })
export class QaReportEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index() @Column({ name: 'batch_item_id', type: 'uuid' }) batchItemId!: string;
  @Column({ type: 'varchar', length: 64 }) stage!: string;
  @Column({ type: 'boolean' }) passed!: boolean;
  @Column({ type: 'jsonb' }) findings!: Record<string, unknown>[];
  @Column({ name: 'snapshot_hash', type: 'varchar', length: 64, nullable: true }) snapshotHash!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ name: 'provider_calls' })
export class ProviderCallEntity {
  @PrimaryColumn('uuid') id!: string;
  @Index() @Column({ name: 'batch_item_id', type: 'uuid', nullable: true }) batchItemId!: string | null;
  @Column({ type: 'varchar', length: 32 }) provider!: string;
  @Column({ type: 'varchar', length: 64 }) operation!: string;
  @Column({ type: 'varchar', length: 128, nullable: true }) model!: string | null;
  @Column({ name: 'provider_request_id', type: 'varchar', length: 255, nullable: true }) providerRequestId!: string | null;
  @Column({ name: 'input_hash', type: 'varchar', length: 64 }) inputHash!: string;
  @Column({ name: 'prompt_hash', type: 'varchar', length: 64, nullable: true }) promptHash!: string | null;
  @Column({ type: 'varchar', length: 24 }) state!: string;
  @Column({ type: 'integer', default: 1 }) attempt!: number;
  @Column({ name: 'duration_ms', type: 'integer', nullable: true }) durationMs!: number | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata!: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'audit_events' })
export class AuditEventEntity {
  @PrimaryGeneratedColumn({ name: 'sequence', type: 'bigint' }) sequence!: string;
  @Index({ unique: true }) @Column({ name: 'event_id', type: 'uuid' }) eventId!: string;
  @Index() @Column({ name: 'batch_id', type: 'uuid' }) batchId!: string;
  @Index() @Column({ name: 'batch_item_id', type: 'uuid', nullable: true }) batchItemId!: string | null;
  @Column({ name: 'event_type', type: 'varchar', length: 96 }) eventType!: string;
  @Column({ type: 'varchar', length: 64 }) actor!: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) data!: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ name: 'resource_leases' })
export class ResourceLeaseEntity {
  @PrimaryColumn({ name: 'resource_type', type: 'varchar', length: 32 }) resourceType!: string;
  @PrimaryColumn({ name: 'resource_id', type: 'varchar', length: 255 }) resourceId!: string;
  @Column({ name: 'lease_owner', type: 'varchar', length: 128 }) leaseOwner!: string;
  @Column({ name: 'fencing_token', type: 'bigint', default: 1 }) fencingToken!: string;
  @Index() @Column({ name: 'leased_until', type: 'timestamptz' }) leasedUntil!: Date;
  @Column({ name: 'heartbeat_at', type: 'timestamptz' }) heartbeatAt!: Date;
  @VersionColumn({ type: 'integer', default: 1 }) version!: number;
}

@Entity({ name: 'remote_product_fingerprints' })
@Index(['shopId', 'productGid', 'mediaGid'], { unique: true })
export class RemoteProductFingerprintEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'shop_id', type: 'uuid' }) shopId!: string;
  @Column({ name: 'product_gid', type: 'varchar', length: 255 }) productGid!: string;
  @Column({ name: 'media_gid', type: 'varchar', length: 255 }) mediaGid!: string;
  @Column({ name: 'product_updated_at', type: 'timestamptz' }) productUpdatedAt!: Date;
  @Column({ name: 'perceptual_hash', type: 'varchar', length: 64 }) perceptualHash!: string;
  @Column({ name: 'ownership_class', type: 'varchar', length: 24 }) ownershipClass!: string;
  @CreateDateColumn({ name: 'indexed_at', type: 'timestamptz' }) indexedAt!: Date;
}

@Entity({ name: 'batch_item_targets' })
export class BatchItemTargetEntity {
  @PrimaryColumn({ name: 'batch_item_id', type: 'uuid' }) batchItemId!: string;
  @Index() @Column({ name: 'batch_id', type: 'uuid' }) batchId!: string;
  @Column({ name: 'external_id', type: 'varchar', length: 96 }) externalId!: string;
  @Column({ name: 'product_gid', type: 'varchar', length: 255, nullable: true }) productGid!: string | null;
  @Column({ name: 'ownership_snapshot_hash', type: 'varchar', length: 64, nullable: true }) ownershipSnapshotHash!: string | null;
  @CreateDateColumn({ name: 'authorized_at', type: 'timestamptz' }) authorizedAt!: Date;
}

export const entities = [
  ShopEntity,
  BatchEntity,
  BatchItemEntity,
  AssetEntity,
  ProductBindingEntity,
  CheckpointEntity,
  JobEntity,
  QaReportEntity,
  ProviderCallEntity,
  AuditEventEntity,
  ResourceLeaseEntity,
  RemoteProductFingerprintEntity,
  BatchItemTargetEntity,
] as const;
