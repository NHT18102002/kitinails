# Folder Product Importer — Phase 0 runbook

Phase 0 chỉ đọc filesystem và Shopify Admin GraphQL. Nó không tạo hoặc sửa product, collection, publication, theme, checkout, payment hay customer data.

## Dữ liệu đầu vào

- Mỗi collection có một thư mục identity bất biến: `3d`, `cute`, `nail art`, `y2k`.
- Identity folder có thể nằm trực tiếp trong `products/` hoặc nằm trong một display wrapper được merchant đổi tên, ví dụ `products/3D Nails/3d/`. Scanner vẫn tạo source key và logical path theo identity folder, nên đổi tên wrapper không làm manifest drift.
- Scanner đọc đệ quy bên trong thư mục collection; thư mục lặp như `products/3d/3d/` không tạo collection thứ hai.
- `N.jpg` là ảnh chính và `N.1.jpg` là ảnh thứ hai của cùng sản phẩm.
- Hỗ trợ `.jpg`, `.jpeg`, `.png`, `.webp`, không phân biệt hoa/thường.
- File khác như PSD được bỏ qua nhưng luôn xuất hiện trong report.
- Thiếu ảnh, trùng role hoặc tên ảnh không đúng mẫu là lỗi blocking.

## Chạy scanner

Từ `tools/catalog-import`:

```powershell
npm run folder-import:scan
```

Kết quả được ghi cục bộ, không commit Git:

- `data/catalog/folder-import/products-manifest.json`
- `data/catalog/folder-import/scan-report.json`

Gate hiện tại phải là 4 folder, 176 ảnh, 88 product, 0 lỗi blocking và 4 file ignored.

`manifestSha256` không phụ thuộc thời gian chạy và thay đổi khi nội dung, đường dẫn hoặc cấu trúc pair thay đổi. Manifest chỉ chứa đường dẫn tương đối, không chứa đường dẫn máy cá nhân.

## Discovery collection Shopify chỉ-đọc

Điền hai biến sau trong `tools/catalog-import/.env` (file này đã được Git ignore):

```dotenv
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=<token-with-read-products-scope>
```

Token chỉ cần scope `read_products` cho Phase 0. Sau đó chạy:

```powershell
npm run folder-import:discover-collections
```

Lệnh này scan lại filesystem, query toàn bộ collection có phân trang và ghi:

- `tools/catalog-import/config/folder-collection-map.proposed.json`

Trạng thái mapping:

- `PASS`: đúng một exact match theo handle hoặc title và collection cho phép membership thủ công.
- `MISSING`: không có exact match.
- `AMBIGUOUS`: nhiều hơn một exact match.
- `BLOCKED_NON_MANUAL`: match là automatic, app-managed, variant-based hoặc source type không được hỗ trợ.

Discovery dùng `query` duy nhất. Không có GraphQL mutation và không tự tạo collection. Proposed map chưa phải quyền cho phép import; Phase tiếp theo phải có bước review và tạo approved map riêng trước bất kỳ mutation nào.

Sau khi proposal đạt `4/4 PASS` và merchant đã xác nhận mapping, khóa mapping bằng lệnh:

```powershell
npm run folder-import:approve-collections -- --confirm-approval
```

Lệnh chỉ ghi `tools/catalog-import/config/folder-collection-map.approved.json`; nó không gọi Shopify. Approval bị chặn nếu proposal không PASS hoặc manifest hash đã thay đổi.

## Trạng thái đã duyệt ngày 2026-07-22

Bốn manual collection đã được tạo trên store theo xác nhận rõ ràng của merchant và được read-back qua discovery. GID + handle là identity cố định; title dưới đây là snapshot lúc duyệt:

- `3d` → `3D`
- `cute` → `Cute`
- `nail art` → `Nail Art`
- `y2k` → `Y2K`

