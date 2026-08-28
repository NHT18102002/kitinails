# Theme architecture refactor decision log

## Phase 0 — regression baseline

Date: 2026-08-22

Scope was limited to test and documentation tooling; no storefront runtime file was changed.

### Direct observations

- Store inspected: `kitinails.myshopify.com` through Shopify CLI local preview.
- Local development theme ID: `152839782551`; production was not published.
- Persistent unpublished checkpoint theme: `Ersa Architecture Refactor`, ID `152839979159`.
- Routes exercised: homepage, `/collections/all`, multi-variant product `/products/safari`, search with/without results, empty cart, and `/pages/contact`.
- Chromium visual baselines were captured at 1440, 1024, 768, and 390 px for home, collection, product, empty search, and empty cart.
- Chromium and WebKit interaction/runtime suite passed 48 scenarios; six viewport-inapplicable scenarios were skipped.
- Theme Check inspected 1,526 files with 0 errors and 13 existing warnings.
- Theme CSS/JS total was 1,429,548 bytes; assets referenced globally by `layout/theme.liquid` totaled 916,164 bytes.

### Baseline allowances

- Shopify's local theme-dev proxy injects one script that WebKit may reject through CORS. The exact message is allowlisted for local-preview runtime assertions only.
- The existing complementary-products slider exposes `role=list` with `role=group` children. Axe reports `aria-required-children` on the product fixture. This pre-existing critical rule is recorded, not silently ignored globally, and remains a hardening item.
- Sold-out and stable single-variant fixture paths are environment-configurable because the development catalog did not provide confirmed immutable handles during baseline capture.

### Decisions

- Node's built-in test runner is used for schema, reference and pure-helper contracts.
- Playwright runs Chromium and WebKit; Chromium is the only visual golden engine.
- Public section schema interfaces are protected by SHA-256 fingerprints.
- Template section targets, literal snippet/asset references, and duplicate custom-element registrations fail the contract suite.
- Root Node tooling is test-only and does not create a storefront build pipeline.

### Evidence classification

The routes, console behavior, accessibility output, screenshots, Theme Check result and asset sizes above were directly observed. Legacy-candidate status is an inference from static references and Theme Check until active store configuration is also inspected. Confidence is high for the recorded fixture outputs and medium for unused-file classification.

## Phase 1 — foundation boundary

The existing global token values moved unchanged into `theme-tokens.css`. The first document-wide layout and shell primitives moved unchanged into `theme-foundation.css`. Both assets remain in the exact cascade position previously occupied by the opening of `custom-theme.css`: after Dawn `base.css` and before the remaining compatibility rules. Brand font aliases were also centralized without changing their values.

The former `custom-theme-overrides.css` is now explicitly named `legacy-compat.css`, at the same cascade position. This checkpoint deliberately leaves feature and page rules in the two transitional stylesheets. Moving those rules is gated by their vertical slices so that later selectors and existing `!important` declarations retain their original cascade behavior.

## Phase 2 — collection/search facets

`facets.js` is now the single rendering engine for both templates. It publishes `ersa:facets:rendered` with `{ template, productCount }` and continues to publish `collection:facets-rendered` and `search:facets-rendered` during migration. Page controllers configure submit behavior through the cancelable `ersa:facets:before-submit` event; neither controller patches `FacetFiltersForm.prototype` or replaces its static methods.

`facets.helpers.js` owns pure query merging. Repeated filter values are preserved, blank values are removed, and search singleton keys use the submitting form as the final authority. The latter prevents a hidden sort form from overwriting the visible selection in WebKit. Shared Dawn facet styling is now explicitly owned by `feature-facets.css`; collection and search visual rules remain scoped in `page-collection.css` and `page-search.css`.

## Phase 3 — product-card primitives

`card-product.liquid` remains the single public orchestrator used by homepage rails, collection, search, related products, cross-sells and complementary products. Primary/secondary media, sale/sold-out badges, price composition and standard quick-add now live in explicit `product-card-*` snippets. Arguments include product, section/form IDs, layout context, color schemes, image loading behavior and captured visual labels; the new snippets do not infer their owner from an ambient section or block.

