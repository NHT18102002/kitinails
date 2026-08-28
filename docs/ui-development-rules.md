# UI Development Rules

Tài liệu này là bộ luật canonical cho mọi thay đổi giao diện của Shopify theme tại repository root. Nó áp dụng cho thiết kế mới, sửa visual, responsive layout, component, interaction, accessibility, animation và UI performance.

Tài liệu này không áp dụng cho `tools/product-publisher`, `tools/catalog-import`, Shopify Admin business logic hoặc checkout internals.

## 1. Thứ tự ưu tiên

Khi các mục tiêu xung đột, quyết định theo thứ tự sau:

1. Shopify commerce, security và data integrity.
2. Online Store 2.0, Theme Editor và public compatibility contracts.
3. Accessibility và keyboard operability.
4. Độ chính xác với authorized Ersa Nails reference hoặc design đã được duyệt.
5. Responsive behavior và content resilience.
6. Performance.
7. Reusability và maintainability.
8. Độ ngắn của code.

Không được hy sinh product form, variant selection, cart, search, filtering, customer flows hoặc Theme Editor để đạt visual nhanh hơn.

Các nguồn quy tắc được áp dụng theo thứ tự:

1. Yêu cầu cụ thể của project owner.
2. `AGENTS.md` và Shopify safety/compatibility rules.
3. `docs/theme-architecture.md`.
4. `docs/theme-feature-ownership.md`.
5. Tài liệu này.
6. Kết quả từ skill `ui-ux-pro-max`.

`ui-ux-pro-max` cung cấp design intelligence và review guidance; nó không được phép thay thế Shopify architecture, authorized reference hoặc technology constraints của repository.

## 2. Quy trình sử dụng `ui-ux-pro-max`

Phải sử dụng skill `ui-ux-pro-max` trước khi thiết kế, code, review hoặc sửa bất kỳ phần nào làm thay đổi:

- visual appearance;
- page/component layout;
- typography hoặc color;
- responsive behavior;
- navigation hoặc interaction;
- accessibility;
- animation/motion;
- forms và user feedback;
- component usability.

Không cần dùng skill cho backend-only logic, data import, infrastructure hoặc script không liên quan đến UI.

### Cách chọn search mode

- Page mới hoặc thay đổi visual direction toàn hệ thống: dùng `--design-system`.
- Component hoặc vấn đề UX cụ thể: dùng một `--domain` phù hợp như `ux`, `style`, `color`, `typography`, `icons` hoặc `landing`.
- Mỗi query chỉ có một mục tiêu chính và một constraint hữu ích.
- Nếu kết quả không đúng domain hoặc không phù hợp Shopify web, thử lại đúng một lần với query hẹp hơn.
- Không persist kết quả thành design-system files nếu task không yêu cầu rõ ràng.
- Không đưa private store data, customer data, credentials hoặc nội dung bảo mật vào query.

Skill không có stack Shopify/Liquid riêng. Vì vậy:

- Không giả định React, Tailwind, shadcn hoặc native-app stack.
- Không cài package do skill gợi ý.
- Không thêm GSAP, icon package hoặc frontend framework nếu chưa có yêu cầu riêng và approval phù hợp.
- Chuyển guidance phù hợp sang Liquid, CSS và vanilla JavaScript hiện hữu.
- Bỏ qua native-only guidance như haptics, iOS tab bar hoặc Android system navigation khi làm storefront web.

## 3. UI change brief bắt buộc

Trước khi sửa code, task phải xác định được:

```text
Feature/page:
Reference/design source:
Target viewports:
Liquid owner:
CSS owner:
JavaScript owner:
Merchant settings affected:
Shopify/Dawn contracts to preserve:
Required states:
Regression surfaces:
```

Required states phải xét khi có liên quan:

- default;
- hover, focus-visible và active;
- loading;
- empty;
- success và error;
- disabled;
- sale và sold-out;
- unavailable variant;
- long content và missing media;
- signed-in/signed-out;
- empty/filled cart.

