# Shopify Theme Source Inventory

> Phạm vi: Shopify theme tại repository root, gồm `templates/`, `sections/`, `snippets/`, `assets/`, `layout/` và `config/`.
>
> Đây là báo cáo read-only về trạng thái source tại thời điểm kiểm tra. Không có file runtime nào được sửa, đổi tên hoặc di chuyển. `tools/product-publisher`, `tools/catalog-import` và dữ liệu ngoài theme không thuộc phạm vi.

## Snapshot và cách đọc báo cáo

| Thư mục | Số file | Vai trò chính |
| --- | ---: | --- |
| `templates/` | 20 | 19 JSON templates và 1 Liquid template cho gift card |
| `sections/` | 68 | 66 Liquid sections và 2 section-group JSON (`header-group`, `footer-group`) |
| `snippets/` | 55 | Liquid components/fragments dùng lại |
| `assets/` | 315 | 127 CSS, 45 JavaScript và 143 media assets |
| `layout/` | 2 | Layout storefront chính và password storefront |
| `config/` | 2 | Theme settings schema và dữ liệu settings hiện tại |

Các trạng thái section dùng trong báo cáo:

- **Active**: có mặt trong template hoặc section group hiện tại.
- **Disabled**: có trong JSON template nhưng `disabled: true`.
- **Preset-only**: có preset để merchant thêm trong Theme Editor nhưng chưa có trong template/group hiện tại.
- **Internal/AJAX**: section không cần nằm trong JSON template; được Shopify Section Rendering API hoặc JavaScript gọi bằng `section_id`.
- **Static layout**: được gọi trực tiếp bằng `{% section %}` từ layout.

Luồng render chính hiện tại là:

```text
layout/theme.liquid
  -> header-group.json -> header.liquid -> header/navigation snippets
  -> templates/*.json -> sections/*.liquid -> snippets/*.liquid
  -> footer-group.json -> footer.liquid
  -> CSS/JS assets được layout, section hoặc snippet load
```

## 1. Pages / Templates

### 1.1 Danh sách pages và template composition

| Page | Template file | Sections theo thứ tự render | Ghi chú |
| --- | --- | --- | --- |
| Home | `templates/index.json` | `slideshow`; 2 x `featured-collection` (disabled); 2 x `ersa-collection-grid`; `ersa-icon-row`; `ersa-must-have-essentials`; `ersa-reviews-carousel`; `ersa-social-gallery`; `newsletter`; `_blocks` | `_blocks` là Shopify-managed section type được contract test allowlist, không có file section local. |
| Product | `templates/product.json` | `main-product`; `ersa-product-benefits`; `ersa-product-island-glow` (disabled); `featured-collection`; `ersa-reviews-carousel`; `ersa-product-ugc-videos`; `collapsible-content`; `ersa-social-gallery` | PDP chính, recommendations, reviews, UGC, FAQ và social gallery. |
| Collection | `templates/collection.json` | `ersa-collection-campaign`; `main-collection-banner`; `main-collection-product-grid` | Campaign hero/countdown, collection heading/breadcrumb và grid có facets/sort/promo tile. |
| Cart | `templates/cart.json` | `main-cart-items`; `main-cart-footer` | Cart lines, quantity/remove, subtotal, checkout, progress và cross-sells. |
| Search | `templates/search.json` | `main-search` | Search form, predictive search, results cho product/article/page và facets/sort. |
| Blog | `templates/blog.json` | `main-blog` | Blog listing và pagination. |
| Article | `templates/article.json` | `main-article` | Featured image, title, content, share, app block và structured data. |
| Generic Page | `templates/page.json` | `main-page` | Render `page.title` và `page.content`. |
| Contact Page | `templates/page.contact.json` | `main-page`; `contact-form` | Custom page template duy nhất có suffix `.contact`. |
| List Collections | `templates/list-collections.json` | `main-list-collections` | Danh sách collection cards có pagination. |
| Customer Account | `templates/customers/account.json` | `main-account` | Account overview, orders và account details. |
| Customer Login | `templates/customers/login.json` | `main-login` | Login và recover password. |
| Customer Register | `templates/customers/register.json` | `main-register` | Đăng ký classic customer account. |
| Activate Account | `templates/customers/activate_account.json` | `main-activate-account` | Kích hoạt account và đặt password. |
| Reset Password | `templates/customers/reset_password.json` | `main-reset-password` | Reset customer password. |
| Customer Addresses | `templates/customers/addresses.json` | `main-addresses` | CRUD address với country/province selector. |
| Customer Order | `templates/customers/order.json` | `main-order` | Chi tiết order, line items, discounts, tax, shipping và billing. |
| 404 | `templates/404.json` | `main-404` | Not-found message và link quay lại. |
| Password | `templates/password.json` + `layout/password.liquid` | `email-signup-banner`; layout còn gọi `main-password-header` và `main-password-footer` | Storefront khóa bằng password, email signup và password modal. |
| Gift Card | `templates/gift_card.liquid` | Liquid standalone, `{% layout none %}` | Gift-card code, balance, QR code, Apple Wallet và copy-to-clipboard. |

Không có alternative template riêng cho product, collection, blog, article hoặc cart. Không có dedicated `policy` template trong repository; policy pages dùng behavior/template Shopify mặc định tương ứng.

### 1.2 Layouts

| File | Chức năng |
| --- | --- |
| `layout/theme.liquid` | Document shell chính: SEO/meta, Shopify Standard Events, CSS variables từ theme settings, global CSS/JS, conditional cart drawer/predictive search/localization, `header-group`, `content_for_layout`, `footer-group`, routes và translated runtime strings. |
| `layout/password.liquid` | Shell riêng cho password storefront; load `main-password-header`, password template content, `main-password-footer`, password modal assets và CSS riêng. |

