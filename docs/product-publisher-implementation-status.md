# Product Publisher — Implementation status

Ngày cập nhật: 2026-07-27.

## Đã triển khai

- React/Vite dashboard, Fastify API, PostgreSQL 17, TypeORM Data Mapper và migrations.
- Streaming upload đúng hai ảnh, Sharp normalization, hashing và local/S3-compatible storage.
- Batch seal, PostgreSQL queue, lease/heartbeat/fencing, retry, resume, cancel, checkpoints và immutable audit events.
- Exact duplicate reservation ở local; remote custom-ID ownership reconciliation.
- Folder picker, natural sort, preview và tự ghép tuần tự đúng hai ảnh thành một product.
- Tự chia nhiều batch theo `MAX_BATCH_ITEMS`; chuẩn bị/seal toàn bộ trước khi queue.
- Metadata deterministic cục bộ; giữ đúng hai ảnh nguồn và không gọi OpenAI.
- Local QA, Shopify Files reconcile/staged upload, productSet DRAFT upsert, remote QA, publish/verify/rollback.
- Kill switch, write modes, scope/store/publication/metafield preflight và explicit Shopify bootstrap.
- Unit tests, PostgreSQL integration tests, mock E2E verification và GitHub Actions CI.

## Gate chưa thể xác nhận nếu thiếu credential thật

- Shopify DRAFT mutation/read-back trên unpublished test data.
- Online Store publish/rollback canary.
- S3 provider integration với bucket thật.
- Visual browser QA dashboard ở 1440/1024/768/390; in-app Browser không khả dụng trong phiên implementation.

Các gate này cố ý không được chạy bằng credential giả hoặc suy đoán. Runbook quy định thứ tự rollout và điều kiện mở kill switch.
