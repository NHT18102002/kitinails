# Ersa Nails Performance And Accessibility Audit

This was a non-invasive public audit. Lighthouse CLI was not available in the workspace, and the browser runtime did not expose resource timing entries for this page, so performance findings rely on public HTML, rendered DOM, headers, asset URLs and visible behavior.

## Performance Evidence

| Area | Observation | Evidence | Confidence | Opportunity for original store |
| --- | --- | --- | --- | --- |
| CDN/edge | Cloudflare and Shopify CDN are used; Shopify image/font/theme assets are served from CDN paths | HEAD https://ersanails.com/ and source | High | Use Shopify CDN defaults and avoid custom asset hosting unless needed. |
| HTML response | HEAD request showed Shopify/Cloudflare headers and dynamic cache status | HEAD https://ersanails.com/ | High | Keep theme server work lean; minimize app blocks. |
| Script volume | Static homepage source had about 85 script tags; rendered homepage counted 127 script tags | Homepage source/rendered DOM | Medium | Reduce app stack and defer non-critical scripts for MVP. |
| Stylesheet volume | Static source showed several theme/app CSS files; rendered DOM counted 21 stylesheet links | Homepage source/rendered DOM | Medium | Consolidate theme CSS and load app CSS only where needed. |
| Image volume | Rendered homepage counted 165 images | Homepage rendered DOM | Medium | Limit above-the-fold media, lazy-load non-critical sections, use fewer carousel assets. |
| Image loading | Rendered homepage counted many lazy images and many eager images; collection product cards used a mix of eager/lazy | Homepage/collection rendered DOM | Medium | Eager-load only true LCP/critical imagery; lazy-load below-the-fold grid/carousel images. |
| Responsive images | Shopify image URLs include width/height transformations; product/collection images request width variants | Homepage/collection/PDP | High | Use `image_url` widths and `srcset/sizes` consistently. |
| Image formats | WebP and JPG assets observed | Homepage/collection/PDP asset URLs | High | Prefer WebP/AVIF when available; avoid oversized JPG gallery images. |
| Font loading | Nunito and Playfair WOFF2 fonts are preloaded from Shopify CDN | Homepage source/rendered DOM | High | Keep to 1-2 font families and use `font-display` strategy. |
| Preloads | Homepage preloads fonts, loading SVG and multiple large hero/section images | Homepage rendered DOM | Medium | Preload only the likely LCP image and critical fonts. |
| Third-party scripts | Klaviyo, Judge.me, Smile, AVADA, PushOwl, Tolstoy, Instafeed, GetSiteControl, Delivery Coder, Clarity and Shopify analytics signals observed | Homepage source | High | For MVP, install only analytics, email and reviews; defer loyalty/push/UGC/countdown until needed. |
| Layout-shift risk | Carousels, tickers, app widgets, review widgets and social embeds can shift layout if dimensions are not reserved | Rendered DOM/source | Medium | Reserve heights/aspect ratios for app blocks and media. |
| Mobile performance risk | Mobile homepage still exposes heavy carousel/ticker/product/UGC structures | Mobile viewport DOM | Medium | Build mobile-first with fewer above-fold modules and tight image budgets. |

## Largest Visible Media And Asset Notes

- Homepage uses large campaign/collection imagery from Shopify CDN, including 2048-width and 1702/1800-width transformed assets in preload/source references.
- PDP gallery links to multiple 2048-size images and at least one video thumbnail-like asset.
- Collection cards use smaller transformed product images, often around 180-360 width requests in the observed grid.
- Some image alt values are descriptive, but many decorative/logo images are empty. Empty alt is acceptable for decoration, but meaningful product/story imagery should be user-readable.

## Accessibility Evidence

