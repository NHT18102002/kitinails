# Bằng Chứng Về Công Nghệ Của Ersa Nails

Tài liệu này ghi lại các công nghệ chỉ khi có bằng chứng công khai. Không khẳng định công nghệ nào nếu chỉ đoán.

## Nền Tảng Và Hosting

| Nhận định | Bằng chứng quan sát | Nơi quan sát | Độ tin cậy |
| --- | --- | --- | --- |
| Website chạy trên Shopify | Header `Powered-By: Shopify`, cookie Shopify, asset từ Shopify CDN, markup `shopify-section`, file public `agents.md` nói rõ Shopify | Trang chủ, header HTTP, `agents.md` | Cao |
| Có theme Shopify | Asset dạng `/cdn/shop/t/49/assets/...`, `theme.css`, `theme.js`, section CSS/JS | HTML công khai | Cao |
| Có kiến trúc section kiểu Online Store 2.0 | Nhiều section assets và `shopify-section` | HTML công khai | Trung bình đến cao |
| Dùng Cloudflare phía trước | Header `Server: cloudflare`, `CF-RAY`, `Cf-Cache-Status` | HEAD request trang chủ | Cao |
| HTTPS và canonical host ổn | HTTP và `www` đều chuyển về `https://ersanails.com/` | HEAD request | Cao |
| Có security headers | CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` | Header HTTP | Cao |
| Có UCP/agent discovery | `/.well-known/ucp` và `/agents.md` tồn tại | URL công khai | Cao |

## Front-End

| Khu vực | Quan sát | Độ tin cậy |
| --- | --- | --- |
| Theme assets | Có `vendor.js`, `theme.js`, `product-info.js`, `theme.css`, `cart-drawer.css` | Cao |
| Search | Form dùng `/search`, có query `q`, type product/article/page | Cao |
| Cart drawer | Sau khi add product, drawer hiện item, size, remove, note, checkout CTA, progress free shipping | Cao |
| Variant selector | PDP dùng radio cho size XS/S/M/L | Cao |
| Product recommendation | PDP có cross-sell, related và recently viewed | Cao |
| Responsive images | URL ảnh Shopify có width/height transform, có lazy/eager loading | Cao |
| Fonts | Nunito và Playfair được preload từ Shopify CDN | Cao |
| Mobile nav | Viewport mobile mở hamburger menu thành overlay | Cao |
| Collection filter | Collection có sort, color, length, shape, style | Cao |

## App Và Dịch Vụ Bên Thứ Ba

| Dịch vụ/app | Bằng chứng | Độ tin cậy | Ghi chú |
| --- | --- | --- | --- |
| Judge.me | Domain `judge.me`, extension assets, sao review/số review hiển thị | Cao | Review app rõ ràng. |
| Klaviyo | Script `static.klaviyo.com`, link signup `manage.kmail-lists.com` | Cao | Email marketing/newsletter. |
| Microsoft Clarity | Script `clarity.ms` | Cao | Heatmap/session analytics. |
| Shopify Analytics/Monorail | Domain `monorail-edge.shopifysvc.com`, Shopify web pixels | Cao | Tracking Shopify. |
| Smile.io | `smile-loader.js`, trang rewards | Trung bình | Có dấu hiệu loyalty. |
| AVADA Free Gift/Upsell | Asset `avada-free-gift.js`, chuỗi `AVADA_FREE_GIFTS` | Cao | Có app upsell/free gift. |
| PushOwl | Asset `pushowl-shopify.js` | Cao | Push notification. |
| Tolstoy | Script `widget.gotolstoy.com`, `play.gotolstoy.com` | Cao | Video/UGC widget. |
| Socialwidget/Instafeed | Asset `socialwidget-instafeed` | Cao | Social/Instagram gallery. |
| GetSiteControl | Countdown widget asset | Trung bình | Có thể dùng urgency/banner. |
| Delivery Coder | `delivery_coder` JS/CSS | Cao | Estimated delivery. |
| Worry-free delivery | Text và page footer về protection service | Trung bình | Provider chưa xác minh đầy đủ. |
| TikTok/Pinterest/YouTube | Link social công khai | Cao cho social, thấp cho pixel | Không xác nhận được pixel riêng. |
| Google Tag Manager | Không xác nhận được GTM container rõ ràng | Thấp | Không nên ghi là chắc chắn. |

## Robots Và Giới Hạn

`robots.txt` cho phép storefront public nhưng chặn:

- `/admin`
- `/checkout`
- `/checkouts/`
- `/orders`
- `/account`
- `/cart.js`
- `/recommendations/products`
- internal services
- nhiều URL filter/sort dạng crawl trap

Điều này nghĩa là audit nên dừng ở storefront công khai, không dùng checkout, account, cart JS endpoint hay endpoint nội bộ.

## Kết Luận Công Nghệ

- Ersa Nails là Shopify storefront, có Cloudflare/Shopify CDN.
- Theme có nhiều app embed và script bên thứ ba.
- Stack hiện tại mạnh về conversion nhưng có thể nặng cho performance.
- Khi build store mới, nên dùng native Shopify trước, chỉ thêm app thật cần thiết.
