# Kế hoạch phát triển Folder Product Importer

> Trạng thái: **Kế hoạch đang có hiệu lực**
>
> Cập nhật: 2026-07-22
>
> Phạm vi: Quét `products/`, ghép hai ảnh thành một sản phẩm và tạo product DRAFT trong đúng Shopify collection
>
> Thay thế: Kế hoạch Product Publisher AI/full-pipeline ngày 2026-07-18

## 1. Quyết định phạm vi mới

Công cụ mới là một CLI import thư mục đơn giản. Công cụ không cần React, PostgreSQL, TypeORM, worker queue, OpenAI, sinh thêm ảnh, tạo nội dung marketing, SEO, variants phức tạp, auto-publish hoặc rollback publication.

Luồng vận hành cuối cùng:

1. Người vận hành đặt ảnh trong `products/<collection>/...`.
2. Mỗi cặp `N.jpg` và `N.1.jpg` là một sản phẩm.
3. Chạy scan/dry-run để xem manifest và collection đích.
4. Chạy import có cờ xác nhận.
5. Tool upload hai ảnh, tạo product DRAFT và gán product vào đúng manual collection đã duyệt.
6. Chạy verify để đối chiếu product, media và collection membership trên Shopify.

## 2. Kết quả audit dữ liệu hiện tại

Scanner phải coi folder cấp một là collection logic; folder lặp lại bên trong, ví dụ `products/3d/3d/`, chỉ là chi tiết lưu trữ và không tạo collection thứ hai.

| Folder collection | Ảnh hợp lệ | Sản phẩm | Cặp lỗi | File bỏ qua |
|---|---:|---:|---:|---:|
| `3d` | 46 | 23 | 0 | 0 |
| `cute` | 40 | 20 | 0 | 2 PSD |
| `nail art` | 48 | 24 | 0 | 0 |
| `y2k` | 42 | 21 | 0 | 2 PSD |
| **Tổng** | **176** | **88** | **0** | **4 PSD** |

Toàn bộ 88 product hiện ghép cặp được chính xác. PSD không phải media import và phải được bỏ qua.

## 3. Business rules

### 3.1 Xác định collection

- Chỉ folder cấp một ngay dưới `products/` đại diện cho collection.
- Mỗi folder phải map tới một Shopify collection GID cụ thể trong file approved config.
- Mapping phải lưu cả `gid`, `handle` và `title`; preflight phải đối chiếu cả ba với live store.
- Chỉ chấp nhận manual/custom collection. Smart collection không thể nhận membership thủ công và phải bị chặn.
- Folder không có mapping, GID không tồn tại, handle/title bị drift hoặc mapping trùng đều là lỗi blocking trước mutation.
- Tool chỉ explicit-assign một collection đích. Shopify vẫn có thể tự động đưa product vào smart collection do rule của store; tool không sửa các rule đó.

Approved config dự kiến:

```json
{
  "3d": { "gid": "gid://shopify/Collection/...", "handle": "...", "title": "..." },
  "cute": { "gid": "gid://shopify/Collection/...", "handle": "...", "title": "..." },
  "nail art": { "gid": "gid://shopify/Collection/...", "handle": "...", "title": "..." },
  "y2k": { "gid": "gid://shopify/Collection/...", "handle": "...", "title": "..." }
}
```

Collection map hiện có trong `tools/catalog-import/config/collection-map.approved.json` chưa chứa bốn collection này. Phase preflight phải query live store và sinh proposed map; không được tự đoán GID.

### 3.2 Ghép cặp ảnh

- Hỗ trợ `.jpg`, `.jpeg`, `.png`, `.webp`, không phân biệt hoa/thường.
- `N.ext` là media thứ nhất; `N.1.ext` là media thứ hai.
- Pair key là phần `N`; sắp xếp theo số, không theo chuỗi.
- Mỗi pair key phải có đúng hai file. Thiếu, thừa hoặc trùng role là lỗi blocking.
- File khác định dạng, bao gồm PSD, được bỏ qua nhưng phải xuất hiện trong report.
- Tool không resize, sinh lại hoặc chỉnh sửa ảnh trong v1.

### 3.3 Product identity, title và ownership

