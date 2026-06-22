# 1. Mục tiêu dự án

Dự án này sẽ xây dựng một Shopify Online Store 2.0 storefront nguyên bản cho thương hiệu press-on nails. Trải nghiệm cần hỗ trợ khách mua theo nhu cầu thật: xem phong cách móng, chọn shape, chọn length, chọn size, đọc hướng dẫn, thêm vào giỏ và checkout qua Shopify.

Nguồn nghiên cứu Ersa Nails được dùng như tài liệu tham khảo về logic thương mại, information architecture và conversion flow công khai. Store mới không được sao chép source code, Liquid, CSS, JavaScript, logo, branding, hình ảnh, video, product names, product descriptions, reviews, campaign copy, fonts, exact visual identity hoặc pixel-perfect layout của Ersa Nails.

MVP cần đạt được:

- Một theme Shopify OS 2.0 nhẹ, mobile-first, merchant-editable qua Theme Editor.
- Luồng mua hàng đầy đủ từ homepage -> collection/search -> PDP -> cart drawer.
- Taxonomy rõ cho shape, length, finish/style, accessories và bundles.
- PDP giúp khách tự tin chọn size và hiểu cách dùng.
- Cart drawer có phản hồi nhanh và free-shipping progress.
- SEO, accessibility và performance baseline tốt trước khi thêm app nặng.

# 2. Hiện trạng repository

## Verified facts

| Hạng mục | Trạng thái đã xác minh |
| --- | --- |
| Project type | Shopify Online Store 2.0 theme repository with planning documentation. |
| Theme base | Official Shopify Dawn `v15.5.0`, commit `83d5e6b4094d8019820bffafe04b242d0602ffe2`, imported from `https://github.com/Shopify/dawn.git`. |
| Folder structure | Hiện có `AGENTS.md`, `README.md`, `.github/`, Dawn theme folders, `docs/` và `docs/vietnamese/`. |
| Theme folders | `assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/` đã tồn tại từ Dawn. |
| Package files | Chưa có `package.json`, lockfile, build script hoặc dependency manifest. |
| Shopify CLI config | Chưa có `shopify.theme.toml` hoặc cấu hình Shopify CLI khác. |
| Git status | Git đã được initialize trong Phase 0; baseline commit sẽ được tạo sau Theme Check và doc update. |
| Existing components | Dawn cung cấp các Liquid sections, snippets, assets và JSON templates nền. Chưa có custom press-on nails storefront features. |
| Local run readiness | Theme scaffold đã sẵn sàng để chạy local preview khi có Shopify store domain và authentication. |
| Theme Check baseline | `shopify theme check` đã chạy: 169 files inspected, 8 warnings, 0 errors. |

## Assumptions

- Theme sẽ tiếp tục dựa trên official Shopify Dawn theo quyết định kiến trúc đã chốt; Dawn là technical base, không phải final visual identity.
- Shopify CLI, Theme Check và Git sẽ được thiết lập ở Phase 0 trước khi viết theme code.
- Nội dung brand, ảnh sản phẩm, policy, shipping, payment và claim marketing sẽ do merchant cung cấp, không lấy từ Ersa Nails.

## Risks and technical debt

- Dawn scaffold đã có, nhưng các file path custom trong tài liệu vẫn là đề xuất cho các phase sau.
- Git đã được initialize, nhưng branch strategy dài hạn vẫn cần xác nhận nếu team dùng remote repository.
- Chưa có merchant data nên không thể hoàn thiện copy, taxonomy, images, payment, shipping, policies hoặc localization.
- Local preview chưa được chạy vì chưa có store domain/authentication trong repo.
- Dawn baseline Theme Check warnings cần được theo dõi khi customize, không nên sửa tùy tiện ngoài Phase 0 scope.

## Phase 0 baseline notes

- Dawn source: official Shopify Dawn `v15.5.0`.
- Dawn commit: `83d5e6b4094d8019820bffafe04b242d0602ffe2`.
- Shopify CLI version observed: `4.2.0`.
- Theme Check result: 169 files inspected, 8 warnings, 0 errors.
- Baseline warnings:
  - `layout/password.liquid`: `UndefinedObject` for `scheme_classes`.
  - `layout/theme.liquid`: `UndefinedObject` for `scheme_classes`.
  - `sections/main-article.liquid`: `VariableName` for `anchorId`.
  - `sections/main-list-collections.liquid`: `VariableName` for `moduloResult`.
  - `sections/main-product.liquid`: `UnusedAssign` for `seo_media`.
  - `sections/main-product.liquid`: `UndefinedObject` for `continue`.
  - `sections/main-search.liquid`: `UnusedAssign` for `product_settings`.
  - `snippets/quick-order-product-row.liquid`: `OrphanedSnippet`.
- Local preview blocker: no Shopify store domain/authentication is available in repository context, so `shopify theme dev --store [STORE].myshopify.com --open` was not run.

# 3. Tổng hợp yêu cầu từ tài liệu nghiên cứu

