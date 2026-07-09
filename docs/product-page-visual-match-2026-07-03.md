# Product Page Visual Match - 2026-07-03

## Public reference inspected

- Reference URL: `https://ersanails.com/products/seafoam`
- Local preview URL: `http://127.0.0.1:9292/products/safari`
- Viewports checked directly in browser: 1440px desktop and 390px mobile.

## Direct observations

- The reference product page uses a two-column desktop layout with a large left media gallery, horizontal thumbnails, and a narrow right product information column.
- Mobile stacks media first, then a horizontal thumbnail strip without visible arrow controls, then product information.
- The size selector is paired with a right-aligned `SIZE CHART` modal trigger.
- Quantity is presented as a compact select-style dropdown, not a plus/minus stepper.
- The add-to-cart button is black, rounded, and full width on mobile.
- The post-CTA stack is: Worry-Free Delivery note, two light trust rows, a single upsell card carousel, custom shape CTA, then product accordions with plus/minus indicators.

## Inferences

- Reference review count, sale price, sale badge, and exact upsell product are product/app data driven. The local `Safari` product currently lacks the same review/sale data, and the local store does not expose the reference `ProTouch Kit Max` or `Magic Glue Kit` product handles.
- The theme should therefore preserve Shopify-native product, recommendation, and metafield rendering rather than hard-code Seafoam-specific product data.

## Implementation decisions

- Kept product data dynamic and Shopify-native.
- Changed the size guide label through locale text to match `SIZE CHART`.
- Replaced the product page quantity stepper with a `select name="quantity"` tied to the existing Shopify product form.
- Kept quantity rule basics by deriving min, max, and increment from the selected variant.
- Fixed the size guide close button id to match Dawn modal behavior.
- Added final Product Page CSS overrides in `assets/custom-theme-overrides.css`, which loads after the main custom theme CSS.
- Styled mobile gallery, thumbnails, CTA stack, Seel note, trust rows, upsell card, custom CTA, and accordion indicators against the reference layout.

## Validation

- Browser visual QA at 1440px and 390px.
- Size Chart modal open and close tested.
- Variant size selection tested with `M`.
- Quantity dropdown tested with value `2`.
- Add to cart tested; cart drawer opened and showed `Safari` size `M`, quantity `2`.
- Local test cart was cleared after interaction testing.
- `powershell -ExecutionPolicy Bypass -File .codex-temp/product-page-reference-check.ps1` passed.
- `git diff --check` passed for touched files.
- `shopify theme check` and `shopify theme check --fail-level error` both reported 10 existing warning-level offenses and then a Shopify CLI Windows assertion. No error-level Liquid issue was reported in the output.

## Known limitations

- Local Safari product data does not match Seafoam reference data for review count, sale price, sale badge, and exact upsell product.
- Local fallback upsell uses available local products because the exact reference tool-kit product handles are missing from the connected store.

## Follow-up: Island Glow product section

### Public/reference material inspected

- Local preview URL: `http://127.0.0.1:9292/products/safari`
- User-provided reference screenshots for the product-page Island Glow campaign area.
- Related public reference URL checked: `https://ersanails.com/products/seafoam`; the live Seafoam PDP did not include this exact Island Glow campaign block at the time of inspection, so the supplied screenshots were treated as the visual target for this section.

### Direct observations

- Local PDP rendered a visible `Share` block at the bottom of the main product section, followed by a blank gap before the Island Glow campaign section.
- Local Island Glow used a single large image with a white overlay panel.
- The target screenshot uses two overlapping campaign images on the left and centered text on the right.
- The target heading is pink, the CTA reads `DISCOVER THE COLLECTION`, and the content does not sit inside an overlay card.

### Implementation decision

- Removed the product `share` block from the active product template block order to eliminate the blank share/gap before the campaign section.
- Updated `ersa-product-island-glow` to support a primary and secondary campaign image while preserving image picker settings and theme asset filename fallbacks.
- Used local authorized campaign assets: `Summer2026_ErsaNails_PressOnNails_19.webp` and `Summer2026_ErsaNails_PressOnNails_15.webp`.
- Updated product template copy and CTA to match the supplied Island Glow visual target.
- Added PDP-scoped CSS overrides for the two-image collage, pink heading, centered copy, black CTA, and responsive stacking below 1200px.

### Validation

- Browser QA checked at 1848px, 1024px, 768px, and 390px.
- Verified the section renders two campaign images, no visible main-product share block, no horizontal overflow, pink heading, and `DISCOVER THE COLLECTION` CTA.

## Follow-up: product benefits section replacing blank area

### Public/reference material inspected

- Reference URL: `https://ersanails.com/products/seafoam`
- Local preview URL: `http://127.0.0.1:9292/products/safari`
- Viewports checked with browser automation: 1440px, 1024px, 768px, and 390px.

### Direct observations

- The live reference PDP renders a post-main benefits area before related products.
- The reference benefits heading reads `4 Reasons Why Millions are Switching to Handmade Press-ons`.
- The benefits cards use four public campaign images with square media, Playfair-style headings, small body copy, and a 4-column desktop layout.
- At 768px, the reference behaves like a horizontal carousel with two cards visible and the next card peeking in.
- At 390px, the reference renders the benefits cards as a compact 2-column grid.

