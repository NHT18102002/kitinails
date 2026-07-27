# Product Publisher — Business rules

## Input contract

- Mỗi item nhận đúng hai ảnh; JPEG, PNG hoặc WebP; tối đa 25 MiB/ảnh theo mặc định.
- Sharp decode thật, auto-orient, chuyển sRGB, bỏ metadata và normalize lossless WebP.
- Cạnh ngắn tối thiểu 600 px; spoofed content, empty file và path traversal bị từ chối.
- Batch chỉ nhận item khi `DRAFT`; seal làm source manifest bất biến.
- Chỉ manual collection `ASSIGNABLE` được chọn. Automated collection bị hiển thị nhưng disable.

## Catalog policy

- Metadata được tạo cục bộ, không gọi AI: title = collection + nhãn tên file đầu tiên; handle chứa hash nội dung.
- Giá lấy từ `DEFAULT_PRODUCT_PRICE`; v1 mặc định variants `Size: XS/S/M/L`.
- Không tạo reviews, stock, urgency, certifications, materials, medical claims hoặc included items.
- Namespace `ersa_automation` dành riêng cho ownership, idempotency và QA.
- Không compare-at price, inventory mutation hay campaign automation.

## QA policy

Local QA fail khi:

- Không có đúng hai source image READY.
- Hai source image có cùng exact content.
- Description có script/iframe/object/embed/style, `javascript:` hoặc inline event handler.
- Variant currency khác store currency.

Shopify QA fail khi:

- Không resolve được product bằng external ID hoặc product GID drift.
- Publisher/external ID/payload hash drift.
- Product không còn DRAFT hoặc đã publish sớm.
- Title/handle không khớp.
- Không có đúng hai media ở trạng thái READY.

Mọi QA fail để product ở DRAFT hoặc chưa tạo product. Không có force-publish.

## Duplicate và safe update

- Exact duplicate trong cùng batch bị từ chối khi upload.
- Exact duplicate đang được batch khác giữ sẽ commit `BLOCKED_DUPLICATE` cùng audit event.
- Remote custom ID thuộc publisher khác, product GID drift, product mất hoặc product ACTIVE đều thành `DRAFT_CONFLICT`; không mutation product đó.
- Product ngoài batch không thể trở thành target vì mutation cần immutable target + custom ID + ownership check.

## Terminal states

- Thành công: `FILES_READY` (off), `SHOPIFY_QA_PASSED` (draft), `PUBLISHED` (publish).
- Hold/fail: `BLOCKED_DUPLICATE`, `QA_HOLD`, `DRAFT_QA_FAILED`, `DRAFT_CONFLICT`, `FAILED_FINAL`, `COMPENSATION_REQUIRED`.
- Batch aggregate thành `COMPLETED`, `PARTIAL_SUCCESS` hoặc `FAILED` chỉ khi toàn bộ item terminal.