| Nhóm yêu cầu | Yêu cầu UI/UX | Nguồn tài liệu | Mức độ ưu tiên | Ghi chú triển khai |
| --- | --- | --- | --- | --- |
| Announcement bar | Hiển thị promo, shipping threshold hoặc thông báo ngắn. | feature matrix, UX analysis, rebuild brief | P0 | Là section global, text merchant-editable, tránh ticker lặp gây ồn cho screen reader. |
| Header | Logo, nav, search, cart, account optional. | feature matrix, URL inventory | P0 | Sticky nhẹ nếu không gây layout shift. |
| Mega menu | Điều hướng theo Shop All, New, Best Sellers, Sale, Shape, Length, Essentials, Bundles, Guides. | rebuild brief, URL inventory | P0 | Dùng Shopify navigation menu, không hard-code handles. |
| Mobile navigation | Drawer accessible, close button, focus trap, Escape close. | performance/accessibility audit | P0 | Mobile-first, thumb-friendly. |
| Homepage hero | Hero nguyên bản với CTA vào collection/campaign. | research summary, rebuild brief | P0 | Không copy campaign concept hoặc imagery của Ersa Nails. |
| Featured collection | Sản phẩm nổi bật/best sellers. | feature matrix, UX analysis | P0 | Dùng section chọn collection từ Theme Editor. |
| Shop by shape | Tiles hoặc collection links cho almond, coffin, oval, squoval, square hoặc taxonomy merchant cung cấp. | URL inventory, rebuild brief | P0 | Dùng collection picker hoặc metaobject. |
| Shop by length | Long, medium, short hoặc taxonomy merchant cung cấp. | URL inventory, UX analysis | P0 | Có ảnh/tile nguyên bản. |
| Collection grid | Product grid rõ, load nhanh, có product count. | feature matrix | P0 | Product cards reusable. |
| Filters | Availability, price, shape, length, color/finish/style. | feature matrix, SEO audit | P0 | Dùng Shopify Search & Discovery để tránh filter URL bloat. |
| Sorting | Sort native theo Shopify. | feature matrix | P0 | Giữ UX đơn giản trên mobile. |
| Product cards | Ảnh, title, price, sale/sold-out badge, rating nếu app có. | feature matrix | P0 | Snippet reusable, alt text tốt, quick add chỉ khi variant-safe. |
| Quick add | Add nhanh cho product không cần chọn variant hoặc mở selector khi cần. | feature matrix | P1 | Không làm sai size; fallback sang PDP nếu variant phức tạp. |
| Product gallery | Gallery ảnh/video sản phẩm responsive. | UX analysis, accessibility audit | P0 | Unique alt cho ảnh meaningful, giới hạn media nặng. |
| Product variants | Size radio, selected state rõ. | tech evidence, UX analysis | P0 | Dùng Shopify variant data, không custom data riêng nếu không cần. |
| Size guide | Modal accessible hoặc linked page. | feature matrix, UX analysis | P0 | Có focus trap nếu modal; content qua page/metaobject/metafield. |
| Product information accordion | Mô tả, what is included, how to apply, wear/removal, shipping/returns. | rebuild brief, UX analysis | P0 | Accordions có `aria-expanded` và panel id. |
| Add to cart | Product form native, error state rõ. | feature matrix | P0 | Không chạm checkout/payment. |
| Cart drawer | Drawer sau add-to-cart, line item, remove, quantity, notes, checkout CTA. | UX analysis | P0 | Accessible dialog, live region, no forced checkout. |
| Free shipping progress | Hiển thị còn bao nhiêu để đạt threshold. | feature matrix, UX analysis | P0 | Threshold trong theme settings. |
| Cross-sell | Phụ kiện liên quan trên PDP/cart. | rebuild brief, UX analysis | P1 | Dùng complementary products hoặc metafield. |
| Related products | Native recommendations trên PDP. | feature matrix | P1 | Dùng Shopify recommendations trước app. |
| Bundles | Collection/bundle products hoặc app nếu logic phức tạp. | feature matrix | P2 | Post-MVP nếu bundle discount phức tạp. |
| FAQ | Page/section accordion. | feature matrix | P0 | FAQ schema chỉ khi nội dung visible và hợp lệ. |
| Newsletter | Footer form hoặc email app integration. | feature matrix | P0 | Shopify customer form cho MVP; Klaviyo nếu merchant chọn. |
| Social proof / UGC | Reviews, trust modules, UGC optional. | research summary | P1/P2 | Reviews MVP; UGC/video defer để tránh script nặng. |
| Footer | Support links, policies, social, localization optional. | URL inventory | P0 | Dùng menus và theme settings. |
| Search | `/search`, product/article/page results, filters/sort nếu phù hợp. | tech evidence | P0 | H1 đúng cho search results. |
| Localization | Currency/country selector nếu bán quốc tế. | feature matrix | P1 | Dùng Shopify Markets, không tự xử lý currency. |
| Accessibility | Semantic HTML, one H1, keyboard, focus, modal/drawer accessible. | accessibility audit | P0 | Non-negotiable. |
| SEO | Unique title/meta, canonical, schema, controlled filters. | SEO audit | P0 | Không tạo thin duplicate collection pages. |
| Performance | Ít app, responsive images, lazy loading, defer JS. | performance audit | P0 | Đo trước khi thêm app/UGC/countdown. |