Không bắt đầu implementation nếu chưa xác định owner và regression surfaces.

## 4. Ownership và phạm vi file

Mọi CSS và JavaScript phải có đúng một feature owner được ghi trong `docs/theme-feature-ownership.md`.

Chọn CSS owner theo thứ tự hẹp nhất:

| Phạm vi | Owner |
| --- | --- |
| Primitive value dùng xuyên theme | `theme-tokens.css` |
| Foundation thực sự dùng toàn site | `theme-foundation.css` |
| Header hoặc footer | `shell-*.css` |
| Component dùng lại | `component-*.css` |
| Feature dùng trên nhiều surface | `feature-*.css` |
| Chỉ một page type | `page-*.css` |
| Chỉ một section độc lập | `section-*.css` |

Quy tắc bắt buộc:

- Không load global asset cho feature chỉ xuất hiện trên một số page.
- Page asset do `main-*` section tương ứng load.
- Section asset do section owner load.
- Không load lại cùng asset từ nhiều section nếu có thể tránh.
- Không tạo catch-all global stylesheet hoặc script.
- Asset mới phải được thêm vào feature ownership map trong cùng change.
- Mọi thay đổi phải giới hạn trong một vertical slice; không cleanup feature khác trong cùng checkpoint.

## 5. Compatibility zones và cascade

Các file `brand-NN-*` và `*-cascade-*` là compatibility zones giữ source order của giao diện hiện tại.

Không được:

- tạo thêm `brand-NN-*`;
- tạo `custom.css`, `overrides.css`, `fix.css`, `final.css` hoặc file tương đương;
- append rule mới vào cuối cascade chỉ để thắng specificity;
- thêm `@layer` trong khi ordered cascade còn là compatibility contract;
- thêm `!important`;
- giữ đồng thời rule cũ và rule mới cùng chịu trách nhiệm cho một state.

Chỉ chỉnh compatibility zone khi change đang thay thế, sửa hoặc loại bỏ chính rule hiện hữu trong zone đó. Rule thiết kế mới phải đi vào canonical feature owner. Nếu rule cũ xung đột, xử lý rule cũ tại source thay vì thêm final override.

`base.css` là Dawn foundation và không phải nơi chứa styling riêng của Ersa Nails feature.

## 6. Liquid và component composition

Section chịu trách nhiệm:

1. Đọc Theme Editor settings.
2. Chuẩn bị Shopify objects và fallback data.
3. Điều phối shared snippets.
4. Chứa backward-compatible schema.

Snippet chịu trách nhiệm render một component contract rõ ràng.

Quy tắc:

- Shared snippet phải nhận arguments tường minh.
- Snippet mới không phụ thuộc ngầm vào `section`, `block`, `product` hoặc global context nếu caller có thể truyền giá trị.
- Dùng `render`, không quay lại legacy `include`.
- Dùng Shopify native objects, forms, routes và Liquid filters trước custom data plumbing.
- Không hard-code product, collection, menu hoặc URL khi merchant cần chỉnh được.
- Text customer-facing phải localizable khi phù hợp.
- Dùng `block.shopify_attributes` cho merchant-editable blocks.
- Namespace DOM IDs bằng `section.id` hoặc `block.id`.
- Xử lý empty setting, missing image, missing collection/product và unavailable product.
- Không duplicate toàn bộ section để tạo một visual variant nhỏ; dùng setting/modifier khi contract vẫn là một component.

Chỉ tạo shared component khi ít nhất hai surface thật sự chia sẻ:

- semantics;
- data contract;
- markup;
- behavior;
- accessibility requirements.

Không hợp nhất component chỉ vì chúng có appearance gần giống nhau.

## 7. Theme Editor contract

