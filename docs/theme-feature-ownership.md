# Theme feature ownership map

This map records current runtime ownership and the remaining cascade boundaries. Ordered `brand-NN-*` slices keep the original source order while exposing one domain owner per slice.

| Feature | Liquid owners | CSS owners | JavaScript owners | Status / boundary |
| --- | --- | --- | --- | --- |
| Global document | `layout/theme.liquid`, `snippets/meta-tags.liquid`, `theme-brand-styles` | `base.css`, `theme-tokens.css`, `theme-foundation.css`, `theme-foundation-cascade.css`, `brand-01/03/05/07/13/19-theme-foundation.css` | `global.js`, `custom-theme.js`, `details-*.js` | No catch-all stylesheet; the entrypoint preserves ordered owner slices and loads each once |
| Header and navigation | `sections/header.liquid`, `header-primary-*`, `header-search` | `shell-header.css`, `shell-header-cascade-*`, `brand-04/15/27/29/32/37/41-shell-header.css` | `global.js`, `shell-header.js` | `header-primary-*` is canonical; `sticky-header` has one registration owner with complete listener/observer teardown |
| Announcement | `sections/announcement-bar.liquid` | shell/header and shared commerce owner slices | section inline behavior | Shell feature |
| Footer | `sections/footer.liquid` | `shell-footer.css`, `shell-footer-cascade.css`, `brand-11-content-footer.css` | `shell-footer.js` | Accordion binding is idempotent across initial load and Theme Editor section reloads |
| Homepage/marketing | homepage JSON sections, `ersa-*`, slideshow, `featured-collection` rails (`summer-vibes`, `cute-nails`), newsletter | section assets, `section-product-ugc-videos.css`, `section-reviews-carousel.css`, `brand-08/12/14/16/18/23/26/28/30/34/36/38-page-home.css` | `section-product-ugc-videos.js`, `section-reviews-carousel.js`, Dawn slider primitives | Homepage now exposes Summer Vibes as the Best Sellers rail and Cute Nails as the suggested rail; each remains Shopify collection-backed and hides automatically when empty. Reviews use a centered, bounded track with deterministic image/no-image interleaving, square media, looped keyboard/arrow navigation and section lifecycle cleanup. |
| Product cards | `card-product`, `product-card-media`, `product-card-badges`, `product-card-price`, `product-card-quick-add`, shared `price` | `component-card.css`, `component-price.css`, `component-product-card-cascade.css`, `brand-02/06/31/33/35/40-product-card.css`, quick-add assets | `quick-add.js`, `product-form.js` | Unified vertical-card contract shared by home, collection, search, recommendations and cross-sells: a second product medium crossfades on desktop hover/focus when available, and the shared Quick Buy control expands from its cart icon. Horizontal cards retain their distinct commerce layout. |
| Collection facets | `main-collection-product-grid`, `facets` | `feature-facets.css`, `feature-facets-cascade.css`, `page-collection.css`, `page-collection-cascade.css`, `brand-10/22/25-page-collection.css` | `facets.js`, `facets.helpers.js`, `collection-filters.helpers.js`, `collection-filters.js` | Shared core/event contract; collection adapter owns reference layout and toolbar |
| Search | `main-search`, `facets` | `feature-facets.css`, `page-search.css`, `brand-21-page-search.css` | `facets.js`, `facets.helpers.js`, `search-page.js`, `main-search.js` | Shares facets core; search composition and canonical query remain page-owned |
| Product detail | `main-product`, `featured-product`, `product-title-block`, `product-price-block`, `product-rating-block`, media, variant, buy-button and disclosure snippets | `section-main-product.css`, `page-product-cascade-*`, `brand-24/39-page-product.css`, component assets | `product-info.js`, `product-form.js`, media and pickup modules | Public section schemas remain independent; shared presentation blocks receive explicit product/block/surface arguments |
| Cart drawer | `sections/cart-drawer`, `snippets/cart-drawer`, `cart-line-item-details`, `cart-line-item-total`, cross-sells/progress snippets | `feature-cart.css`, `feature-cart-cascade-*`, shared `brand-09/17/20-feature-commerce.css`, cart-drawer/item assets | `cart-drawer.js`, `cart.js`, `cart.helpers.js`, disclosure modules | `PUB_SUB_EVENTS.cartUpdate`, Standard Actions and section IDs are compatibility boundaries |
| Cart page | `main-cart-items`, `main-cart-footer`, `cart-line-item-details`, `cart-line-item-total` | `feature-cart.css`, `feature-cart-cascade-*`, shared `brand-09/17/20-feature-commerce.css`, cart item/total assets | `cart.js`, `cart.helpers.js`, quantity modules | Row wrappers and quantity controls remain surface-owned; compatible details and total composition are shared |
| Predictive search | `predictive-search`, `header-search` | `component-predictive-search.css` | `predictive-search.js`, `search-form.js` | Shell-owned |
| Localization | localization snippets and disclosure section | `component-localization-form.css` | `localization-form.js` | Shell-owned |
| Customer accounts | `main-account`, login/register/order/address sections | `customer.css` | `customer.js` | Dawn domain; refactor only when a dedicated slice is approved |

## Remaining high-risk boundaries

| File | Baseline size | Risk |
| --- | ---: | --- |
| Ordered `brand-NN-*` slices | 494,483-byte pre-split source | Rules have domain owners, but the numeric source-order contract remains necessary for pixel parity; consolidate only inside a dedicated owner checkpoint |
| `main-product.liquid` | 2,346 lines after Phase 4 | Public PDP orchestrator and independent schema; title, pricing and rating presentation now delegate to product-domain snippets |
| `featured-product.liquid` | 1,499 lines after Phase 4 | Public featured-product orchestrator and independent schema; shared presentation delegates without schema generation |
| `card-product.liquid` | 887-line baseline | Orchestrator now delegates media, badges, pricing and standard quick-add; bulk quick-add remains an explicit Dawn compatibility branch |
| `facets.liquid` | 1,038 lines | Desktop/mobile controls, sorting, active filters and disclosures |

## Removed legacy candidates

`header-drawer`, `header-dropdown-menu`, `header-mega-menu`, `header-normalized-url`, `header-shop-mega-menu`, and `quick-order-product-row` were removed in Phase 8. Theme Check and repository-wide scans found no consumer in Liquid, templates, section groups, or settings data; the canonical `header-primary-*` chain and the full preview suite remained operational after deletion.