# 4. Kiến trúc Shopify đề xuất

## Templates

| Template | Mục đích | Priority |
| --- | --- | --- |
| `templates/index.json` | Homepage sections. | P0 |
| `templates/collection.json` | Collection grid, filters, sort, collection hero. | P0 |
| `templates/product.json` | PDP gallery, buy box, accordions, recommendations. | P0 |
| `templates/search.json` | Search results and filters. | P0 |
| `templates/cart.json` | Fallback cart page. | P1 |
| `templates/page.faq.json` | FAQ page. | P0 |
| `templates/page.size-guide.json` | Size guide page. | P0 |
| `templates/page.contact.json` | Contact/support page. | P0 |
| `templates/page.json` | Generic content pages and policies. | P0 |
| `templates/404.json` | Helpful 404 with search/collection links. | P1 |
| `templates/blog.json`, `templates/article.json` | Educational content after MVP. | P2 |

## Sections

| Section | Proposed file | Notes |
| --- | --- | --- |
| Announcement bar | `sections/announcement-bar.liquid` | Global in layout or header group. |
| Header | `sections/header.liquid` | Logo, nav, search, cart. |
| Hero banner | `sections/hero-banner.liquid` | Original image/copy and CTA settings. |
| Featured collection | `sections/featured-collection.liquid` | Uses product-card snippet. |
| Shop by shape | `sections/shop-by-shape.liquid` | Collection tiles or metaobject cards. |
| Shop by length | `sections/shop-by-length.liquid` | Same pattern as shape. |
| Trust row | `sections/trust-row.liquid` | Real claims only. |
| Main collection | `sections/main-collection-product-grid.liquid` | Filters, sort, pagination. |
| Main product | `sections/main-product.liquid` | Gallery, form, buy box. |
| Product accordions | `sections/product-accordions.liquid` | PDP content blocks/metafields. |
| Related products | `sections/related-products.liquid` | Native recommendations. |
| FAQ | `sections/faq-accordion.liquid` | FAQ page and reusable section. |
| Newsletter | `sections/newsletter.liquid` | Shopify form or app block area. |
| Footer | `sections/footer.liquid` | Menus, policies, social, localization. |

## Snippets and assets

| Type | Proposed file | Responsibility |
| --- | --- | --- |
| Snippet | `snippets/card-product.liquid` | Product card display and badges. |
| Snippet | `snippets/price.liquid` | Sale/compare-at price formatting. |
| Snippet | `snippets/product-badges.liquid` | Sale, sold out, new, best seller labels. |
| Snippet | `snippets/responsive-image.liquid` | Shared image markup with `image_url`, widths, `sizes`. |
| Snippet | `snippets/variant-picker.liquid` | Radio variant picker. |
| Snippet | `snippets/size-guide-modal.liquid` | Accessible size guide shell. |
| Snippet | `snippets/cart-drawer.liquid` | Drawer markup if not section-based. |
| Snippet | `snippets/free-shipping-progress.liquid` | Threshold and progress copy. |
| Snippet | `snippets/accordion-item.liquid` | Accessible accordion row. |
| Asset | `assets/theme.css` | Tokens, layout, components. |
| Asset | `assets/theme.js` | Drawer, modal, accordion, variant, cart behavior. |
| Asset | `assets/cart.js` | Optional split if cart drawer grows. |
| Asset | `assets/product.js` | Optional split for PDP behavior. |

## Theme settings

- Logo and favicon.
- Color tokens: background, surface, text, muted text, border, accent, sale, success, warning.
- Typography families, scale and heading weight.
- Button radius, card radius, layout width.
- Announcement text and links.
- Free-shipping threshold and currency-aware messaging copy.
- Product-card options: show vendor, show rating, show quick add, badge style.
- Review app toggle.
- Social links.
- Localization selector visibility.

## Metafields

| Owner | Metafield | Use |
| --- | --- | --- |
| Product | `custom.shape` | Shape filter/card facts. |
| Product | `custom.length` | Length filter/card facts. |
| Product | `custom.finish_style` | Finish/style filter. |
| Product | `custom.whats_included` | PDP accordion. |
| Product | `custom.application_time` | PDP facts. |
| Product | `custom.wear_duration` | PDP facts. |
| Product | `custom.reusable` | PDP trust/details. |
| Product | `custom.size_guide_group` | Select correct size guide. |
| Product | `custom.care_instructions` | PDP accordion. |
| Product | `custom.cross_sell_products` | Compatible accessories. |
| Collection | `custom.hero_image` | Original collection hero. |
| Collection | `custom.seo_intro` | Unique collection intro. |

## Metaobjects

- Size guide tables.
- Application/removal steps.
- Trust badges.
- FAQ groups.
- Material or safety notes.
- Campaign tiles.
- Shape and length education cards.

## Navigation menus

- Main menu: Shop All, New, Best Sellers, Sale, Shop by Shape, Shop by Length, Essentials, Bundles, Guides.
- Footer shop menu.
- Footer support menu: FAQ, Size Guide, How To, Shipping, Returns, Contact.
- Policy menu.
- Social links via theme settings.