- Không đổi public section filename, setting ID, block type hoặc template section ID chỉ để chuẩn hóa naming.
- Setting mới phải backward-compatible và có default giữ behavior hiện tại.
- Không xóa setting/block nếu chưa có migration được owner phê duyệt.
- Section phải hoạt động khi add, remove, reorder và reload.
- JavaScript phải init lại an toàn trên `shopify:section:load`.
- Per-instance values nên truyền bằng CSS custom properties, `data-*` hoặc JSON script; không sinh stylesheet toàn cục cho từng instance.
- Không làm mất app-block surfaces hoặc `@app` rendering.
- Schema labels/help text phải mô tả rõ cho merchant; không dùng internal implementation terminology nếu không cần thiết.

## 8. CSS rules

### Tokens

- Dùng token hiện hữu trước khi tạo giá trị mới.
- Giá trị lặp giữa nhiều feature mới được đưa vào `theme-tokens.css`.
- Giá trị chỉ thuộc một component dùng component-level custom property.
- Không tạo global token cho một giá trị one-off.
- Color mang semantics phải dùng semantic token thay vì raw color trong component.
- Spacing, radius, shadow, icon size và motion phải theo scale nhất quán.

### Naming

Với code mới, ưu tiên:

```text
.ersa-feature
.ersa-feature__element
.ersa-feature--modifier
.is-active
.has-error
[data-feature-action]
```

- Class dùng cho styling.
- `data-*` dùng làm JavaScript hook.
- `.is-*` và `.has-*` dùng cho runtime state.
- Không dùng text content hoặc DOM position làm hook.
- Không styling bằng generated Shopify IDs.

### Specificity

- Ưu tiên selector một class.
- Hạn chế selector sâu quá ba cấp.
- Không tạo selector dài chỉ để thắng Dawn hoặc legacy rule.
- Không dùng ID selector cho styling.
- Không thêm inline style trừ CSS custom properties sinh từ per-instance Liquid settings.
- Khi sửa component, xử lý rule tại owner thay vì tăng specificity ở consumer.

### Layout

- Mobile-first.
- Dùng Grid/Flexbox theo semantics; tránh absolute positioning cho primary layout.
- Container width và gutters phải nhất quán với theme.
- **Desktop horizontal-list default:** từ `990px` trở lên, danh sách ngang phải căn giữa phần nội dung đang nhìn thấy trong một content frame có `max-width` rõ ràng. Nếu danh sách dài hơn frame, giữ overflow ở chính rail để có thể drag/scroll/navigate tới item còn lại; không dùng offset/peek ở card đầu làm cả rail lệch trái. Bất kỳ ngoại lệ canh trái nào phải được yêu cầu hoặc ghi rõ tại feature owner.
- Không dùng fixed height cho merchant-authored content nếu có thể gây clipping.
- Text/flex/grid children phải shrink được; long token dùng `overflow-wrap: anywhere` khi cần.
- Không gây horizontal page scroll ở mobile.
- Sticky/fixed UI phải chừa không gian và không che focused element hoặc page content.
- Z-index mới phải thuộc một documented layer; không tùy ý tăng đến giá trị cực lớn.

### Typography và iconography

- Không dùng heading element chỉ để đạt visual size.
- Body text mobile không nhỏ hơn mức đọc được; form input text phải tránh iOS auto-zoom.
- Long-form text giữ readable line length.
- Price, countdown và số thay đổi theo thời gian nên dùng tabular figures khi phù hợp.
- Không dùng emoji làm structural icon.
- Ưu tiên icon SVG hiện có trong `assets/`; icon mới phải cùng visual language, stroke và sizing system.
- Decorative icon có visible text tương đương phải `aria-hidden="true"`.

## 9. Responsive rules

Canonical visual viewports:

```text
1440px desktop
1024px laptop
768px tablet
390px mobile
```

Ngoài bốn viewport trên, component quan trọng phải được spot-check tại small mobile khoảng `375px` và landscape khi layout có nguy cơ lỗi.

