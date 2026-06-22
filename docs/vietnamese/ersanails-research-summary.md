# Tóm Tắt Nghiên Cứu Ersa Nails

## 1. Tóm Tắt Điều Hành

Ersa Nails là một Shopify storefront bán press-on nails thủ công/premium. Website có cấu trúc thương mại khá trưởng thành: homepage campaign, navigation theo shape/length/collection, product cards có review/sale/quick buy, PDP có size selector, size guide, cross-sell, cart drawer có free-shipping progress.

Kết luận quan trọng: ta nên học logic thương mại và UX pattern, không sao chép creative, hình ảnh, nội dung, tên sản phẩm, review, code hay brand identity.

## 2. Mục Đích Website Và Customer Journey

Journey công khai:

1. Vào homepage campaign-led.
2. Chọn shop all, best sellers, new, sale, shape, length, tools hoặc bundles.
3. Browse product cards.
4. Search/filter nếu có nhu cầu cụ thể.
5. Mở PDP để xem gallery, review, size, guide, shipping/return và cross-sell.
6. Add to cart.
7. Xem cart drawer với free-shipping progress.
8. Checkout không được kiểm tra.

## 3. Technology Stack Đã Xác Nhận

Đã xác nhận qua public evidence:

- Shopify storefront
- Shopify theme assets
- Cloudflare edge
- Shopify CDN cho image/font/theme
- Shopify analytics/Monorail/web pixels
- Shopify Markets/localization
- Judge.me reviews
- Klaviyo email/newsletter
- Microsoft Clarity
- Public UCP discovery

## 4. Technology Stack Có Khả Năng Cao

Có bằng chứng public nhưng một số cấu hình private không thể xác minh:

- Shopify OS 2.0-style section theme
- Smile loyalty
- AVADA free gift/upsell
- PushOwl
- Tolstoy
- Socialwidget/Instafeed
- GetSiteControl countdown/banner
- Delivery Coder
- Worry-free delivery/protection

Không xác nhận chắc chắn standalone GTM/TikTok Pixel/Pinterest Pixel/Meta Pixel.

## 5. Navigation Và Information Architecture

Navigation tập trung vào:

- Shop all
- Best sellers
- New
- Sale
- Collections/campaign
- Shape
- Length
- Tools/accessories
- Bundles
- Footer support/policies

Đây là cấu trúc tốt cho ngành press-on nails vì khách thường mua theo fit, style, dịp hoặc mức độ tin cậy.

## 6. Cấu Trúc Homepage

Homepage có:

- Announcement/promo ticker
- Hero campaign carousel
- Trust strip
- Featured best sellers
- Seasonal/campaign collections
- Shape browsing
- Press/social proof
- UGC/social inspiration
- Tools/accessories
- Newsletter
- Footer

Rủi ro: nhiều script/media/widget, nhiều text lặp trong carousel/ticker, empty `h1`.

## 7. Cấu Trúc Collection Page

Collection có:

- Hero/campaign content
- Breadcrumb
- Product count
- Sort
- Filter: color, length, shape, style
- Product cards
- Review stars
- Sale badges
- Quick buy

Rủi ro: empty `h1`, một số taxonomy page dùng meta description generic.

## 8. Cấu Trúc Product Page

PDP mẫu có:

- Gallery lớn
- Review rating/count
- Product title
- Sale price
- Trust bullets
- Size radios XS/S/M/L
- Size Chart
- Quantity
- Add to Cart
- Shipping/payment badges
- Cross-sell tools
- Customization CTA
- Accordions
- Benefits
- Related/recently viewed

Đây là pattern PDP đáng học về mặt conversion.

## 9. Cart Và Conversion Strategy

Sau khi add product qua UI, cart drawer hiển thị:

- Item
- Size
- Sale price
- Quantity
- Remove
- Add order notes
- Free-shipping progress
- Checkout CTA

Conversion levers:

- Buy more save more
- Sale badges
- Free-shipping threshold
- Reviews/social proof
- Accessory cross-sells
- Newsletter discount
- Rewards/social retention

## 10. Third-Party Integration Signals

High confidence:

- Judge.me
- Klaviyo
- Microsoft Clarity
- Shopify Analytics/Monorail
- AVADA
- PushOwl
- Tolstoy
- Socialwidget/Instafeed
- Delivery Coder

Medium confidence:

- Smile loyalty
- GetSiteControl
- Worry-free delivery/protection

Low confidence:

- Standalone GTM/TikTok/Pinterest/Meta pixel chưa xác nhận chắc chắn.

## 11. SEO Observations

- Có canonical trên nhiều page type.
- Homepage có Organization và WebSite/SearchAction JSON-LD.
- Product page có Product/ProductGroup/Offer JSON-LD.
- Sitemap đầy đủ.
- Robots chặn checkout/account/cart JS/internal/filter trap.
- Một số collection meta còn generic.
- Empty `h1` xuất hiện ở homepage/collection/search.

## 12. Performance Observations

- CDN tốt.
- Ảnh dùng Shopify image transform.
- Homepage nặng vì nhiều ảnh/script/app.
- Có nhiều app third-party global.
- Không có Lighthouse score vì tool không khả dụng.

## 13. Accessibility Observations

Điểm tốt:

- Có skip link.
- Size variant là radio.
- Header/menu/search/cart dùng button/link.
- Search/newsletter có label signals.

Rủi ro:

- Empty `h1`.
- Text carousel/ticker lặp.
- Gallery link name lặp.
- Cart drawer/menu/size chart cần focus trap/Escape/live region.
- Alt text cần audit.

## 14. Features Nên Có Cho Shopify MVP

- Brand system nguyên bản
- Header/nav/search/cart
- Announcement bar đơn giản
- Collection grid/filter/sort
- Product cards có badge/review
- PDP gallery/variant/size guide/add-to-cart/reviews
- Cart drawer free-shipping progress
- Newsletter
- FAQ/policy/footer
- SEO metadata/schema
- Accessibility baseline

## 15. Features Nên Hoãn

- Loyalty/rewards
- Push notifications
- Countdown timer
- UGC/video embeds
- Advanced bundles/free gifts
- Delivery estimate app
- Shipping protection
- Affiliate program
- Product quiz/customization workflow

## 16. Features Không Được Copy Vì Branding/IP

- Brand name/logo/colors/fonts/art direction
- Product names/collection names/descriptions/reviews
- Product photos/videos/UGC/social assets
- Theme code/CSS/JS/app config
- Seasonal campaign concepts
- Exact layout và wording

## 17. Câu Hỏi Mở Và Unknowns

- Tên theme chính xác
- Private app config
- Logged-in account experience
- Checkout/payment behavior
- Review schema validation
- Core Web Vitals/Lighthouse score
- Full keyboard/focus behavior
- App nào đang active thật sự và app nào chỉ cài nhưng ít dùng

## 18. Next Steps Trước Khi Development

1. Chốt brand positioning và visual direction nguyên bản.
2. Thiết kế taxonomy product: shape, length, finish, style, occasion.
3. Xây Shopify OS 2.0 theme nhẹ.
4. Dùng native Shopify trước.
5. Cài app MVP: reviews, email, analytics.
6. Viết content nguyên bản: size guide, how-to, shipping, returns, FAQ.
7. Validate SEO/schema/accessibility.
8. Đo performance trước khi thêm loyalty, UGC, push, countdown, bundle apps.
