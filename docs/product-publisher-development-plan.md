# Kế hoạch phát triển Product Publisher

> Trạng thái: Kế hoạch phát triển chính thức  
> Cập nhật: 2026-07-18  
> Phạm vi: Công cụ nội bộ tự động tạo và đăng sản phẩm press-on nails lên Shopify

## 1. Mục tiêu sản phẩm

Trải nghiệm cuối cùng:

1. Upload đúng hai ảnh cho mỗi sản phẩm.
2. Chọn collection.
3. Bấm `Run`.
4. Tool tự động:
   - Phân tích sản phẩm.
   - Chống duplicate.
   - Tạo thêm năm ảnh.
   - Tạo nội dung, giá, tags, metafields, SEO và variants.
   - Upload media.
   - Tạo hoặc cập nhật product ở trạng thái DRAFT.
   - QA dữ liệu thực tế trên Shopify.
   - Publish lên Online Store khi đạt.
   - Rollback về DRAFT nếu publish hoặc QA cuối thất bại.

Batch hỗ trợ nhiều sản phẩm. Mỗi item xử lý độc lập; batch có thể hoàn thành một phần.

## 2. Phạm vi v1

### 2.1 Bao gồm

- Press-on nail products.
- Một Shopify store.
- Một collection được chọn cho mỗi batch.
- Variants `SIZE: XS/S/M/L`.
- Tạo năm ảnh bổ sung.
- Resume, retry và checkpoint.
- Exact và visual duplicate detection.
- Safe update cho product do tool sở hữu.
- Auto-publish Online Store sau QA.
- React dashboard theo dõi realtime.

### 2.2 Không bao gồm

- Sửa theme, checkout hoặc payment.
- Customer, order hoặc payment data.
- Inventory quantity management.
- Reviews hoặc ratings.
- Compare-at price và campaign automation.
- Sửa collection rules hoặc menus.
- Product class ngoài press-on nails.
- Force-publish khi duplicate hoặc QA fail.
- Public multi-user SaaS hoặc multi-store dashboard.

## 3. Kiến trúc tổng thể

```text
React Web
    │ REST + SSE
    ▼
Fastify API
    │
    ├── PostgreSQL + TypeORM
    │     ├── Batch state
    │     ├── Checkpoints
    │     ├── Job queue
    │     └── Audit trail
    │
    └── Workflow Worker
          ├── OpenAI vision/content
          ├── OpenAI image generation
          ├── Local/S3 media storage
          └── Shopify Admin GraphQL
```

### 3.1 Stack

- Frontend: React, Vite, TypeScript.
- Backend: Fastify, TypeScript.
- Worker: Node.js TypeScript process riêng.
- Database: PostgreSQL.
- Data access: TypeORM Data Mapper.
- Validation: Zod schemas dùng chung.
- Queue: PostgreSQL-backed queue.
- Realtime: Server-Sent Events.
- Image processing: Sharp.
- Production media: S3-compatible object storage.
- Development media: ignored local filesystem.
- Monorepo: npm workspaces nằm riêng trong `tools/product-publisher/`.

## 4. Quy ước sử dụng TypeORM

TypeORM dùng cho:

- Entities.
- Repository CRUD.
- Relations.
- Transactions thông thường.
- Versioned migrations.
- Mapping database record sang domain model.

Raw PostgreSQL qua `QueryRunner` dùng cho:

- `FOR UPDATE SKIP LOCKED`.
- Job claiming và lease.
- Compare-and-set state transition.
- Per-shop mutation locking.
- Upsert chống duplicate.
- Partial indexes.
- Các transaction có safety-critical side effects.

Quy tắc bắt buộc:

- `synchronize: false` trong mọi môi trường.
- Không dùng Active Record hoặc `BaseEntity`.
- Không dùng lazy relations.
- Cascade mặc định tắt.
- Không dùng `save()` cho state transition quan trọng.
- Tất cả schema changes đi qua migrations được commit.
- Database constraints là lớp bảo vệ cuối cùng.
- TypeORM entities không trả thẳng cho React; API dùng DTO riêng.

## 5. Cấu trúc source code