| Area | Observation | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Skip link | `Skip to content` link exists | Global rendered DOM | Low | Keep and test visible focus state. |
| Heading hierarchy | Empty `h1` observed on homepage, collection and search; product page has meaningful product `h1` | Rendered DOM | Medium | Ensure each template has one meaningful `h1`. |
| Keyboard navigation | Header buttons, menu, search, filters, size radios and cart controls are represented as buttons/links/radios | Rendered DOM | Medium | Run keyboard-only pass for focus order, escape behavior and traps. |
| Focus visibility | Not conclusively evaluated visually | Browser DOM only | Unknown | Verify focus rings on header, filters, modals, product cards and cart drawer. |
| Mobile menu | Hamburger opens overlay with close button and expanded state | 390px viewport browser test | Medium | Confirm focus moves into drawer, background is inert, Escape closes. |
| Search modal/popdown | Search areas have role `dialog` and aria labels in DOM | Product/homepage modal scan | Medium | Confirm only one active dialog is exposed and focus is trapped. |
| Cart drawer | Drawer exposes heading, close link, line item, remove link, order notes button, checkout button and progressbar | After add-to-cart | Medium | Use `role=dialog`, `aria-modal`, focus trap, Escape close, and clear live region for cart update. |
| Product variant selector | Size options are radios with checked state | Product page | Low | Keep radio semantics and visible selected state. |
| Size chart | Size Chart is a button and can expand/open content, but modal/dialog semantics were not clearly confirmed | Product page | Medium | Implement a real accessible dialog or clearly expanded inline panel. |
| Accordions | PDP has accordion buttons for description, tools, how-to, ingredients, shipping and returns | Product page | Medium | Ensure `aria-expanded`, associated panel IDs and keyboard behavior. |
| Forms | Search input has aria label; newsletter email input has placeholder and aria label | Homepage/search | Low to medium | Add visible labels where possible and clear validation/error messaging. |
| Buttons/links | Some icon-only controls have generic labels; many repeated `Open image lightbox` links in gallery | PDP/homepage | Medium | Add unique accessible names for gallery items and icon controls. |
| Images | Rendered homepage counted 68 images without alt; many may be decorative, but product/story imagery needs review | Homepage rendered DOM | Medium | Audit alt text by image role. |
| Color contrast | Not measured with tooling | Visual inspection not captured | Unknown | Run automated and manual contrast checks for sale badges, overlays and CTA text. |
| Country selector | Many country/currency options appear in DOM/footer/header | Homepage/footer | Medium | Ensure select/listbox pattern is accessible and not exposed redundantly. |
| Carousel/ticker content | Repeated promotional/trust text appears many times in DOM | Homepage/mobile DOM | Medium | Prevent duplicated slides/tickers from being over-announced. |

## Page-Specific Performance And Accessibility Notes

### Homepage

- Strengths: CDN assets, lazy loading exists, clear navigation/search/cart entry points, trust and social proof visible.
- Risks: high script/app/image count, many carousels/tickers, repeated DOM text, empty `h1`, numerous third-party widgets.
- Original-store recommendation: start with a simpler homepage: one hero, one trust row, one featured collection, one shape/length module, one reviews/social-proof section and one newsletter/footer block.

### Collection Pages

- Strengths: product count, filters, sort, product cards, quick buy and sale/review signals.
- Risks: empty `h1`, heavy campaign content before product grid, app scripts loaded globally, filter controls need keyboard testing.
- Original-store recommendation: reserve collection title/content, keep filters in accessible drawer/sidebar, and lazy-load product images below first row.

### Product Pages

- Strengths: semantic radios for size, strong buy-box information, reviews, cross-sells, accordions and recommendations.
- Risks: many gallery media items, repeated image labels, uncertain size-chart dialog semantics, app/widget load.
- Original-store recommendation: constrain gallery media count, use optimized media variants, make size guide accessible, and keep cross-sells highly relevant.

### Cart Drawer

- Strengths: immediate feedback after add-to-cart, line item detail, free-shipping progress and clear checkout CTA.
- Risks: checkout CTA is prominent, so error/focus states must be robust; progressbar needs accessible label/value.
- Original-store recommendation: implement cart drawer with focus trap, live cart update, accessible progress text and no forced checkout step.

## Validation Limitations

- Lighthouse was not installed globally and was not run.
- Browser resource timing returned zero entries in this runtime, so no transfer-size waterfall is reported.
- No automated axe/WCAG scanner was run.
- Checkout, login, payment, account and private endpoints were not tested.
- No screenshots or visual assets were saved or embedded.
