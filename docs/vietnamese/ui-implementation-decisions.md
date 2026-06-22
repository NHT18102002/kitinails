# UI Implementation Decisions

Tài liệu này khóa các quyết định kiến trúc và sản phẩm cho giai đoạn chuẩn bị build theme. Các quyết định này dựa trên `AGENTS.md`, `README.md` và toàn bộ research docs hiện có trong `docs/`.

## 1. Architecture decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Platform | Shopify Online Store 2.0 | Phù hợp mục tiêu store press-on nails và Theme Editor customization. |
| Current repo classification | Dawn-based Shopify OS 2.0 theme foundation with planning documentation | Phase 0 imported official Dawn and preserved project docs. |
| Theme base | Official Shopify Dawn `v15.5.0`, commit `83d5e6b4094d8019820bffafe04b242d0602ffe2` | Dawn is the technical base by confirmed decision; final storefront must become original. |
| Rendering | Liquid + JSON templates + sections/snippets | Native Shopify pattern, merchant-editable. |
| JavaScript | Lightweight vanilla JavaScript | Đủ cho drawer, modal, accordion, variant và cart behavior; không cần framework. |
| CSS | Preserve Dawn CSS organization during foundation; customize deliberately in later phases | Avoid broad refactors before product taxonomy and brand direction are known. |
| Data model | Shopify products, variants, collections, metafields, metaobjects | Dữ liệu merchant-editable và tương thích Search & Discovery. |
| Checkout and payments | Shopify Admin/payment providers only | Theme không xử lý card data, payment token hoặc secrets. |
| Research usage | Functional inspiration only | Không sao chép Ersa Nails code, assets, copy, reviews hoặc brand identity. |

## 2. Section naming conventions

- Section files use kebab-case, descriptive English names: `hero-banner.liquid`, `featured-collection.liquid`, `shop-by-shape.liquid`.
- Main template sections use Shopify-style names: `main-product.liquid`, `main-collection-product-grid.liquid`, `main-search.liquid`, `main-cart.liquid`.
- Reusable snippets use noun-based names: `card-product.liquid`, `price.liquid`, `variant-picker.liquid`, `accordion-item.liquid`.
- Global behavior can live in `assets/theme.js` until it becomes too large; only split to `assets/cart.js` or `assets/product.js` when there is real complexity.
- Locale keys should be grouped by component, for example `products.product.add_to_cart`, `cart.drawer.free_shipping_remaining`, `sections.newsletter.heading`.

## 3. CSS and JavaScript organization

## CSS

- Use CSS custom properties for design tokens from `config/settings_schema.json`.
- Preserve Dawn asset conventions first; introduce new CSS only when a later phase has an approved component or brand requirement.
- Use predictable component classes such as `.product-card`, `.cart-drawer`, `.site-header`, `.mobile-menu`, `.accordion`.
- Use responsive CSS with stable layout primitives: grid, flex, aspect-ratio, min/max widths.
- Keep focus styles global and visible; do not remove outlines without replacement.

## JavaScript

- Use vanilla JS modules/patterns without jQuery.
- Own only interaction behavior: drawer open/close, modal focus trap, accordions, variant updates, AJAX cart updates.
- Prefer progressive enhancement: HTML forms and links should remain useful if JS fails where practical.
- Keep Shopify cart requests limited to normal storefront cart behavior; do not call private/admin/checkout/payment endpoints.
- Add reduced-motion checks where animations are used.

## 4. Shopify-native features chosen

| Capability | Shopify-native choice |
| --- | --- |
| Product catalog | Shopify products and variants. |
| Product taxonomy | Collections, product types, tags only where useful, metafields for shape/length/finish/style. |
| Filters | Shopify Search & Discovery. |
| Sorting | Shopify collection/search sort. |
| Recommendations | Shopify product recommendations and complementary products first. |
| Cart and checkout | Shopify cart object, cart form/endpoints and Shopify checkout. |
| Pages and policies | Shopify pages and policy settings. |
| Localization | Shopify Markets where required. |
| Theme customization | Sections, blocks, settings, metafields and metaobjects. |
| Analytics baseline | Shopify analytics. |