- `sourceKey = folder-import:<folder-slug>:<pair-key>` là danh tính bất biến.
- Tool tạo SHA-256 cho từng file và combined pair hash cho manifest.
- Custom-ID metafield `ersa_automation.external_id` lưu `sourceKey` trên Shopify product.
- Title xác định theo mẫu `<Collection title> <NN>`, ví dụ `Y2K 01` và `Nail Art 12`.
- Handle tạo theo mẫu `folder-import-<folder-slug>-<NN>`; handle không được dùng làm ownership key.
- Product mới luôn ở `DRAFT`. Tool không publish và không tạo giá/nội dung bị suy đoán.
- Shopify có thể tạo default variant; product vẫn DRAFT cho tới khi merchant bổ sung giá và thông tin bán hàng.

### 3.4 Chống duplicate và update an toàn

- Dedupe theo `sourceKey`, combined pair hash và Shopify custom ID.
- Reconcile Shopify Files theo content hash trước khi upload.
- Rerun chỉ update product DRAFT có cùng custom ID và ownership marker của tool.
- Product ACTIVE, product không có ownership marker hoặc handle collision với product khác phải bị skip/block; không overwrite.
- Tool không xóa product, collection, Shopify File hay media cũ. Orphan file chỉ được báo cáo.

## 4. Kiến trúc tối giản

```text
products/
   ├── 3d/**/1.jpg + 1.1.jpg
   ├── cute/**/1.jpg + 1.1.jpg
   ├── nail art/**/1.jpg + 1.1.jpg
   └── y2k/**/1.jpg + 1.1.jpg
          │
          ▼
Folder scanner + pair validator
          │
          ▼
Immutable import manifest + approved collection map
          │
          ▼
Shopify staged upload / Files reconcile
          │
          ▼
productSet DRAFT + exact manual collection GID
          │
          ▼
Read-back verification + JSON/CSV report
```

Kiến trúc không có web app, API server hay database riêng. State resume là JSON append-only theo từng product, lưu dưới `data/catalog/folder-import/` và bị Git ignore.

## 5. Hướng tái sử dụng code

Không mở rộng `tools/product-publisher` cho phạm vi mới. Tạo entrypoint mỏng trong `tools/catalog-import` và tái sử dụng các helper đã được kiểm thử:

- Shopify Admin GraphQL authentication và API version.
- Scope/store preflight.
- `stagedUploadsCreate`, upload media, `fileCreate` và READY polling.
- `productSet` DRAFT.
- Collection ID validation.
- Request hash, retry và resume record.
- Read-back QA và summary report.

Code folder-import phải là module riêng, không làm thay đổi hành vi pipeline catalog cũ.

## 6. CLI contract

```powershell
npm run folder-import:scan
npm run folder-import:discover-collections
npm run folder-import:dry-run
npm run folder-import:run -- --confirm-import
npm run folder-import:verify
```

- `scan`: chỉ đọc filesystem, sinh manifest và report pair lỗi.
- `discover-collections`: chỉ đọc Shopify, sinh proposed mapping; không mutation.
- `dry-run`: khóa manifest hash, xác nhận mapping, scopes, duplicate và kế hoạch create/update/skip.
- `run -- --confirm-import`: chỉ mutation khi manifest hash và approved map khớp dry-run.
- `verify`: đọc lại Shopify, kiểm tra DRAFT status, hai media và exact explicit collection GID.

## 7. State và resume

Mỗi product có record:

```json
{
  "sourceKey": "folder-import:y2k:1",
  "requestHash": "...",
  "collectionGid": "gid://shopify/Collection/...",
  "media": [
    { "path": "products/y2k/y2k/1.jpg", "sha256": "...", "fileGid": "..." },
    { "path": "products/y2k/y2k/1.1.jpg", "sha256": "...", "fileGid": "..." }
  ],
  "productGid": "gid://shopify/Product/...",
  "state": "VERIFIED"
}
```

State progression:

```text
SCANNED -> PREFLIGHT_OK -> FILES_READY -> DRAFT_CREATED -> COLLECTION_ASSIGNED -> VERIFIED
```

- Mỗi stage ghi checkpoint sau khi Shopify xác nhận.
- Rerun tiếp tục từ stage chưa hoàn tất.
- Request hash thay đổi khi file, mapping hoặc import policy thay đổi; tool không tái sử dụng checkpoint cũ sai hash.
- Retry chỉ áp dụng cho network, rate limit và Shopify 5xx. User error, collection drift và ownership conflict không retry tự động.

## 8. Các phase triển khai

### Phase 0 — Inventory và collection contract — implemented 2026-07-22

**Nghiệp vụ:** biến filesystem thành danh sách 88 product xác định và map bốn folder với bốn collection thật.

**Công việc:**