Discovery đạt `4/4 PASS`; approved mapping nằm tại `tools/catalog-import/config/folder-collection-map.approved.json` và gắn với manifest 88 sản phẩm hiện tại. Nếu ảnh hoặc cấu trúc folder thay đổi, approval cũ không còn hợp lệ và phải scan/discover/approve lại.

Ngày 2026-07-23 merchant đổi display title thành `3D Nails`, `Cute Nails`, `Nails Art`, `Y2K nails`. Bốn GID và handle vẫn giữ nguyên, vì vậy membership và approved identity không đổi. Guard cho phép title drift nhưng vẫn khóa chính xác GID + handle và manual-assignable status.

## Xử lý lỗi

- Nếu scan `BLOCKED`, sửa tên/cặp file rồi chạy lại; discovery sẽ không gọi Shopify.
- Nếu store domain trả về khác `.env`, tool dừng để tránh đọc nhầm store.
- Nếu mapping `MISSING`, tạo hoặc đổi collection trong Shopify Admin theo quyết định merchant rồi chạy discovery lại.
- Nếu mapping `BLOCKED_NON_MANUAL`, không dùng collection đó làm target cho manual assignment; cần một manual collection được merchant xác nhận.
- Không thêm token vào JSON report, config hoặc Git.

## Chuẩn bị tối thiểu store đích

Chỉ chạy sau khi discovery read-only xác nhận đúng store nhưng báo thiếu collection/identity definition:

```powershell
npm run folder-import:prepare-store
```

Lệnh có mutation guard và chỉ được phép:

- Tạo bốn manual collection chính xác: `3d`, `cute`, `nail-art`, `y2k`.
- Tạo PRODUCT metafield definition `ersa_automation.external_id` kiểu `id` với `uniqueValues.enabled=true`, đúng yêu cầu của Shopify khi dùng metafield làm custom ID cho `productSet`/`productByIdentifier`.
- Nếu tool tìm thấy definition legacy `single_line_text_field` do phiên setup cũ tạo, nó chỉ được phép xóa và tạo lại khi `metafieldsCount=0`; definition đã có dữ liệu sẽ bị chặn.
- Reuse dữ liệu đã đúng khi chạy lại; định danh collection bằng GID + handle, cho phép merchant đổi title, đồng thời vẫn chặn GID/handle drift, automatic collection, sai store hoặc thiếu scope.

Lệnh không chứa mutation product, file, publication hoặc customer. Sau mutation, tool query lại live state và chỉ trả `PASS` khi toàn bộ cấu hình đúng.

## Dry-run an toàn trước upload

Chạy từ `tools/catalog-import`:

```powershell
npm run folder-import:dry-run
```

Dry-run thực hiện các kiểm tra read-only sau:

- Scan lại filesystem và buộc manifest hash khớp approved collection map.
- Xác minh store domain, bốn scope import và bốn live manual collection không drift GID/handle; title được phép thay đổi.
- Đọc toàn bộ product inventory để đối chiếu `ersa_automation.external_id`, ownership marker và handle.
- Chặn foreign handle, duplicate external ID, product không còn DRAFT và ownership mismatch.
- Tính request hash riêng cho từng product và kế hoạch upload/reuse theo SHA-256.
- Không gọi staged upload, file mutation, product mutation hoặc publication mutation.

Artifacts local, đã Git ignore:

- `data/catalog/folder-import/dry-run.json`
- `data/catalog/folder-import/dry-run.csv`

Kết quả live mới nhất ngày 2026-07-22 trên `gmsqgg-bk.myshopify.com`: gate `PASS`, `88 CREATE`, `0 UPDATE`, `0 SKIP_UNCHANGED`, `0 BLOCKED`; 176 media reference tương ứng 176 SHA-256 duy nhất. Dry-run đã đọc 2 product live để kiểm tra collision và không gọi mutation Shopify.

## Canary một product DRAFT

Canary bắt buộc chỉ rõ một `source-key`, đúng SHA-256 của dry-run vừa duyệt và cờ xác nhận riêng:

```powershell
npm run folder-import:canary -- `
  --source-key folder-import:3d:1 `
  --approved-dry-run-sha <REPORT_SHA256> `
  --confirm-canary