`layout/theme.liquid` định nghĩa thêm hai analytics custom elements từ Shopify Standard Events: `collection-component` và `product-component`, đồng thời dispatch `PageViewEvent` sau `DOMContentLoaded`.

### 1.3 Section groups

| File | Composition hiện tại |
| --- | --- |
| `sections/header-group.json` | Một section `header` type `header`; menu `main-menu`, desktop mega menu, sticky always, account enabled. Không có announcement bar trong group hiện tại. |
| `sections/footer-group.json` | Một section `footer` type `footer`; ba text blocks Shop, Brand, Customer Service; newsletter, social, localization, payment và policies được bật. |

### 1.4 Theme config

| File | Nội dung |
| --- | --- |
| `config/settings_schema.json` | 22 nhóm cấu hình: theme info, logo/favicon, color schemes, typography, layout/spacing, animations, buttons, variant pills, inputs, product cards, collection cards, blog cards, content containers, media, popups, drawers, badges, brand information, social links, predictive search, currency format và cart. |
| `config/settings_data.json` | Giá trị merchant hiện tại, preset `Dawn`, color schemes, typography/layout/card/cart/social settings và cấu hình `main-password-header`/`main-password-footer`. Không thấy active app embed được lưu trong file này. |

## 2. Sections

### 2.1 Shell, commerce helpers và internal rendering sections

| Section | Chức năng | Được sử dụng ở đâu / trạng thái |
| --- | --- | --- |
| `sections/announcement-bar.liquid` | Announcement ticker, social links và country/language selector. | Preset-only; chưa có trong `header-group.json`. |
| `sections/apps.liquid` | Container generic cho Shopify app blocks (`@app`). | Preset-only; merchant có thể thêm qua Theme Editor. |
| `sections/bulk-quick-order-list.liquid` | Markup trả về cho bulk quick-add modal/order list. | Internal/AJAX: `global.js` fetch product URL với `section_id=bulk-quick-order-list`. |
| `sections/cart-drawer.liquid` | Thin section wrapper render shared `cart-drawer` snippet. | Internal/AJAX: `cart.js` fetch `/cart?section_id=cart-drawer`; layout render drawer trực tiếp khi `cart_type=drawer`. |
| `sections/cart-icon-bubble.liquid` | Cart icon và item-count bubble cho header. | Internal/AJAX: cart notification/product form refresh section này. |
| `sections/cart-live-region-text.liquid` | Nội dung live-region về estimated cart total. | Internal/AJAX compatibility section cho cart accessibility updates. |
| `sections/cart-notification-button.liquid` | Text/link “view cart” cập nhật theo cart count. | Internal/AJAX: `cart-notification.js`. |
| `sections/cart-notification-product.liquid` | Product vừa add, options, quantity và disclosure indicator trong notification. | Internal/AJAX: `cart-notification.js`. |
| `sections/disclosures.liquid` | Standalone product disclosure composition từ Shopify product disclosure metafield. | Preset-only; PDP hiện render `product-disclosures` trực tiếp. |
| `sections/footer.liquid` | Footer canonical: newsletter, menu/text/image/app blocks, social, localization, payment, policies và mobile accordions. | Active trong `footer-group.json`. |
| `sections/header.liquid` | Header canonical: logo, desktop links/mega menu, mobile drawer, search, account, localization, app blocks, cart notification và sticky behavior. | Active trong `header-group.json`. |
| `sections/main-password-header.liquid` | Logo và password-login trigger cho locked storefront. | Static layout: `layout/password.liquid`; settings lưu trong `settings_data.json`. |
| `sections/main-password-footer.liquid` | Password footer, Shopify link và social links. | Static layout: `layout/password.liquid`; settings lưu trong `settings_data.json`. |
| `sections/pickup-availability.liquid` | Store pickup preview và availability drawer cho variant. | Internal/AJAX: `pickup-availability.js` gọi `/variants/{id}?section_id=pickup-availability`. |
| `sections/predictive-search.liquid` | Server-rendered predictive results cho queries, collections, products, pages và articles. | Internal/AJAX: `predictive-search.js` gọi predictive search route với `section_id=predictive-search`. |
| `sections/quick-order-list.liquid` | Public quick-order list section cho product variants, pagination và bulk cart actions. | Preset-only. |
| `sections/related-products.liquid` | Shopify product recommendations grid. | Không có trong template hiện tại; được giữ như recommendations-compatible section, không có preset. |

### 2.2 Main page sections

| Section | Chức năng | Được sử dụng ở đâu / trạng thái |
| --- | --- | --- |
| `sections/main-404.liquid` | Nội dung trang 404. | Active: `templates/404.json`. |
| `sections/main-account.liquid` | Customer account dashboard và order history. | Active: `templates/customers/account.json`. |
| `sections/main-activate-account.liquid` | Form activate customer account. | Active: `templates/customers/activate_account.json`. |
| `sections/main-addresses.liquid` | Address list, add/edit/delete forms, country/province handling. | Active: `templates/customers/addresses.json`. |
| `sections/main-article.liquid` | Article blocks: app, image, title/meta, content, share và JSON-LD. | Active: `templates/article.json`. |
| `sections/main-blog.liquid` | Blog article grid/list và pagination. | Active: `templates/blog.json`. |
| `sections/main-cart-footer.liquid` | Cart note, subtotal, discounts, checkout/app blocks, free-shipping progress và cross-sells. | Active: `templates/cart.json`. |
| `sections/main-cart-items.liquid` | Cart lines, quantity popover, remove, errors và live regions. | Active: `templates/cart.json`; cũng là AJAX refresh target. |
| `sections/main-collection-banner.liquid` | Breadcrumb, collection title, optional description/image. | Active: `templates/collection.json`. |
| `sections/main-collection-product-grid.liquid` | Product grid, facets, sort, active filters, promo tile, quick add, bulk ordering và pagination. | Active: `templates/collection.json`; section rendering owner cho collection filtering. |
| `sections/main-list-collections.liquid` | Paginated collection-card grid. | Active: `templates/list-collections.json`. |
| `sections/main-login.liquid` | Login và password recovery forms. | Active: `templates/customers/login.json`. |
| `sections/main-order.liquid` | Customer order details, totals, addresses và unit pricing. | Active: `templates/customers/order.json`. |
| `sections/main-page.liquid` | Generic current page title/content. | Active: `templates/page.json` và `templates/page.contact.json`. |
| `sections/main-product.liquid` | PDP orchestrator: media, title/rating/price, variants, quantity, buy form, inventory, pickup, accordions, complementary/cross-sells, app blocks và schema. | Active: `templates/product.json`; 2,340 lines, section lớn nhất. |
| `sections/main-register.liquid` | Customer registration form. | Active: `templates/customers/register.json`. |
| `sections/main-reset-password.liquid` | Reset-password form. | Active: `templates/customers/reset_password.json`. |
| `sections/main-search.liquid` | Search input/predictive UI, facets/sort, product/article/page results và pagination. | Active: `templates/search.json`; section rendering owner cho search filtering. |

