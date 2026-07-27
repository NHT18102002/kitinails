# Product Publisher — Kiến trúc triển khai

## Ranh giới hệ thống

Product Publisher là một ứng dụng độc lập tại `tools/product-publisher/`. Không có import từ hoặc mutation tới Liquid/theme, checkout, payment, order hay customer data. Legacy importer tại `tools/catalog-import/` được giữ nguyên.

```text
React/Vite dashboard
        │ REST + SSE
        ▼
Fastify API ─────── PostgreSQL 17 / TypeORM migrations
        │                    │
        │ enqueue            │ SKIP LOCKED + lease + checkpoint
        ▼                    ▼
Node worker ── deterministic folder metadata
        │
        ├── Local filesystem hoặc S3-compatible object storage
        └── Shopify Admin GraphQL (Files, productSet, publication)
```

## Thành phần

- `apps/web`: React, TanStack Query, upload, preflight, batch/item status, resume/cancel và SSE.
- `apps/api`: validation, streaming multipart, collection discovery, authorization chạy và audit/event APIs.
- `apps/worker`: state-machine executor. Mọi side effect có checkpoint và được reconcile trước retry.
- `packages/contracts`: DTO/Zod dùng chung; không trả TypeORM entity ra UI.
- `packages/domain`: transition policy, stable hashing và idempotency keys.
- `packages/db`: entities, versioned migration, repositories, queue lease và fencing token.
- `packages/ai`: giữ schema `CatalogSpec` tương thích; workflow folder-direct không gọi provider AI.
- `packages/media`: Sharp normalization/fingerprint; local hoặc S3 storage.
- `packages/shopify`: GraphQL client, scope/store preflight, Files reconcile, DRAFT upsert, publish/rollback.

## Idempotency và ownership

- `external_id = SHA256(shop_id + sorted canonical source hashes)`.
- PostgreSQL unique `(shop_id, external_id)` chặn hai batch sở hữu cùng candidate.
- Shopify custom ID `ersa_automation.external_id` là identity từ xa.
- `publisher_id`, `last_batch_id`, `payload_hash`, `pipeline_version`, `qa_state` và `model_manifest` tạo ownership envelope.
- `batch_item_targets` là immutable authorization target; product GID không được đổi sau khi bind.
- Product ACTIVE hiện hữu không bao giờ bị đưa về DRAFT để update. v1 chỉ update product do publisher sở hữu và đang DRAFT.
- Shopify filename chứa SHA-256; worker query filename trước staged upload để tránh file duplicate sau network ambiguity.

## Checkpoint và retry

Checkpoint unique theo `(item, stage, input_hash, pipeline_version)`. Output gồm spec, asset/file/product IDs và remote snapshot hash. Job queue claim bằng `FOR UPDATE SKIP LOCKED`, có heartbeat, lease expiry, max attempts và exponential delay. Resume tạo job mới cho batch còn `RUNNING` nhưng tái sử dụng checkpoint đã hoàn tất.

## Publish transaction logic

Shopify không cung cấp transaction xuyên qua product status và publication. Vì vậy worker dùng saga:

1. Product luôn được tạo/update ở DRAFT.
2. Read-back QA xác thực ownership, payload hash, content và đúng hai media READY.
3. Chuyển `ACTIVE`, publish đúng publication GID, rồi read-back lại.
4. Nếu publish/verify lỗi: unpublish và đưa về DRAFT.
5. Nếu compensation lỗi: item `COMPENSATION_REQUIRED`; không retry mutation mù.

Nguồn schema chính thức: [productSet](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productSet), [custom IDs](https://shopify.dev/docs/apps/build/metafields/working-with-custom-ids), [stagedUploadsCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate), [fileCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate), [publishablePublish](https://shopify.dev/docs/api/admin-graphql/latest/mutations/publishablePublish).
