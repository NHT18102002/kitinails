# Ersa Product Publisher

Ứng dụng nội bộ độc lập để tạo hàng loạt sản phẩm Shopify từ các cặp ảnh nguồn. Ứng dụng không sửa theme, checkout, payment hoặc customer data.

## Trải nghiệm vận hành

1. Chọn một manual collection có trạng thái `ASSIGNABLE`.
2. Chọn một thư mục chứa ảnh JPEG/PNG/WebP.
3. Kiểm tra preview: hệ thống natural-sort theo tên file và ghép tuần tự mỗi hai ảnh thành một sản phẩm.
4. Bấm **Upload sản phẩm** một lần.
5. Theo dõi batch/item qua React dashboard và SSE.

Nếu thư mục lớn hơn `MAX_BATCH_ITEMS`, giao diện tự chia thành nhiều batch mà
không bỏ sót cặp ảnh. Số ảnh lẻ sẽ bị chặn trước khi có request upload. File ẩn,
file hệ thống và định dạng không hỗ trợ được bỏ qua.

Pipeline giữ nguyên đúng hai ảnh nguồn, tạo metadata mặc định hoàn toàn cục bộ, QA ảnh,
upload Shopify Files, upsert product DRAFT bằng custom ID, QA read-back và chỉ publish
khi cấu hình cho phép. Workflow folder-direct không gọi OpenAI và không phát sinh chi
phí AI.

## Chạy local an toàn

Yêu cầu Node.js 24+ và PostgreSQL 17+.

```powershell
Copy-Item .env.example .env
npm ci
npm run db:migrate
npm run dev:api
npm run dev:worker
npm run dev:web
```

Sau `npm run build`, chạy artifact production bằng `npm run start:api` và
`npm run start:worker`; phục vụ `apps/web/dist` qua reverse proxy cùng origin có
xác thực. API mặc định chỉ bind `127.0.0.1`; không expose trực tiếp
ra Internet công khai.

Mặc định `.env.example` dùng `SHOPIFY_WRITE_MODE=off` và
`PUBLISH_KILL_SWITCH=true`; không có mutation Shopify.

Giá mặc định lấy từ `DEFAULT_PRODUCT_PRICE` (mặc định `19.99`) và được áp dụng cho
bốn size `XS/S/M/L`. Title được tạo từ collection + tên file ảnh đầu tiên; handle dùng
hash nội dung nên ổn định và không trùng.

Để ghi product DRAFT vào store, điền token đúng store và đặt
`SHOPIFY_WRITE_MODE=draft`. Chỉ đặt `SHOPIFY_WRITE_MODE=publish` cùng
`PUBLISH_KILL_SWITCH=false` khi đã hoàn tất canary và thực sự muốn publish.

## Chế độ chạy

| Chế độ | Kết quả thành công | Shopify mutation |
|---|---|---|
| `off` | Item dừng ở `FILES_READY` local | Không |
| `draft` | Item dừng ở `SHOPIFY_QA_PASSED`; product vẫn DRAFT | Có |
| `publish` | Item `PUBLISHED` sau read-back QA | Có; yêu cầu kill switch tắt |

`SHOPIFY_WRITE_MODE` của API, worker và payload job phải trùng nhau. Worker từ chối khởi động khi preflight không đạt.

## Bootstrap Shopify một lần

Custom ID cần product metafield definition `ersa_automation.external_id` với type `id`. Sau khi cấu hình token trong môi trường (không commit `.env`), chạy:

```powershell
npm run shopify:bootstrap
```

Lệnh idempotent này chỉ tạo definition còn thiếu. Nó không tạo/sửa product.

## Kiểm tra

```powershell
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

PostgreSQL integration tests chạy khi có `TEST_DATABASE_URL`; tên database bắt buộc chứa `test`.

Tài liệu vận hành đầy đủ: [runbook](../../docs/product-publisher-runbook.md), [kiến trúc](../../docs/product-publisher-architecture.md), [business rules](../../docs/product-publisher-business-rules.md).

Triển khai cho team: [Vercel frontend + persistent API/worker](../../docs/product-publisher-vercel-deployment.md).