### 2.3 Reusable content, merchandising và brand sections

| Section | Chức năng | Được sử dụng ở đâu / trạng thái |
| --- | --- | --- |
| `sections/browse-collections.liquid` | Collection tile grid với custom image/title/text và responsive columns. | Preset-only. |
| `sections/collage.liquid` | Mixed collage blocks: image, product, collection và video. | Preset-only. |
| `sections/collapsible-content.liquid` | Configurable accordion rows với heading/content/page/icon. | Active: product FAQ trong `templates/product.json`; cũng có preset. |
| `sections/collection-list.liquid` | Configurable collection-card list/slider. | Preset-only. |
| `sections/contact-form.liquid` | Shopify contact form với validation messages. | Active: `templates/page.contact.json`. |
| `sections/custom-liquid.liquid` | Merchant-authored Liquid content. | Preset-only. |
| `sections/email-signup-banner.liquid` | Banner image/content/email form cho password/marketing surface. | Active: `templates/password.json`; cũng có preset. |
| `sections/ersa-as-seen-in.liquid` | Logo strip “As Seen In” với optional links. | Preset-only. |
| `sections/ersa-collection-campaign.liquid` | Campaign hero, overlay, countdown labels, optional marquee và deal content. | Active: `templates/collection.json`. |
| `sections/ersa-collection-grid.liquid` | Brand collection cards, custom/local image fallback, product count và view-all. | Active hai instance trong `templates/index.json`. |
| `sections/ersa-icon-row.liquid` | Trust/benefit row gồm icon, title và text. | Active: `templates/index.json`. |
| `sections/ersa-marquee.liquid` | Repeating text/icon marquee với màu, speed và spacing controls. | Preset-only. |
| `sections/ersa-must-have-essentials.liquid` | Editorial image/text kết hợp product rail cuộn độc lập từ collection và quick add; homepage hiện dùng collection `nails-art`. | Active: `templates/index.json`. |
| `sections/ersa-product-benefits.liquid` | PDP benefit grid với image, title và rich text. | Active: `templates/product.json`. |
| `sections/ersa-product-island-glow.liquid` | Product editorial/collection story với hai ảnh và CTA. | Có trong `templates/product.json` nhưng disabled. |
| `sections/ersa-product-ugc-videos.liquid` | Horizontal UGC video rail với poster, source URL, controls và reduced-motion handling. | Active: `templates/product.json`. |
| `sections/ersa-reviews-carousel.liquid` | Review/testimonial carousel với review image vuông, rating, author image và verified/sample state; review có/không ảnh được xen kẽ, track giới hạn trong khung căn giữa và nút điều hướng vòng lặp hai bên. | Active: `templates/index.json` và `templates/product.json`; CSS owner `assets/section-reviews-carousel.css`, JS owner `assets/section-reviews-carousel.js`. |
| `sections/ersa-social-gallery.liquid` | Social image gallery với caption/link. | Active: `templates/index.json` và `templates/product.json`. |
| `sections/ersa-testimonials.liquid` | Simpler testimonial cards với image, rating, quote và author. | Preset-only. |
| `sections/featured-blog.liquid` | Featured blog article cards/slider. | Preset-only. |
| `sections/featured-collection.liquid` | Reusable product rail/grid với view-all, slider, card options, quick add/bulk modes. | Active trên product (“you may like”); hai instance Home tồn tại nhưng disabled. |
| `sections/featured-product.liquid` | Merchant-addable product-detail composition dùng product primitives tương tự PDP, schema độc lập. | Preset-only; 1,499 lines. |
| `sections/image-banner.liquid` | Responsive hero/banner với image(s), overlay, review badge, headings và CTA blocks. | Preset-only. |
| `sections/image-with-text.liquid` | Image + content split section. | Preset-only. |
| `sections/multicolumn.liquid` | Responsive multi-column cards/slider. | Preset-only. |
| `sections/multirow.liquid` | Repeating image-with-text rows. | Preset-only. |
| `sections/newsletter.liquid` | Heading/text/email/app blocks và social links. | Active: `templates/index.json`. |
| `sections/page.liquid` | Merchant-selectable page-content section, khác với current-page entry `main-page`. | Preset-only. |
| `sections/rich-text.liquid` | Rich-text blocks: heading, caption, text, button. | Preset-only. |
| `sections/slideshow.liquid` | Responsive slideshow dùng shared slider component, images, review badge, text và CTAs. | Active: Home hero; cũng có preset. |
| `sections/video.liquid` | Deferred YouTube/Vimeo hoặc Shopify-hosted video section. | Preset-only. |

## 3. Components / Snippets

### 3.1 Product, product card và listing components