- [x] Implement scanner/pair validator.
- [x] Sinh manifest với sourceKey, file path, hash và title dự kiến.
- [x] Query live collections read-only, phân loại manual/automatic và sinh proposed folder map.
- [x] Duyệt map thành config immutable, khóa theo manifest hash hiện tại.

**Gate:** 88 product, 176 image, 0 pair error, 4 mapping đều PASS.

**Kết quả triển khai:** filesystem gate PASS với 88 product, 176 image, 0 pair error và 4 PSD ignored. Theo xác nhận rõ ràng của merchant ngày 2026-07-22, bốn manual collection rỗng `3d`, `cute`, `nail-art`, `y2k` đã được tạo trên đúng store. Read-back discovery xác nhận `4/4 PASS`, không có condition tự động, và approved map đã được khóa theo manifest hash `7730d7b1e3abf0d3ddf6c8a45ed39ff02373fb97a1c8110f165ac5adda2b1676`. Không có product, publication, theme, checkout, payment hay customer mutation.

### Phase 1 — Dry-run và safety — implemented 2026-07-22

**Nghiệp vụ:** cho merchant biết chính xác product nào sẽ create/update/skip trước khi ghi Shopify.

**Công việc:**

- [x] Preflight store domain, scopes và custom-ID definition.
- [x] Tính manifest hash và request hash theo product.
- [x] Reconcile custom ID, handle và media hash trên toàn bộ live product inventory.
- [x] Xuất JSON/CSV dry-run report.
- [x] Chứng minh toàn bộ GraphQL document của dry-run là query-only.
- [x] Provision unique custom-ID definition bằng bước `prepare-store` có mutation guard riêng, không ẩn trong dry-run.
- [x] Yêu cầu cờ `--confirm-canary`, source key tường minh và approved dry-run hash cho mutation canary ở Phase 2.

**Gate:** không có unresolved conflict; số create/update/skip được xác định.

**Kết quả dry-run live mới nhất:** store đích `gmsqgg-bk.myshopify.com` đã được xác minh và chuẩn bị tối thiểu bằng bước riêng: tạo đúng bốn manual collection `3d`, `cute`, `nail-art`, `y2k` cùng unique PRODUCT metafield definition `ersa_automation.external_id`. Discovery/approved mapping đạt `4/4 PASS`. Dry-run đọc 2 product live và xác định `88 CREATE`, `0 UPDATE`, `0 SKIP_UNCHANGED`, `0 product conflict`; 176 media reference tương ứng 176 SHA-256 duy nhất. Gate tổng `PASS`. Dry-run vẫn query-only, không upload file và không mutation product/publication.

### Phase 2 — Media và DRAFT import — canary implemented 2026-07-22

**Nghiệp vụ:** upload hai ảnh và tạo product DRAFT đúng collection, không publish.

**Công việc:**

- [x] Upload/reuse Shopify Files theo SHA-256 cho canary.
- [x] Tạo/upsert DRAFT qua `productSet` với title, handle, ownership metafield và hai media.
- [x] Assign duy nhất manual collection GID từ approved map.
- [x] Ghi checkpoint sau upload, product mutation và QA.
- [x] Giới hạn canary bằng source key tường minh, approved dry-run hash và cờ xác nhận riêng.
- [ ] Mở rộng executor đã kiểm chứng sang 87 item còn lại theo từng collection.

**Gate:** canary mỗi collection một product, tất cả ở DRAFT và đúng collection.

**Kết quả canary live:** `folder-import:3d:1` đã tạo đúng một product `3D 01` (`gid://shopify/Product/10475347837203`) ở trạng thái `DRAFT`, thuộc duy nhất collection `3d`, có đúng hai image media `READY` và đúng một exact handle match. Custom ID definition đã được sửa từ legacy `single_line_text_field` rỗng sang type `id` theo contract Shopify 2026-07; definition cũ có `metafieldsCount=0` nên không xóa dữ liệu product. Dry-run hậu canary đạt `87 CREATE`, `1 SKIP_UNCHANGED`, `0 UPDATE`, `0 BLOCKED`; bulk rollout chưa chạy.

### Phase 3 — Verify, resume và bulk rollout — implemented 2026-07-22

**Nghiệp vụ:** import đủ 88 product, có thể tiếp tục sau lỗi mà không tạo duplicate.

**Công việc:**

