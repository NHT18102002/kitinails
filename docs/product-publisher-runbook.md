# Product Publisher — Runbook

## 1. Chuẩn bị

1. Cài Node.js 24+, PostgreSQL 17+ và tạo database/user riêng.
2. Từ `tools/product-publisher`, copy `.env.example` thành `.env`.
3. Điền secret qua secret manager hoặc environment runtime; không commit `.env`.
4. Chạy `npm ci` và `npm run db:migrate`.
5. Bắt đầu với `SHOPIFY_WRITE_MODE=off`, `PUBLISH_KILL_SWITCH=true`.

Khi deploy, chạy `npm run build`, `npm run start:api` và
`npm run start:worker`; phục vụ `apps/web/dist` cùng origin với `/api`. API
mặc định bind `127.0.0.1` và phải nằm sau reverse proxy/VPN có xác
thực nhân viên. Không expose API nội bộ trực tiếp ra Internet.

## 2. Shopify app scopes và bootstrap

Các scope cần thiết:

- Luôn đọc: `read_products`, `read_files`, `read_publications`.
- DRAFT: thêm `write_products`, `write_files`.
- Publish: thêm `write_publications`.

Đặt domain dạng `store.myshopify.com`, token Admin API, API version và Online Store publication GID. Chạy `npm run shopify:bootstrap`, sau đó gọi `/api/shop/preflight`. Không chuyển write mode nếu status còn `blocked`.

## 3. Rollout theo gate

1. **Dry run:** Shopify off; kiểm tra ghép cặp, dedupe, đúng hai ảnh, QA và resume.
2. **DRAFT canary:** `SHOPIFY_WRITE_MODE=draft`; 1–2 item; xác thực product chỉ ở DRAFT.
3. **Publish canary:** cấu hình publication đúng, đổi mode `publish`, chỉ sau đó đặt `PUBLISH_KILL_SWITCH=false`.
4. Tăng batch size từ từ; giữ `WORKER_CONCURRENCY=1` trong v1.

API và worker phải được restart cùng cấu hình. Worker từ chối khởi động nếu token/store/scope/definition/publication không đúng.

## 4. Upload một thư mục sản phẩm

1. Chạy API, worker và web ở ba terminal riêng:

   ```powershell
   npm run dev:api
   npm run dev:worker
   npm run dev:web
   ```

2. Mở `http://127.0.0.1:4311`.
3. Chọn collection. Giao diện chỉ hiển thị collection có
   `compatibility=ASSIGNABLE`.
4. Chọn folder ảnh. Trình duyệt chỉ gửi file ảnh, không gửi absolute path trên
   máy.
5. Tool lọc JPG/JPEG/PNG/WEBP, natural-sort theo relative filename và ghép
   tuần tự mỗi hai ảnh. Ví dụ `1.jpg + 1.1.jpg`, `2.jpg + 2.1.jpg`.
6. Kiểm tra preview, tổng số product, số ảnh, dung lượng và số batch rồi bấm
   **Upload sản phẩm**.

Worker không gọi OpenAI và không sinh thêm media. Mỗi product trên Shopify nhận đúng
hai ảnh nguồn. Title mặc định lấy từ collection và tên file đầu tiên của cặp; giá lấy
từ `DEFAULT_PRODUCT_PRICE`.

Số ảnh phải chẵn. Nếu số product vượt `MAX_BATCH_ITEMS`, frontend tự chia thành
nhiều batch, upload và seal toàn bộ batch trước khi queue worker. Nếu upload
thất bại trong giai đoạn chuẩn bị, các batch DRAFT/SEALED vừa tạo được hủy. Hash
chuẩn hóa của hai ảnh vẫn là external identity, vì vậy cùng một cặp ảnh không
tạo duplicate product và không thể chiếm ownership của product ngoài batch.

Chrome/Edge hỗ trợ directory picker trực tiếp. Sau khi chọn folder, luôn kiểm
tra preview nếu quy ước tên file không phải dạng số.

## 5. Vận hành lỗi

- `RUNNING` nhưng worker chết: khởi động worker, bấm Resume. Checkpoint ngăn chạy lại stage đã hoàn tất.
- `QA_HOLD`: xem `GET /api/items/:id/qa`; sửa input/policy rồi tạo batch mới. Không override hold.
- `DRAFT_QA_FAILED`: kiểm tra product DRAFT và remote findings; không publish tay trước khi điều tra.
- `DRAFT_CONFLICT`: kiểm tra custom ID/ownership; không sửa product ngoài batch.
- `COMPENSATION_REQUIRED`: bật kill switch, kiểm tra publication và đưa product về DRAFT thủ công nếu cần; ghi incident.
- Nghi token lộ: revoke/rotate token, giữ kill switch bật, kiểm tra audit; repo không chứa token.

## 6. Backup và observability

- Backup PostgreSQL định kỳ; checkpoint/audit/provider call là dữ liệu vận hành quan trọng.
- S3 bucket production nên bật versioning, encryption và lifecycle cho orphaned objects.
- Theo dõi API health, worker heartbeat/job lease, retry count, QA fail rate, provider latency/cost và compensation count.
- Không log raw base64, presigned URL, database URL, Shopify token hoặc OpenAI key.

## 7. Validation trước release

```powershell
npm run typecheck
$env:TEST_DATABASE_URL='postgresql://.../product_publisher_test'
npm test
npm run build
npm audit --audit-level=high
```

CI chạy PostgreSQL 17 service. Ngoài ra chạy `npm test` trong `tools/catalog-import` để đảm bảo legacy importer không regression. Theme Check không bắt buộc cho app này vì không có theme file bị sửa.
