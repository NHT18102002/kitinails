# Collection Page Visual Match - 2026-07-03

## Scope

- Reference URL: `https://ersanails.com/collections/all`
- Local preview: `http://127.0.0.1:9292/collections/all`
- Page phase: Collection Page only.

## Direct Observations

- Desktop reference check at 1440px showed a compact collection area after promotional content: breadcrumb, product count, sort control, left filter column, product grid, and pagination.
- Desktop local before this pass rendered a large Dawn-style collection hero with fallback product imagery/description, pushing the product grid down.
- Mobile local before this pass rendered the collection grid as 3 narrow columns with clipped quick-add controls.
- Chrome extension browser control became unstable after timeout, so final visual verification used local Chromium headless screenshots.

## Implementation Decisions

- Preserve Shopify-native collection data, sort, filters, pagination, product card links, and quick add.
- Do not hard-code collection/product data into Liquid, CSS, or JavaScript.
- Remove the product-media fallback from `main-collection-banner`; collection images now render only from `collection.image` when enabled.
- Remove the generic fallback collection description; collection copy now comes from the Shopify collection object only.
- Set `/collections/all` template defaults to a compact collection heading with no collection image or fallback description.
- Add scoped CSS for collection pages to neutralize stale `collection-hero--with-image` markup when no media element renders, flatten the filter sidebar, restore a clean quick-add control, and keep mobile product cards to 2 columns.

## Verification

- RED check before the fix: local HTML rendered `collection-hero--with-image`.
- GREEN structural check after the fix: local HTML has no `collection-hero__image-container`, no fallback description text, and served CSS contains the compact no-media guard.
- Local theme dev on port `9292` was restarted because the previous watcher stopped syncing updated files.
- Chromium headless desktop screenshot captured after the fix:
  - `.codex-temp/collection-local-1440-after2.png`
- Responsive visual check performed:
  - 1440px desktop screenshot inspected.
  - 390px mobile CSS rule verified in served CSS; mobile screenshot tooling was inconsistent after the first pre-fix capture.

## Remaining Gaps

- Reference collection currently includes promotional campaign modules above the collection grid; this pass focused on the collection header, toolbar, filters, grid, mobile layout, and clipped controls.
- Local store has only 11 products in `/collections/all`, while the reference showed hundreds, so pagination and dense catalog behavior remain data-limited locally.
- Product media exists in local HTML, but several local product images are very light on white and appear low-contrast in the headless screenshot.

## 2026-07-04 Follow-up Pass

### Direct Observations

- Public reference and local preview were checked at 1440px, 1024px, 768px, and 390px.
- Reference collection page shows a black announcement strip, centered header, campaign hero, black marquee, "BUY MORE SAVE MORE" promo accordion, breadcrumb row, sort/product-count controls, left filters on tablet/desktop, icon-only mobile filter control, 2-column mobile grid, wishlist hearts, quick-buy buttons, and sale/promo product cards.
- Reference mobile uses a distinct close-up hero image source for the campaign hero; desktop/tablet use the beach group campaign image.
- Local store data remains different from the reference: local `/collections/all` has 11 products, while the reference displayed hundreds and richer review/sale metadata.

### Implementation Decisions

- Added an `ersa-collection-campaign` section to the collection template and kept campaign copy/media configurable through section settings and blocks.
- Stored the authorized public mobile hero source locally as `assets/collection-july-hero-mobile.jpg` and wired it through a mobile-only `<picture>` source.
- Kept Shopify-native collection objects, product cards, filtering, sorting, pagination, product links, quick add, and cart drawer behavior; no product list, inventory, price, or collection handles were hard-coded.
- Added final collection-scoped CSS for announcement/header alignment, desktop/tablet sort/filter layout, mobile icon-only filter control, product-card media ratio, wishlist visibility, quick-add hit testing, and collection-only cart glyph styling.

### Verification

- Final screenshots and metrics were saved under `.codex-temp/collection-*-{1440,1024,768,390}-*.png` and `.codex-temp/collection-final-metrics.json`.
- Browser interaction checks passed for mobile filter drawer open/Escape close, desktop sort change to `price-ascending`, and quick add opening the cart drawer with cart bubble update.
- `templates/collection.json` parsed successfully with Node.
- `shopify theme check` inspected 191 files and reported 10 pre-existing warnings across 9 files, then exited with a Shopify CLI Windows assertion; no reported warning targeted the collection template, campaign section, or collection override changes from this pass.

### Remaining Gaps

- Local product images, product count, prices, review counts, sale states, and pagination cannot visually match the reference until matching Shopify catalog data/metafields are available.
- Reference internals use different collection DOM selectors, so automated numeric extraction is partial for reference product-grid details; final assessment used saved screenshots plus direct rendered local DOM metrics.

## 2026-07-04 Final Continuation Pass

### Direct Observations

- Local preview was rechecked at 1440px, 1024px, 768px, and 390px.
- Chrome extension browser control could render the local preview, but closed the HTTPS connection for the reference URL. The public reference HTML was still reachable through a normal fetch path, and existing saved reference screenshots were used for visual comparison.
- Local quick-add buttons rendered as blank white squares because the collection card relied on a CSS pseudo-element data-URL glyph that did not visibly paint in the browser.
- The reference promo tile image near "July 4th Flash Sale" matched the public asset `Ersa_Essence_5_Cat_Eye_New.jpg`.

### Implementation Decisions

- Preserved Shopify-native collection products, filters, sorting, pagination, product links, quick-add product forms, and cart drawer behavior.
- Added a collection-specific inline cart SVG inside `card-product` quick-add controls instead of depending on a CSS-only pseudo icon.
- Stored the authorized public promo tile image locally as `assets/collection-flash-sale-reference.jpg` and configured the collection promo tile fallback to use it.
- Polished the desktop sort trigger so the visible label reads "Sort by" like the reference while retaining the native transparent select control for sorting.

### Verification

- Final screenshots and metrics saved under `.codex-temp/collection-current-20260704/local-{1440,1024,768,390}-final.*`.
- Confirmed the promo tile image loaded with natural dimensions `900x1349` at all checked viewports.
- Confirmed the collection quick-add icon displayed with a visible `21px` glyph at 1440px, 1024px, 768px, and 390px.
- Browser interaction checks passed:
  - mobile filter drawer opened and closed with Escape;
  - desktop sort changed to `price-ascending` and updated the URL query;
  - mobile quick-add opened the native cart drawer and updated the cart bubble.

### Remaining Gaps

- Local collection data still differs from the reference store: product titles, product imagery, review counts, sale badges, filter taxonomy, product count, and pagination depend on Shopify catalog/metafield data.
- Header utility controls differ from the reference desktop header because the local theme currently omits visible currency/language selectors on this page.
