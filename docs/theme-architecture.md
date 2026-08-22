# Theme architecture

This document is the canonical boundary and compatibility contract for the Shopify theme at the repository root. It does not cover `tools/product-publisher`, `tools/catalog-import`, catalog data, or Shopify Admin business logic.

## Runtime model

The theme remains a Shopify Online Store 2.0 theme based on Dawn. Liquid sections and snippets render the initial document; classic deferred vanilla JavaScript and Web Components own client-side interactions. There is no storefront build step, JavaScript framework, or jQuery dependency.

The public compatibility boundary includes:

- Section filenames, section setting IDs, block types, and JSON template section IDs.
- Shopify and Dawn DOM hooks used by section rendering, product forms, facets, cart updates, search, and Theme Editor reloads.
- Product, collection, search, cart, customer, and checkout-entry URLs and request payloads.
- `PUB_SUB_EVENTS.cartUpdate`, Standard Actions integration, and existing transitional custom events.
- The rendered cascade, responsive breakpoints, accessible names, keyboard behavior, and merchant-authored content.

## Responsibility conventions

### Liquid

- `main-*`: page-template entry sections.
- `ersa-*`: brand-specific content sections.
- `product-*`, `cart-*`, `facets-*`, `header-*`: domain snippets.
- `ui-*`: genuinely reusable primitives, such as responsive media, disclosure, modal, drawer, and icon controls.

A section reads Theme Editor settings, prepares Shopify objects, composes snippets, and owns its backward-compatible schema. Shared snippets receive explicit arguments; new snippets must not silently rely on `section`, `block`, or `product` when the value can be passed by the caller.

### CSS

The target order is tokens, foundation, global shell, shared components, feature assets, and page assets. Only tokens and foundation may be globally loaded without a specific storefront feature owner. The behavior-preserving brand migration uses ordered `brand-NN-*` slices: every slice has one domain owner, while its numeric prefix preserves the previously interleaved cascade. Reordering those slices requires the complete visual gate. No `@layer`, new `!important`, or catch-all final override file may be introduced.

### JavaScript

JavaScript remains deferred, framework-free, and compatible with Dawn custom elements. Initialization must be idempotent across initial load and `shopify:section:load`. Global listeners require teardown or duplicate-registration protection. Cross-component communication uses custom events or Dawn pub/sub; page adapters may not patch another component's prototype.

Pure helpers must be importable by Node tests without browser or Shopify globals. A custom element name may have one registration owner only.

## Asset-loading rules

- Global assets are declared by `layout/theme.liquid` or its `theme-brand-styles` entrypoint.
- `theme-brand-styles` is applied once: at the established late-cascade marker when that section exists, otherwise through the layout fallback.
- Page assets are loaded by their `main-*` owner section.
- Section assets are loaded by the owning section, once per document where practical.
- A new CSS or JavaScript asset requires an entry in [theme-feature-ownership.md](theme-feature-ownership.md).
- `npm run report:theme:assets` reports total and globally referenced CSS/JS bytes.

## Validation gates

Run `npm run check:theme:all` for Theme Check and static contracts. Run `npm run test:theme:e2e` against the local preview for Chromium and WebKit interaction coverage. Chromium visual snapshots are canonical at 1440, 1024, 768, and 390 px. Golden snapshots are never updated merely to make a failure pass.

Schema fingerprints in `tests/theme/schema-contract.json` intentionally fail when a public section interface changes. A deliberate merchant-facing migration requires explicit approval and an updated contract in the same checkpoint.