## Shopify Search & Discovery

- Configure filters for availability, price, shape, length, color/finish/style and product type.
- Configure synonyms for common nail terms once product taxonomy is known.
- Use native complementary products and related recommendations first.
- Avoid creating indexed crawl traps for every filter combination.

## Native, app, and deferred requirements

| Requirement | Recommendation |
| --- | --- |
| Products, variants, collections, discounts, cart, checkout, policies, search, localization | Native Shopify. |
| Product filters and recommendations | Shopify Search & Discovery first. |
| Reviews | App likely needed for MVP, such as Judge.me or merchant-approved equivalent. |
| Email marketing | Shopify forms for baseline, Klaviyo or approved app if merchant needs automation. |
| Analytics | Shopify analytics first, optional Clarity or pixel setup with consent/privacy review. |
| Bundles/free gifts | Defer or app if discount logic cannot be native. |
| Loyalty, push, UGC/video, countdown, delivery estimate | Post-MVP unless merchant explicitly prioritizes. |

# 5. Bản đồ page -> section -> file

| Page | Section / Component | Proposed file path | Purpose | Theme Editor configurable? | Priority |
| --- | --- | --- | --- | --- | --- |
| Global | Theme layout | `layout/theme.liquid` | Base HTML, skip link, CSS/JS includes, sections groups. | Partly | P0 |
| Global | Design tokens | `assets/theme.css` | Tokens, grid, buttons, cards, forms, focus. | Through settings | P0 |
| Global | Interaction JS | `assets/theme.js` | Drawer, modal, accordion, variant, cart helpers. | No | P0 |
| Header | Announcement bar | `sections/announcement-bar.liquid` | Promo/free shipping/notice. | Yes | P0 |
| Header | Header/nav | `sections/header.liquid` | Logo, desktop nav, search, cart, account. | Yes | P0 |
| Mobile menu | Navigation drawer | `sections/header.liquid`, `assets/theme.js` | Mobile menu overlay and focus handling. | Yes | P0 |
| Homepage | Index template | `templates/index.json` | Homepage composition. | Yes | P0 |
| Homepage | Hero | `sections/hero-banner.liquid` | Original hero with CTA. | Yes | P0 |
| Homepage | Featured products | `sections/featured-collection.liquid` | Display selected collection. | Yes | P0 |
| Homepage | Shape tiles | `sections/shop-by-shape.liquid` | Route users by shape. | Yes | P0 |
| Homepage | Length tiles | `sections/shop-by-length.liquid` | Route users by length. | Yes | P0 |
| Homepage | Trust row | `sections/trust-row.liquid` | Real claims and reassurance. | Yes | P1 |
| Collection page | Collection template | `templates/collection.json` | Collection page composition. | Yes | P0 |
| Collection page | Collection grid | `sections/main-collection-product-grid.liquid` | Product grid, filters, sort, pagination. | Yes | P0 |
| Collection page | Product card | `snippets/card-product.liquid` | Reusable product cards. | Via parent | P0 |
| Search page | Search template | `templates/search.json` | Search results. | Yes | P0 |
| Search page | Search grid | `sections/main-search.liquid` | Results, filters, sort. | Yes | P0 |
| Product page | Product template | `templates/product.json` | PDP composition. | Yes | P0 |
| Product page | Main product | `sections/main-product.liquid` | Gallery, title, price, variants, form. | Yes | P0 |
| Product page | Gallery | `snippets/product-media-gallery.liquid` | Responsive media gallery. | Via parent | P0 |
| Product page | Variant picker | `snippets/variant-picker.liquid` | Size/variant radios. | Via parent | P0 |
| Product page | Size guide | `snippets/size-guide-modal.liquid` | Fit support modal/page trigger. | Via settings/metafield | P0 |
| Product page | Accordions | `sections/product-accordions.liquid` | Product detail, how-to, shipping, returns. | Yes | P0 |
| Product page | Related products | `sections/related-products.liquid` | Native recommendations. | Yes | P1 |
| Cart drawer | Drawer markup | `snippets/cart-drawer.liquid` | AJAX cart preview. | Partly | P0 |
| Cart drawer | Progress component | `snippets/free-shipping-progress.liquid` | Free-shipping threshold. | Yes | P0 |
| Cart page | Cart template | `templates/cart.json` | Fallback full cart. | Yes | P1 |
| Cart page | Main cart | `sections/main-cart.liquid` | Cart form and checkout CTA. | Yes | P1 |
| FAQ page | FAQ template | `templates/page.faq.json` | FAQ page composition. | Yes | P0 |
| FAQ page | FAQ accordion | `sections/faq-accordion.liquid` | Help content. | Yes | P0 |
| Size guide page | Size guide template | `templates/page.size-guide.json` | Standalone sizing guide. | Yes | P0 |
| Contact page | Contact template | `templates/page.contact.json` | Contact form/support copy. | Yes | P0 |
| Policy pages | Generic page template | `templates/page.json` | Shipping, returns, privacy, terms. | Yes | P0 |
| 404 page | Not found template | `templates/404.json` | Recover users with search/collections. | Yes | P1 |
| Footer | Footer | `sections/footer.liquid` | Menus, newsletter, social, localization. | Yes | P0 |