```text
tools/product-publisher/
├─ apps/
│  ├─ web/
│  │  ├─ src/pages/
│  │  ├─ src/components/
│  │  ├─ src/api/
│  │  └─ src/state/
│  ├─ api/
│  │  ├─ src/routes/
│  │  ├─ src/services/
│  │  ├─ src/plugins/
│  │  └─ src/server.ts
│  └─ worker/
│     ├─ src/jobs/
│     ├─ src/stages/
│     └─ src/worker.ts
├─ packages/
│  ├─ contracts/           DTO, Zod schemas, events
│  ├─ domain/              Business policies và state machine
│  ├─ db/
│  │  ├─ src/entities/
│  │  ├─ src/repositories/
│  │  ├─ src/migrations/
│  │  └─ src/locking/
│  ├─ providers/
│  │  ├─ shopify/
│  │  ├─ openai/
│  │  └─ storage/
│  └─ testing/
├─ tests/
├─ package.json
├─ package-lock.json
├─ tsconfig.base.json
└─ .env.example
```

Không thay đổi root build pipeline của Shopify theme.

## 6. Mô hình dữ liệu

| Entity | Trách nhiệm |
|---|---|
| `ShopEntity` | Store domain, API version, publication GID |
| `BatchEntity` | Collection, trạng thái, thời điểm seal |
| `BatchItemEntity` | Một product candidate và trạng thái hiện tại |
| `AssetEntity` | Source/generated media, hash, QA, Shopify file GID |
| `ProductBindingEntity` | External ID liên kết với Shopify product GID |
| `CheckpointEntity` | Input/output từng workflow stage |
| `JobEntity` | Queue, lease, retry và lịch chạy |
| `QaReportEntity` | QA findings dạng JSONB |
| `ProviderCallEntity` | Model, request ID, prompt hash, provider status |
| `AuditEventEntity` | Immutable business/security events |

### 6.1 Unique constraints

- `(shop_id, external_id)`.
- `shopify_product_gid`.
- `(batch_item_id, stage, input_hash)`.
- `(batch_item_id, asset_role, content_hash)`.
- `(job_type, idempotency_key)`.

### 6.2 State machine

```text
RECEIVED
→ NORMALIZED
→ DEDUPED
→ ANALYZED
→ GENERATED
→ LOCAL_QA_PASSED
→ FILES_READY
→ DRAFT_SYNCED
→ SHOPIFY_QA_PASSED
→ PUBLISHING
→ PUBLISHED
```

Failure và hold states:

- `BLOCKED_DUPLICATE`
- `QA_HOLD`
- `DRAFT_QA_FAILED`
- `DRAFT_CONFLICT`
- `FAILED_RETRYABLE`
- `FAILED_FINAL`
- `COMPENSATION_REQUIRED`

## 7. Các phase phát triển

Ước lượng dưới đây dành cho một engineer, chưa tính thời gian chờ quyền truy cập hoặc provider quota.

| Phase | Nội dung | Ước lượng |
|---|---|---:|
| 0 | Safety contract và audit live store | 2–3 ngày |
| 1 | Monorepo, React, API, PostgreSQL, TypeORM | 4–5 ngày |
| 2 | Upload, storage và batch orchestration | 3–4 ngày |
| 3 | Dedupe và ownership | 4–6 ngày |
| 4 | AI analysis và CatalogSpec | 5–7 ngày |
| 5 | Image generation và QA | 5–7 ngày |
| 6 | Shopify Files và DRAFT sync | 5–7 ngày |
| 7 | Remote QA, publish và rollback | 4–6 ngày |
| 8 | Hardening, CI/CD và rollout | 4–6 ngày |

Tổng khoảng 36–51 engineer-days.

### Phase 0 — Safety contract và audit live store

Mục tiêu nghiệp vụ:

- Khóa chính xác tool được phép làm gì.
- Không mutation Shopify trong phase này.
- Tách hoàn toàn catalog importer cũ.

Công việc:

- Chạy lại 84 legacy importer tests.
- Query read-only store locale, currency, collections, publication, metafields, comparable prices và variant conventions.
- Khóa taxonomy shape, length, finish, color và style.
- Xây field ownership matrix: tool-owned, merchant-owned, read-only và prohibited.
- Chuẩn bị fixtures từ các cặp ảnh hiện tại.

Exit criteria:

- Không có theme hoặc catalog manifest diff.
- Có collection compatibility report.
- Có business policies và test fixtures.