- Chỉ dùng breakpoint hiện hữu trừ khi thiết kế chứng minh cần breakpoint mới.
- Breakpoint mới phải giải quyết layout constraint, không nhắm một model thiết bị cụ thể.
- Không ẩn core commerce action trên mobile.
- Content quan trọng phải xuất hiện trước secondary content trên mobile.
- Hover không được là cách duy nhất để xem hoặc thực hiện action.
- Hover effects chỉ kích hoạt khi device thực sự hỗ trợ hover/fine pointer nếu behavior có thể gây lỗi touch.
- Drag/swipe interaction phải có visible buttons và keyboard alternative.
- Badge, chip và active filters phải wrap/reflow trước khi truncate hoặc ẩn.
- Browser zoom không được disable.

## 10. Responsive media

Mọi image mới phải:

- dùng Shopify `image_url`;
- có responsive widths/srcset;
- có `sizes` phản ánh layout thực tế;
- có `width` và `height` hoặc reserved aspect ratio;
- có alt phù hợp; ảnh trang trí dùng alt rỗng;
- lazy-load nếu không phải above-the-fold/LCP;
- không gửi desktop asset quá lớn cho mobile.

Chỉ một image thực sự quan trọng nên nhận eager loading hoặc `fetchpriority="high"` trên một view. Không preload mọi hero slide hoặc mọi font variant.

Video phải:

- không autoplay audio;
- có poster và reserved dimensions;
- defer khi ngoài viewport nếu có thể;
- dừng hoặc giảm motion khi `prefers-reduced-motion` bật;
- dùng shared deferred-media behavior cho YouTube/Vimeo khi phù hợp.

## 11. JavaScript rules

- Giữ vanilla JavaScript, deferred classic scripts và Dawn-compatible Web Components.
- Không thêm frontend framework, jQuery hoặc build dependency cho UI task thông thường.
- Một custom-element name chỉ có một registration owner.
- Init phải idempotent trên initial load và `shopify:section:load`.
- Global listeners, observers, timers và subscriptions phải cleanup hoặc chống đăng ký lặp.
- Query trong phạm vi component trước khi dùng `document`.
- Dùng event delegation trong local component khi giúp giảm listeners.
- Không monkey-patch prototype của component khác.
- Không dùng JavaScript để giải quyết vấn đề thuần CSS.
- New JavaScript hooks dùng `data-*`, không phụ thuộc styling class nếu có thể.
- High-frequency events phải debounce/throttle hợp lý; batch DOM reads/writes để tránh layout thrashing.
- Animation ưu tiên `transform` và `opacity`, không animate layout properties nếu có lựa chọn khác.
- Animation phải interruptible và state correctness không phụ thuộc riêng vào `animationend`/`transitionend`.
- Pure helpers phải chạy được trong Node không cần browser hoặc Shopify globals.
- Cross-component communication dùng custom events hoặc Dawn pub/sub.

Phải giữ các compatibility contracts nếu task không phải migration riêng:

- Shopify AJAX endpoints và payloads;
- section IDs dùng trong Section Rendering API;
- `PUB_SUB_EVENTS.cartUpdate` và variant events;
- Standard Actions/Standard Events adapters;
- product form, cart, predictive search và facets DOM hooks.

## 12. Interaction và feedback

- Primary actions phải dùng semantic `<button>` hoặc `<a>` phù hợp.
- Icon-only controls phải có accessible name.
- Async action phải có loading feedback và chống submit lặp.
- Disabled state phải có semantic `disabled` hoặc `aria-disabled` đúng behavior, không chỉ thay màu.
- Error phải nêu nguyên nhân và cách khắc phục khi có thể.
- Form error phải nằm gần field, liên kết bằng `aria-describedby` và được announce phù hợp.
- Empty state phải giải thích trạng thái và cung cấp next action hợp lý.
- Destructive action phải được phân biệt và xác nhận khi hậu quả khó phục hồi.
- Toast/live update không tự ý lấy focus; dùng live region phù hợp.
- Primary CTA không bị cạnh tranh bởi nhiều action có visual weight tương đương.