# 6. Thiết kế hệ thống giao diện

- Visual direction: premium, clean, editorial, fit-confidence first. Không dùng lại color palette, typography, campaign style hoặc bố cục đặc trưng của Ersa Nails.
- Color-token strategy: dùng CSS variables từ theme settings như `--color-background`, `--color-surface`, `--color-text`, `--color-muted`, `--color-border`, `--color-accent`, `--color-sale`, `--color-success`.
- Typography strategy: 1 font body và 1 font heading nếu cần; font phải do merchant chọn hoặc dùng Shopify font picker. Không sao chép font quan sát từ đối thủ.
- Spacing scale: dùng scale đơn giản `4, 8, 12, 16, 24, 32, 48, 64` px; section spacing configurable cho mobile/desktop.
- Border radius: mặc định 6-8px cho buttons/cards; tránh bo quá lớn nếu không thuộc brand system được duyệt.
- Button hierarchy: primary cho add-to-cart/checkout/hero CTA; secondary cho navigation CTA; tertiary/link cho supporting actions.
- Card design: product cards rõ ảnh, title, price, badge, rating optional; giữ aspect ratio ổn định.
- Product badge system: sale, sold out, new, best seller; text localizable và không tạo claim giả.
- Form controls: labels rõ, error text rõ, target size mobile đủ lớn.
- Mobile behavior: nav drawer, filters drawer, cart drawer và modal cần focus management; grid 2 columns khi đủ rộng, 1 column khi rất nhỏ.
- Animation rules: nhẹ, ngắn, có `prefers-reduced-motion`; không dùng motion cần thiết để hiểu nội dung.
- Focus styles: outline rõ, contrast tốt, không bị che bởi sticky header.
- Dark/light behavior: chỉ build light theme cho MVP; dark mode là post-MVP nếu merchant yêu cầu.

# 7. Kế hoạch triển khai theo phase

## Phase 0 - Environment and safety

- Objective: thiết lập nền làm việc an toàn trước khi viết theme code.
- Files likely affected: `.git/` nếu init repo, `.gitignore`, Shopify theme scaffold files, `shopify.theme.toml` nếu merchant/store workflow cần.
- Shopify features required: Shopify CLI authentication, development theme or unpublished theme.
- Dependencies: store domain, collaborator access, Git decision, base theme decision.
- Acceptance criteria: repo có theme scaffold chuẩn, Git hoạt động, Theme Check chạy được, không có secret committed.
- Manual test checklist: `shopify theme dev --store [STORE].myshopify.com --open`, `shopify theme check`, inspect root folders.
- Risk level: Medium.
- Estimated complexity: Medium.

## Phase 1 - Theme foundation

- Objective: tạo layout, tokens, snippets nền và schema settings tối thiểu.
- Files likely affected: `layout/theme.liquid`, `assets/theme.css`, `assets/theme.js`, `config/settings_schema.json`, `locales/en.default.json`.
- Shopify features required: Theme Editor settings, locale strings.
- Dependencies: Phase 0, brand token inputs hoặc temporary demo tokens được ghi nhãn rõ.
- Acceptance criteria: theme load được, có skip link, CSS tokens, no console errors, Theme Editor mở được.
- Manual test checklist: homepage load, inspect mobile/desktop, keyboard tab reaches skip link/header.
- Risk level: Medium.
- Estimated complexity: Medium.

## Phase 2 - Header, navigation, and global UI

- Objective: build announcement, header, desktop mega menu, mobile nav, search entry, cart trigger.
- Files likely affected: `sections/announcement-bar.liquid`, `sections/header.liquid`, `assets/theme.css`, `assets/theme.js`, locales.
- Shopify features required: navigation menus, localization optional, cart object.
- Dependencies: menus created in Shopify Admin, logo/brand settings.
- Acceptance criteria: desktop/mobile nav usable, menu keyboard accessible, no hard-coded competitor labels.
- Manual test checklist: tab nav, open/close mobile drawer, Escape close, search opens, cart trigger visible.
- Risk level: Medium.
- Estimated complexity: Medium.

## Phase 3 - Homepage sections

- Objective: build original homepage conversion ladder.
- Files likely affected: `templates/index.json`, `sections/hero-banner.liquid`, `sections/featured-collection.liquid`, `sections/shop-by-shape.liquid`, `sections/shop-by-length.liquid`, `sections/trust-row.liquid`, `sections/newsletter.liquid`.
- Shopify features required: collection picker, image picker, rich text, URL settings, product cards.
- Dependencies: original brand copy, original images, collections.
- Acceptance criteria: homepage has one meaningful H1, hero CTA, product section, shape/length routing, newsletter and no copied content.
- Manual test checklist: mobile first viewport, CTA links, image lazy/eager behavior, Theme Editor controls.
- Risk level: Medium.
- Estimated complexity: Medium.