```

Workflow bị khóa theo thứ tự: live guard → upload/reuse đúng hai file theo SHA-256 → guard lần hai → `productSet` DRAFT theo custom ID → read-back status/media/collection/ownership → dry-run hậu canary. Tool không có publication mutation và không chạy các item còn lại.

Artifacts resume/gate, đều bị Git ignore:

- `data/catalog/folder-import/shopify-files.json`
- `data/catalog/folder-import/canary.json`
- `data/catalog/folder-import/rollout-gate.json`

Canary live ngày 2026-07-22 đạt `PASS` cho `folder-import:3d:1`: product `3D 01` ở trạng thái `DRAFT`, đúng một collection `3d`, đúng hai media `IMAGE/READY`, một default variant và đúng một handle match. Dry-run hậu kiểm đạt `87 CREATE`, `1 SKIP_UNCHANGED`, `0 UPDATE`, `0 BLOCKED`; 87 product còn lại chưa được mutation.

Có thể refresh QA và rollout checkpoint hoàn toàn read-only, không gọi lại `productSet` hay upload:

```powershell
npm run folder-import:verify-canary -- --source-key folder-import:3d:1
```

## Bulk rollout 87 product còn lại

Bulk chỉ chạy khi rollout gate và dry-run hash hiện tại khớp tuyệt đối:

```powershell
npm run folder-import:run -- `
  --approved-dry-run-sha <POST_CANARY_REPORT_SHA256> `
  --confirm-import
```

Executor xử lý tuần tự theo collection, ghi checkpoint sau từng trạng thái `FILES_READY`, `PRODUCT_MUTATED`, `VERIFIED`, dừng ở lỗi đầu tiên và có thể chạy lại cùng lệnh để resume. Product đã `VERIFIED` được bỏ qua; product xuất hiện sau khi checkpoint gián đoạn được nhận lại bằng custom ID và chỉ read-back QA nếu ownership hợp lệ.

Sau bulk, chạy verifier query-only:

```powershell
npm run folder-import:verify
```

Gate cuối yêu cầu `88/88 VERIFIED`, tất cả `DRAFT`, đúng hai media `IMAGE/READY`, đúng một approved collection, đúng custom ID/ownership/request hash và không có product foreign bị sửa.

### Kết quả bulk live 2026-07-22

- Bulk executor hoàn tất `87/87 VERIFIED`, `0 FAILED`.
- Cộng với canary: `88/88 VERIFIED`, toàn bộ ở `DRAFT`.
- Collection membership: `3d=23`, `cute=20`, `nail art=24`, `y2k=21`.
- Media checkpoint: `176/176 READY`.
- Post-bulk dry-run: `0 CREATE`, `0 UPDATE`, `88 SKIP_UNCHANGED`, `0 BLOCKED`.
- Store có 90 product live trong Admin: 88 product thuộc batch và 2 product có sẵn không thuộc batch.
- Không gọi publication mutation; các default variant hiện có giá `0.00` theo phạm vi importer tối giản.

## Bổ sung giá bán trước khi publish

Pricing workflow chỉ được phép đọc hoặc sửa đúng 88 product có custom ID `ersa_automation.external_id`, publisher marker của folder importer, trạng thái `DRAFT` và đúng một default variant. Hai product có sẵn ngoài batch không nằm trong kế hoạch.

Tạo pricing plan read-only với một giá USD thống nhất:

```powershell
npm run folder-import:price-plan -- --price 44.99
```

Plan phải đạt `PASS`, có đúng 88 item, `0 BLOCKED`. Lệnh ghi báo cáo tại `data/catalog/folder-import/pricing-plan.json` nhưng không gọi mutation.

Sau khi merchant duyệt chính xác mức giá và SHA-256 của plan, mới được cập nhật:

```powershell
npm run folder-import:price-apply -- `
  --price 44.99 `
  --approved-plan-sha <PRICING_PLAN_SHA256> `
  --confirm-price-update
```