| Tên component | File | Chức năng | Được sử dụng ở đâu |
| --- | --- | --- | --- |
| Buy Buttons | `snippets/buy-buttons.liquid` | Product form, add-to-cart, dynamic checkout, recipient form và pickup availability. | `main-product`, `featured-product`. |
| Collection Card | `snippets/card-collection.liquid` | Reusable collection image/title card. | `collage`, `collection-list`, `main-list-collections`. |
| Product Card | `snippets/card-product.liquid` | Product-card orchestrator: media, title, badges, price, rating, quick add/bulk actions. | Collage, Home essentials/featured collection, collection grid, PDP complementary products, search, related products và product cross-sells. |
| Gift-card Recipient Form | `snippets/gift-card-recipient-form.liquid` | Optional recipient name/email/message/send date fields. | `buy-buttons`. |
| Price | `snippets/price.liquid` | Shared regular/sale/unit price markup và badges-compatible states. | Predictive search, product-card price, PDP price block. |
| Product Card Badges | `snippets/product-card-badges.liquid` | Sold-out/sale badges với explicit IDs/position. | `card-product`. |
| Product Card Media | `snippets/product-card-media.liquid` | Responsive primary/secondary product images và shape/ratio behavior. | `card-product`. |
| Product Card Price | `snippets/product-card-price.liquid` | Adapter truyền product/card context vào shared `price`. | `card-product`. |
| Product Card Quick Add | `snippets/product-card-quick-add.liquid` | Standard single-variant add hoặc quick-add modal trigger. | `card-product`. |
| Product Cross-sells | `snippets/product-cross-sells.liquid` | Render cross-sell product cards từ product data/metafield contract. | `main-product`. |
| Product Disclosures | `snippets/product-disclosures.liquid` | Disclosure summary/details từ `product.metafields.shopify.disclosure`. | Standalone `disclosures`, `main-product`, `featured-product`. |
| Product Facts | `snippets/product-facts.liquid` | Product facts/metadata đi kèm khu vực giá. | `product-price-block`. |
| Product Media | `snippets/product-media.liquid` | Render image/video/external video/3D model trong media modal. | `product-media-modal`. |
| Product Media Gallery | `snippets/product-media-gallery.liquid` | Main media slider/thumbnails/gallery controls. | `main-product`, `featured-product`. |
| Product Media Modal | `snippets/product-media-modal.liquid` | Lightbox/modal chứa tất cả product media. | `main-product`, `featured-product`. |
| Product Price Block | `snippets/product-price-block.liquid` | PDP price, volume pricing note, tax/shipping và installment form. | `main-product`, `featured-product`. |
| Product Rating Block | `snippets/product-rating-block.liquid` | Rating value/count markup từ product metafields. | `main-product`, `featured-product`. |
| Product Size Guide | `snippets/product-size-guide.liquid` | Size-guide modal từ selected page hoặc fallback content. | `main-product`. |
| Product Support Accordions | `snippets/product-support-accordions.liquid` | “What’s included”, application guide và care guide accordions. | `main-product`. |
| Product Thumbnail | `snippets/product-thumbnail.liquid` | Gallery thumbnail/media tile và open-modal control. | `product-media-gallery`. |
| Product Title Block | `snippets/product-title-block.liquid` | PDP/featured title, optional vendor/link behavior theo surface. | `main-product`, `featured-product`. |
| Product Variant Options | `snippets/product-variant-options.liquid` | Option values dưới dạng buttons/dropdown/swatches và availability states. | `product-variant-picker`. |
| Product Variant Picker | `snippets/product-variant-picker.liquid` | Variant selector wrapper và selected variant JSON. | `main-product`, `featured-product`. |
| Quantity Input | `snippets/quantity-input.liquid` | Accessible quantity controls, min/max/step, rules và progress bar. | `card-product`, `quick-order-list-row`. |
| Quick Order List | `snippets/quick-order-list.liquid` | Variant table/list, pagination, totals, bulk actions và cart-state JSON. | `quick-order-list`, `bulk-quick-order-list`. |
| Quick Order Row | `snippets/quick-order-list-row.liquid` | Một variant row với image, SKU, price, quantity và remove state. | `quick-order-list` snippet. |
| Swatch | `snippets/swatch.liquid` | Visual swatch markup từ Shopify swatch/color/image value. | `product-variant-picker`, `swatch-input`. |
| Swatch Input | `snippets/swatch-input.liquid` | Radio/checkbox input kết hợp swatch và accessible label. | Facets và product variant options. |
| Unit Price | `snippets/unit-price.liquid` | Unit price + measurement reference. | Order detail, cart totals, shared price và quick-order rows. |

### 3.2 Cart components

| Tên component | File | Chức năng | Được sử dụng ở đâu |
| --- | --- | --- | --- |
| Cart Cross-sells | `snippets/cart-cross-sells.liquid` | Product-card rail từ configured cart collection. | `main-cart-footer`, `cart-drawer`. |
| Cart Disclosure Indicator | `snippets/cart-disclosure-indicator.liquid` | Regulatory/product disclosure modal trigger/tooltip content trong cart. | `cart-notification-product`, `cart-line-item-details`. |
| Cart Drawer | `snippets/cart-drawer.liquid` | Full cart drawer shell, lines, totals, empty state, focus controls, note và checkout. | `layout/theme.liquid`, thin `sections/cart-drawer.liquid`. |
| Cart Line Item Details | `snippets/cart-line-item-details.liquid` | Product link/image/options/properties/discounts/disclosures cho một cart line. | Cart page và cart drawer. |
| Cart Line Item Total | `snippets/cart-line-item-total.liquid` | Original/final line price, discounts, unit price và loading state. | Cart page và cart drawer. |
| Cart Notification | `snippets/cart-notification.liquid` | Add-to-cart notification dialog shell. | `sections/header.liquid`. |
| Free Shipping Progress | `snippets/free-shipping-progress.liquid` | Threshold message và progress state từ `settings.free_shipping_threshold`. | Cart page footer và cart drawer. |

