# Theme architecture refactor decision log

## Phase 0 — regression baseline

Date: 2026-08-22

Scope was limited to test and documentation tooling; no storefront runtime file was changed.

### Direct observations

- Store inspected: `develop-store-5y6bipog.myshopify.com` through Shopify CLI local preview.
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
