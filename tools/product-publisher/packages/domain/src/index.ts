import { createHash } from 'node:crypto';
import type { BatchState, ItemState } from '@ersa/product-publisher-contracts';

const batchTransitions: Readonly<Record<BatchState, readonly BatchState[]>> = {
  DRAFT: ['SEALED', 'CANCELLED'],
  SEALED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['PARTIAL_SUCCESS', 'COMPLETED', 'FAILED', 'CANCELLED'],
  PARTIAL_SUCCESS: [],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

const itemTransitions: Readonly<Record<ItemState, readonly ItemState[]>> = {
  RECEIVED: ['NORMALIZED', 'FAILED_FINAL'],
  NORMALIZED: ['DEDUPED', 'BLOCKED_DUPLICATE', 'QA_HOLD', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  DEDUPED: ['ANALYZED', 'QA_HOLD', 'DRAFT_CONFLICT', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  ANALYZED: ['GENERATED', 'QA_HOLD', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  GENERATED: ['LOCAL_QA_PASSED', 'QA_HOLD', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  LOCAL_QA_PASSED: ['FILES_READY', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  FILES_READY: ['DRAFT_SYNCED', 'DRAFT_CONFLICT', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  DRAFT_SYNCED: ['SHOPIFY_QA_PASSED', 'DRAFT_QA_FAILED', 'DRAFT_CONFLICT', 'FAILED_RETRYABLE'],
  SHOPIFY_QA_PASSED: ['PUBLISHING', 'DRAFT_CONFLICT'],
  PUBLISHING: ['PUBLISHED', 'DRAFT_QA_FAILED', 'DRAFT_CONFLICT', 'COMPENSATION_REQUIRED'],
  PUBLISHED: [],
  BLOCKED_DUPLICATE: [],
  QA_HOLD: [],
  DRAFT_QA_FAILED: [],
  DRAFT_CONFLICT: [],
  FAILED_RETRYABLE: ['RECEIVED', 'NORMALIZED', 'DEDUPED', 'ANALYZED', 'GENERATED', 'LOCAL_QA_PASSED', 'FILES_READY', 'DRAFT_SYNCED'],
  FAILED_FINAL: [],
  COMPENSATION_REQUIRED: [],
};

export class IllegalStateTransitionError extends Error {
  readonly code = 'ILLEGAL_STATE_TRANSITION';

  constructor(readonly from: string, readonly to: string) {
    super(`Illegal state transition from ${from} to ${to}`);
    this.name = 'IllegalStateTransitionError';
  }
}

export function assertBatchTransition(from: BatchState, to: BatchState): void {
  if (!batchTransitions[from].includes(to)) {
    throw new IllegalStateTransitionError(from, to);
  }
}

export function assertItemTransition(from: ItemState, to: ItemState): void {
  if (!itemTransitions[from].includes(to)) {
    throw new IllegalStateTransitionError(from, to);
  }
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildStageInputHash(input: {
  itemId: string;
  stage: string;
  sourceHashes: readonly string[];
  pipelineVersion: string;
  policyVersion?: string;
  providerInputs?: unknown;
}): string {
  return sha256(stableStringify({
    ...input,
    sourceHashes: [...input.sourceHashes].sort(),
  }));
}

export function buildJobIdempotencyKey(input: {
  itemId?: string;
  batchId: string;
  stage: string;
  inputHash: string;
  pipelineVersion: string;
}): string {
  return `${input.batchId}:${input.itemId ?? 'batch'}:${input.stage}:${input.inputHash}:${input.pipelineVersion}`;
}

export function aggregateBatchState(itemStates: readonly ItemState[]): BatchState {
  if (itemStates.length === 0) return 'DRAFT';

  const published = itemStates.filter((state) => state === 'PUBLISHED').length;
  const terminalFailures = itemStates.filter((state) =>
    ['BLOCKED_DUPLICATE', 'QA_HOLD', 'DRAFT_QA_FAILED', 'DRAFT_CONFLICT', 'FAILED_FINAL', 'COMPENSATION_REQUIRED'].includes(state),
  ).length;

  if (published === itemStates.length) return 'COMPLETED';
  if (published > 0 && published + terminalFailures === itemStates.length) return 'PARTIAL_SUCCESS';
  if (terminalFailures === itemStates.length) return 'FAILED';
  return 'RUNNING';
}