## Phase 4 - Collection and discovery experience

- Objective: build collection/search grids with filters, sort, product cards and quick discovery.
- Files likely affected: `templates/collection.json`, `templates/search.json`, `sections/main-collection-product-grid.liquid`, `sections/main-search.liquid`, `snippets/card-product.liquid`, `snippets/price.liquid`, `snippets/product-badges.liquid`.
- Shopify features required: Search & Discovery filters, collection sorting, pagination.
- Dependencies: product taxonomy/metafields, collections, filter configuration.
- Acceptance criteria: collection H1 correct, filters/sort work, product cards responsive, no filter index bloat assumptions.
- Manual test checklist: filter by shape/length, sort, pagination, search query, mobile filter drawer keyboard.
- Risk level: High.
- Estimated complexity: High.

## Phase 5 - Product page and size-selection experience

- Objective: build PDP with gallery, size picker, size guide, accordions, cross-sells and recommendations.
- Files likely affected: `templates/product.json`, `sections/main-product.liquid`, `sections/product-accordions.liquid`, `sections/related-products.liquid`, `snippets/product-media-gallery.liquid`, `snippets/variant-picker.liquid`, `snippets/size-guide-modal.liquid`.
- Shopify features required: variants, product media, metafields, complementary products, recommendations.
- Dependencies: product data, media, size guide content, metafields.
- Acceptance criteria: variant selection updates availability/price, add-to-cart works, size guide accessible, PDP has meaningful H1.
- Manual test checklist: choose size, unavailable variant, open modal, keyboard through gallery, add to cart success/error.
- Risk level: High.
- Estimated complexity: High.

## Phase 6 - Cart drawer and conversion features

- Objective: build AJAX cart drawer with free-shipping progress and accessible cart controls.
- Files likely affected: `snippets/cart-drawer.liquid`, `snippets/free-shipping-progress.liquid`, `assets/theme.js`, `assets/theme.css`, optional `templates/cart.json`, `sections/main-cart.liquid`.
- Shopify features required: cart endpoints through normal theme JS, cart object, checkout URL.
- Dependencies: Phase 5 add-to-cart, free-shipping threshold setting.
- Acceptance criteria: drawer opens after add, line item actions work, progress text correct, focus trap and live region work.
- Manual test checklist: add item, change quantity, remove item, cart empty state, Escape close, checkout button does not bypass Shopify checkout.
- Risk level: High.
- Estimated complexity: High.

## Phase 7 - SEO, accessibility, and performance

- Objective: harden templates for launch quality.
- Files likely affected: `layout/theme.liquid`, templates, sections, snippets, locale files, CSS/JS assets.
- Shopify features required: SEO title/meta, canonical, structured data where appropriate.
- Dependencies: core templates complete, original content present.
- Acceptance criteria: one H1 per page, Product/Organization/SearchAction/Breadcrumb schema valid, images responsive, JS deferred where safe.
- Manual test checklist: keyboard-only pass, mobile widths, alt audit, Lighthouse or equivalent if available, Rich Results Test for sampled pages.
- Risk level: Medium.
- Estimated complexity: Medium.

## Phase 8 - Merchant configuration and content population

- Objective: configure real content and remove temporary demo assumptions.
- Files likely affected: theme settings, Shopify Admin product/collection/page data, metafields/metaobjects, locales.
- Shopify features required: products, collections, pages, policies, Markets, navigation, metafields, metaobjects.
- Dependencies: merchant-provided content and assets.
- Acceptance criteria: no copied competitor content, product taxonomy complete, policy/help pages populated.
- Manual test checklist: inspect top products/collections/pages, verify settings_data changes are intentional, verify menus.
- Risk level: High.
- Estimated complexity: Medium.

## Phase 9 - QA and launch preparation

- Objective: validate unpublished theme and prepare launch approval.
- Files likely affected: bugfixes across theme files and docs.
- Shopify features required: unpublished theme preview, test orders, payment/shipping config in Admin by merchant.
- Dependencies: complete MVP, merchant approval, store settings configured.
- Acceptance criteria: Theme Check clean or documented warnings, critical flows pass, merchant approves final preview.
- Manual test checklist: desktop/mobile, search, filters, PDP, cart, checkout test order, policies, localization, broken links.
- Risk level: High.
- Estimated complexity: High.

# 8. MVP backlog theo thứ tự ưu tiên