Bulk quick-add remains inside the orchestrator because its modal, quantity-price-break and section contracts differ from standard card quick-add. Existing URLs, image `srcset`/`sizes`, badge IDs, percentage calculation, price output, accessible labels and product-form IDs are unchanged.

## Phase 4 — product detail composition

`main-product` and `featured-product` remain the public section owners and retain independent Theme Editor schemas. Their duplicated title, price/tax/installment and review-rating markup now delegates to `product-title-block`, `product-price-block` and `product-rating-block`. Each shared snippet receives the product, block, section ID and surface mode explicitly; the intentional heading, placeholder, installment-form and review-count differences remain surface-specific branches.

Existing media-gallery, media-modal, variant-picker, buy-buttons and disclosure snippets continue to own their established runtime boundaries. Quantity controls were not combined because the active main-product select control and Dawn featured-product stepper expose different markup and behavior. No schema generation or public ID rename was introduced.

Direct validation used `/products/safari` on the local development preview and the Shopify Section Rendering endpoint for the unconfigured featured-product placeholder. The Chromium visual product snapshots matched at 1440, 1024, 768 and 390 px. The new PDP suite passed gallery, pricing, form, variant-update and duplicate Theme Editor reload contracts in Chromium and WebKit; disclosure scenarios were skipped because this fixture does not render a product disclosure block. Confidence is high for the active PDP fixture and medium for merchant configurations not represented by the fixture catalog.

## Phase 5 — cart and commerce interactions

The cart page and drawer retain separate row wrappers and quantity controls because their table semantics, responsive totals and input models are materially different. Compatible line title, unit price, option/property/discount rendering and line-total rendering now delegate to `cart-line-item-details` and `cart-line-item-total`. Explicit `surface` arguments preserve the existing page/drawer differences, including disclosure IDs, vendor class, upload-link accessibility attributes, option separators, escaping and `dl` versus `div` price semantics.

`component-cart.css` is now the feature-owned `feature-cart.css`; all Liquid references were updated without moving its rules. The existing later body loads remain temporarily duplicated because visual regression testing proved they are part of the current cascade: removing them moved cart layouts by 60–350 px depending on viewport. They may only be removed after the related selectors are migrated out of the global compatibility stylesheets.

The drawer quantity select exposed a directly observed baseline defect: `CartItems.validateQuantity` read number-input DOM properties from a `select`, producing “increments of undefined” and never sending `/cart/change`. `cart.helpers.js` now normalizes min/max/step for both controls, the recursive inline handler moved to the cart owner, and Node tests protect the pure constraint contract. AJAX payloads, section IDs, `PUB_SUB_EVENTS.cartUpdate` and Standard Actions remain unchanged.

Validation covered filled cart, page and drawer quantity updates, remove-to-empty, simulated 422 errors, progress, checkout, drawer focus/Escape and runtime errors in desktop Chromium and mobile WebKit. Four new filled-cart Chromium baselines were captured at 1440, 1024, 768 and 390 px; all pre-existing empty-cart baselines remain pixel-identical.

## Phase 6 — header, footer and global shell

`sections/header.liquid` directly composes `header-primary-drawer`, `header-primary-links`, `header-collection-menu` and `header-search`; this is the canonical navigation chain. The older Dawn `header-drawer`, `header-dropdown-menu`, `header-mega-menu`, `header-normalized-url` and `header-shop-mega-menu` chain has no consumer in templates, section groups, settings data or active header code and remains deprecated until the Phase 8 deletion gate.

The section-inline `sticky-header` class moved to `shell-header.js`, while the footer accordion moved to `shell-footer.js`. The header custom element now has a guarded single registration owner and tears down scroll, media-query, observer and timer resources on disconnect. Footer headings use a `WeakSet` instead of clone-and-replace, so repeated `shopify:section:load` events cannot duplicate listeners or replace merchant-rendered DOM nodes. CSS owners were named consistently as `shell-header.css` and `shell-footer.css`; rule contents and cascade positions did not move.