### Phase 1 — Nền tảng ứng dụng

Mục tiêu nghiệp vụ:

- Có thể tạo và theo dõi batch giả lập mà chưa cần OpenAI hoặc Shopify.

Công việc:

- Khởi tạo npm workspaces.
- React shell và routing.
- Fastify API.
- Worker process.
- PostgreSQL/TypeORM configuration.
- Migrations đầu tiên.
- PostgreSQL job queue.
- SSE event stream.
- Health/preflight endpoints.
- Structured logs và secret redaction.

React pages:

- New Batch.
- Batch List.
- Batch Detail.
- Item Detail.
- QA/Error Detail.

Exit criteria:

- Worker crash/restart không mất job.
- Hai worker không xử lý cùng một job.
- React nhận realtime state changes.
- TypeORM migrations chạy từ database rỗng.

### Phase 2 — Upload và batch orchestration

Mục tiêu nghiệp vụ:

- Mỗi item có đúng hai ảnh nguồn hợp lệ.
- Batch trở thành immutable sau khi Run.

Công việc:

- Upload streaming, không giữ toàn file trong memory.
- Hỗ trợ nhiều product rows.
- Hỗ trợ folder pairing `name.jpg` và `name.1.jpg`.
- Validate magic bytes, MIME, dung lượng và decode.
- Normalize EXIF orientation, sRGB và strip metadata.
- Tạo SHA-256, pixel hash và pHash.
- Lưu local hoặc S3 object key.
- Seal immutable batch manifest.
- Xây cancel và resume semantics.

Business rules:

- Chính xác hai ảnh mỗi item.
- Chỉ JPG, PNG, WebP.
- Tối đa 25 MiB mỗi ảnh.
- Thay ảnh sau seal tạo item version mới.
- Một item fail không dừng toàn batch.

Exit criteria:

- Upload batch lớn không gây memory spike.
- Đổi filename không làm thay canonical hash.
- Restart không mất batch hoặc media reference.

### Phase 3 — Dedupe và ownership

Mục tiêu nghiệp vụ:

- Không duplicate.
- Không sửa product ngoài batch.
- Chỉ update product do tool quản lý.

External ID:

```text
SHA256(
  shop_id +
  sorted(canonical_hash_image_1, canonical_hash_image_2)
)
```

Shopify ownership metafields:

- `ersa_automation.external_id`
- `ersa_automation.publisher_id`
- `ersa_automation.source_fingerprint`
- `ersa_automation.source_phashes`
- `ersa_automation.last_batch_id`
- `ersa_automation.payload_hash`
- `ersa_automation.pipeline_version`
- `ersa_automation.qa_state`
- `ersa_automation.model_manifest`

Dedupe layers:

1. PostgreSQL unique lookup.
2. Shopify `productByIdentifier(customId)`.
3. pHash comparison.
4. Vision adjudication cho candidates gần giống.

Quyết định:

- Exact ID: resume hoặc no-op.
- Tool-owned identity từ 0,97: update cùng GID.
- Foreign identity từ 0,92: block.
- Identity từ 0,80 đến dưới 0,97: QA hold.
- Nhiều candidates: QA hold.
- Không có force-create trong v1.

Exit criteria:

- Đổi tên hoặc đảo thứ tự ảnh không duplicate.
- Foreign product không bị mutation.
- Handle collision không được dùng để quyết định ownership.

### Phase 4 — AI analysis và CatalogSpec

Mục tiêu nghiệp vụ:

- Tạo đầy đủ product data nhưng không để AI tự quyết định chính sách thương mại.

AI output:

- Product class.
- Shape.
- Length.
- Colors.
- Finish.
- Style.
- Motifs.
- Confidence và evidence.
- Uncertainty warnings.

Policy engine tạo:

- Title.
- Sanitized description HTML.
- Vendor và product type.
- SEO.
- Managed tags.
- Theme-compatible metafields.
- Price.
- Options và variants.
- Media plan.
- Collection intent.

Variants:

- Option `SIZE`.
- Values `XS`, `S`, `M`, `L`.
- Cùng price.
- SKU chỉ tạo khi cấu hình `SKU_PREFIX`.
- Không ghi quantity.

Pricing:

