# Ersa Nails UX And Conversion-Flow Analysis

This analysis is based on public, customer-facing pages only. One product was added to the cart through the normal product page UI to observe cart drawer behavior; checkout was not opened.

## Important Page Patterns

| Page or surface | Main user goal | Primary conversion action | Secondary actions | Hierarchy and modules | Friction points | Trust/urgency/cross-sell/retention | Accessibility notes | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage | Understand brand and start shopping | Click a campaign/category/product CTA | Open search, cart, mobile menu, newsletter, social | Announcement/ticker, hero carousel, trust strip, best sellers, seasonal collections, shape browsing, press/social proof, tools, UGC/social, newsletter, footer | Very high promotional density; repeated ticker/trust text can become noisy on mobile | Discount tiers, free shipping, review claims, customer-count claim, press mention, newsletter discount, UGC/social | Empty `h1` observed in rendered DOM; duplicated text from carousels/tickers may be verbose for assistive tech | https://ersanails.com/ |
| Main navigation | Choose shopping path | Select collection, shape, length, bundle or sale | Search/account/cart | Desktop nav plus mobile overlay; hierarchy by shop all, collections, shape, length, tools, bundles | Some nav labels differ from URL handles; "See More" requires interaction on mobile | Strong merchandising segmentation | Mobile menu has open/close controls and expanded state, but nested menu accessibility should be tested further | https://ersanails.com/ |
| Collection page | Browse and narrow catalog | Open PDP or quick buy | Sort/filter by color, length, shape, style | Campaign hero, breadcrumb, product count, sort, filter buttons, product grid, quick buy | Collection hero/marketing content can push products down; filters use button panels and path-like tag URLs | Sale badges, review stars, quick buy, free-shipping/trust strips | Empty `h1` observed on collection; filter controls need keyboard/focus testing | https://ersanails.com/collections/all |
| Shape/length collections | Browse by fit preference | Open product | Filter/sort within category | Same collection template with taxonomy-specific URL | Generic meta descriptions observed on some taxonomy pages | Helps shoppers make a known-preference choice quickly | Heading and metadata quality should be improved for taxonomy pages | https://ersanails.com/collections/almond, https://ersanails.com/collections/long |
| Search results | Find specific product or theme | Open product/quick buy | Sort/filter | Search form, result count, product grid | Search result counts changed between requests, likely due state/index/localization; exact behavior should be validated during build | Captures high-intent traffic | Search input has aria label; empty `h1` plus visible `h2` result heading observed | https://ersanails.com/search?q=almond |
| Product detail page | Decide and add item to cart | Select size and add to cart | View gallery, open size chart, read accordions, browse cross-sells/recommendations | Large gallery, rating, price/sale, trust bullets, size radios, quantity, add-to-cart, badges, accessory cross-sells, custom request CTA, accordions, benefits, related/recent | Many modules compete below the buy box; size chart behavior needs clearer modal semantics | Reviews, discount, trust bullets, shipping/payment badges, accessory cross-sells, recommendations | Size radios are accessible as radios; gallery has many repeated image links; modal semantics for size chart were not clearly confirmed | https://ersanails.com/products/seafoam |
| Cart drawer | Review cart and continue to checkout | Checkout | Remove item, add order notes | Drawer heading, line item, size, sale price, free-shipping progress, checkout CTA | Checkout button is prominent; no cross-sell in the observed drawer state | Free-shipping progress gives clear AOV incentive | Drawer has heading and expanded cart state; focus trap/escape behavior was not fully tested | Product page after add-to-cart |
| Footer | Find support, policies, social, localization | Open help/policy/social/newsletter | Switch country/currency | Shop links, support links, policy links, localization selector, newsletter, social links | Very long country list can dominate footer DOM | Trust through policy/help availability and social links | Country selector links are numerous `#` anchors; should ensure keyboard and screen-reader handling | https://ersanails.com/ |

## Detailed Customer Flows

### 1. First-Time Visitor Landing On Homepage

- Goal: understand what is sold, whether the store is trustworthy, and where to start.
- Observed path: announcement/ticker communicates current campaign, discount tiers and free-shipping threshold; hero CTAs route to campaign and all-products collections; trust strip claims customer volume, press recognition, hand-made quality, fast application, lasting wear and no-damage positioning.
- Conversion strengths: homepage rapidly communicates category, offer, social proof and collection paths.
- Friction: multiple carousels/tickers repeat copy in the DOM, which can create noise and potential screen-reader fatigue.
- Evidence: https://ersanails.com/ rendered desktop and mobile DOM.

### 2. Browsing By Category

- Goal: browse a campaign, collection or product category.
- Observed path: nav routes to shop all, best sellers, new arrivals, sale, seasonal/thematic collections, tools and bundles.
- Conversion strengths: best-seller, sale, newness and bundle routes map to common buyer intent.
- Friction: some campaign URL handles and labels do not match exactly, which can complicate reporting and merchandising governance.
- Evidence: https://ersanails.com/ and https://ersanails.com/collections/all.

### 3. Browsing By Nail Shape

- Goal: start with known shape preference.
- Observed path: nav routes to shape index and individual shape collections including almond, coffin, oval, squoval and square.
- Conversion strengths: shape taxonomy is prominent in both navigation and homepage modules.
- Friction: some shape pages use generic meta descriptions and collection pages showed an empty `h1` in rendered DOM.
- Evidence: https://ersanails.com/collections/almond and homepage navigation.

### 4. Browsing By Nail Length