| Priority | Feature | Why it matters | Dependency | Complexity | MVP / Post-MVP |
| --- | --- | --- | --- | --- | --- |
| P0 | Shopify theme scaffold | Không có scaffold thì không thể build theme. | Store/base theme decision | Medium | MVP |
| P0 | Git baseline | Cần diff review và rollback. | Repo init decision | Low | MVP |
| P0 | Design tokens | Nền cho UI nguyên bản. | Brand direction | Medium | MVP |
| P0 | Header/mobile nav/search/cart | Global shopping entry points. | Menus/logo | Medium | MVP |
| P0 | Product card snippet | Reuse cho homepage, collection, search, recommendations. | Product data | Medium | MVP |
| P0 | Homepage core sections | Tạo conversion entry. | Original images/copy/collections | Medium | MVP |
| P0 | Collection filters/sort | Discovery chính cho catalog. | Search & Discovery/metafields | High | MVP |
| P0 | PDP gallery/variant/size guide | Core purchase decision. | Product media/size data | High | MVP |
| P0 | Add to cart/cart drawer | Core conversion. | PDP/cart JS | High | MVP |
| P0 | Accessibility baseline | Non-negotiable UX/legal quality. | Core components | Medium | MVP |
| P0 | SEO metadata/schema | Search discoverability. | Original content | Medium | MVP |
| P0 | Policy/help/footer/newsletter | Trust and support. | Merchant content | Medium | MVP |
| P1 | Reviews integration | Social proof. | Merchant app choice | Medium | MVP if approved |
| P1 | Cross-sell/complementary products | AOV and product success. | Product relationships | Medium | MVP/P1 |
| P1 | Localization selector | International selling. | Shopify Markets | Medium | MVP if needed |
| P2 | Bundles | AOV uplift. | Bundle rules/app decision | High | Post-MVP |
| P2 | UGC/social gallery | Social proof but script-heavy. | Approved content/app | Medium | Post-MVP |
| P2 | Delivery estimate | Reduces shipping anxiety. | Shipping app/data | Medium | Post-MVP |
| P3 | Loyalty/rewards | Retention. | App choice | High | Post-MVP |
| P3 | Push/countdown/product quiz | Optional growth tools. | Merchant approval | Medium/High | Post-MVP |

# 9. Những nội dung cần merchant cung cấp

| Nội dung/data | Required for MVP? | Notes |
| --- | --- | --- |
| Brand name | Yes | Dùng cho logo text, SEO, schema. |
| Logo/favicons | Yes | SVG/PNG nguyên bản. |
| Brand colors | Yes | Dùng tạo tokens. |
| Typography preference | Yes | Shopify font picker hoặc font licensed. |
| Product photography | Yes | Ảnh nguyên bản, đủ desktop/mobile. |
| Product videos | Later | Optional cho PDP/UGC, cần tối ưu performance. |
| Collection images | Yes | Hero/tile images nguyên bản. |
| Product names | Yes | Không copy competitor names. |
| Product descriptions | Yes | Copy nguyên bản. |
| Price list | Yes | Cấu hình trong Shopify products. |
| Variants | Yes | Size/shape/length nếu là variant. |
| Size chart | Yes | Critical cho PDP. |
| Shape and length taxonomy | Yes | Dùng cho navigation/filter/metafields. |
| Stock information | Yes | Shopify inventory. |
| Policies | Yes | Shipping, returns, privacy, terms. |
| Shipping rules | Yes | Shopify Admin, không hard-code theme. |
| Return rules | Yes | Policy/help pages. |
| Contact details | Yes | Footer/contact page. |
| Social links | Yes | Footer/header settings. |
| Approved marketing claims | Yes | Trust row/PDP claims phải thật. |
| FAQ content | Yes | FAQ page/accordions. |
| Testimonial/review permissions | Later/MVP if reviews | Chỉ dùng review thật được phép. |
| Payment method details | Yes | Shopify Admin/provider setup, theme chỉ hiển thị generic approved badges. |
| Domain details | Launch | DNS/launch prep. |
| Localization markets/currencies | If selling internationally | Shopify Markets. |
| Email marketing provider | MVP if newsletter automation | Shopify form baseline, Klaviyo optional. |

# 10. App vs custom-code decision matrix

| Feature | Recommendation | Reason | Trade-off |
| --- | --- | --- | --- |
| Reviews | Shopify app | Native Shopify không có review UI đầy đủ. | App script/performance; chọn app nhẹ và approved. |
| Product bundles | Defer or Shopify app | Native discount may cover simple bundles; complex free gifts need app. | App adds complexity; defer until after MVP if possible. |
| Upsell | Custom Liquid/JS for simple cross-sell; app for rule-heavy offers | PDP accessory cross-sell có thể dùng metafields/complementary products. | Cart upsell phức tạp cần careful UX. |
| Loyalty | Defer, then app | Retention useful sau launch. | Heavy app and setup overhead. |
| Email marketing | Shopify form baseline; app for automation | Newsletter MVP có thể simple. | Klaviyo-like flows need app. |
| Wishlists | Defer | Không launch blocking. | App/storage complexity. |
| UGC gallery | Defer, then app/embed | Script-heavy and needs rights-approved content. | Performance risk. |
| Analytics | Native Shopify; optional Clarity/pixels with consent | Need measurement. | Privacy/consent setup. |
| Cookie consent | Native/privacy app depending markets | Legal requirement depends region. | Requires merchant/legal decision. |
| Shipping tracking | Defer or app | Post-purchase feature. | Not theme MVP. |
| Localization | Native Shopify Markets | Correct currency/language routing belongs to Shopify. | Needs Shopify plan/settings. |
| Product filtering | Shopify Search & Discovery | Native and SEO-aware. | Requires clean metafields/taxonomy. |
| Chat support | Defer or app | Support value but not core theme. | Adds scripts and operational burden. |

