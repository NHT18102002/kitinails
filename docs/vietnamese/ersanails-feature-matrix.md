# Ma Trận Tính Năng

Ma trận này tóm tắt các tính năng public quan sát được và gợi ý mức ưu tiên nếu xây một Shopify store nguyên bản.

| Tính năng | Trang/khu vực | Lợi ích cho khách | Mục tiêu kinh doanh | Cách triển khai khả dĩ | Độ phức tạp | Ưu tiên |
| --- | --- | --- | --- | --- | --- | --- |
| Announcement bar/ticker | Global | Biết promo ngay | Đẩy campaign, discount, free shipping | Theme section | Thấp-trung bình | MVP |
| Header sticky/nav | Global | Điều hướng nhanh | Giảm ma sát | Theme header | Trung bình | MVP |
| Mega menu/menu hierarchy | Header/mobile | Browse theo intent | Đưa khách vào collection phù hợp | Shopify navigation + theme | Trung bình | MVP |
| Search | Header/search page | Tìm nhanh sản phẩm | Capture khách có intent cao | Shopify search | Trung bình | MVP |
| Product filters | Collection/search | Thu hẹp catalog | Tăng khả năng tìm đúng sản phẩm | Shopify Search & Discovery | Trung bình | MVP |
| Sort | Collection/search | Sắp xếp theo nhu cầu | Hỗ trợ browse | Shopify sort | Thấp | MVP |
| Product cards | Homepage/collection/search | So sánh nhanh | Discovery và click PDP | Product-card snippet | Trung bình | MVP |
| Quick Buy | Product cards | Mua nhanh | Rút ngắn path to cart | `/cart/add` form/theme JS | Trung bình | MVP nếu xử lý variant tốt |
| Product gallery | PDP | Xem kỹ sản phẩm | Tăng tin tưởng | Shopify media/gallery | Trung bình | MVP |
| Variant picker | PDP | Chọn size | Giảm sai fit | Variant radios | Trung bình | MVP |
| Size guide | PDP/footer | Tự tin chọn size | Giảm return/hỏi support | Modal/page/metafield | Trung bình | MVP |
| Add to cart | PDP | Thêm sản phẩm | Core conversion | Shopify product form | Trung bình | MVP |
| Cart drawer | Global | Review nhanh giỏ hàng | Giữ khách trong flow | Theme cart drawer | Trung bình | MVP |
| Free-shipping progress | Cart drawer | Biết cần mua thêm bao nhiêu | Tăng AOV | Cart logic/theme | Trung bình | MVP |
| Discount messaging | Global/PDP | Hiểu ưu đãi | Tăng chuyển đổi | Theme + Shopify discounts/app | Trung bình | MVP |
| Bundles | Nav/homepage/collection | Tiết kiệm khi mua nhiều | Tăng AOV | Collection/products/app | Trung bình-cao | Sau MVP |
| Cross-sell | PDP/cart | Mua phụ kiện phù hợp | Tăng AOV | Native recommendations/app | Trung bình | MVP trên PDP |
| Related products | PDP | Khám phá thêm | Tăng items/session | Shopify recommendations | Trung bình | MVP |
| Product reviews | Cards/PDP | Tăng tin cậy | Social proof | Judge.me hoặc app review | Trung bình | MVP |
| FAQ accordions | FAQ/PDP | Trả lời thắc mắc | Giảm support/friction | Theme accordion | Thấp | MVP |
| Newsletter | Header/footer | Nhận ưu đãi | Email retention | Klaviyo/Shopify form | Trung bình | MVP |
| Footer links | Footer | Tìm support/policy | Trust/compliance | Theme footer | Thấp | MVP |
| UGC/social gallery | Homepage | Cảm hứng/social proof | Retention/brand | Tolstoy/Instafeed/app | Trung bình | Sau MVP |
| Localization/currency | Header/footer | Mua theo quốc gia/tiền tệ | International conversion | Shopify Markets | Trung bình | MVP nếu bán quốc tế |
| Customer accounts | Header/mobile | Quản lý đơn/account | Retention | Shopify customer accounts | Trung bình | Sau MVP |
| Loyalty/rewards | Rewards page | Tích điểm | Retention/referral | Smile.io có khả năng | Trung bình-cao | Sau MVP |
| Analytics/tracking | Global | Không trực tiếp | Đo lường | Shopify analytics, Clarity | Trung bình | MVP |
| Accessibility support | Global | Dễ dùng cho mọi người | UX/pháp lý | Theme quality | Trung bình | MVP |
| Mobile interactions | Mobile | Mua dễ trên điện thoại | Mobile conversion | Responsive theme | Trung bình | MVP |
| Push notifications | Global | Nhận thông báo | Retention | PushOwl | Trung bình | Hoãn |
| Countdown/urgency | Campaign | Tạo khẩn cấp | Campaign conversion | GetSiteControl/app | Trung bình | Hoãn |
| Delivery estimate | PDP/cart | Biết khi nào nhận hàng | Giảm lo lắng | Delivery app | Trung bình | Sau MVP |

## Ưu Tiên Tổng Kết

MVP nên có:

- Header/nav/search/cart
- Homepage rõ ràng
- Collection filter/sort
- Product card tốt
- PDP đầy đủ size guide/add-to-cart/reviews
- Cart drawer có free-shipping progress
- FAQ/policy/footer/newsletter
- SEO và accessibility cơ bản

Sau MVP:

- Loyalty
- UGC
- Bundle/free gift
- Delivery estimate
- Push notification
- Countdown

Không nên vội:

- Cài quá nhiều app global
- Quá nhiều urgency widget
- Filter URL bị index tràn lan
- Sao chép creative/brand/copy của website tham chiếu
