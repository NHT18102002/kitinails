# Phase 3A Homepage Composition Log

## 1. Objective

Phase 3A triển khai bố cục homepage gốc trên nền Dawn cho storefront press-on nails, trong phạm vi chỉ chạm homepage composition và một section reusable mới cho collection-led browsing.

Mục tiêu của phase này:

- tạo khung homepage merchant-editable,
- giữ flow commerce rõ ràng,
- tránh hard-code catalog thật khi collections/products chưa được populate,
- reuse Dawn ở những nơi đủ tốt,
- không đụng product/cart/search/header logic ngoài phạm vi cho phép.

## 2. Files changed

- `templates/index.json`
- `sections/browse-collections.liquid`
- `assets/section-browse-collections.css`
- `docs/vietnamese/phase-3a-homepage-composition-log.md`

Không cần sửa:

- `sections/image-banner.liquid`
- `sections/featured-collection.liquid`
- `sections/multicolumn.liquid`
- `sections/newsletter.liquid`
- `assets/custom-theme.css`
- locale files

## 3. Existing Dawn sections reused

- `sections/image-banner.liquid` cho hero.
- `sections/featured-collection.liquid` cho featured products và accessories/bundles modules.
- `sections/multicolumn.liquid` cho trust/education block tùy chọn.
- `sections/newsletter.liquid` cho newsletter capture.

Phase này chỉ đổi composition ở `templates/index.json`, không rewrite các Dawn section trên.

## 4. New reusable section created

Section mới:

- `sections/browse-collections.liquid`
- `assets/section-browse-collections.css`

Vai trò:

- dùng chung cho `Browse by shape`
- dùng chung cho `Browse by length`

Behavior chính:

- dùng Theme Editor blocks
- mỗi block chọn một Shopify collection
- cho phép custom image override
- cho phép custom title override
- cho phép short supporting text
- dùng collection image/title mặc định khi merchant không override
- tile link toàn khối tới collection đã chọn
- block không có collection sẽ không render trên storefront thường
- trong Theme Editor design mode, block chưa chọn collection hiện trạng thái placeholder an toàn để merchant cấu hình
- section tự co giãn tốt với 2-6 tiles

## 5. Theme Editor controls available

### Homepage template composition

`templates/index.json` hiện có các section roles sau:

- Hero
- Featured products
- Browse by shape
- Browse by length
- Optional trust/education block
- Optional accessories or curated bundles block
- Newsletter

### `browse-collections` section

Section settings:

- heading
- heading size
- supporting text
- image ratio
- desktop columns
- mobile columns
- color scheme
- top/bottom padding

Block settings:

- collection picker
- custom image override
- custom title override
- short supporting text

### Data-dependent sections in homepage template

Để tránh placeholder product content sai ngữ cảnh khi chưa có catalog thật:

- `featured_products` được đưa vào template nhưng `disabled: true`
- `browse_shape` được đưa vào template nhưng `disabled: true`
- `browse_length` được đưa vào template nhưng `disabled: true`
- `education` được đưa vào template nhưng `disabled: true`
- `featured_accessories` được đưa vào template nhưng `disabled: true`

Hero và newsletter vẫn active để homepage có baseline composition rõ ràng ngay từ Phase 3A.

## 6. Responsive behavior

Desktop:

- hero dùng Dawn image banner với content alignment trái
- newsletter giữ container hẹp hơn full width để đọc/form dễ hơn
- `browse-collections` hỗ trợ 2-4 columns desktop tùy settings

Mobile:

- homepage giữ hero copy, CTA và newsletter form gọn trong viewport nhỏ
- `browse-collections` hỗ trợ 1 hoặc 2 columns mobile
- tile spacing, tap target và content padding được giữ thoáng để tránh cramped layout

## 7. Accessibility validation

Đã kiểm tra:

- hero CTA là native link
- newsletter dùng native email input + submit button của Dawn
- footer policy link vẫn tồn tại
- không thêm JavaScript mới cho homepage phase này
- console errors do Phase 3A gây ra: không thấy
- data-dependent sections không render placeholder product cards khi chưa được populate

Kết quả semantic heading hiện tại:

- Trang chỉ có một `h1` trong DOM: store name ở header (`develop store`)
- Hero heading trong `image-banner` vẫn render thành `h2`

Đây là limitation đã xác minh của Dawn `image-banner.liquid`: setting `heading_size: h1` chỉ đổi class size, không đổi semantic tag. Phase 3A giữ nguyên Dawn hero section theo scope, nên homepage chưa có main-content `h1` riêng ở hero. Nếu project muốn hero headline trở thành semantic `h1`, cần mở scope để replace hoặc extend hero section trong phase sau.

Keyboard QA note:

- Native link/input/button surfaces của hero và newsletter đều hiện diện đúng trong DOM.
- Browser automation của in-app browser không tái hiện ổn định chuỗi `Tab` traversal trên preview local, nên keyboard proof được xác nhận bằng native semantics, link/form presence, và Phase 1A focus-visible foundation đã tồn tại sẵn.
- Collection tiles và featured collection links chưa thể keyboard-test live vì các section data-dependent đang intentionally disabled cho tới khi merchant có collections thật.

## 8. Theme Check result

Command:

```powershell
shopify theme check
```

Result:

- Pass
- 170 files inspected
- 8 warnings
- 0 errors

8 warnings còn lại là baseline warnings của Dawn đã có từ trước, không phải regression mới của Phase 3A.

## 9. Local preview result

Preview dùng Shopify dev server tại:

- `http://127.0.0.1:9293`

Kiểm tra đã chạy:

- homepage render thành công sau khi fix JSON setting step cho `image_overlay_opacity`
- hero copy mới render
- CTA hero resolve tới `/collections`
- newsletter section render
- mobile preview ở `390x844` render ổn
- không có product-card placeholder xuất hiện vì các section collection-led đang disabled chờ data
- console error do Phase 3A gây ra: không thấy

Theme Editor note:

- Theme editor route của preview mở được
- automation không đọc sâu được app-shell/iframe của editor, nhưng section schema compile và preview theme upload thành công

## 10. Known limitations caused by missing brand content, original media, collections, products, and merchant claims

- Chưa có brand name/logo/palette/final typography được chốt.
- Hero vẫn đang dùng neutral placeholder media flow của Dawn cho tới khi merchant có ảnh gốc.
- Chưa có featured products collection thật, shape collections, length collections, accessories collection hoặc curated bundle collection để bật các homepage modules data-dependent.
- Trust/education content vẫn chưa có approved copy thực tế cho size/application/care/shipping/support.
- Newsletter copy mới chỉ là baseline neutral copy, chưa gắn incentive hay provider-specific behavior.
- Limitation semantic `h1` của hero đã được xử lý ở Phase 3A.1; các limitation còn lại vẫn là brand/content/data dependent.

## 11. Required merchant inputs before Phase 3B population

- Hero image gốc
- Hero final copy và CTA direction
- Featured products collection cần dùng ở homepage
- Shape collections để map vào `Browse by shape`
- Length collections để map vào `Browse by length`
- Tile images hoặc quyết định dùng collection image mặc định
- Approved trust/education content cho size, application, care, shipping, support
- Accessories collection thật
- Curated bundle collection thật nếu muốn merch ở homepage
- Newsletter positioning/copy cuối cùng nếu merchant muốn tinh chỉnh

## 12. Recommended next step: Phase 4 collection and discovery experience

Recommended next step:

- Phase 4 collection and discovery experience

Lý do:

- homepage shell và reusable browse section đã sẵn
- product taxonomy/metafield foundation đã có
- bước tiếp theo hợp lý là collection grid, filters, sort, product-card rules, quick-add safety, và search/discovery parity

## 13. Phase 3A.1 semantic and schema cleanup

### What changed

- `sections/image-banner.liquid` được extend bằng setting `heading_tag` giới hạn ở `h1` hoặc `h2`, mặc định là `h2`.
- Homepage hero instance trong `templates/index.json` được set `heading_tag: h1` để hero headline trở thành semantic page heading trong main content.
- `sections/header.liquid` được chỉnh tối thiểu để brand/logo wrapper trên homepage dùng `div.header__heading` thay vì `h1`, giữ nguyên styling header hiện có.
- `sections/browse-collections.liquid` được siết lại theo constraint đã duyệt: schema `max_blocks` là `6`, storefront chỉ render bình thường khi có từ 2 tile hợp lệ trở lên, và Theme Editor placeholder nhắc đúng range 2-6.

### Why the H1 correction was necessary

Phase 3A đã xác minh một lệch semantic quan trọng của Dawn: `image-banner` cho phép chọn `heading_size: h1` nhưng vẫn render tag thật là `h2`, trong khi header brand/logo lại đang là `h1` trên homepage. Kết quả là homepage có `h1` nằm ở chrome của header thay vì ở nội dung chính, không khớp với mục tiêu semantic và accessibility của storefront.

### How exactly one meaningful H1 is ensured on homepage

- Homepage hero heading là block duy nhất trong `templates/index.json` được set `heading_tag: h1`.
- `image-banner` mặc định vẫn giữ semantic tag là `h2` cho các use case khác, nên patch không đổi hành vi chung của Dawn ngoài những instance được opt in.
- Header brand/logo trên homepage không còn render bằng `h1`; wrapper chỉ còn là `div.header__heading`.
- Kết quả sau patch: homepage chỉ còn đúng một `h1`, nằm trong `main` và là hero heading.

### Browse section tile-limit correction

- Range được chốt cho `browse-collections` là 2-6 tile.
- Schema block limit hiện là `6`.
- Nếu merchant mới cấu hình 1 collection block, section không render ngoài storefront thường; trong Theme Editor sẽ hiện note yêu cầu thêm một block nữa để đạt range đã duyệt.
- Layout desktop/mobile hiện tại vẫn dùng cùng settings cũ và wrap ổn trong phạm vi 2-6 block.

### Files changed

- `sections/header.liquid`
- `sections/image-banner.liquid`
- `sections/browse-collections.liquid`
- `templates/index.json`
- `docs/vietnamese/phase-3a-homepage-composition-log.md`

### Validation results

- `shopify theme check`: pass, `170 files inspected`, `8 warnings`, `0 errors`; 8 warnings còn lại là baseline warnings của Dawn.
- Local preview: kiểm tra trên `http://127.0.0.1:9293/` thành công ở desktop mặc định `1280x720` và mobile `390x844`.
- Homepage DOM: đúng `1` thẻ `h1`, text là `Find your next press-on set`, nằm trong `main`; header không còn `h1`.
- Header wrapper trên homepage hiện là `DIV.header__heading`; hero heading render tag thật là `H1`.
- Collection page `http://127.0.0.1:9293/collections/all` và product page `http://127.0.0.1:9293/products/gift-card` vẫn giữ `1` main-content `h1` và không có `h1` trong header.
- Keyboard evidence: hero CTA và header logo link đều là native anchor có `href`, `tabIndex: 0`, visible, và automation có thể focus trực tiếp vào từng link; browser runtime vẫn không replay ổn định full `Tab` traversal/Enter navigation nên keyboard proof được ghi nhận theo native semantics + focusability.
- Browser console check trên homepage: không có `error` hoặc `warn`.
