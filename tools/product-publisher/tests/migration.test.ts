import { describe, expect, it } from 'vitest';
import type { QueryRunner } from 'typeorm';
import { InitialSchema1784419200000 } from '../packages/db/src/migrations/001-initial-schema.js';

describe('initial PostgreSQL migration', () => {
  it('creates ownership, queue, checkpoint, QA and audit boundaries', async () => {
    const statements: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        statements.push(sql);
        return [];
      },
    } as unknown as QueryRunner;

    await new InitialSchema1784419200000().up(queryRunner);
    const sql = statements.join('\n');

    for (const table of [
      'shops',
      'batches',
      'batch_items',
      'assets',
      'product_bindings',
      'checkpoints',
      'jobs',
      'qa_reports',
      'provider_calls',
      'audit_events',
      'resource_leases',
      'remote_product_fingerprints',
      'batch_item_targets',
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }

    expect(sql).toContain('UNIQUE(shop_id, external_id)');
    expect(sql).toContain('UNIQUE(batch_id, external_id)');
    expect(sql).toContain('UNIQUE(batch_item_id, stage, input_hash, pipeline_version)');
    expect(sql).toContain('UNIQUE(job_type, idempotency_key)');
    expect(sql).toContain("checkpoints_state_check CHECK (state IN ('STARTED','COMPLETED','FAILED'))");
  });
});