Executor re-query ownership trước từng mutation, dùng `productVariantsBulkUpdate` với partial updates bị tắt, ghi checkpoint vào `pricing-state.json`, hỗ trợ resume và dừng ở lỗi đầu tiên. Read-back cuối phải hội tụ thành `88 SKIP_UNCHANGED`; báo cáo nằm tại `pricing-verification.json`. Workflow này không đổi title, media, collection, status hoặc publication.

Pricing plan read-only ngày 2026-07-22 với mức `$44.99 USD` đạt `PASS`: `88 UPDATE`, `0 SKIP_UNCHANGED`, `0 BLOCKED`, SHA-256 `e100d0d455d999619a73cb217733bc95af3a239dc456766c914ebc37c183a4af`. Sau khi merchant duyệt, pricing apply hoàn tất `88/88`, checkpoint `COMPLETE`; read-back đạt `0 UPDATE`, `88 SKIP_UNCHANGED`, `0 BLOCKED`, verification SHA-256 `1dab307ab81d5e025d121c5fd8858cbfa4efc92565c6fef3a476b46fc3a68daf`. Tất cả product vẫn ở `DRAFT` và chưa có publication mutation.

## Publish batch lên Online Store

Publisher chỉ nhận đúng 88 product GID từ final verification và kiểm tra lại trước từng mutation: custom ID, publisher marker, request hash, pair hash, handle, title, đúng hai media `IMAGE/READY`, đúng một collection GID và đúng một variant giá `44.99`. Title của collection không nằm trong identity guard; collection được khóa bằng GID + handle.

Tạo kế hoạch hoàn toàn read-only:

```powershell
npm run folder-import:publish-plan
```

Sau khi duyệt SHA của plan, chạy một canary rồi mới rollout phần còn lại:

```powershell
npm run folder-import:publish-canary -- `
  --source-key folder-import:3d:1 `
  --approved-plan-sha <PUBLISH_PLAN_SHA256> `
  --confirm-publish

npm run folder-import:publish-run -- `
  --approved-plan-sha <PUBLISH_PLAN_SHA256> `
  --confirm-publish
```

Executor chuyển từng product sang `ACTIVE`, gọi `publishablePublish` với đúng Online Store publication, rồi read-back trước khi ghi `VERIFIED`. Checkpoint nằm trong `data/catalog/folder-import/publish-state.json`; chạy lại cùng command và cùng approved SHA sẽ resume các item chưa verified. Bất kỳ drift hoặc Shopify user error nào đều dừng rollout tại item hiện tại.

Verification độc lập không có mutation:

```powershell
npm run folder-import:publish-verify
```

Kết quả live ngày 2026-07-23 trên `gmsqgg-bk.myshopify.com`:

- Publish plan: `PASS`, 88 item, 88 `PUBLISH`, 0 `BLOCKED`; SHA-256 `7ca9724caec6ab11b3299110a8f79697fc107689423edabda0edc7d7f8229c45`.
- Target publication: `gid://shopify/Publication/306315723027`, channel `Online Store`.
- Canary `folder-import:3d:1`: `ACTIVE`, published và read-back `VERIFIED`.
- Rollout checkpoint: `COMPLETE`, 88/88 `VERIFIED`, 0 `FAILED`.
- Independent verification: 88 `ACTIVE`, 88 published trên Online Store, 88 storefront/preview URL, 0 failed; SHA-256 `2251afa9bbd1cef94deacb5be5af93b5ce8f0cbe0534568aded563886090ca8e`.
- Collection membership không đổi: `3d=23`, `cute=20`, `nail art=24`, `y2k=21`.
- Hai product ngoài batch không xuất hiện trong plan và không có mutation nào nhắm tới chúng.
- HTTP smoke test một product của mỗi collection trả về Shopify storefront nhưng redirect tới `/password`; product đã published đúng Online Store, còn toàn bộ storefront vẫn đang bật password protection ở cấp store.