### 3.3 Navigation, localization và document components

| Tên component | File | Chức năng | Được sử dụng ở đâu |
| --- | --- | --- | --- |
| Breadcrumbs | `snippets/breadcrumbs.liquid` | Collection breadcrumb/navigation trail. | `main-collection-banner`. |
| Country Localization | `snippets/country-localization.liquid` | Country/currency selector options và search. | Announcement, header, footer, mobile header drawer. |
| Header Collection Menu | `snippets/header-collection-menu.liquid` | Collection-aware mega-menu content. | `header-primary-links`. |
| Header Primary Drawer | `snippets/header-primary-drawer.liquid` | Canonical mobile navigation drawer, localization và social controls. | `sections/header.liquid`. |
| Header Primary Links | `snippets/header-primary-links.liquid` | Canonical desktop/menu link tree và mega-menu branching. | Header và header mobile drawer. |
| Header Search | `snippets/header-search.liquid` | Search modal/form và optional predictive-search result container. | `sections/header.liquid`. |
| Language Localization | `snippets/language-localization.liquid` | Language selection list. | Announcement, header, footer, mobile drawer. |
| Meta Tags | `snippets/meta-tags.liquid` | Open Graph, Twitter card và canonical social metadata. | `layout/theme.liquid`, `layout/password.liquid`. |
| Social Icons | `snippets/social-icons.liquid` | Social network icon links từ global settings. | Announcement, footer, newsletter, mobile drawer. |

### 3.4 Shared UI và content components

| Tên component | File | Chức năng | Được sử dụng ở đâu |
| --- | --- | --- | --- |
| Article Card | `snippets/article-card.liquid` | Blog/article image, title, excerpt, author/date card. | Featured blog, blog page, search results. |
| Facets | `snippets/facets.liquid` | Desktop/mobile filters, sort, active filters, price range, swatches, drawer và show-more. | Collection product grid và search. |
| Accordion Icon | `snippets/icon-accordion.liquid` | Maps icon setting values sang SVG icon assets. | Collapsible content, PDP accordions, icon-with-text. |
| Icon With Text | `snippets/icon-with-text.liquid` | Product trust/benefit icons với heading text. | `main-product`, `featured-product`. |
| Loading Spinner | `snippets/loading-spinner.liquid` | Shared loading indicator. | Product forms/cards, cart totals, facets, search, predictive search, gallery và quick-order surfaces. |
| Pagination | `snippets/pagination.liquid` | Accessible previous/next/page-number pagination. | Article comments, blog, collection, list collections, search, quick-order list. |
| Price Facet | `snippets/price-facet.liquid` | Min/max price inputs và range behavior. | `facets`. |
| Progress Bar | `snippets/progress-bar.liquid` | Generic progress element used by quantity/volume rules. | `quantity-input`. |
| Share Button | `snippets/share-button.liquid` | Native Web Share/copy-link disclosure. | Article, main product, featured product. |
| Theme Brand Styles | `snippets/theme-brand-styles.liquid` | Ordered loader cho 41 `brand-NN-*` CSS ownership slices để giữ cascade. | Layout fallback và late-cascade anchor trong reviews section. |

## 4. JavaScript Components

Theme dùng vanilla JavaScript, deferred classic scripts và Web Components theo Dawn. Không có frontend framework hoặc storefront build pipeline.

### 4.1 Global, shell và shared UI JavaScript

| Module | Component / feature xử lý | Load bởi |
| --- | --- | --- |
| `assets/constants.js` | Khai báo `PUB_SUB_EVENTS` cho cart, quantity, variant và option changes. | `layout/theme.liquid`. |
| `assets/pubsub.js` | In-memory `subscribe`, `unsubscribe`, `publish`. | `layout/theme.liquid`. |
| `assets/global.js` | Core utilities/focus trap và custom elements: `quantity-input`, `menu-drawer`, `header-drawer`, `modal-dialog`, `bulk-modal`, `modal-opener`, `deferred-media`, `slider-component`, `slideshow-component`, `variant-selects`, `product-recommendations`, `account-icon`, `bulk-add`. | Theme và password layouts. |
| `assets/animations.js` | Reveal-on-scroll và stagger animations; re-init trong Theme Editor. | Theme layout khi animation setting bật. |
| `assets/custom-theme.js` | Mouse drag-scroll cho homepage product slider, có idempotent init trên section reload. | Theme layout. |
| `assets/details-disclosure.js` | `details-disclosure` và `header-menu`: open/close/focus behavior. | Theme layout. |
| `assets/details-modal.js` | `details-modal` dialog behavior, focus trap và close. | Theme và password layouts. |
| `assets/localization-form.js` | `localization-form`, country/language selection, search/filter và submit. | Theme layout khi có nhiều locale/country. |
| `assets/search-form.js` | Base `search-form`: clear/reset, synchronize search inputs và focus state. | Theme layout. |
| `assets/predictive-search.js` | `predictive-search`: debounce, Section Rendering request, keyboard navigation, live status và Standard Search events. | Theme layout khi predictive search enabled. |
| `assets/shell-header.js` | `sticky-header`: sticky/reveal/hide state, predictive search/disclosure close và lifecycle cleanup. | `sections/header.liquid`. |
| `assets/shell-footer.js` | Mobile footer accordions và desktop reset; idempotent section reload init. | `sections/footer.liquid`. |
| `assets/show-more.js` | `show-more-button` cho truncated option/facet/content lists. | Facets và product sections. |
| `assets/share.js` | `share-button`, Web Share API hoặc copy-to-clipboard fallback. | `share-button` snippet. |
| `assets/theme-editor.js` | Theme Editor block selection/reorder hooks cho slideshow/product media. | Product/featured-product/slideshow sections. |
| `assets/password-modal.js` | `password-modal` specialization của `DetailsModal`. | Password layout. |
| `assets/standard-actions-override.js` | Shopify Standard Actions cart adapter; giữ AJAX endpoints, requested sections và `PUB_SUB_EVENTS.cartUpdate`. | Theme layout. |