- Tối thiểu tám comparable prices trong selected collection.
- Fallback tối thiểu 20 press-on prices toàn store.
- Chỉ auto-price khi `MAD / median <= 0.35`.
- Chọn existing price tier gần median.
- Không compare-at price.
- Thiếu confidence: `QA_HOLD`.

Cấm AI tạo:

- Review hoặc rating.
- Fake stock hoặc urgency.
- Material hoặc durability claim.
- Included-item claim không có approved policy.
- Handmade, medical hoặc safety claim.

Exit criteria:

- Structured output luôn schema-valid.
- Cùng input và policy version sinh deterministic CatalogSpec.
- Low-confidence sản phẩm không tiến tới image generation.

### Phase 5 — Image generation và QA

Mục tiêu nghiệp vụ:

- Tạo gallery nhất quán, không thay đổi thiết kế nail.

Generated roles:

1. Hero catalog.
2. Alternate studio.
3. Macro detail.
4. On-hand lifestyle.
5. Editorial flat-lay.

QA deterministic:

- Decode và MIME.
- sRGB.
- Resolution.
- Blur và exposure.
- Không blank hoặc corrupt.
- Không duplicate.
- Không EXIF.

QA visual:

- Đúng shape, colors, motifs và embellishments.
- Không thiếu hoặc thừa chi tiết nail.
- Không malformed fingers hoặc nails.
- Không text, logo hoặc watermark.
- Identity score từ 0,90.

Retry:

- Tối đa hai lần mỗi role.
- Resume không regenerate ảnh đã pass.
- Ít nhất bốn generated images pass.
- Tổng media tối thiểu năm.
- Ảnh nguồn chỉ upload nếu sạch.

Exit criteria:

- Watermarked hoặc hallucinated media không lên Shopify.
- Provider timeout không gây tạo lại vô hạn.
- Mỗi asset có model, prompt và request manifest.

### Phase 6 — Shopify Files và DRAFT sync

Mục tiêu nghiệp vụ:

- Tạo hoặc cập nhật product DRAFT an toàn.

Preflight:

- Store domain.
- API version.
- Token scopes.
- Publication.
- Metafield definitions.
- Collection compatibility.

Media workflow:

```text
stagedUploadsCreate
→ upload binary
→ fileCreate
→ poll READY
→ associate product
→ reorder media
```

Product mới:

- `productSet`.
- Custom ID.
- Status DRAFT.
- Complete initial state.

Product tool-owned:

- Surgical `productUpdate`.
- `metafieldsSet` với `compareDigest`.
- Exact variant GIDs.
- Managed tags only.
- Tool-owned media only.
- Không xóa merchant data.

Collection:

- Manual: add exact GID.
- Automated: verify live membership.
- Không sửa rules hoặc remove khỏi collection khác.

Exit criteria:

- Product luôn DRAFT.
- Files READY và đúng order.
- Timeout hoặc retry không tạo duplicate.
- Snapshot chứng minh không GID ngoài batch thay đổi.

### Phase 7 — Remote QA, publish và rollback

Mục tiêu nghiệp vụ:

- Publish dựa trên trạng thái thực tế của Shopify.

Remote QA:

- Exact GID và external ID.
- Ownership.
- Status DRAFT.
- Title và description.
- SEO.
- Tags và metafields.
- Bốn variants.
- Price và currency.
- Media count, order, alt và status.
- Collection membership.
- Không merchant conflict.

Publish:

1. Acquire per-shop mutation lease.
2. Re-read ownership và `updatedAt`.
3. Chuyển ACTIVE.
4. Publish chỉ Online Store.
5. Poll publication status.
6. Post-publish QA.
7. Ghi audit event.

Compensation:

- Unpublish Online Store.
- Chuyển về DRAFT.
- Poll xác nhận.
- Nếu chưa xác nhận được: `COMPENSATION_REQUIRED`, ngừng retry.

Exit criteria:

- Success chỉ được ghi khi Shopify readback xác nhận.
- Mọi failure path kết thúc ở PUBLISHED hoặc DRAFT/unpublished.
- Không publish sang channel khác.

### Phase 8 — Hardening và rollout

Công việc:

