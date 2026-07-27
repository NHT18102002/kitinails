import { z } from 'zod';

export const batchStates = [
  'DRAFT',
  'SEALED',
  'RUNNING',
  'PARTIAL_SUCCESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export const itemStates = [
  'RECEIVED',
  'NORMALIZED',
  'DEDUPED',
  'ANALYZED',
  'GENERATED',
  'LOCAL_QA_PASSED',
  'FILES_READY',
  'DRAFT_SYNCED',
  'SHOPIFY_QA_PASSED',
  'PUBLISHING',
  'PUBLISHED',
  'BLOCKED_DUPLICATE',
  'QA_HOLD',
  'DRAFT_QA_FAILED',
  'DRAFT_CONFLICT',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'COMPENSATION_REQUIRED',
] as const;

export const jobStates = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export const checkpointStates = ['STARTED', 'COMPLETED', 'FAILED'] as const;

export const BatchStateSchema = z.enum(batchStates);
export const ItemStateSchema = z.enum(itemStates);
export const JobStateSchema = z.enum(jobStates);
export const CheckpointStateSchema = z.enum(checkpointStates);

export type BatchState = z.infer<typeof BatchStateSchema>;
export type ItemState = z.infer<typeof ItemStateSchema>;
export type JobState = z.infer<typeof JobStateSchema>;
export type CheckpointState = z.infer<typeof CheckpointStateSchema>;

export const CollectionSnapshotSchema = z
  .object({
    gid: z.string().min(1),
    title: z.string().min(1).max(255),
    handle: z.string().min(1).max(255),
    rulesHash: z.string().min(1).max(128),
    kind: z.enum(['MANUAL', 'AUTOMATED', 'VIRTUAL']),
    compatibility: z.enum(['ASSIGNABLE', 'BLOCKED_CAMPAIGN', 'UNSUPPORTED_RULE']),
  })
  .strict();

export const CreateBatchInputSchema = z
  .object({
    collection: CollectionSnapshotSchema,
  })
  .strict();

export type CollectionSnapshot = z.infer<typeof CollectionSnapshotSchema>;
export type CreateBatchInput = z.infer<typeof CreateBatchInputSchema>;

export const BatchItemSchema = z
  .object({
    id: z.string().uuid(),
    batchId: z.string().uuid(),
    position: z.number().int().nonnegative(),
    state: ItemStateSchema,
    externalId: z.string().nullable(),
    productGid: z.string().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const BatchSchema = z
  .object({
    id: z.string().uuid(),
    shopId: z.string().uuid(),
    collection: CollectionSnapshotSchema,
    state: BatchStateSchema,
    version: z.number().int().nonnegative(),
    sealedAt: z.string().datetime().nullable(),
    runAuthorizedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    items: z.array(BatchItemSchema).optional(),
  })
  .strict();

export type BatchDto = z.infer<typeof BatchSchema>;
export type BatchItemDto = z.infer<typeof BatchItemSchema>;

export const AssetSchema = z
  .object({
    id: z.string().uuid(),
    batchItemId: z.string().uuid(),
    kind: z.enum(['SOURCE', 'GENERATED']),
    slot: z.string().nullable(),
    role: z.string().nullable(),
    status: z.string(),
    storageKey: z.string(),
    rawHash: z.string().length(64),
    contentHash: z.string().length(64),
    canonicalHash: z.string().length(64).nullable(),
    perceptualHash: z.string().nullable(),
    shopifyFileGid: z.string().nullable(),
    metadata: z.record(z.unknown()),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AssetDto = z.infer<typeof AssetSchema>;

export const ApiErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  })
  .strict();

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const WorkflowEventSchema = z
  .object({
    id: z.string(),
    eventId: z.string().uuid(),
    batchId: z.string().uuid(),
    itemId: z.string().uuid().nullable(),
    type: z.string().min(1),
    data: z.record(z.unknown()),
    createdAt: z.string().datetime(),
  })
  .strict();

export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

export const HealthResponseSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    service: z.string(),
    database: z.enum(['up', 'down', 'not_checked']),
    release: z.string(),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