### 4.2 Product and merchandising JavaScript

| Module | Component / feature xử lý | Load bởi |
| --- | --- | --- |
| `assets/product-form.js` | `product-form`: AJAX add-to-cart, error handling, cart drawer/notification render và Standard Cart events. | Product, featured product, collection rails/grids, essentials. |
| `assets/product-info.js` | `product-info`: variant change orchestration, section HTML fetch/morph, price/inventory/quantity/pickup updates và pub/sub. | `main-product`, `featured-product`. |
| `assets/media-gallery.js` | `media-gallery`: thumbnail navigation, active media, AR button và media positioning. | Product sections/gallery snippet. |
| `assets/magnify.js` | Cursor/zoom behavior cho product images. | `main-product`, `featured-product` khi zoom enabled. |
| `assets/product-modal.js` | `product-modal` specialization của shared modal dialog. | Product sections. |
| `assets/product-model.js` | `product-model`/Shopify Model Viewer UI cho 3D media. | Product sections khi có model. |
| `assets/pickup-availability.js` | `pickup-availability` và `pickup-availability-drawer`; fetch availability theo variant. | `buy-buttons`. |
| `assets/price-per-item.js` | `price-per-item`: quantity/variant-aware unit and volume pricing. | Product, listing, cart/quick-order surfaces. |
| `assets/quantity-popover.js` | `quantity-popover`: open/close quantity rules and volume pricing UI. | Cart, collection, featured collection, quick-order. |
| `assets/quick-add.js` | `quick-add-modal`: fetch product section markup, open modal, manage media/pickup focus. | Product cards/collections/PDP recommendations. |
| `assets/quick-add-bulk.js` | `quick-add-bulk`: multi-variant add, section refresh và cart events. | Featured collection và collection grid. |
| `assets/quick-order-list.js` | `quick-order-list` + remove-all component: pagination, variant quantities, bulk update/remove và cart synchronization. | Quick-order sections and listing surfaces supporting bulk mode. |
| `assets/recipient-form.js` | `recipient-form`: gift-card recipient field expansion, validation và hidden properties. | Gift-card recipient snippet. |
| `assets/disclosures.js` | `disclosures-content`: product disclosure item switching/open behavior. | Product disclosure snippet. |
| `assets/section-product-ugc-videos.js` | UGC rail previous/next scrolling và reduced-motion video handling. | `ersa-product-ugc-videos`. |

### 4.3 Collection and search JavaScript

| Module | Component / feature xử lý | Load bởi |
| --- | --- | --- |
| `assets/facets.helpers.js` | Pure helper tạo query parameters, hỗ trợ singleton keys và duplicate facet values. | Collection/search main sections. |
| `assets/facets.js` | Shared engine: `facet-filters-form`, `price-range`, `facet-remove`; history/popstate, section render/cache, filters/sort và shared events. | Collection/search main sections. |
| `assets/collection-filters.helpers.js` | Pure helpers sắp xếp preferred filter groups và giữ `sort_by` khi clear all. | Collection product grid. |
| `assets/collection-filters.js` | Collection-specific controller: toolbar/layout, mobile drawer/apply/clear và reference filter composition. | `main-collection-product-grid`. |
| `assets/main-search.js` | `main-search` specialization của `SearchForm`; search-template input behavior. | `main-search`. |
| `assets/search-page.js` | Search-specific facets controller, canonical query preservation, mobile apply/clear và result layout updates. | `main-search`. |

### 4.4 Cart and customer JavaScript

| Module | Component / feature xử lý | Load bởi |
| --- | --- | --- |
| `assets/cart.helpers.js` | Pure helper normalize quantity min/max/step. | Cart page và drawer. |
| `assets/cart.js` | `cart-remove-button`, `cart-items`, `cart-note`; AJAX quantity/remove/note, error/live regions, section refresh, totals và Standard Cart events. | Cart page và drawer. |
| `assets/cart-drawer.js` | `cart-drawer`, `cart-drawer-items`; drawer open/close/focus, render sections và empty-state transition. | Theme layout khi cart type là drawer. |
| `assets/cart-notification.js` | `cart-notification`; cập nhật notification product/button/bubble, focus trap và cart view event. | Header. |
| `assets/cart-disclosure-modal.js` | `cart-disclosure-modal`; product/regulatory disclosure modal trong cart. | Theme layout. |
| `assets/cart-disclosure-tooltip.js` | Tooltip positioning/open state cho cart disclosure indicator. | Theme layout. |
| `assets/customer.js` | `CustomerAddresses`: country/province selector, address form edit/delete UI. | `main-addresses`. |

### 4.5 Inline JavaScript đáng chú ý

- `layout/theme.liquid`: import Shopify `standard-events.js`, define `collection-component`/`product-component`, dispatch page view, expose `window.routes` và translated cart/variant/accessibility strings.
- `templates/gift_card.liquid`: Shopify-hosted QR library, QR generation và copy gift-card code.
- `sections/main-addresses.liquid`: khởi tạo `CustomerAddresses` sau window load.
- Các JSON-LD scripts nằm trong header, article và product sections; application JSON được dùng cho selected variants và product models.

## 5. Asset map và Feature Map

### 5.1 CSS ownership hiện tại

`assets/` có 127 stylesheet. Nhóm owner chính:

| Owner | CSS assets chính |
| --- | --- |
| Global foundation | `base.css`, `theme-tokens.css`, `theme-foundation.css`, `theme-foundation-cascade.css`, `brand-01/03/05/07/13/19-theme-foundation.css`, `mask-blobs.css` |
| Header/navigation | `shell-header.css`, `shell-header-cascade-01.css`, `shell-header-cascade-02.css`, `brand-04/15/27/29/32/37/41-shell-header.css`, `component-menu-drawer.css`, `component-mega-menu.css`, `component-search.css`, `component-predictive-search.css`, `component-localization-form.css`, `component-list-menu.css` |
| Footer | `shell-footer.css`, `shell-footer-cascade.css`, `brand-11-content-footer.css`, `component-newsletter.css`, `component-list-payment.css`, `component-list-social.css` |
| Product card/listings | `component-card.css`, `component-price.css`, `component-product-card-cascade.css`, `brand-02/06/31/33/35/40-product-card.css`, `quick-add.css`, `quantity-popover.css`, `component-volume-pricing.css`, `component-rating.css` |
| Product detail | `section-main-product.css`, `section-featured-product.css`, `page-product-cascade-01/02/03.css`, `brand-24/39-page-product.css`, `component-product-variant-picker.css`, `component-swatch.css`, `component-swatch-input.css`, `component-deferred-media.css`, `component-product-model.css`, `component-model-viewer-ui.css`, `component-pickup-availability.css`, `component-complementary-products.css`, `component-accordion.css`, `component-disclosures.css` |
| Collection/facets | `template-collection.css`, `page-collection.css`, `page-collection-cascade.css`, `brand-10/22/25-page-collection.css`, `feature-facets.css`, `feature-facets-cascade.css`, `component-collection-hero.css`, `component-pagination.css`, `component-show-more.css` |
| Search | `page-search.css`, `brand-21-page-search.css`, shared facets/card/search assets |
| Cart/commerce | `feature-cart.css`, `feature-cart-cascade-01/02.css`, `brand-09/17/20-feature-commerce.css`, `component-cart-drawer.css`, `component-cart-items.css`, `component-cart-notification.css`, `component-totals.css`, `component-discounts.css`, `component-progress-bar.css` |
| Home/marketing | `brand-08/12/14/16/18/23/26/28/30/34/36/38-page-home.css`, `section-image-banner.css`, `component-slideshow.css`, `component-slider.css`, `section-browse-collections.css`, `section-collection-list.css`, `section-multicolumn.css`, `component-image-with-text.css`, `section-product-ugc-videos.css`, `section-rich-text.css`, `collage.css`, `video-section.css`, `newsletter-section.css` |
| Blog/content/contact | `component-article-card.css`, `section-featured-blog.css`, `section-main-blog.css`, `section-blog-post.css`, `section-main-page.css`, `section-contact-form.css`, `collapsible-content.css` |
| Customer/password/gift card | `customer.css`, `section-password.css`, `section-email-signup-banner.css`, `template-giftcard.css` |

Lưu ý về runtime: dù tên file đã thể hiện owner, `layout/theme.liquid` vẫn load trực tiếp nhiều cascade assets mang tên page/feature trên toàn storefront để bảo toàn thứ tự cascade. Ngoài ra 41 `brand-NN-*` files được load theo thứ tự cố định qua `theme-brand-styles`.

### 5.2 Static media inventory

| Loại | Số lượng | Nội dung chính |
| --- | ---: | --- |
| SVG | 88 | Dawn/Shopify icons, payment/social/UI icons và password banner backgrounds. |
| JPG | 28 | Home/collection campaign images, product benefit images, social gallery và UGC posters. |
| WebP | 18 | Collection shapes, campaign/editorial/product imagery. |
| PNG | 8 | Brand logos, homepage studio image và nail-length guides. |
| GIF | 1 | `sparkle.gif`. |

### 5.3 Feature map

| Feature | Liquid owners | CSS owners | JavaScript owners | Chức năng chính |
| --- | --- | --- | --- | --- |
| Product | `main-product`, `featured-product`, product-domain snippets, `buy-buttons`, `card-product` | PDP, product-card, quick-add, variant/media component assets | `product-info`, `product-form`, media/modal/model, pickup, price/quantity, quick-add | PDP, variants, media, pricing, add-to-cart, pickup, disclosures, complementary/cross-sells. |
| Cart | `main-cart-items`, `main-cart-footer`, `cart-drawer` và cart snippets | `feature-cart*`, cart components, shared commerce slices | `cart`, `cart-drawer`, `cart-notification`, cart disclosure modules | Drawer/page cart, quantity/remove/note/errors, totals, progress, cross-sells, checkout entry. |
| Collection | `ersa-collection-campaign`, `main-collection-banner`, `main-collection-product-grid`, `facets`, `card-product` | Collection, facets và product-card assets | `facets`, collection controllers/helpers, quick-add modules | Campaign, breadcrumbs, product grid, Search & Discovery filters, sort, promo tile, history. |
| Search | `main-search`, `facets`, product/article cards | Search, facets và card assets | `search-form`, `main-search`, `predictive-search`, `facets`, `search-page` | Search input, predictive results, mixed result types, filter/sort/history. |
| Navigation | `header`, `header-primary-*`, `header-collection-menu`, `header-search`, localization snippets | Shell header/menu/search/localization assets | `global`, `shell-header`, details/search/predictive/localization modules | Sticky header, mega menu, drawer, account, search, locale selectors, cart trigger. |
| Footer | `footer`, social/localization snippets | Shell footer/newsletter/list assets | `shell-footer`, `localization-form` | Menu/content blocks, mobile accordions, newsletter, social, locale, payment/policy links. |
| Customer | Các `main-account/login/register/activate/reset/addresses/order` sections | `customer.css` | `customer.js` | Classic account lifecycle, addresses và order history/detail. |
| Blog / Content | `main-blog`, `main-article`, `article-card`, `featured-blog`, generic page/content sections | Blog/article/page/contact/accordion assets | Shared modal/share/slider only | Blog listing, article, comments/share, pages, contact và reusable content. |
| Home / Marketing | `slideshow`, active `ersa-*`, featured collection, newsletter | Home brand slices và section assets | `custom-theme`, slider primitives, UGC module, theme editor | Hero, collection discovery, trust row, essentials, reviews, gallery, newsletter. |
| Global UI | Layouts, `loading-spinner`, pagination, icons, modal/disclosure snippets | Base/foundation/tokens và component CSS | `global`, pub/sub, details, animations, show-more, theme-editor | Document shell, focus/modal/drawer/slider primitives, shared events và accessibility utilities. |
| Third-party integrations | `@app` blocks in apps/header/footer/newsletter/article/cart/product; `content_for_header`; video sections | App-provided CSS không hiện diện trong repo | Shopify Standard Events CDN; YouTube/Vimeo embeds; app scripts có thể được `content_for_header` inject | Theme source không chứa app-specific runtime bundle. Product template có nội dung “seel” dạng custom Liquid thuần túy, không có Seel script/API integration trong repo. |