- Goal: choose products by desired length.
- Observed path: nav routes to length index and long/medium/short collections; collection filter panel also exposes length values.
- Conversion strengths: length is treated as a first-class taxonomy.
- Friction: length filter uses path/tag-style links rather than obvious query filters in the observed state, which may complicate analytics and SEO if unmanaged.
- Evidence: https://ersanails.com/collections/long and https://ersanails.com/collections/all.

### 5. Searching For A Product

- Goal: search a style, product, shape or term.
- Observed path: header opens search; direct `/search?q=almond` returns product/article/page search scope and product results.
- Conversion strengths: search result page includes product grid and quick-buy entries.
- Friction: search result count varied in separate checks; should be monitored for indexing/state consistency.
- Evidence: https://ersanails.com/search?q=almond.

### 6. Viewing A Product

- Goal: confirm design, fit, quality, price and trust before add-to-cart.
- Observed path: gallery, review rating, price/sale, trust bullets, size selector, size chart trigger, add-to-cart, shipping/payment badges, cross-sells, custom request CTA, accordions, recommendation modules.
- Conversion strengths: strong buy-box density and multiple objection handlers.
- Friction: gallery has many image links and repeated alt text; lower page is long and module-heavy.
- Evidence: https://ersanails.com/products/seafoam.

### 7. Selecting Variants/Size

- Goal: choose correct size.
- Observed path: PDP exposes size radio controls XS/S/M/L with XS selected by default.
- Conversion strengths: radio controls are easy to understand and are represented semantically in DOM.
- Friction: only size was observed for the sampled product; shape/length customization is routed via a separate custom request CTA rather than inline variant choice.
- Evidence: https://ersanails.com/products/seafoam.

### 8. Checking Size Guide

- Goal: avoid fit mistakes.
- Observed path: PDP includes Size Chart button; footer links to a size guide page; page sitemap includes multiple size/shape guide pages.
- Conversion strengths: sizing support is available at PDP and footer level.
- Friction: size chart modal/drawer semantics were not clearly confirmed from accessible DOM during the quick interaction.
- Evidence: https://ersanails.com/products/seafoam and https://ersanails.com/pages/how-to-find-your-size.

### 9. Adding A Product To Cart

- Goal: commit selected item.
- Observed path: default size selection on Seafoam allowed Add to Cart; the drawer opened with one item.
- Conversion strengths: no page navigation was required; drawer gave immediate feedback.
- Friction: Add to Cart disabled after the add action while cart drawer is open, which is expected but should have clear state recovery.
- Evidence: https://ersanails.com/products/seafoam rendered interaction.

### 10. Cart Drawer / Cart Page Behavior

- Goal: review purchase and decide whether to checkout.
- Observed drawer: heading showed one item, product link, selected size, sale price, quantity control, remove link, order note button, free-shipping progress and checkout CTA with total.
- Conversion strengths: free-shipping progress is explicit and ties cart value to threshold.
- Boundary: checkout was not clicked and checkout pages were not inspected.
- Evidence: product page cart drawer after add-to-cart.

### 11. Discount / Shipping Incentive Behavior

- Observed incentives: tiered buy-more discounts, free worldwide shipping threshold, sale-price labels, percentage-off product badges, newsletter signup discount, free-shipping progress in cart.
- UX effect: multiple incentives are visible before PDP, on PDP and in cart, encouraging higher AOV.
- Risk: too many promotional layers can reduce clarity if campaign logic overlaps.
- Evidence: homepage, collection page, product page and cart drawer.

### 12. Product Recommendation Behavior

- Observed recommendations: PDP "buy it with" accessory cross-sells, related/recently viewed product sections and recommendation query parameters.
- UX effect: accessory cross-sells match application needs and can raise AOV.
- Unknown: exact recommendation algorithm and app/native source were not verified.
- Evidence: https://ersanails.com/products/seafoam.

### 13. Newsletter Signup

- Observed entry points: top bar external Klaviyo list signup and footer Shopify contact/newsletter form.
- UX effect: top bar ties signup to a discount; footer supports ongoing capture.
- Boundary: no email address was entered or submitted.
- Evidence: homepage rendered DOM and public HTML.

### 14. Social Proof / Review Behavior

- Observed: product cards and PDP expose star ratings and review counts; homepage has broad trust and customer-count claims; Judge.me assets are present.
- UX effect: social proof appears throughout discovery and PDP decision points.
- Risk: ensure review widgets do not block rendering or harm accessibility.
- Evidence: homepage, collection page, https://ersanails.com/products/seafoam.

### 15. Returning Visitor Journey

- Publicly observable elements: customer/account links, rewards page, newsletter, PushOwl script evidence, recently viewed module, social links and cart persistence cookies.
- UX effect: retention is supported through account/rewards/email/push/recently viewed mechanics.
- Unknown: logged-in account experience, loyalty rules and push permission flows were not tested.
- Evidence: homepage source/rendered DOM, https://ersanails.com/pages/ersa-rewards.

## UX Priorities For An Original Rebuild

- Preserve intent-based navigation by collection, shape, length, best sellers, new and sale.
- Keep PDP buy box focused: gallery, review summary, price, size selector, size guide, add-to-cart and one accessory cross-sell block.
- Use free-shipping progress in cart, but simplify campaign messaging so discounts are easy to understand.
- Build mobile first: prominent hamburger/search/cart, compact hero, fast product grid and accessible filter drawers.
- Improve accessibility with real page `h1`s, reduced duplicate carousel/ticker text, clear dialog semantics, focus trapping and stronger image alt governance.
