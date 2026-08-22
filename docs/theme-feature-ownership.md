# Theme feature ownership map

This map records current runtime ownership and the intended consolidation boundary. “Transitional” means the behavior is active and must be preserved while its rules are moved to a named owner.

| Feature | Liquid owners | CSS owners | JavaScript owners | Status / boundary |
| --- | --- | --- | --- | --- |
| Global document | `layout/theme.liquid`, `snippets/meta-tags.liquid` | `base.css`, `theme-tokens.css`, `theme-foundation.css`, transitional `custom-theme.css` and `legacy-compat.css` | `global.js`, `custom-theme.js`, `details-*.js` | Dawn foundation; catch-all files are transitional |
| Header and navigation | `sections/header.liquid`, `header-primary-*`, `header-search` | `header-unified.css`, transitional custom rules | header behavior in `global.js` and inline section code | `header-primary-*` is canonical; orphan Dawn header snippets remain deprecated until store-config audit |
| Announcement | `sections/announcement-bar.liquid` | transitional custom rules | section inline behavior | Shell feature |
| Footer | `sections/footer.liquid` | `section-footer.css`, transitional custom rules | section inline behavior | Shell feature; inline behavior will become idempotent asset |
| Homepage/marketing | homepage JSON sections, `ersa-*`, slideshow, collection rails, newsletter | section assets plus transitional custom rules | section inline code and slider primitives | Consolidate only behaviorally equivalent sliders |
| Product cards | `card-product`, `product-card-media`, `product-card-badges`, `product-card-price`, `product-card-quick-add`, shared `price` | `component-card.css`, `component-price.css`, quick-add assets, transitional overrides | `quick-add.js`, `product-form.js` | One explicit Liquid contract shared by home, collection, search, recommendations and cross-sells; CSS overrides remain a later ownership migration |
| Collection facets | `main-collection-product-grid`, `facets` | `feature-facets.css`, `page-collection.css` | `facets.js`, `facets.helpers.js`, `collection-filters.helpers.js`, `collection-filters.js` | Shared core/event contract; collection adapter owns reference layout and toolbar |
| Search | `main-search`, `facets` | `feature-facets.css`, `page-search.css` | `facets.js`, `facets.helpers.js`, `search-page.js`, `main-search.js` | Shares facets core; search composition and canonical query remain page-owned |
| Product detail | `main-product`, `featured-product`, product-domain snippets | `section-main-product.css`, component assets, transitional overrides | `product-info.js`, `product-form.js`, media and pickup modules | Public section schemas remain independent |
| Cart drawer | `sections/cart-drawer`, `snippets/cart-drawer`, cross-sells/progress snippets | cart drawer/component styles plus transitional overrides | `cart-drawer.js`, `cart.js`, disclosure modules | `PUB_SUB_EVENTS.cartUpdate` and section IDs are compatibility boundaries |
| Cart page | `main-cart-items`, `main-cart-footer` | cart component styles plus transitional overrides | `cart.js`, quantity modules | Share line-item rendering only where markup contracts match |
| Predictive search | `predictive-search`, `header-search` | `component-predictive-search.css` | `predictive-search.js`, `search-form.js` | Shell-owned |
| Localization | localization snippets and disclosure section | `component-localization-form.css` | `localization-form.js` | Shell-owned |
| Customer accounts | `main-account`, login/register/order/address sections | `customer.css` | `customer.js` | Dawn domain; refactor only when a dedicated slice is approved |

## Transitional high-risk files

| File | Baseline size | Risk |
| --- | ---: | --- |
| `custom-theme.css` | 497,253 bytes | Multiple features and successive overrides; globally loaded and redundantly referenced by three sections |
| `legacy-compat.css` | 172,814-byte baseline | Temporary catch-all formerly named `custom-theme-overrides.css`; overlaps heavily with the preceding file |
| `main-product.liquid` | 2,418 lines | Rendering, schema, structured data, media and commerce orchestration |
| `featured-product.liquid` | 1,565 lines | Duplicates substantial PDP composition while maintaining a distinct schema |
| `card-product.liquid` | 887-line baseline | Orchestrator now delegates media, badges, pricing and standard quick-add; bulk quick-add remains an explicit Dawn compatibility branch |
| `facets.liquid` | 1,038 lines | Desktop/mobile controls, sorting, active filters and disclosures |

## Deprecated candidates

`header-drawer`, `header-dropdown-menu`, `header-mega-menu`, `header-normalized-url`, `header-shop-mega-menu`, and `quick-order-product-row` currently have no static consumer according to Theme Check. They are not removed until templates, section groups, settings data, active store configuration, and the full preview suite all prove them unused.
