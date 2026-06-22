# Ersa Nails Shopify Theme Rebuild

Đây là repository cho việc nghiên cứu và xây dựng một theme Shopify Online Store 2.0 nguyên bản cho thương hiệu press-on nails. Dự án có thể học các pattern UX công khai từ các website cùng ngành, nhưng không được sao chép source code, hình ảnh, video, nội dung sản phẩm, review, font, logo, nhận diện thương hiệu hoặc bố cục pixel-perfect của đối thủ.

Hiện tại repo đã có foundation theme từ official Shopify Dawn `v15.5.0` tại commit `83d5e6b4094d8019820bffafe04b242d0602ffe2`. Dawn chỉ là nền kỹ thuật; storefront cuối cùng vẫn phải trở thành một brand press-on nails nguyên bản. Repo chưa có package scripts hoặc file cấu hình Shopify CLI cho store cụ thể.

## Mục Tiêu

- Xây dựng storefront Shopify độc lập, có trải nghiệm thương mại tương đương các cửa hàng press-on nails trưởng thành.
- Tạo theme mobile-first, dễ tùy chỉnh trong Shopify Theme Editor.
- Ưu tiên trải nghiệm mua hàng rõ ràng: chọn shape, length, size, xem guide, thêm vào giỏ và checkout qua Shopify.
- Dùng Shopify native features trước, hạn chế app và script bên thứ ba nếu chưa cần.
- Đảm bảo nội dung, hình ảnh, branding, sản phẩm và thông điệp marketing là nguyên bản.

## Tính Năng Chính Dự Kiến

- Announcement bar.
- Header responsive, mobile menu, mega menu và search.
- Homepage hero, featured collections, shop by shape và shop by length.
- Product cards có trạng thái sale, sold out và quick discovery.
- Collection filters và sorting tương thích Shopify Search & Discovery.
- Product gallery, variant/size picker và size guide.
- Add to cart và AJAX cart drawer.
- Free-shipping progress messaging.
- Related products và complementary products.
- FAQ accordions, newsletter form và footer responsive.
- Nội dung hỗ trợ: size guide, application/removal guide, shipping, returns, FAQ, policies và contact.

## Công Nghệ Sử Dụng

Stack mục tiêu:

- Shopify Online Store 2.0.
- Official Shopify Dawn theme `v15.5.0` as the technical base.
- Liquid.
- JSON templates.
- Shopify sections, blocks và snippets.
- CSS.
- Vanilla JavaScript.
- Shopify CLI.
- Shopify Theme Check.
- Git.

Không giả định Node build pipeline, jQuery, framework frontend, package scripts hoặc dependency bên ngoài cho đến khi repo thật sự có các thành phần đó.

## Cấu Trúc Repository Hiện Tại

```text
.
|-- AGENTS.md
|-- README.md
|-- assets/
|-- config/
|-- docs/
|   |-- ersanails-original-shopify-rebuild-brief.md
|   |-- ersanails-research-summary.md
|   |-- ersanails-feature-matrix.md
|   |-- ersanails-performance-accessibility-audit.md
|   |-- ersanails-seo-content-audit.md
|   |-- ersanails-tech-stack-evidence.md
|   |-- ersanails-url-inventory.md
|   |-- ersanails-ux-conversion-analysis.md
|   `-- vietnamese/
|-- layout/
|-- locales/
|-- sections/
|-- snippets/
`-- templates/
```

Các thư mục Shopify tiêu chuẩn hiện đã tồn tại từ Dawn. Chưa có nội dung brand, product taxonomy hoặc custom sections cho storefront press-on nails.

## Cách Chạy Local

Khi có store domain và quyền Shopify CLI, chạy preview local bằng Shopify CLI:

```bash
shopify theme dev --store [STORE].myshopify.com --open
```

Để tạo preview lâu dài trên một unpublished theme:

```bash
shopify theme push --unpublished
```

Trước các mốc review lớn, chạy Theme Check:

```bash
shopify theme check
```

Baseline Phase 0: `shopify theme check` đã chạy trên Dawn `v15.5.0` và trả về 8 warnings, 0 errors. Các warning hiện là baseline của Dawn import và được ghi lại trong `docs/vietnamese/ui-implementation-plan.md`.

Không chạy `shopify theme publish` trừ khi người dùng yêu cầu rõ ràng.

## Ghi Chú Quan Trọng

- Làm việc local, không sửa trực tiếp live theme.
- Không copy asset, code, copywriting, review, product name, policy, font, logo hoặc visual identity của đối thủ.
- Không lưu screenshot, source code, hình ảnh hoặc nội dung có bản quyền của đối thủ trong repo.
- Không hard-code sản phẩm, giá, collection handle, menu, link, ảnh hoặc business copy nếu không phải demo tạm thời.
- Không chỉnh `config/settings_data.json` tùy tiện vì file này có thể chứa cấu hình merchant.
- Không xử lý card data, payment token, API secret, store password hoặc customer data trong theme.
- Không commit `.env`, token, credential, customer export hoặc dữ liệu riêng tư.
- Mọi tính năng lớn nên cập nhật tài liệu liên quan trong `docs/`.
- Khi nghiên cứu đối thủ, chỉ ghi lại quan sát công khai, mức độ chắc chắn, takeaway chức năng và quyết định triển khai nguyên bản.

## Tài Liệu Liên Quan

- `AGENTS.md`: hướng dẫn cho agent và quy tắc bảo trì repo.
- `docs/ersanails-original-shopify-rebuild-brief.md`: định hướng rebuild Shopify nguyên bản.
- `docs/ersanails-research-summary.md`: tóm tắt nghiên cứu storefront công khai.
- `docs/ersanails-feature-matrix.md`: ma trận tính năng và mức ưu tiên.
- `docs/ersanails-performance-accessibility-audit.md`: ghi chú performance và accessibility.