### Implementation decision

- Added a configurable `ersa-product-benefits` section to the product template after the main product section.
- Disabled the old product-page Island Glow campaign section in `templates/product.json` for this product template position, preserving the section config in case it is reused elsewhere.
- Reused authorized public reference assets locally as theme assets:
  - `product-benefit-stays-on-v2.jpg`
  - `product-benefit-turn-heads-v2.webp`
  - `product-benefit-wears-again-v2.jpg`
  - `product-benefit-zero-effort-v2.jpg`
- Kept section content configurable through section settings and blocks rather than hard-coding product data in Liquid.
- Added Product Page CSS overrides for reference-aligned spacing, square media, heading typography, 768px horizontal swipe behavior, and mobile 2-column layout.

### Validation

- Local preview returned 200 and rendered `.ersa-product-benefits`.
- Visual metrics after the fix:
  - 1440px: local benefit images `315x315`, matching reference image size and within 1px of reference vertical placement.
  - 1024px: local benefit images `211x211`, matching reference image size.
  - 768px: local benefit images `318x318`, matching reference image size and carousel-like horizontal layout.
  - 390px: local benefit images `167x167`, matching the reference 2-column pattern closely.
- Verified no horizontal overflow at 1440px, 1024px, 768px, or 390px.
- Verified `Island Glow Club` text is no longer visible in the product-page position where the reference benefits section appears.
- Product interaction smoke test passed: accordion opens, complementary quick-buy is visible, add-to-cart opens the cart drawer, and cart was cleared after testing.

## Follow-up: Ersa Babes in Action UGC video carousel

### Public/reference material inspected

- Reference URL: `https://ersanails.com/products/seafoam`
- Local preview URL: `http://127.0.0.1:9292/products/safari`
- Viewports checked with browser automation: desktop 1440px/1536px Chrome viewport and 390px mobile emulation.

### Direct observations

- The reference PDP renders `Ersa Babes in Action` after the reviews area and before FAQs.
- The reference block uses a Tolstoy-style horizontal 9:16 video carousel with rounded corners, centered play rings, and previous/next arrows on desktop.
- Local PDP previously jumped from reviews directly to FAQs/social content, leaving the expected UGC video area missing.

### Implementation decision

- Added a configurable `ersa-product-ugc-videos` section and inserted it after `product_reviews` in `templates/product.json`.
- Stored six authorized public poster frames locally as theme assets: `product-ugc-video-01.jpg` through `product-ugc-video-06.jpg`.
- Used public Shopify CDN MP4 sources in configurable block settings so the visible behavior matches the reference autoplaying muted carousel, with local posters as fallback.
- Added reduced-motion handling so videos pause when `prefers-reduced-motion: reduce` is active.

### Validation

- Local preview rendered `.ersa-product-ugc-videos` with heading `Ersa Babes in Action`, six 9:16 cards, desktop arrows, and no horizontal page overflow.
- Desktop carousel next arrow scrolled the track from `0` to `240px`.
- Mobile 390px emulation rendered 234px-wide horizontal video cards, no blank poster area, and no horizontal page overflow.
- `templates/product.json` parsed successfully.
- Targeted `git diff --check` passed for touched product files; Git reported only the existing LF-to-CRLF warning on `templates/product.json`.
- `shopify theme check --fail-level error` reported 10 existing warning-level offenses and then the known Shopify CLI Windows assertion; no new error-level issue was reported for the new section.

## Follow-up: product social gallery blank/spacing cleanup

### Public/reference material inspected

- Reference URL: `https://ersanails.com/products/seafoam`
- Local preview URL: `http://127.0.0.1:9292/products/safari`
- Viewports checked with browser automation: 1440px, 1024px, 768px, and 390px.

### Direct observations

- On mobile, the reference PDP social gallery renders five square look cards, small carousel dots below the cards, and then transitions into the footer without a large empty-feeling white area.
- Local PDP had only four configured social items, no real dot row, smaller mobile cards, and an oversized blank-feeling gap after `SHOP THE LOOK`.
- The mobile benefits heading underline was also missing after previous overrides, making the benefits section less faithful to the reference.

### Implementation decision

- Added a real dot row to the reusable `ersa-social-gallery` section.
- Kept social images lazy on non-product pages, but loads the product-page social gallery eagerly so horizontal carousel cards do not appear blank when swiped.
- Replaced the product template social gallery blocks with five authorized public reference images stored locally in `assets/`.
- Added PDP-scoped final CSS overrides for square 330px mobile social cards, compact spacing, hidden legacy pseudo dots, and restored benefits heading underline placement.

### Validation

- Browser QA confirmed all five social gallery images load at 390px, 768px, 1024px, and 1440px.
- Verified 390px mobile social card size is `330x330`, five dots render, and no horizontal overflow exists.
- Verified the benefits underline is visible below `Handmade` on mobile.