# 11. Accessibility and performance requirements

- Semantic HTML with landmarks and clear section structure.
- One logical `h1` per page.
- Keyboard navigation for header, mega menu, mobile drawer, filters, modals, accordions, variant picker, cart drawer and checkout CTA.
- Visible focus states on all interactive elements.
- Accessible mobile drawer with focus move, focus trap, Escape close and inert background behavior.
- Accessible cart drawer with `role="dialog"` or equivalent semantics, live region for cart updates and clear empty/error states.
- Accessible accordions with real buttons, `aria-expanded`, associated panels and predictable keyboard behavior.
- Labeled forms for search, newsletter, contact and product options.
- Responsive images via Shopify image transforms, width/height, `sizes`, lazy loading below fold and eager only for true LCP.
- Prevent layout shifts with aspect ratios and reserved app/widget space.
- Reduced motion support for animation.
- Avoid heavy global scripts and avoid loading post-MVP apps before needed.
- Avoid fake urgency, fake reviews, fake stock levels and unsupported marketing claims.
- Do not autoplay audio.

# 12. QA and validation plan

- Run `shopify theme check` after scaffold exists and before major review.
- Run local preview with `shopify theme dev --store [STORE].myshopify.com --open`.
- Push an unpublished preview with `shopify theme push --unpublished` for persistent review.
- Test desktop widths: 1440, 1280, 1024.
- Test mobile widths: 390, 375, 320.
- Test homepage, collection, search, product, cart drawer, cart page, FAQ, size guide, contact, policy and 404.
- Test cart behavior: add, quantity change, remove, empty cart, error state, free-shipping progress.
- Test variant behavior: size selection, unavailable variant, selected state, price/availability update.
- Test collection filtering and sorting using Shopify Search & Discovery config.
- Test search query and empty results.
- Test keyboard-only flow through header, mobile menu, filters, PDP, modal, accordion and cart drawer.
- Check image alt text and ensure decorative images are intentionally empty.
- Check broken links in header, footer, CTAs and help pages.
- Check Theme Editor configuration for every new section and global setting.
- Validate SEO metadata, canonical tags, Product/Offer schema, Organization schema, SearchAction schema and BreadcrumbList where present.
- Run performance audit if Lighthouse or browser tooling is available.
- Complete a Shopify test order only with merchant-approved test payment setup; do not inspect real payment data.
- Get final merchant approval before publish.

# 13. Risks, blockers, and decisions needed

| Risk/blocker | Impact | Decision or mitigation |
| --- | --- | --- |
| Dawn scaffold is baseline only | It is not yet an original press-on nails storefront. | Future phases must customize deliberately without copying Ersa Nails. |
| Git remote/branch strategy unknown | Baseline exists locally but collaboration flow is not defined. | Confirm remote repository and branch strategy before multi-agent implementation. |
| Missing merchant brand inputs | Cannot finalize design system. | Collect brand name, colors, logo, typography. |
| Missing product data | Cannot configure variants, filters, PDP facts. | Collect catalog, taxonomy, prices, inventory. |
| Missing original media | Cannot build final homepage/PDP visuals. | Use clearly marked temporary demo media only if necessary. |
| App dependencies undecided | Reviews/email/analytics may block launch decisions. | Choose minimal app stack before MVP QA. |
| Shopify plan limitations | Markets, checkout, metafields/app features may vary. | Confirm Shopify plan and Admin access. |
| Payment limitations | Theme must not handle payment data. | Configure in Shopify Admin/providers only. |
| Shipping limitations | Free-shipping logic may depend on Shopify discounts/settings. | Align threshold copy with real shipping rules. |
| Localization limitations | Currency/language support depends on Markets/content. | Decide launch markets before localization work. |
| Merchant approval needed | Copy/claims/policies cannot be invented. | Track open merchant inputs. |
| IP risk | Copying competitor creative creates legal/brand risk. | Enforce original assets/copy/code only. |

# 14. Recommended first implementation task

Recommended next task: Phase 0.5 product taxonomy and metafield model.

Exact files likely to be created or modified:

- Create a planning/spec document such as `docs/vietnamese/phase-0-5-product-taxonomy-metafields.md`.
- Do not modify Dawn storefront UI yet.
- Do not create homepage, product, collection, cart drawer, branding or visual features yet.

Expected output:

- A product taxonomy model for shape, length, finish/style, color, occasion, product type and accessories.
- A metafield/metaobject plan for PDP facts, size guide groups, included items, care instructions and cross-sell relationships.
- A Shopify Search & Discovery filter plan before collection UI implementation.

Test command:

```bash
shopify theme check
```

Local preview command:

```bash
shopify theme dev --store [STORE].myshopify.com --open
```

Acceptance criteria:

- Dawn baseline still runs `shopify theme check`.
- Taxonomy spec lists required product metafields, collection conventions, metaobjects and filter usage.
- Merchant decisions required for taxonomy are clearly listed.
- `AGENTS.md`, `README.md` and this plan still accurately describe repo state.
- No Ersa Nails source code, assets, product text, reviews, campaign copy or visual identity were introduced.
