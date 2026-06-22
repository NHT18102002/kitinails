# Audit SEO, Nội Dung Và Khả Năng Được Tìm Thấy

Tài liệu này tóm tắt các pattern SEO/content quan sát được, không sao chép page copy hay mô tả sản phẩm.

## Metadata

| Khu vực | Quan sát | Độ tin cậy | Khuyến nghị cho store mới |
| --- | --- | --- | --- |
| Homepage title | Có title theo brand + category | Cao | Viết title ngắn, rõ brand và sản phẩm. |
| Homepage meta description | Có description riêng | Cao | Viết mô tả nguyên bản, không copy. |
| Collection title | Collection dùng title + brand | Cao | Mỗi collection nên có title riêng. |
| Collection description | Một số shape/length page dùng description generic | Cao | Viết description riêng cho từng shape/length. |
| Product title | PDP dùng product title + brand | Cao | Title nên chứa thuộc tính hữu ích như shape/length/color nếu hợp lý. |
| Product description | PDP có description chi tiết | Cao | Cần viết copy mới 100%. |
| Canonical | Có canonical trên homepage, collection, product, page, search | Cao | Giữ canonical chuẩn để tránh duplicate. |
| Open Graph/Twitter | Homepage có OG/Twitter tags | Cao | Dùng ảnh và copy social share nguyên bản. |

## Robots, Sitemap Và Indexation

Điểm tốt:

- `robots.txt` cho phép public storefront.
- Sitemap index có products, collections, pages, blogs.
- Có canonical tags.
- Có chặn checkout/account/cart JS/internal endpoints.
- Có chặn một số filter/sort crawl traps.

Rủi ro:

- Shape/length/style collections dễ bị nội dung trùng nếu dùng chung meta description.
- Filter/tag URL có thể gây index bloat nếu không kiểm soát.
- Search page có canonical query URL; cần quyết định có index hay không.

## Structured Data

Quan sát:

- Homepage có Organization JSON-LD.
- Homepage có WebSite/SearchAction JSON-LD.
- Product page có ProductGroup/Product/Offer JSON-LD.
- Review hiển thị qua Judge.me, nhưng AggregateRating trong JSON-LD chưa được xác nhận chắc chắn từ mẫu trích xuất.
- Breadcrumb UI có, nhưng BreadcrumbList JSON-LD chưa xác nhận.
- FAQ page có nội dung FAQ, nhưng FAQPage JSON-LD chưa xác nhận.

Khuyến nghị:

- Store mới nên có Organization, WebSite/SearchAction, Product, Offer, BreadcrumbList.
- Review schema cần test bằng Rich Results Test.
- FAQ schema chỉ thêm khi nội dung thật sự hiển thị và hợp lệ.

## Heading Hierarchy

Rủi ro lớn nhất: một số page render ra empty `h1`:

- Homepage
- Collection
- Search

Product page mẫu có `h1` đúng cho tên sản phẩm.

Khuyến nghị cho store mới:

- Mỗi template chỉ nên có một `h1` có nghĩa.
- Collection page phải có `h1` là tên collection.
- Search page nên có `h1` như "Search results for ...".
- Các utility như cart/country không nên chiếm heading hierarchy chính.

## Internal Linking

Website liên kết nội bộ tốt theo các nhóm:

- Shop all
- Best sellers
- New
- Sale
- Collection/campaign
- Shape
- Length
- Tools/accessories
- Bundles
- FAQ/policy/support
- Blog/education

Đây là cấu trúc nên học về mặt logic, nhưng nội dung/copy/creative phải làm mới.

## Image SEO Và Alt Text

Quan sát:

- Một số ảnh product có alt text khá mô tả.
- Một số ảnh/logo/decorative có alt rỗng.
- Gallery PDP có nhiều ảnh dùng alt giống nhau.
- Homepage có nhiều ảnh, một phần có alt rỗng.

Khuyến nghị:

- Ảnh trang trí có thể alt rỗng.
- Ảnh sản phẩm chính nên có alt mô tả hữu ích.
- Không dùng filename như nội dung marketing.
- Gallery nên có alt khác nhau khi ảnh thể hiện góc/chi tiết khác nhau.

## Chiến Lược Content Cho Store Mới

Nên viết nội dung nguyên bản cho:

- Size guide
- Shape/length guide
- How to apply/remove
- Nail care
- Shipping/returns
- FAQ
- Blog theo mùa/dịp sử dụng
- Guide chọn style theo nhu cầu

Không nên:

- Copy mô tả sản phẩm
- Copy tên campaign/collection
- Copy review
- Copy ảnh/video/social content

## Khuyến Nghị SEO Chính

- Unique title/meta cho homepage, collection, PDP, guide, policy.
- Heading hierarchy chuẩn.
- Canonical đầy đủ.
- Product schema hợp lệ.
- Kiểm soát filter URLs bằng Shopify Search & Discovery và robots/canonical.
- Blog nên phục vụ người dùng thật, không chỉ nhồi keyword.
