# Phân tích Giao diện Trang chủ Ersa Nails

**URL Public được kiểm tra:** `https://ersanails.com/`
**Mức độ tự tin:** Cao (Dữ liệu quan sát trực tiếp bằng script tự động và snapshot giao diện)

## 1. Hệ thống Màu sắc (Colors)
- **Màu nền chung (Body Background):** Trắng (`#FFFFFF` / `rgb(255, 255, 255)`)
- **Màu chữ chính (Body Text):** Đen (`#000000` / `rgb(0, 0, 0)`)
- **Nút bấm (Buttons):** Nền trong suốt hoặc tùy chỉnh ở từng section cụ thể, chữ màu đen.
- **Header:** Nền header đồng nhất với thân trang (hoặc trong suốt khi cuộn để lộ ảnh hero banner).

## 2. Hệ thống Typography (CSS Fonts)
Sử dụng 2 font chữ chính để tạo sự thanh lịch và hiện đại, kết hợp giữa Serif cổ điển (Playfair) và Sans-serif dễ đọc (Nunito):
- **Heading 1 (H1):** `Playfair, serif` - Kích thước 18px, Trọng lượng 400.
- **Heading 2 (H2):** `Playfair, serif` - Kích thước 40px, Trọng lượng 400 (Màu chữ: `#0B0B0B`).
- **Heading 3 (H3):** `Playfair, serif` - Kích thước 24px, Trọng lượng 400 (Màu chữ: `#333333`).
- **Body Text (Đoạn văn):** `Nunito, sans-serif` - Kích thước 16px, Trọng lượng 400.

## 3. Cấu trúc Layout (Sections quan sát được)
Dựa trên Shopify Online Store 2.0, trang chủ được lắp ghép từ nhiều section khác nhau:
1. `announcement-bar`: Thanh thông báo trên cùng.
2. `header`: Trình đơn điều hướng chính (có logo và icon giỏ hàng/tìm kiếm).
3. `slideshow`: Banner chính ở đầu trang (Hero image).
4. `marquee`: Dòng chữ chạy ngang.
5. `collection` (Nhiều section): Hiển thị sản phẩm theo bộ sưu tập.
6. `text`: Các khối văn bản giới thiệu/chia sẻ.
7. `list_collection`: Danh sách các bộ sưu tập nổi bật.
8. `icons_row`: Hàng icon thể hiện đặc tính sản phẩm (ví dụ: dễ dán, tái sử dụng, v.v.).
9. `products_with_image`: Cấu trúc xen kẽ giữa hình ảnh lifestyle và sản phẩm.
10. `social_gallery`: Feed mạng xã hội (Instagram/TikTok).
11. `footer`: Chân trang với các liên kết chính sách và newsletter.

## 4. Hình ảnh và Định dạng (Images)
- **Hình ảnh Hero/Banner:** Thường có tỷ lệ hiển thị bao phủ (width 1440px, height 650px). Sử dụng định dạng `webp` và `jpg` (Ví dụ: `Summer2026_ErsaNails_PressOnNails_2.webp`).
- **Hình ảnh Sản phẩm:** Tỷ lệ khung hình dọc (Portrait) hoặc vuông tùy chỉnh, kích thước render hiển thị trên lưới thường là 315x347px trên desktop.
- **Crop Center:** Hầu hết các hình ảnh sản phẩm đều sử dụng `crop=center` thông qua Shopify Image URL filters.
- **Icon/Logo:** Có cả phiên bản Logo Đen và Trắng dạng PNG trong suốt (`Logo_Black_New.png`, `Logo_White_New.png`), kích thước hiển thị khoảng 110x23px.

## 5. Kết luận và Hướng triển khai (Functional Takeaway)
- **Thiết kế tổng thể:** Tối giản (Minimalist), thanh lịch, tập trung vào hình ảnh chất lượng cao để làm nổi bật sản phẩm nail.
- **Trải nghiệm:** Cảm giác mượt mà với nhiều không gian trắng (whitespace), typography có độ tương phản cao, phong cách "editorial" (tạp chí).
- **Quyết định cho dự án gốc:** Dựa trên các quan sát này, theme độc lập của chúng ta cần sử dụng cấu trúc font Serif cho tiêu đề và Sans-serif cho nội dung, tối ưu hình ảnh tỷ lệ dọc bằng `webp`, và xây dựng hệ thống khoảng trắng rộng rãi tương đương nhưng không sao chép trực tiếp asset hay font chữ bản quyền của họ. Tự xây dựng icon row và slideshow section nguyên bản trên nền Dawn.
