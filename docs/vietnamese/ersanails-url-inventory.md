# Bản Kiểm Kê URL Công Khai Của Ersa Nails

Tài liệu này là bản tiếng Việt của báo cáo kiểm kê URL. Mục tiêu là giúp bạn hiểu cấu trúc website công khai của `https://ersanails.com` để sau này xây một cửa hàng Shopify nguyên bản, không sao chép thương hiệu, hình ảnh, nội dung hay mã nguồn của website tham chiếu.

## Cơ Sở Bằng Chứng

Các nguồn đã được kiểm tra:

- Trang chủ: `https://ersanails.com/`
- Robots: `https://ersanails.com/robots.txt`
- Sitemap chính: `https://ersanails.com/sitemap.xml`
- Sitemap sản phẩm: 587 URL được quan sát
- Sitemap collection: 162 URL được quan sát
- Sitemap page: 29 URL được quan sát
- Sitemap blog: 90 URL được quan sát

Mức tin cậy cao vì các dữ liệu này đến từ HTML công khai, DOM đã render, header HTTP, robots và sitemap.

## Quy Mô Sitemap

| Nhóm URL | Số lượng quan sát | Ý nghĩa |
| --- | ---: | --- |
| Products | 587 | Danh sách sản phẩm công khai. Có một entry trang chủ nằm trong sitemap sản phẩm. |
| Collections | 162 | Bao gồm shop all, shape, length, style, mùa vụ, sale và các campaign. |
| Pages | 29 | Bao gồm FAQ, shipping, returns, size guide, about, rewards, affiliate, policy. |
| Blogs | 90 | Bao gồm blog index và nhiều bài viết SEO/giáo dục. |

## Cấu Trúc Điều Hướng Chính

Website tổ chức điều hướng theo hành vi mua hàng:

- Shop all
- Best sellers
- New arrivals
- Sale
- Shop by collections
- Shop by shape: almond, coffin, oval, squoval, square
- Shop by length: long, medium, short
- Tools and accessories
- Bundles

Đây là một cấu trúc tốt cho cửa hàng press-on nails vì khách thường mua theo kiểu dáng, độ dài, dịp sử dụng hoặc nhu cầu tiết kiệm/bundle.

## Các URL Quan Trọng

| Trang | URL | Loại trang | Vai trò | Hành động chính | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| Homepage | `https://ersanails.com/` | Landing page | Giới thiệu thương hiệu, campaign, sản phẩm nổi bật | Shop campaign, shop all, search, cart | Có announcement bar, hero, trust strip, best sellers, newsletter. |
| Shop all | `https://ersanails.com/collections/all` | Collection | Xem toàn bộ catalog | Filter, sort, mở PDP, quick buy | Có product count, filter, sort, product cards. |
| Best sellers | `https://ersanails.com/collections/best-seller` | Collection | Đẩy sản phẩm bán chạy | Xem/mua sản phẩm | Dùng social proof và review để tăng tin cậy. |
| New arrivals | `https://ersanails.com/collections/new-arrival` | Collection | Sản phẩm mới | Browse/mua | Phục vụ khách quay lại. |
| Sale | `https://ersanails.com/collections/summer-glow-sale` | Collection/campaign | Sản phẩm giảm giá | Browse/mua | Có messaging giảm giá. |
| Shape index | `https://ersanails.com/collections/shape` | Collection index | Mua theo dáng móng | Chọn shape | Quan trọng cho UX ngành nails. |
| Length index | `https://ersanails.com/collections/length` | Collection index | Mua theo độ dài | Chọn length | Quan trọng cho chọn fit. |
| Tools/accessories | `https://ersanails.com/collections/tools-accessories` | Collection | Bán phụ kiện | Mua kit/glue/tools | Hỗ trợ cross-sell trên PDP. |
| Bundles | `https://ersanails.com/collections/bundle` | Collection | Tăng AOV | Mua combo | Có thông điệp tiết kiệm. |
| Search | `https://ersanails.com/search?q=almond` | Search results | Tìm sản phẩm | Search, filter, sort, mở sản phẩm | Search dùng `/search` của Shopify. |
| Cart | `https://ersanails.com/cart` | Cart page | Xem giỏ hàng | Review trước checkout | Không kiểm tra checkout. Cart drawer được quan sát qua UI. |

## Trang Sản Phẩm Đại Diện

Trang được kiểm tra sâu nhất là:

- `https://ersanails.com/products/seafoam`

Các thành phần được quan sát:

- Gallery ảnh lớn
- Review rating và số review
- Giá sale
- Size radio XS/S/M/L
- Nút Size Chart
- Quantity
- Add to Cart
- Trust badges về shipping/payment
- Cross-sell tools/accessories
- Customization CTA
- Accordion thông tin sản phẩm, hướng dẫn, shipping, return
- Related products và recently viewed

Một số sản phẩm khác xuất hiện trong sitemap hoặc cross-sell:

- `https://ersanails.com/products/protouch-kit-max`
- `https://ersanails.com/products/magic-glue-kit`
- `https://ersanails.com/products/customization-request`
- `https://ersanails.com/products/ersa-nails-gift-card`

## Trang Hỗ Trợ, Policy Và Nội Dung

Các trang public đáng chú ý:

- Contact: `https://ersanails.com/pages/contact`
- Shipping policy: `https://ersanails.com/pages/shipping-policy`
- Return/exchange: `https://ersanails.com/pages/return-exchange-policy`
- Nail shape/size guide: `https://ersanails.com/pages/nail-shape-size-guide`
- FAQ: `https://ersanails.com/pages/faq`
- How-to guide: `https://ersanails.com/pages/how-to-guide`
- Privacy policy: `https://ersanails.com/pages/privacy-policy`
- Terms of service: `https://ersanails.com/pages/terms-of-service`
- About us: `https://ersanails.com/pages/about-us`
- Rewards: `https://ersanails.com/pages/ersa-rewards`
- Customization service: `https://ersanails.com/pages/customization-service`
- Affiliate program: `https://ersanails.com/pages/affiliate-program`
- Blog: `https://ersanails.com/blogs/blogs`

## Kết Luận Kiểm Kê URL

- Website dùng cấu trúc URL chuẩn Shopify: `/collections/...`, `/products/...`, `/pages/...`, `/blogs/...`, `/search?q=...`.
- Điều hướng rất tập trung vào thương mại: campaign, best sellers, sale, shape, length, tools, bundles.
- Các trang support/policy khá đầy đủ, giúp giảm lo ngại trước khi mua.
- Không cần phân tích từng sản phẩm trong 587 URL; chỉ cần dùng sitemap để hiểu quy mô và chọn các trang đại diện để phân tích sâu.