Touch target cho control quan trọng nên đạt khoảng `44 x 44 CSS px`. WCAG 2.2 minimum target requirement vẫn phải được thỏa mãn khi visual control nhỏ hơn thông qua hit area hoặc spacing phù hợp.

## 13. Accessibility gate

Mọi UI change phải kiểm tra:

- một logical `h1` cho page;
- heading hierarchy có nghĩa;
- landmark và reading order đúng;
- visible focus state;
- keyboard access cho mọi action;
- focus không bị sticky header/drawer che;
- modal/drawer có Escape, focus trap và focus return;
- menu/accordion/filter expose đúng `aria-expanded`, `aria-controls`, selected/pressed states;
- meaningful images có alt; decorative images có alt rỗng;
- normal text contrast tối thiểu 4.5:1, large text và non-text UI theo threshold phù hợp;
- error/success/sale/sold-out không chỉ truyền đạt bằng màu;
- dynamic cart/filter/count updates dùng contextual live announcement khi cần;
- reduced motion được tôn trọng;
- carousel auto-rotation có pause/stop và dừng khi focus hoặc reduced motion;
- authentication không chặn paste/password manager;
- zoom và text enlargement không làm mất nội dung hoặc action.

Không remove focus ring nếu chưa cung cấp replacement có độ tương phản rõ ràng.

## 14. Performance gate

- Không tăng global CSS/JS cho một local feature.
- Không load cùng asset nhiều lần không cần thiết.
- Không thêm third-party script nếu chưa có business need, performance review và approval.
- Reserve dimensions cho image, video, drawer, banner và async/app content để tránh CLS.
- Không render đồng thời desktop/mobile DOM lớn nếu một responsive structure có thể dùng chung.
- Tránh Liquid loop lồng nhau trên product/collection lists.
- Không preload non-critical asset.
- Deferred scripts phải giữ `defer` hoặc lifecycle tương đương.
- Mọi tăng trưởng global bytes phải được giải thích.

Chạy asset report trước và sau thay đổi lớn:

```bash
npm run report:theme:assets
```

## 15. Commerce-specific safety

UI redesign không được thay đổi ngoài chủ đích:

- product/variant URLs;
- selected variant state;
- product form IDs và line-item properties;
- selling plan, quantity rules hoặc volume pricing;
- add-to-cart payloads;
- cart line keys, quantity/remove operations và sections requested;
- checkout entry flow;
- filter query parameters, sort order hoặc browser history;
- predictive search route;
- customer authentication forms;
- dynamic checkout/app blocks;
- localization form submissions.

Không tạo fake stock, fake urgency, fake reviews hoặc discount state không được Shopify data/approved content cung cấp.

## 16. Reference-driven UI workflow

Khi task yêu cầu match authorized reference:

1. Xác định public URL và page state.
2. Quan sát trực tiếp desktop và mobile behavior.
3. Ghi rõ phần nào là observation, inference hoặc unknown.
4. Chụp baseline local trước thay đổi.
5. Chỉ dùng `ui-ux-pro-max` để kiểm tra usability/accessibility hoặc lấp khoảng trống mà reference không xác định.
6. Không để generic skill recommendation làm thay đổi brand direction đã được reference quyết định.
7. So sánh local với reference tại bốn canonical viewports.

Research note phải ghi URL, viewport, observation/inference, confidence, functional takeaway và implementation decision theo `AGENTS.md`.

## 17. Validation workflow

### Trước khi code

- Đọc relevant template, section, snippet và owner assets.
- Kiểm tra `docs/theme-feature-ownership.md`.
- Load `ui-ux-pro-max` và dùng mode nhỏ nhất phù hợp.
- Ghi baseline visual và interaction states.
- Xác định keyboard, commerce và Theme Editor regressions.