## 5. App vs custom-code decisions

| Feature | Decision | Notes |
| --- | --- | --- |
| Reviews | Use merchant-approved Shopify app for MVP if reviews are required. | Judge.me-like functionality is not native; watch performance and schema. |
| Email marketing | Start with Shopify newsletter form; use Klaviyo or approved app if automation is needed. | Do not hard-code external list URLs without merchant approval. |
| Product bundles | Defer or use app only for complex bundle/free-gift rules. | Simple bundle collections can be native. |
| Upsell/cross-sell | Custom Liquid using complementary products/metafields first. | Keep suggestions relevant and editable. |
| Loyalty/rewards | Defer. | Useful after MVP, not launch-blocking. |
| Wishlists | Defer. | Adds app/storage complexity. |
| UGC gallery/video | Defer. | Requires rights-approved content and adds script weight. |
| Analytics | Shopify analytics first; optional Clarity/pixels after privacy review. | Merchant must approve tracking stack. |
| Cookie consent | Decide based on launch markets/legal needs. | May require Shopify/app support. |
| Shipping tracking/delivery estimate | Defer unless merchant makes it MVP. | Avoid heavy app before launch. |
| Localization | Native Shopify Markets. | Do not custom-convert currencies in theme. |
| Product filtering | Shopify Search & Discovery. | Requires clean taxonomy. |
| Chat support | Defer. | Operational and performance cost. |

## 6. Deferred features

Defer these until after MVP unless the merchant explicitly changes priority:

- Loyalty/rewards.
- UGC/social gallery/video embeds.
- Push notifications.
- Countdown timers and urgency widgets.
- Advanced bundles/free gifts.
- Delivery-estimate app.
- Shipping protection add-on.
- Affiliate/creator program.
- Product quiz.
- Complex customization request workflow.
- Dark mode.
- Agentic/UCP commerce work.

## 7. Open decisions requiring merchant input

- Final brand name and positioning.
- Logo, favicon, color palette and typography.
- Product taxonomy: exact shape, length, finish/style, occasion and accessory groups.
- Product catalog, names, descriptions, images, videos, prices, variants and inventory.
- Size chart and fit guidance.
- Shipping threshold and real shipping rules.
- Return/exchange policy.
- Payment methods and Shopify payment provider setup.
- Launch markets, currencies and languages.
- Review provider and whether existing reviews have permission to migrate.
- Email marketing provider.
- Analytics/pixel/privacy stack.
- Depth of Dawn customization versus preserving Dawn defaults for early MVP.
- Remote repository and branch strategy for collaboration after the local baseline commit.

## 8. Design principles

- Original brand expression first: no copied color palette, fonts, art direction, photography, layout, campaign concepts or product naming from Ersa Nails.
- Mobile-first browsing and buying.
- Fit confidence is central: shape, length, size guide, clear PDP facts and accessible variant selection.
- Product outcome first, technical details second, policies/support third.
- Trust must be honest: real policies, real reviews, real claims, no fake urgency.
- Performance is a feature: avoid app-heavy launch, reduce global scripts, optimize images.
- Accessibility is part of definition of done: keyboard, focus, semantic structure, visible labels and useful alt text.

## 9. Anti-copying and IP rules

- Do not copy Ersa Nails source code, Liquid, CSS, JavaScript, app configuration or generated assets.
- Do not save competitor screenshots, product photos, UGC, videos, icons, reviews or press assets in this repo.
- Do not copy product names, collection names, descriptions, review text, campaign copy, policy text or blog content.
- Do not reproduce exact homepage order, carousel creative, seasonal campaign idea or pixel-perfect visual identity.
- Research notes must distinguish direct observation, inference, confidence level and original implementation decision.
- If temporary demo content is needed later, label it clearly and replace it before launch.

## 10. Phase 0 baseline decision

Phase 0 uses official Shopify Dawn `v15.5.0` as the technical base. The baseline Theme Check result is 8 warnings and 0 errors. Local preview requires a real Shopify store domain and CLI authentication; it was not run in Phase 0 because no store access was available in repository context.

The next implementation decision is Phase 0.5: define product taxonomy and metafield/metaobject model before customizing Dawn UI.
