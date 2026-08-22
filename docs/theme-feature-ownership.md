# Theme feature ownership map

This map records current runtime ownership and the intended consolidation boundary. “Transitional” means the behavior is active and must be preserved while its rules are moved to a named owner.

| Feature | Liquid owners | CSS owners | JavaScript owners | Status / boundary |
| --- | --- | --- | --- | --- |
| Global document | `layout/theme.liquid`, `snippets/meta-tags.liquid` | `base.css`, `theme-tokens.css`, `theme-foundation.css`, `theme-foundation-cascade.css`, transitional `custom-theme.css` | `global.js`, `custom-theme.js`, `details-*.js` | Dawn foundation; only `custom-theme.css` remains a catch-all |
| Header and navigation | `sections/header.liquid`, `header-primary-*`, `header-search` | `shell-header.css`, `shell-header-cascade-*`, transitional custom rules | `global.js`, `shell-header.js` | `header-primary-*` is canonical; `sticky-header` has one registration owner with complete listener/observer teardown |
| Announcement | `sections/announcement-bar.liquid` | transitional custom rules | section inline behavior | Shell feature |
| Footer | `sections/footer.liquid` | `shell-footer.css`, `shell-footer-cascade.css`, transitional custom rules | `shell-footer.js` | Accordion binding is idempotent across initial load and Theme Editor section reloads |
| Homepage/marketing | homepage JSON sections, `ersa-*`, slideshow, collection rails, newsletter | section assets, `section-product-ugc-videos.css`, transitional custom rules | `section-product-ugc-videos.js`, Dawn slider primitives | UGC owns its static CSS/JS and idempotent reload lifecycle; consolidate only behaviorally equivalent sliders |
| Product cards | `card-product`, `product-card-media`, `product-card-badges`, `product-card-price`, `product-card-quick-add`, shared `price` | `component-card.css`, `component-price.css`, `component-product-card-cascade.css`, quick-add assets, transitional custom rules | `quick-add.js`, `product-form.js` | One explicit Liquid contract shared by home, collection, search, recommendations and cross-sells |
| Collection facets | `main-collection-product-grid`, `facets` | `feature-facets.css`, `feature-facets-cascade.css`, `page-collection.css`, `page-collection-cascade.css` | `facets.js`, `facets.helpers.js`, `collection-filters.helpers.js`, `collection-filters.js` | Shared core/event contract; collection adapter owns reference layout and toolbar |
| Search | `main-search`, `facets` | `feature-facets.css`, `page-search.css` | `facets.js`, `facets.helpers.js`, `search-page.js`, `main-search.js` | Shares facets core; search composition and canonical query remain page-owned |
| Product detail | `main-product`, `featured-product`, `product-title-block`, `product-price-block`, `product-rating-block`, media, variant, buy-button and disclosure snippets | `section-main-product.css`, `page-product-cascade-*`, component assets, transitional custom rules | `product-info.js`, `product-form.js`, media and pickup modules | Public section schemas remain independent; shared presentation blocks receive explicit product/block/surface arguments |
| Cart drawer | `sections/cart-drawer`, `snippets/cart-drawer`, `cart-line-item-details`, `cart-line-item-total`, cross-sells/progress snippets | `feature-cart.css`, `feature-cart-cascade-*`, cart-drawer/item component styles plus transitional custom rules | `cart-drawer.js`, `cart.js`, `cart.helpers.js`, disclosure modules | `PUB_SUB_EVENTS.cartUpdate`, Standard Actions and section IDs are compatibility boundaries |
| Cart page | `main-cart-items`, `main-cart-footer`, `cart-line-item-details`, `cart-line-item-total` | `feature-cart.css`, `feature-cart-cascade-*`, cart item/total component styles plus transitional custom rules | `cart.js`, `cart.helpers.js`, quantity modules | Row wrappers and quantity controls remain surface-owned; compatible details and total composition are shared |
| Predictive search | `predictive-search`, `header-search` | `component-predictive-search.css` | `predictive-search.js`, `search-form.js` | Shell-owned |
| Localization | localization snippets and disclosure section | `component-localization-form.css` | `localization-form.js` | Shell-owned |
| Customer accounts | `main-account`, login/register/order/address sections | `customer.css` | `customer.js` | Dawn domain; refactor only when a dedicated slice is approved |

## Transitional high-risk files

| File | Baseline size | Risk |
| --- | ---: | --- |
| `custom-theme.css` | 497,253-byte baseline | Multiple features and successive overrides; two redundant section loads are removed, while one late homepage load remains a verified cascade compatibility boundary |
| `main-product.liquid` | 2,346 lines after Phase 4 | Public PDP orchestrator and independent schema; title, pricing and rating presentation now delegate to product-domain snippets |
| `featured-product.liquid` | 1,499 lines after Phase 4 | Public featured-product orchestrator and independent schema; shared presentation delegates without schema generation |
| `card-product.liquid` | 887-line baseline | Orchestrator now delegates media, badges, pricing and standard quick-add; bulk quick-add remains an explicit Dawn compatibility branch |
| `facets.liquid` | 1,038 lines | Desktop/mobile controls, sorting, active filters and disclosures |

## Removed legacy candidates

`header-drawer`, `header-dropdown-menu`, `header-mega-menu`, `header-normalized-url`, `header-shop-mega-menu`, and `quick-order-product-row` were removed in Phase 8. Theme Check and repository-wide scans found no consumer in Liquid, templates, section groups, or settings data; the canonical `header-primary-*` chain and the full preview suite remained operational after deletion.
