import { describe, expect, it } from 'vitest';
import {
  aggregateBatchState,
  assertBatchTransition,
  assertItemTransition,
  buildJobIdempotencyKey,
  buildStageInputHash,
  IllegalStateTransitionError,
  stableStringify,
} from '@ersa/product-publisher-domain';

describe('workflow state machine', () => {
  it('allows only declared batch transitions', () => {
    expect(() => assertBatchTransition('DRAFT', 'SEALED')).not.toThrow();
    expect(() => assertBatchTransition('SEALED', 'RUNNING')).not.toThrow();
    expect(() => assertBatchTransition('DRAFT', 'COMPLETED')).toThrow(IllegalStateTransitionError);
    expect(() => assertBatchTransition('COMPLETED', 'RUNNING')).toThrow(IllegalStateTransitionError);
  });

  it('keeps publication behind Shopify QA', () => {
    expect(() => assertItemTransition('SHOPIFY_QA_PASSED', 'PUBLISHING')).not.toThrow();
    expect(() => assertItemTransition('DRAFT_SYNCED', 'PUBLISHED')).toThrow(IllegalStateTransitionError);
    expect(() => assertItemTransition('QA_HOLD', 'PUBLISHING')).toThrow(IllegalStateTransitionError);
  });

  it('aggregates terminal item results without hiding partial failure', () => {
    expect(aggregateBatchState([])).toBe('DRAFT');
    expect(aggregateBatchState(['PUBLISHED', 'PUBLISHED'])).toBe('COMPLETED');
    expect(aggregateBatchState(['PUBLISHED', 'QA_HOLD'])).toBe('PARTIAL_SUCCESS');
    expect(aggregateBatchState(['BLOCKED_DUPLICATE', 'FAILED_FINAL'])).toBe('FAILED');
    expect(aggregateBatchState(['ANALYZED', 'PUBLISHED'])).toBe('RUNNING');
  });
});

describe('idempotency hashing', () => {
  it('canonicalizes object keys and source hash order', () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 4 }, b: 2 }),
    );

    const first = buildStageInputHash({
      itemId: 'item-1',
      stage: 'analyze',
      sourceHashes: ['b', 'a'],
      pipelineVersion: 'v1',
      providerInputs: { model: 'mock', detail: 'high' },
    });
    const second = buildStageInputHash({
      pipelineVersion: 'v1',
      sourceHashes: ['a', 'b'],
      stage: 'analyze',
      itemId: 'item-1',
      providerInputs: { detail: 'high', model: 'mock' },
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(buildJobIdempotencyKey({
      batchId: 'batch-1',
      itemId: 'item-1',
      stage: 'analyze',
      inputHash: first,
      pipelineVersion: 'v1',
    })).toBe(`batch-1:item-1:analyze:${first}:v1`);
  });
});