### Trong khi code

- Chỉ sửa một vertical slice.
- Không format hoặc cleanup file ngoài phạm vi.
- Không tạo duplicate component hoặc final override.
- Kiểm tra console và keyboard sớm.
- Test section add/remove/reorder/reload nếu schema hoặc behavior thay đổi.

### Automated checks

```bash
npm run check:theme:all
npm run report:theme:assets
npm run test:theme:e2e
```

- `check:theme:all`: Shopify Theme Check và Node unit/contract tests.
- `report:theme:assets`: theo dõi asset size/global ownership.
- `test:theme:e2e`: Chromium và WebKit khi preview environment có sẵn.

Chromium là canonical visual snapshot engine. Không tự update golden snapshot chỉ để test pass.

### Manual checks

- Visual: `1440`, `1024`, `768`, `390px`.
- Keyboard-only flow.
- Reduced motion.
- Browser console/network errors.
- Theme Editor add/remove/reorder/reload.
- Long text, missing image và empty state.
- Relevant commerce states.

## 18. Feature regression matrix

| Feature | Required regression checks |
| --- | --- |
| Product card | Sale, sold-out, secondary image, card URL, price, rating, keyboard focus, single/multi-variant quick add |
| PDP | Default/single/multi/sold-out variants, gallery, zoom, quantity, add-to-cart, pickup, size guide, dynamic checkout, section reload |
| Collection | Filter, sort, apply, clear, mobile drawer, pagination, promo tile, back/forward history |
| Search | Results/no-results, predictive search, query preservation, filters, sort, articles/pages/products |
| Cart | Empty/filled, add, quantity, remove, error, progress, drawer focus/Escape, checkout CTA |
| Header | Sticky states, desktop mega menu, mobile drawer, predictive search, localization, account, cart trigger |
| Footer | Mobile accordions, newsletter, localization, social/policy links, keyboard navigation |
| Marketing section | Empty settings, block add/remove/reorder, slider buttons/touch/drag, long content, reduced motion |
| Customer/forms | Labels, autocomplete, validation, error announcement, password manager/paste, keyboard submit |

## 19. Forbidden patterns

- Không thêm final override stylesheet.
- Không thêm CSS/JS global vì tiện.
- Không dùng `base.css` cho feature styling.
- Không duplicate `card-product`, facets, cart hoặc product form thành page-specific implementation.
- Không copy toàn bộ section để đổi một visual variant nhỏ.
- Không đổi Dawn/Shopify DOM hook mà chưa kiểm tra mọi consumer.
- Không hard-code Shopify data trong JavaScript.
- Không dùng hover-only interaction.
- Không dùng emoji làm structural icon.
- Không thêm arbitrary device-specific breakpoint.
- Không xóa app-block surface.
- Không thêm dependency/framework/build pipeline cho UI task thông thường.
- Không gộp redesign với unrelated refactor hoặc cleanup.
- Không publish production theme nếu user chưa yêu cầu rõ ràng.

## 20. Definition of Done

Một UI change chỉ hoàn tất khi:

- visual đúng với approved design/reference tại bốn canonical viewports;
- không phá Theme Editor;
- keyboard và accessibility checks pass;
- không có console error hoặc unresolved Liquid/asset reference;
- commerce/search/navigation flow liên quan vẫn hoạt động;
- CSS/JS có đúng một owner;
- không có override, duplicate component hoặc global dependency mới không cần thiết;
- asset growth được kiểm tra và giải thích;
- Theme Check và unit/contract tests pass;
- E2E liên quan pass khi preview environment có sẵn;
- diff chỉ chứa feature và documentation/tests liên quan;
- ownership map được cập nhật nếu có component hoặc asset owner mới;
- final report nêu files changed, reference used, validation, viewports, known limitations và assumptions.