- Unit, integration, contract và E2E tests.
- Worker crash injection.
- Network, 429 và 5xx simulations.
- Database disconnect recovery.
- Publish partial-failure tests.
- Upload security tests.
- Prompt-injection fixtures.
- React desktop/mobile QA.
- CI PostgreSQL service.
- React production build.
- Dependency và secret scan.
- Runbook và monitoring.

Rollout:

1. Mock-only.
2. Local images.
3. Một dev-store DRAFT.
4. Năm dev-store DRAFT.
5. Fault-injection batch.
6. Một auto-publish.
7. Năm auto-publish.
8. Batch 20 sản phẩm.
9. Bật vận hành thường xuyên.

## 8. API contract

### 8.1 Store

- `GET /api/health`
- `GET /api/shop/preflight`
- `GET /api/collections`
- `GET /api/collections/:id/compatibility`

### 8.2 Batch

- `POST /api/batches`
- `GET /api/batches`
- `GET /api/batches/:id`
- `POST /api/batches/:id/items`
- `POST /api/batches/:id/seal`
- `POST /api/batches/:id/run`
- `POST /api/batches/:id/resume`
- `POST /api/batches/:id/cancel`
- `GET /api/batches/:id/events`

### 8.3 Item

- `GET /api/items/:id`
- `GET /api/items/:id/assets`
- `GET /api/items/:id/qa`
- `GET /api/items/:id/events`

Không có arbitrary product update hoặc force-publish endpoint.

## 9. Retry và checkpoint policy

Retry tối đa năm lần với exponential backoff và full jitter cho:

- Network errors.
- 429 hoặc throttle.
- 5xx.
- Provider timeout có thể reconcile.

Không retry tự động:

- Schema validation.
- Missing scopes.
- Duplicate.
- Ownership conflict.
- Merchant drift.
- QA failure.
- Unsupported collection rules.

Mỗi stage có idempotency key:

```text
batchItemId + stage + inputHash + pipelineVersion
```

Unknown Shopify outcome phải query lại bằng custom ID hoặc file hash trước khi retry.

## 10. Security

- Secrets chỉ qua environment hoặc secret manager.
- Không log token, request authorization hoặc image base64.
- App bind localhost hoặc private network trong v1.
- Same-origin React/API.
- Upload filename không dùng làm filesystem path.
- MIME và magic-byte validation.
- Runtime images không commit.
- PostgreSQL backup định kỳ.
- Production object storage bật versioning.
- Không truy cập customer, checkout, payment hoặc order APIs.

## 11. CI/CD

Workflow mới:

1. Install từ lockfile.
2. TypeScript type-check.
3. Unit tests.
4. Khởi tạo PostgreSQL service.
5. Chạy TypeORM migrations.
6. Integration tests.
7. React build.
8. Dependency audit.
9. Secret scan.

CI không chứa Shopify hoặc OpenAI credentials thật.

## 12. File impact

| Khu vực | Thay đổi |
|---|---|
| `tools/product-publisher/` | Toàn bộ ứng dụng mới |
| `.gitignore` | Runtime, uploads và local env; giữ `products/*` hiện có |
| `.github/workflows/product-publisher-ci.yml` | CI mới |
| `docs/product-publisher-development-plan.md` | Kế hoạch phát triển chính thức này |
| `docs/product-publisher-architecture.md` | Kiến trúc chi tiết khi bắt đầu implement |
| `docs/product-publisher-business-rules.md` | Business policies |
| `docs/product-publisher-runbook.md` | Vận hành, resume và rollback |
| `tools/catalog-import/` | Không dùng global runners hoặc manifests |
| Theme directories | Không thay đổi |

## 13. Definition of Done

Dự án hoàn thành khi:

- Hai ảnh, collection và Run hoạt động end-to-end.
- Batch nhiều sản phẩm có realtime progress.
- Cùng ảnh không tạo duplicate.
- Không mutation product ngoài batch allowlist.
- Crash có thể resume.
- QA fail không publish.
- Partial publish failure được rollback.
- Product pass có media, title, description, price, tags, metafields, SEO và variants đầy đủ.
- Chỉ publish Online Store.
- Không secret, runtime image hoặc customer data vào Git.
- TypeORM migrations chạy sạch từ database rỗng.
- Legacy importer tests vẫn pass.
- Theme, checkout, payment và customer files không có diff.
