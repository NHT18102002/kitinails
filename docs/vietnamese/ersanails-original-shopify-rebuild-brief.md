# Brief Xây Lại Shopify Store Nguyên Bản

Brief này chuyển các phát hiện public thành kế hoạch định hướng cho một Shopify Online Store 2.0 nguyên bản. Không dùng lại logo, màu, font, layout, copy, ảnh, video, product name, review, campaign concept hoặc source code của Ersa Nails.

## A. Pattern Chức Năng Nên Học

- Navigation theo intent: shop all, best sellers, new, sale, collections, shape, length, tools/accessories, bundles.
- Homepage có luồng conversion: hero/campaign, trust row, featured products, taxonomy browsing, reviews/social proof, newsletter, footer.
- PDP có buy box rõ: gallery, review, price, size selector, size guide, add-to-cart, shipping/payment trust, accordion.
- Cart drawer có feedback nhanh và free-shipping progress.
- Taxonomy sản phẩm theo shape, length, color/style.
- Support content đầy đủ: size guide, how-to, shipping, returns, FAQ, customization, policies.
- Retention: newsletter trước, rewards/UGC sau MVP.

## B. Best Practice Chung

- Dùng Shopify Online Store 2.0 sections.
- Dữ liệu merchant-editable qua theme settings, metafields, metaobjects.
- Dùng Shopify Search & Discovery cho filter/recommendations trước khi cài app nặng.
- Component phải accessible: heading đúng, radio cho variants, button thật, modal/drawer có focus trap.
- Tối ưu media: responsive images, lazy loading, aspect ratio cố định.
- App stack tối giản: analytics, email, reviews cho MVP.
- Mobile-first.

## C. Tuyệt Đối Không Copy

- Brand name, logo, typography, color palette, art direction.
- Product names, collection names, descriptions, review text.
- Product photos, videos, UGC, social posts, icons, press assets.
- Theme code, CSS, JavaScript, template, app config.
- Homepage section order y hệt, seasonal campaign concept hoặc promotional wording.

## D. Cơ Hội Thiết Kế Nguyên Bản

Hướng đề xuất: một brand press-on nails premium, rõ ràng, tinh tế, tập trung vào fit confidence và trải nghiệm mobile.

Nguyên tắc UX:

- Mua nhanh
- Chọn size tự tin
- PDP không rối
- Cart drawer rõ
- Trust thật
- Mobile nhẹ

Content hierarchy:

1. Kết quả thẩm mỹ và style
2. Fit/shape/length/wear
3. Cách dùng và chăm sóc
4. Shipping/returns/trust
5. Cross-sell phụ kiện

Navigation gợi ý:

- Shop All
- New
- Best Sellers
- Sale
- Shop by Shape
- Shop by Length
- Occasion
- Essentials
- Sets/Bundles
- Guides

PDP modules gợi ý:

- Gallery
- Review summary
- Price/sale
- Size/shape/length facts
- Size guide
- What's included
- How to apply
- Wear/removal
- Shipping/returns
- Compatible accessories
- Related products

Cart strategy:

- Free-shipping progress
- Một accessory upsell thật liên quan
- Edit/remove dễ
- Shipping/taxes note rõ
- Checkout CTA rõ

## Kiến Trúc Shopify Đề Xuất

| Khu vực | Khuyến nghị |
| --- | --- |
| Theme base | Shopify OS 2.0 custom theme hoặc base theme nhẹ. |
| Templates | `index`, `collection`, `product`, `page`, `blog`, `article`, `search`, `cart`, policies. |
| Sections | Header, announcement, hero, featured collection, collection list, shape/length tiles, trust row, reviews, newsletter, footer, product main, product accordions, related products, cart drawer, FAQ. |
| Snippets | Product card, price, badge, rating, responsive image, variant picker, size guide trigger, free-shipping progress, accordion item. |
| Theme settings | Logo, màu, typography, button, sale badge, free-shipping threshold, announcement, card settings, reviews toggle, social links. |
| Metafields | Shape, length, finish/style, what's included, application time, wear duration, reusable flag, size guide group, care instructions, cross-sell products. |
| Metaobjects | Size guide tables, application steps, trust badges, press mentions, FAQ groups, material notes, campaign tiles. |
| Search & Discovery | Filter theo availability, price, shape, length, color/finish/style, product type; synonyms cho thuật ngữ nails. |
| Native Shopify | Products, variants, collections, discounts, Markets, customer accounts, cart drawer, search/filter, email capture, policies, analytics. |
| Apps MVP | Reviews, email marketing, analytics. |
| Apps sau MVP | Loyalty, UGC/video, bundle/free gift, delivery estimate. |

## Ưu Tiên Xây Dựng

### MVP

- Brand identity và visual/copy nguyên bản
- Header/nav/search/cart
- Homepage gọn
- Collection filter/sort
- PDP gallery/variant/size guide/add-to-cart/reviews
- Cart drawer
- FAQ, size guide, how-to, shipping, returns, contact, privacy, terms
- SEO metadata/schema
- Accessibility baseline

### Sau MVP

- Loyalty/rewards
- Bundles/free gifts
- Delivery estimate
- UGC/social gallery
- Recently viewed/personalized recommendations
- Affiliate/creator program

### Nice-to-have

- Push notifications
- Countdown banner
- Shipping protection
- Product quiz
- Customization request workflow

### Nên Tránh

- Quá nhiều app global
- Quá nhiều urgency widgets
- Filter index bloat
- Checkout customization phức tạp
- Copy creative của website tham chiếu

## Tiêu Chí Chấp Nhận

- Mỗi template có `h1`, title, meta description, canonical đúng.
- PDP variant và cart drawer dùng được bằng keyboard/screen reader.
- Script app tối giản và đo được.
- Nội dung, ảnh, tên sản phẩm, campaign đều nguyên bản.
- Không dùng tài sản hoặc copy của Ersa Nails.
