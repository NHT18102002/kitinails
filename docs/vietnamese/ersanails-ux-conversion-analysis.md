# Phân Tích UX Và Luồng Chuyển Đổi

Phân tích này dựa trên trải nghiệm public như khách mua hàng. Có thêm một sản phẩm mặc định vào giỏ qua UI để xem cart drawer; không mở checkout, không đăng nhập, không gửi form.

## Mẫu Trang Chính

| Trang/khu vực | Mục tiêu người dùng | Hành động chuyển đổi chính | Điểm mạnh | Ma sát/rủi ro |
| --- | --- | --- | --- | --- |
| Homepage | Hiểu thương hiệu và bắt đầu mua | Click campaign/category/product CTA | Có promo, trust strip, best sellers, social proof, newsletter | Nhiều carousel/ticker, nội dung lặp trong DOM, có empty `h1`. |
| Navigation | Chọn đường mua phù hợp | Vào collection/shape/length/bundle/sale | Điều hướng theo intent mua hàng rất rõ | Label và URL đôi khi không khớp hoàn toàn. |
| Collection | Browse và lọc catalog | Mở PDP hoặc quick buy | Có filter, sort, product cards, review, sale badge | Hero/campaign có thể đẩy grid xuống; empty `h1`. |
| Shape/length collection | Mua theo fit preference | Mở sản phẩm | Dáng và độ dài là taxonomy quan trọng | Một số meta description còn generic. |
| Search | Tìm sản phẩm cụ thể | Mở kết quả hoặc quick buy | Search dùng Shopify `/search`, có product grid | Result count thay đổi giữa các lần kiểm tra; cần monitor. |
| PDP | Quyết định mua | Chọn size và add to cart | Gallery, review, price, size, size guide, cross-sell, accordion | Trang dài, nhiều module cạnh tranh sự chú ý. |
| Cart drawer | Review giỏ hàng | Checkout | Có item, size, remove, note, progress free shipping | Cần kiểm tra focus trap và Escape key khi build mới. |
| Footer | Tìm support/policy/social | Mở help/policy/newsletter | Rất đầy đủ link support | Country list dài, cần accessible selector tốt. |

## Luồng 1: Khách Lần Đầu Vào Homepage

Người dùng được giới thiệu ngay:

- Campaign hiện tại
- Discount tiers
- Free-shipping threshold
- CTA vào campaign và shop all
- Trust claims
- Best sellers
- Shape/category browsing
- Newsletter discount

Điểm mạnh là website nhanh chóng nói rõ bán gì và vì sao đáng tin. Điểm yếu là trang có nhiều lớp promo nên có thể hơi ồn, nhất là mobile và screen reader.

## Luồng 2: Browse Theo Category

Navigation cho phép đi theo:

- Shop all
- Best sellers
- New
- Sale
- Seasonal/thematic collections
- Tools
- Bundles

Đây là cấu trúc tốt cho conversion vì bám sát hành vi mua: người muốn xem hàng bán chạy, người muốn hàng mới, người săn sale, người cần phụ kiện.

## Luồng 3: Browse Theo Nail Shape

Shape được đưa lên navigation: almond, coffin, oval, squoval, square.

Điểm mạnh:

- Khách biết dáng mình thích có đường đi rất nhanh.
- Shape cũng xuất hiện trong homepage/category logic.

Cần cải thiện khi build mới:

- Mỗi shape page nên có `h1` rõ ràng.
- Meta title/description nên riêng cho từng shape.

## Luồng 4: Browse Theo Nail Length

Length gồm long, medium, short. Collection page cũng có filter length.

Đây là taxonomy quan trọng vì độ dài ảnh hưởng trực tiếp đến quyết định mua và khả năng sử dụng hằng ngày.

## Luồng 5: Search

Search page dùng `/search?q=almond`, form có:

- `q`
- `type=product,article,page`
- prefix option
- filter/sort

Kết quả hiển thị product cards và quick buy. Đây là điểm tốt cho khách có intent cao.

## Luồng 6: Xem Product Detail Page

PDP mẫu có:

- Gallery ảnh
- Review rating và count
- Giá sale
- Trust bullets
- Size radios
- Size Chart
- Quantity
- Add to Cart
- Free shipping / secure payment badges
- Cross-sell tools
- Custom request CTA
- Accordions
- Recommendations

PDP xử lý nhiều objection: có đẹp không, có vừa không, dùng thế nào, ship/return ra sao, cần phụ kiện gì.

## Luồng 7: Chọn Variant/Size

Size selector là radio XS/S/M/L, XS được chọn mặc định ở sản phẩm mẫu.

Đây là pattern tốt vì radio rõ nghĩa hơn dropdown khi số option ít.

## Luồng 8: Xem Size Guide

PDP có nút Size Chart và footer có size guide page. Điều này giúp giảm rủi ro chọn sai size.

Khi build mới, size guide nên là modal accessible hoặc panel inline có `aria-expanded`, focus management và nội dung dễ hiểu.

## Luồng 9: Add To Cart

Khi bấm Add to Cart, cart drawer mở ra ngay, không cần chuyển trang.

Drawer hiển thị:

- Sản phẩm
- Size đã chọn
- Giá sale
- Quantity
- Remove
- Add order notes
- Progress free shipping
- Checkout button

Đây là conversion pattern tốt vì phản hồi nhanh và vẫn giữ khách trong flow.

## Luồng 10: Discount Và Shipping Incentive

Các incentive quan sát được:

- Buy more save more
- Sale badges
- Product discount percentage
- Free shipping threshold
- Cart progress bar
- Newsletter discount

Nên giữ logic free-shipping progress cho store mới, nhưng cần đơn giản hóa messaging để không gây rối.

## Luồng 11: Recommendation Và Cross-Sell

PDP có cross-sell phụ kiện như kit/glue và có related/recently viewed. Đây là cách tăng AOV hợp lý vì phụ kiện liên quan trực tiếp đến việc dùng nails.

## Luồng 12: Newsletter Và Retention

Có hai entry:

- Top bar link sang Klaviyo signup
- Footer newsletter form

Không nhập email hay submit form.

## Luồng 13: Social Proof

Social proof xuất hiện ở:

- Product card
- PDP
- Homepage trust claims
- Review app Judge.me
- Social/UGC scripts

Đây là yếu tố rất quan trọng cho ngành beauty vì khách cần tin vào chất lượng hình ảnh, độ bền và fit.

## Khuyến Nghị UX Cho Store Mới

- Giữ navigation theo shape, length, collection, best seller, new, sale.
- PDP nên tập trung vào gallery, review, size, size guide, add-to-cart, shipping/return và một cross-sell thật liên quan.
- Cart drawer nên có free-shipping progress.
- Mobile-first: menu/search/cart rõ, grid nhanh, filter dễ dùng.
- Cải thiện accessibility: `h1` thật, modal/drawer accessible, giảm text lặp trong carousel/ticker, alt text tốt hơn.