- [x] Read-back product status, media count/status, custom ID và collection membership.
- [x] Resume từ state JSON, bỏ qua item đã `VERIFIED` và nhận lại product bằng custom ID sau gián đoạn.
- [x] Chạy tuần tự theo collection với concurrency 1; canary được hoàn tất trước bulk.
- [x] Xuất bulk checkpoint, post-run dry-run và final verification report.

**Gate:** 88/88 item VERIFIED hoặc mỗi item chưa verified có error code rõ ràng; không có product foreign bị sửa.

**Kết quả rollout live:** bulk executor đã tạo và read-back thành công 87 DRAFT còn lại. Kết hợp canary, final verifier đạt `88/88 VERIFIED`, `88 DRAFT`, `0 FAILED`; membership chính xác `3d=23`, `cute=20`, `nail art=24`, `y2k=21`, và `176/176` media checkpoint được reuse ở trạng thái READY. Post-bulk dry-run hội tụ về `0 CREATE`, `0 UPDATE`, `88 SKIP_UNCHANGED`, `0 BLOCKED`. Store có tổng cộng 90 product Admin, gồm 88 item thuộc batch và 2 product có sẵn; executor không có publication mutation.

## 9. File impact map

### File tạo mới

- `tools/catalog-import/src/folder-import/scan.cjs`
- `tools/catalog-import/src/folder-import/collection-map.cjs`
- `tools/catalog-import/src/folder-import/manifest.cjs`
- `tools/catalog-import/src/folder-import/shopify-sync.cjs`
- `tools/catalog-import/src/folder-import/state.cjs`
- `tools/catalog-import/src/folder-import/report.cjs`
- `tools/catalog-import/src/run-folder-import.cjs`
- `tools/catalog-import/config/folder-collection-map.proposed.json`
- `tools/catalog-import/config/folder-collection-map.approved.json`
- `tools/catalog-import/test/folder-import/*.test.cjs`
- `docs/folder-product-import-runbook.md`

### File chỉnh sửa

- `tools/catalog-import/package.json`: thêm năm CLI scripts.
- `.gitignore`: ignore manifest/state/report runtime có Shopify GID.
- `docs/product-publisher-development-plan.md`: plan đang có hiệu lực này.

### File không sửa

- `products/**`: chỉ đọc.
- `tools/product-publisher/**`: giữ nguyên, không còn là delivery path của phạm vi mới.
- Theme, checkout, payment, customer data và collection rules.

## 10. API, credential và scope

Chỉ cần Shopify Admin GraphQL API:

- `read_products`
- `write_products`
- `read_files`
- `write_files`

Không cần OpenAI API, PostgreSQL, S3, `write_publications` hoặc customer/order scopes.

Credential chỉ ở `tools/catalog-import/.env` hoặc runtime secret manager; không commit token. Collection GID không phải secret nhưng approved map vẫn phải được review vì nó quyết định write target.

## 11. Definition of Done

- Scanner luôn nhận ra 88 product từ dataset hiện tại.
- PSD bị bỏ qua và được report.
- Bốn folder được map tới bốn manual collection GID đã duyệt.
- Dry-run không có Shopify mutation.
- Mutation không chạy nếu thiếu `--confirm-import`, manifest drift hoặc collection drift.
- Mỗi product có đúng hai media theo đúng thứ tự.
- Mỗi product DRAFT có external ID duy nhất và explicit target collection chính xác.
- Rerun không tạo duplicate và không sửa foreign/ACTIVE product.
- Interrupted run resume được từ checkpoint.
- Final verify report có create/update/skip/fail, product GID, Admin URL và collection GID.
- Toàn bộ test mới và 84 legacy importer tests đều pass.

## 12. Thứ tự implement tối ưu

1. Scanner + tests cho 88 pair hiện tại.
2. Live collection discovery read-only + proposed map.
3. Approved mapping và preflight drift check.
4. Immutable manifest, request hash, dry-run report.
5. Shopify Files reconcile/upload.
6. DRAFT productSet + exact collection assignment.
7. Read-back verify + JSON state resume.
8. Canary một product mỗi collection.
9. Rollout từng collection: `3d`, `cute`, `nail art`, `y2k`.
10. Final 88-product verification report.

---

# Phụ lục A — Kế hoạch Product Publisher full-pipeline đã được thay thế

> Trạng thái: Không còn là delivery scope
>
> Phiên bản: 2026-07-18
>
> Lý do lưu lại: Bảo toàn các quyết định kiến trúc cũ để tham khảo; không triển khai thêm nếu không có yêu cầu mới.

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