### 5.4 Third-party và Shopify-managed boundaries

- Shopify CDN: `standard-events.js`, Shopify font CDN, hosted product videos và gift-card QR asset.
- YouTube/Vimeo: supported trong `video` và `collage` sections qua deferred media.
- App extension surfaces: `sections/apps.liquid` và `@app` blocks trong header, footer, newsletter, article, cart footer, main product và featured product.
- `content_for_header` có thể inject app/runtime code theo store configuration; nội dung đó không thể xác định chỉ từ repository.
- Không phát hiện jQuery, React/Vue, third-party npm storefront runtime, private API key hoặc hard-coded app credential trong các thư mục theme đã kiểm tra.

## 6. Summary

| Feature/Page | Main files | Components | JS liên quan |
| --- | --- | --- | --- |
| Global shell | `layout/theme.liquid`, `header-group.json`, `footer-group.json` | Meta tags, header, footer, modal/drawer/slider primitives | `global.js`, `constants.js`, `pubsub.js`, details modules, Standard Events |
| Home | `templates/index.json` | Slideshow, collection grids, icon row, essentials, reviews, social gallery, newsletter | `custom-theme.js`, `section-product-ugc-videos.js`, shared slider/product-form modules |
| Product | `templates/product.json`, `main-product.liquid` | Gallery, media modal, title/rating/price, variants, size guide, buy buttons, disclosures, accordions, cross-sells | `product-info.js`, `product-form.js`, gallery/modal/model, pickup, quick-add |
| Collection | `templates/collection.json`, campaign/banner/product-grid sections | Breadcrumbs, facets, product card, price, quick add, pagination | `facets.js`, `collection-filters.js` + helpers, product-form/quick-add |
| Search | `templates/search.json`, `main-search.liquid` | Search form, predictive search, facets, product/article cards, pagination | `main-search.js`, `search-page.js`, `predictive-search.js`, `facets.js` |
| Cart | `templates/cart.json`, `main-cart-items`, `main-cart-footer`, cart drawer section/snippet | Cart line details/total, disclosure, shipping progress, cross-sells | `cart.js`, `cart-drawer.js`, `cart-notification.js`, disclosure/quantity modules |
| Navigation | `header.liquid`, `header-primary-*`, `header-search` | Mega menu, mobile drawer, search modal, localization, cart bubble | `shell-header.js`, `details-disclosure.js`, `predictive-search.js`, `localization-form.js` |
| Footer | `footer.liquid`, `footer-group.json` | Menus/text/images/app blocks, newsletter, social, localization, payments | `shell-footer.js`, `localization-form.js` |
| Blog / Article | `blog.json`, `article.json`, `main-blog`, `main-article` | Article card, share, pagination, app blocks | `share.js`, shared global modules |
| Page / Contact | `page.json`, `page.contact.json`, `main-page`, `contact-form` | Rich page content và Shopify contact form | Shared global form/UI only |
| Customer | `templates/customers/*.json`, `main-*` customer sections | Login/register/recovery, account, addresses, orders | `customer.js` cho addresses; shared global JS |
| Password | `layout/password.liquid`, `templates/password.json` | Password header/footer, email signup banner, password modal | `global.js`, `details-modal.js`, `password-modal.js` |
| Gift Card | `templates/gift_card.liquid` | Balance/code/QR, Apple Wallet, print/copy | Shopify QR library và inline copy handler |
| Reusable merchandising | `featured-collection`, `featured-product`, `related-products`, `quick-order-list`, generic marketing sections | Product/collection/article cards, slider, quick-add, modal, accordion | Product, quick-order, slider và Theme Editor modules tùy section |

## Kết luận cấu trúc hiện tại

- Theme là Shopify Online Store 2.0 dựa trên Dawn, dùng JSON templates, section composition, Liquid snippets và vanilla Web Components.
- Public pages được tổ chức tương đối rõ quanh các `main-*` sections. Brand content dùng prefix `ersa-*`; product/cart/header snippets đã có domain prefixes rõ hơn.
- Các component dùng lại nhiều nhất là `card-product`, `price`, `facets`, product media/variant/buy snippets, cart line snippets và header canonical snippets.
- Internal/AJAX sections là một phần runtime thực sự; không nên đánh dấu unused chỉ vì không xuất hiện trong JSON templates.
- Các điểm tập trung trách nhiệm lớn nhất hiện tại là `main-product.liquid` (2,340 lines), `featured-product.liquid` (1,499 lines), `facets.liquid` (1,038 lines), `global.js` (49,410 bytes) và các ordered brand/cascade CSS slices. Báo cáo này chỉ ghi nhận cấu trúc, không đề xuất hoặc thực hiện thay đổi.