Direct Chromium/WebKit validation covered desktop collection navigation, predictive search, sticky scroll state, mobile footer keyboard behavior and two repeated Theme Editor load events. The homepage remained pixel-identical at 1440, 1024, 768 and 390 px. Header/footer filenames, schemas, group JSON, merchant settings, localization, cart trigger and predictive-search contracts are unchanged.

## Phase 7 — marketing section ownership

The product UGC rail's static rules and inline interaction moved to `section-product-ugc-videos.css` and `section-product-ugc-videos.js`; only per-instance padding remains Liquid-generated. The runtime initializes on the first document load and `shopify:section:load`, uses its existing ready marker to prevent duplicate arrow listeners, and continues to disable autoplay under reduced-motion preferences. Chromium and WebKit confirm that two simulated Theme Editor reloads still move the rail by exactly one card.

The repeated `custom-theme.css` links were audited in source order. Removing the copies in `ersa-collection-grid` and `ersa-as-seen-in` is pixel-neutral because the later reviews-section copy remains the final cascade application. Removing that last late copy causes 2–37% homepage visual diffs, so it remains an explicit Phase 8 compatibility boundary rather than being silently replaced with a duplicate file under a new name.

The leading UTF-8 BOM in `ersa-reviews-carousel.liquid` also creates a directly observed anonymous line box of roughly 27 px. It is intentionally preserved for visual parity in this behavior-preserving roadmap and recorded as legacy debt; deleting it requires a separately approved visual migration. Home and product snapshots remain unchanged at all canonical Chromium viewports after the owned UGC extraction.

## Phase 8 — legacy audit and hardening

Repository-wide Liquid, template, section-group and settings scans confirmed that the deprecated Dawn header chain and `quick-order-product-row` had no runtime consumer. The six orphan snippets were removed only after schema, asset/snippet reference, duplicate custom-element and full preview contracts continued to pass. Header behavior remains owned by the canonical `header-primary-*` chain.

Safe Liquid lint debt was removed by initializing the color-scheme accumulator, deleting unused assignments and normalizing local variable names. The valid Liquid pagination contract `offset: continue` is retained and has a targeted `UndefinedObject` exception around that loop. Theme Check now reports zero offenses rather than the 13-warning Phase 0 baseline.

The full browser gate exercises 240 project/browser cases. A transient WebKit active-facet timeout passed on immediate isolated rerun. Shopify's development proxy also emits a WebKit CORS error for its injected `/api/event/collect` web-pixel endpoint; the test-only runtime baseline now recognizes that exact local telemetry form alongside the existing worker form. Storefront errors remain failures.

`legacy-compat.css` was split without changing rule text, specificity, or source order at twelve existing top-level domain boundaries. The resulting Product, Cart, Footer, Collection, Facets, Product Card, Header and Foundation cascade assets concatenate to the exact normalized source of the former file. All 24 Chromium visual cases match at 1440/1024/768/390; the known transient 768 px homepage capture passed on immediate isolated rerun.

`custom-theme.css` was then divided at 41 existing top-level boundaries. Every `brand-NN-*` slice has one Foundation, Header, Product Card, Home, Collection, Search, Product, Content/Footer, or shared Commerce owner, while the numeric prefix protects the original interleaved cascade. The obsolete late Google Fonts `@import` was removed because browser CSSOM inspection confirmed that its former mid-file position was invalid and ignored; the existing local/fallback font declarations remain unchanged.

`theme-brand-styles` is the single ordered entrypoint. Home and Product retain the directly observed late-cascade position through the reviews section marker; `layout/theme.liquid` detects that marker in `content_for_layout`, so pages without the section load the entrypoint once in the head instead of losing their styles. This removes both catch-all files and duplicate stylesheet application without changing computed output. The 24 canonical Chromium snapshots pass exactly after the split.

The final post-split Playwright run completed with 162 passing cases, 78 intentional viewport/browser skips, and zero failures. Theme Check remained at zero offenses, all 13 unit/contract tests passed, and measured global CSS/JS was 916,021 bytes versus the 916,164-byte Phase 0 baseline.
