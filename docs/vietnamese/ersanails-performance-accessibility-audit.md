# Audit Performance Và Accessibility

Đây là audit public, không xâm lấn. Không chạy Lighthouse vì CLI không có sẵn. Browser runtime cũng không trả resource timing usable, nên đánh giá performance dựa trên HTML công khai, DOM đã render, header, asset URLs và hành vi thấy được.

## Performance

| Khu vực | Quan sát | Rủi ro | Khuyến nghị cho store mới |
| --- | --- | --- | --- |
| CDN/edge | Dùng Cloudflare và Shopify CDN | Tốt | Tận dụng Shopify CDN mặc định. |
| Script volume | Source/rendered DOM có nhiều script | Có thể làm chậm page | MVP chỉ dùng app thật cần. |
| Stylesheet volume | Có nhiều CSS theme/app | Render-blocking risk | Gộp/tối giản CSS, app CSS chỉ load khi cần. |
| Image volume | Homepage render nhiều ảnh | LCP/CLS/mobile risk | Giảm ảnh above-the-fold, lazy-load dưới fold. |
| Image loading | Có cả eager và lazy images | Eager quá nhiều có thể nặng | Chỉ eager ảnh LCP thật sự. |
| Responsive images | Shopify image URL có width transform | Tốt | Dùng `srcset/sizes` nhất quán. |
| Formats | Có WebP và JPG | Ổn | Ưu tiên WebP/AVIF nếu có. |
| Fonts | Preload Nunito/Playfair từ Shopify CDN | Ổn nhưng cần kiểm soát | Giữ 1-2 font family. |
| Third-party apps | Nhiều app: review, email, loyalty, UGC, push, countdown, delivery | Nặng global JS | Launch với review/email/analytics trước. |
| Layout shift | Carousel, ticker, app widgets, reviews, social embeds | CLS risk | Reserve height/aspect-ratio. |
| Mobile | Mobile vẫn có nhiều module/media | Mobile performance risk | Mobile-first, ít section above fold hơn. |

## Accessibility

| Khu vực | Quan sát | Rủi ro | Khuyến nghị |
| --- | --- | --- | --- |
| Skip link | Có `Skip to content` | Tốt | Giữ và test focus visible. |
| Heading | Một số page có empty `h1` | SEO/a11y risk | Mỗi template có `h1` rõ nghĩa. |
| Keyboard controls | Button/link/radio xuất hiện đúng ở nhiều nơi | Cần test sâu | Test keyboard-only. |
| Focus visibility | Chưa đo chắc bằng visual tooling | Unknown | Kiểm tra focus ring. |
| Mobile menu | Hamburger mở overlay, có close | Cần test focus trap | Focus vào drawer, Escape đóng, background inert. |
| Search dialog | Có role dialog/aria label ở search popdown | Có thể bị duplicate dialog | Chỉ expose dialog active. |
| Cart drawer | Có heading, line item, remove, note, checkout, progressbar | Cần focus/live region | Dùng accessible dialog + live cart update. |
| Variant selector | Size là radio | Tốt | Giữ radio semantics. |
| Size chart | Có button, nhưng modal semantics chưa rõ | Medium risk | Làm modal/panel accessible. |
| Accordions | PDP có nhiều accordion button | Cần `aria-expanded` đúng | Gắn panel ID và keyboard behavior. |
| Forms | Search/newsletter có aria label | Tốt vừa đủ | Nên có visible labels và error messaging. |
| Gallery | Nhiều link "Open image lightbox" lặp | Screen-reader noise | Accessible name nên unique. |
| Images | Nhiều image alt rỗng | Có thể ổn nếu decorative, rủi ro nếu meaningful | Audit alt theo vai trò ảnh. |
| Country selector | Danh sách quốc gia rất dài | Có thể gây noise | Dùng select/listbox accessible. |
| Carousel/ticker | Text promo lặp nhiều trong DOM | Screen-reader fatigue | Ẩn duplicate slides/tickers khỏi AT khi cần. |

## Ghi Chú Theo Trang

### Homepage

Điểm mạnh:

- CDN assets
- Lazy loading tồn tại
- Navigation/search/cart rõ
- Trust/social proof mạnh

Rủi ro:

- Nhiều script/app/image
- Nhiều carousel/ticker
- Empty `h1`
- Text lặp trong DOM

### Collection

Điểm mạnh:

- Product count
- Filter/sort
- Product cards
- Quick buy
- Sale/review signals

Rủi ro:

- Empty `h1`
- Campaign content có thể đẩy grid xuống
- Filter cần keyboard test

### PDP

Điểm mạnh:

- Size radio semantic
- Buy box đầy đủ
- Review/cross-sell/accordion

Rủi ro:

- Nhiều gallery media
- Alt/link name lặp
- Size chart cần accessible modal

### Cart Drawer

Điểm mạnh:

- Phản hồi add-to-cart nhanh
- Có free-shipping progress
- Checkout CTA rõ

Rủi ro:

- Cần focus trap, Escape close, live region
- Progressbar cần label/value rõ

## Giới Hạn

- Không chạy Lighthouse.
- Không có resource waterfall.
- Không chạy axe/WCAG scanner.
- Không test checkout/login/payment/private endpoints.
- Không lưu screenshot hoặc asset hình ảnh.
