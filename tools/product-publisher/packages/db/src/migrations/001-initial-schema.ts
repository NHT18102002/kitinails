import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1784419200000 implements MigrationInterface {
  name = 'InitialSchema1784419200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shops (
        id uuid PRIMARY KEY,
        shop_domain varchar(255) NOT NULL UNIQUE,
        shop_gid varchar(255) UNIQUE,
        primary_locale varchar(16) NOT NULL DEFAULT 'en',
        currency_code varchar(3) NOT NULL DEFAULT 'USD',
        api_version varchar(16) NOT NULL DEFAULT '2026-07',
        online_store_publication_gid varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE batches (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
        collection_gid varchar(255) NOT NULL,
        collection_title varchar(255) NOT NULL,
        collection_handle varchar(255) NOT NULL,
        collection_rules_hash varchar(128) NOT NULL,
        collection_kind varchar(32) NOT NULL,
        collection_compatibility varchar(32) NOT NULL,
        state varchar(32) NOT NULL DEFAULT 'DRAFT',
        version integer NOT NULL DEFAULT 1,
        source_manifest_hash varchar(64),
        sealed_at timestamptz,
        run_authorized_at timestamptz,
        cancel_requested_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT batches_state_check CHECK (state IN ('DRAFT','SEALED','RUNNING','PARTIAL_SUCCESS','COMPLETED','FAILED','CANCELLED'))
      );
      CREATE INDEX batches_shop_id_idx ON batches(shop_id);
      CREATE INDEX batches_state_idx ON batches(state);

      CREATE TABLE batch_items (
        id uuid PRIMARY KEY,
        batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        position integer NOT NULL,
        state varchar(48) NOT NULL DEFAULT 'RECEIVED',
        version integer NOT NULL DEFAULT 1,
        external_id varchar(96),
        shopify_product_gid varchar(255),
        source_manifest_hash varchar(64),
        payload_hash varchar(64),
        error_code varchar(96),
         error_message text,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now(),
         UNIQUE(batch_id, position),
         UNIQUE(batch_id, external_id),
         CONSTRAINT batch_items_position_check CHECK (position >= 0),
         CONSTRAINT batch_items_state_check CHECK (state IN (
           'RECEIVED','NORMALIZED','DEDUPED','ANALYZED','GENERATED','LOCAL_QA_PASSED','FILES_READY',
           'DRAFT_SYNCED','SHOPIFY_QA_PASSED','PUBLISHING','PUBLISHED','BLOCKED_DUPLICATE','QA_HOLD',
           'DRAFT_QA_FAILED','DRAFT_CONFLICT','FAILED_RETRYABLE','FAILED_FINAL','COMPENSATION_REQUIRED'
         ))
      );
      CREATE INDEX batch_items_batch_id_idx ON batch_items(batch_id);
      CREATE INDEX batch_items_state_idx ON batch_items(state);
      CREATE INDEX batch_items_external_id_idx ON batch_items(external_id);

      CREATE TABLE assets (
        id uuid PRIMARY KEY,
        batch_item_id uuid NOT NULL REFERENCES batch_items(id) ON DELETE RESTRICT,
        kind varchar(24) NOT NULL,
        slot varchar(24),
        role varchar(48),
        status varchar(32) NOT NULL,
        storage_key text NOT NULL,
        raw_hash varchar(64) NOT NULL,
        content_hash varchar(64) NOT NULL,
        canonical_hash varchar(64),
        perceptual_hash varchar(64),
        shopify_file_gid varchar(255),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(batch_item_id, role, content_hash)
      );
      CREATE INDEX assets_batch_item_id_idx ON assets(batch_item_id);
      CREATE INDEX assets_status_idx ON assets(status);

      CREATE TABLE product_bindings (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
        external_id varchar(96) NOT NULL,
        shopify_product_gid varchar(255) UNIQUE,
        state varchar(24) NOT NULL,
        owner_batch_item_id uuid NOT NULL REFERENCES batch_items(id) ON DELETE RESTRICT,
        source_fingerprint varchar(64) NOT NULL,
        managed_snapshot_hash varchar(64),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(shop_id, external_id)
      );

      CREATE TABLE checkpoints (
        id uuid PRIMARY KEY,
        batch_item_id uuid NOT NULL REFERENCES batch_items(id) ON DELETE RESTRICT,
         stage varchar(64) NOT NULL,
         input_hash varchar(64) NOT NULL,
         pipeline_version varchar(64) NOT NULL,
         state varchar(16) NOT NULL,
        attempt integer NOT NULL DEFAULT 1,
        output_json jsonb,
        error_code varchar(96),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
         UNIQUE(batch_item_id, stage, input_hash, pipeline_version),
        CONSTRAINT checkpoints_state_check CHECK (state IN ('STARTED','COMPLETED','FAILED'))
      );

      CREATE TABLE jobs (
        id uuid PRIMARY KEY,
        job_type varchar(64) NOT NULL,
        idempotency_key varchar(255) NOT NULL,
        state varchar(16) NOT NULL DEFAULT 'PENDING',
        payload jsonb NOT NULL,
        priority integer NOT NULL DEFAULT 0,
        run_at timestamptz NOT NULL DEFAULT now(),
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 5,
        lease_owner varchar(128),
        lease_until timestamptz,
        heartbeat_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(job_type, idempotency_key),
        CONSTRAINT jobs_state_check CHECK (state IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED'))
      );
      CREATE INDEX jobs_claim_idx ON jobs(state, run_at, priority DESC, created_at);
      CREATE INDEX jobs_lease_until_idx ON jobs(lease_until);

      CREATE TABLE qa_reports (
        id uuid PRIMARY KEY,
        batch_item_id uuid NOT NULL REFERENCES batch_items(id) ON DELETE RESTRICT,
        stage varchar(64) NOT NULL,
        passed boolean NOT NULL,
        findings jsonb NOT NULL,
        snapshot_hash varchar(64),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE provider_calls (
        id uuid PRIMARY KEY,
        batch_item_id uuid REFERENCES batch_items(id) ON DELETE RESTRICT,
        provider varchar(32) NOT NULL,
        operation varchar(64) NOT NULL,
        model varchar(128),
        provider_request_id varchar(255),
        input_hash varchar(64) NOT NULL,
        prompt_hash varchar(64),
        state varchar(24) NOT NULL,
        attempt integer NOT NULL DEFAULT 1,
        duration_ms integer,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE audit_events (
        sequence bigserial PRIMARY KEY,
        event_id uuid NOT NULL UNIQUE,
        batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        batch_item_id uuid REFERENCES batch_items(id) ON DELETE RESTRICT,
        event_type varchar(96) NOT NULL,
        actor varchar(64) NOT NULL,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX audit_events_batch_sequence_idx ON audit_events(batch_id, sequence);

      CREATE TABLE resource_leases (
        resource_type varchar(32) NOT NULL,
        resource_id varchar(255) NOT NULL,
        lease_owner varchar(128) NOT NULL,
        fencing_token bigint NOT NULL DEFAULT 1,
        leased_until timestamptz NOT NULL,
        heartbeat_at timestamptz NOT NULL,
        version integer NOT NULL DEFAULT 1,
        PRIMARY KEY(resource_type, resource_id)
      );
      CREATE INDEX resource_leases_expiry_idx ON resource_leases(leased_until);

      CREATE TABLE remote_product_fingerprints (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
        product_gid varchar(255) NOT NULL,
        media_gid varchar(255) NOT NULL,
        product_updated_at timestamptz NOT NULL,
        perceptual_hash varchar(64) NOT NULL,
        ownership_class varchar(24) NOT NULL,
        indexed_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(shop_id, product_gid, media_gid)
      );

      CREATE TABLE batch_item_targets (
        batch_item_id uuid PRIMARY KEY REFERENCES batch_items(id) ON DELETE RESTRICT,
        batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        external_id varchar(96) NOT NULL,
        product_gid varchar(255),
        ownership_snapshot_hash varchar(64),
        authorized_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX batch_item_targets_batch_id_idx ON batch_item_targets(batch_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS batch_item_targets;
      DROP TABLE IF EXISTS remote_product_fingerprints;
      DROP TABLE IF EXISTS resource_leases;
      DROP TABLE IF EXISTS audit_events;
      DROP TABLE IF EXISTS provider_calls;
      DROP TABLE IF EXISTS qa_reports;
      DROP TABLE IF EXISTS jobs;
      DROP TABLE IF EXISTS checkpoints;
      DROP TABLE IF EXISTS product_bindings;
      DROP TABLE IF EXISTS assets;
      DROP TABLE IF EXISTS batch_items;
      DROP TABLE IF EXISTS batches;
      DROP TABLE IF EXISTS shops;
    `);
  }
}
