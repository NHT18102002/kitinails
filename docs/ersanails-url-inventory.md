# Ersa Nails Public URL Inventory

Inspected on 2026-06-22 Asia/Bangkok using public storefront pages, rendered DOM, response headers, `robots.txt`, `sitemap.xml`, and representative customer-facing flows. This inventory is for research only. It does not include private account pages, checkout, admin routes, cart API endpoints, or blocked crawler surfaces.

## Evidence Basis

| Source | What it was used for | Observation | Confidence |
| --- | --- | --- | --- |
| https://ersanails.com/ | Homepage, navigation, footer, newsletter, product-card, cart-entry and localization evidence | Directly observed in rendered DOM and public HTML | High |
| https://ersanails.com/robots.txt | Crawl boundaries and sitemap location | Storefront is broadly allowed; checkout, account, cart JS, recommendations endpoints and internal services are disallowed | High |
| https://ersanails.com/sitemap.xml | Public sitemap index | Links to product, page, collection, blog and agentic discovery sitemaps | High |
| https://ersanails.com/sitemap_products_1.xml?from=8813176193303&to=10373468455191 | Product URL scale and samples | 587 URL entries observed; first entry is homepage followed by product URLs | High |
| https://ersanails.com/sitemap_collections_1.xml?from=461698859287&to=526368571671 | Collection URL scale and samples | 162 collection URL entries observed | High |
| https://ersanails.com/sitemap_pages_1.xml?from=135721353495&to=173456490775 | Public page URL scale and samples | 29 page URL entries observed | High |
| https://ersanails.com/sitemap_blogs_1.xml | Blog URL scale and samples | 90 blog URL entries observed | High |

## Sitemap Scale

| Sitemap type | Count observed | Notes |
| --- | ---: | --- |
| Products | 587 | Includes public product URLs and one homepage entry in the product sitemap output. |
| Collections | 162 | Includes broad catalog, shape, length, seasonal, style and campaign collections. |
| Pages | 29 | Includes help, policies, brand, rewards, custom service, campaigns and affiliate pages. |
| Blogs | 90 | Includes blog index and article URLs. |

## Primary Navigation And Menu Hierarchy

| Page name | URL | Page type | Main purpose | Important user actions | Conversion elements | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Homepage | https://ersanails.com/ | Landing page | Introduce brand, campaigns, product categories, best sellers and trust signals | Shop campaign, shop all, open search, open cart, navigate by collection/shape/length | Announcement discounts, free-shipping threshold, product cards, reviews, press/trust claims, newsletter | Directly observed. Header is sticky-style with hamburger/search/cart on small viewport. |
| Shop all | https://ersanails.com/collections/all | Collection | Browse full catalog | Sort, filter, open product, quick buy | Product cards, discounts, review stars, quick buy, product count | Directly observed. Rendered count showed 565 products during inspection. |
| Best sellers | https://ersanails.com/collections/best-seller | Collection | Prioritize proven high-converting products | Browse, quick buy, open PDP | Best-seller positioning, review counts, sale prices | Directly observed through nav and page metadata. |
| New arrivals | https://ersanails.com/collections/new-arrival | Collection | Surface new products | Browse, quick buy, open PDP | Newness labels, product grid | Directly observed in nav and sitemap. |
| Sale | https://ersanails.com/collections/summer-glow-sale | Collection/campaign | Shop discounted items | Browse discounted products | Sale labels, discount messaging | Directly observed in nav. Related `https://ersanails.com/collections/sales` also appears. |
| Collections index | https://ersanails.com/collections | Collection index | Browse thematic collections | Select collection | Collection tiles and campaign organization | Directly observed in nav; sitemap has many child collections. |
| Summer campaign | https://ersanails.com/collections/island-glow-club | Campaign collection | Seasonal discovery | Shop campaign products | Announcement bar, seasonal collection positioning | Directly observed in nav. Homepage also links to `https://ersanails.com/collections/hot-girl-summer`. |
| Floral beauty | https://ersanails.com/collections/bloom-for-yourself | Campaign collection | Browse floral styles | Shop floral products | Campaign imagery and category CTAs | Directly observed in homepage/nav. |
| Music festival | https://ersanails.com/collections/music-festival | Campaign collection | Occasion-based shopping | Browse products | Thematic merchandising | Directly observed in nav. |
| Ersa Essence | https://ersanails.com/collections/ersa-essence | Collection | Browse a branded design line | Browse products | Collection positioning and product cards | Directly observed in nav. |
| Classy nails | https://ersanails.com/collections/classy-nails | Collection | Browse polished/classic styles | Browse products | Product grid | Directly observed in nav. |
| LNY 2026 | https://ersanails.com/collections/lny-2026 | Campaign collection | Lunar New Year campaign | Browse products | Seasonal campaign merchandising | Directly observed in nav and sitemap. |
| Love edit | https://ersanails.com/collections/valentine | Campaign collection | Romantic/holiday shopping | Browse products | Occasion positioning | Directly observed in nav. |
| Catholic | https://ersanails.com/collections/golden-glamour | Collection | Religious or themed styles | Browse products | Thematic merchandising | Directly observed in nav label and URL. |
| Press-on toenails | https://ersanails.com/collections/press-on-toenails | Collection | Browse toenail products | Browse products | Category expansion beyond fingernails | Directly observed in nav. |
| Shape index | https://ersanails.com/collections/shape | Collection index | Browse by nail shape | Select shape | Product taxonomy | Directly observed in nav and sitemap. |
| Almond | https://ersanails.com/collections/almond | Shape collection | Browse almond styles | Filter/sort/open product | Shape-based decision support | Directly observed in nav and page metadata. |
| Coffin | https://ersanails.com/collections/coffin | Shape collection | Browse coffin styles | Filter/sort/open product | Shape taxonomy | Directly observed in nav. |
| Oval | https://ersanails.com/collections/oval | Shape collection | Browse oval styles | Filter/sort/open product | Shape taxonomy | Directly observed in nav. |
| Squoval | https://ersanails.com/collections/squoval | Shape collection | Browse squoval styles | Filter/sort/open product | Shape taxonomy | Directly observed in nav. |
| Square | https://ersanails.com/collections/square | Shape collection | Browse square styles | Filter/sort/open product | Shape taxonomy | Directly observed in nav. |
| Length index | https://ersanails.com/collections/length | Collection index | Browse by length | Select length | Length taxonomy | Directly observed in nav and sitemap. |
| Long | https://ersanails.com/collections/long | Length collection | Browse long styles | Filter/sort/open product | Length taxonomy | Directly observed in nav and page metadata. |
| Medium | https://ersanails.com/collections/medium | Length collection | Browse medium styles | Filter/sort/open product | Length taxonomy | Directly observed in nav. |
| Short | https://ersanails.com/collections/short | Length collection | Browse short styles | Filter/sort/open product | Length taxonomy | Directly observed in nav. |
| Tools and accessories | https://ersanails.com/collections/tools-accessories | Collection | Sell prep, glue and accessory products | Browse/open product/quick buy | Cross-sell alignment with nail sets | Directly observed in nav, homepage and footer. |
| Bundles | https://ersanails.com/collections/bundle | Collection | Sell bundles and higher AOV offers | Browse/open bundle products | Save-up-to messaging, multi-item logic | Directly observed in nav and homepage. |

## Representative Product URLs

The product sitemap is too large for manual page-by-page prose, so these examples represent the public product URL pattern and observed PDP functionality.

| Page name | URL | Page type | Main purpose | Important user actions | Conversion elements | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Seafoam | https://ersanails.com/products/seafoam | Product detail | Sell a press-on nail set | Review gallery, choose size, open size chart, add to cart, review cross-sells | Sale price, star rating, review count, trust bullets, size radios, add-to-cart, free-shipping/secure-payment badges, tool-kit cross-sells, accordions, recommendations | Directly inspected in rendered DOM. Used as primary PDP sample. |
| ProTouch Kit Max | https://ersanails.com/products/protouch-kit-max | Product detail | Sell accessory kit | Quick buy/open PDP | Accessory cross-sell | Directly observed as PDP cross-sell from Seafoam. |
| Magic Glue Kit | https://ersanails.com/products/magic-glue-kit | Product detail | Sell adhesive accessory | Quick buy/open PDP | Accessory cross-sell | Directly observed as PDP cross-sell from Seafoam. |
| Metallic Mirage | https://ersanails.com/products/metallic-mirage | Product detail | Sell nail product | Open PDP/add to cart | Product card and PDP conversion | Observed in product sitemap sample. |
| Gothic Radiance | https://ersanails.com/products/gothic-radiance | Product detail | Sell nail product | Open PDP/add to cart | Product card and PDP conversion | Observed in product sitemap sample. |
| Gift card | https://ersanails.com/products/ersa-nails-gift-card | Product detail | Sell gift card | Select gift card options | Gift purchase use case | Observed in product sitemap sample. |
| Customization request | https://ersanails.com/products/customization-request | Product/service detail | Support custom requests | Open customization product/service | Customization monetization | Observed in product sitemap and PDP custom-shape callout. |

## Public Help, Policy, Brand, And Content Pages

| Page name | URL | Page type | Main purpose | Important user actions | Conversion elements | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Contact | https://ersanails.com/pages/contact | Support page | Contact/support entry | Read contact info or use available contact surface | Trust/support | Sitemap entry. Forms were not submitted. |
| Shipping policy | https://ersanails.com/pages/shipping-policy | Policy page | Explain shipping | Read policy before purchase | Reduces shipping uncertainty | Directly fetched. |
| Return and exchange policy | https://ersanails.com/pages/return-exchange-policy | Policy page | Explain returns/exchanges | Read before purchase | Trust and risk reduction | Directly fetched. |
| Nail shape and size guide | https://ersanails.com/pages/nail-shape-size-guide | Guide page | Help customers choose size/shape | Read guide | Reduces fit friction | Directly fetched. |
| FAQ | https://ersanails.com/pages/faq | Help center | Answer common questions | Expand/read FAQ topics | Objection handling | Directly fetched. |
| How-to guide | https://ersanails.com/pages/how-to-guide | Guide page | Explain application/removal | Read instructions | Confidence after purchase and before purchase | Directly fetched. |
| Privacy policy | https://ersanails.com/pages/privacy-policy | Policy page | Privacy disclosure | Read policy | Compliance/trust | Sitemap entry. |
| Terms of service | https://ersanails.com/pages/terms-of-service | Policy page | Terms disclosure | Read terms | Compliance/trust | Sitemap entry. |
| About us | https://ersanails.com/pages/about-us | Brand page | Explain brand story and value proposition | Learn about brand | Trust and premium positioning | Directly fetched. |
| Shapes and lengths | https://ersanails.com/pages/shapes-and-lengths | Guide page | Explain product taxonomy | Learn shape/length choices | Decision support | Sitemap entry. |
| How to find your size | https://ersanails.com/pages/how-to-find-your-size | Guide page | Sizing support | Read size instructions | Reduces returns and hesitation | Footer links to this as size guide. |
| Ersa rewards | https://ersanails.com/pages/ersa-rewards | Loyalty page | Explain rewards program | Learn about loyalty | Retention | Directly fetched. |
| Customer survey completion | https://ersanails.com/pages/customer-survey-completion-page | Utility page | Survey completion landing | None for normal browsing | Retention/research support | Sitemap entry. |
| Customization service | https://ersanails.com/pages/customization-service | Service page | Explain custom nail sets | Learn custom service | Premium personalization | Directly fetched. |
| Campaign pages | `https://ersanails.com/pages/sale`, `.../cyber-week-sale`, `.../black-friday-specials`, `.../heirloom-reverie-2026`, `.../summer-collection`, etc. | Campaign/content pages | Seasonal promotions | Shop/read campaign | Campaign conversion | Observed in page sitemap. |
| Worry-free delivery service | https://ersanails.com/pages/worry-free-protection-service | Service page | Explain delivery protection | Learn protection offer | Risk reduction and possible add-on | Footer and sitemap entry. |
| Affiliate program | https://ersanails.com/pages/affiliate-program | Partnership page | Recruit affiliates | Read program | Acquisition channel | Directly fetched. |
| Tutorials | https://ersanails.com/pages/tutorials | Guide/content page | Educate customers | Watch/read tutorials | Product confidence | Sitemap entry. |
| EU withdrawal form | https://ersanails.com/pages/eu-withdrawal-form | Compliance page | EU withdrawal support | Read/use form | Legal compliance | Sitemap entry. |
| Blog index | https://ersanails.com/blogs/blogs | Blog index | Education and SEO content | Read articles | Topical SEO and product education | Directly fetched. |

## Search, Cart, Account, Newsletter, Social

| Surface | URL or entry point | Page type | Main purpose | Important user actions | Conversion elements | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Search | https://ersanails.com/search?q=almond | Search results | Find products/articles/pages | Enter query, sort/filter, open product, quick buy | Result count, product cards, quick buy | Directly observed. Search form submits to `/search` with `q`, `type`, and prefix options. |
| Cart drawer | Header cart icon, cart drawer overlay | Cart preview | Review cart without leaving PDP | Change/inspect item, remove, add notes, proceed to checkout | Free-shipping progress, checkout total, order notes | Directly observed after adding one default product to cart through UI. Checkout was not clicked. |
| Cart page | https://ersanails.com/cart | Cart page | Full cart review | Review items, checkout | Cart total and checkout CTA | URL is public, but `/cart/` and cart JS surfaces are disallowed in robots. Analysis prioritized drawer and did not use cart JS endpoints. |
| Account login | Header/customer hub links and https://ersanails.com/account/login | Account entry | Let customers access account | Log in/create account | Retention and order history | Public login entry is allowed in robots; login was not attempted. Header links were rewritten to a customer hub hash in rendered DOM. |
| Newsletter top link | External Klaviyo subscription URL from top bar | Email signup | Join list for discount | Click external signup | New-subscriber discount | Directly observed. No email submitted. |
| Newsletter footer form | `/contact#NewsletterForm...` | Email signup form | Capture email marketing consent | Enter email/subscribe | Retention and discount messaging | Directly observed. No email submitted. |
| Instagram/Pinterest/TikTok/YouTube | Footer social links | Social channels | Social proof and content discovery | Visit social profile | Brand trust and UGC loop | Directly observed as links/scripts in public HTML. |

## Key Inventory Notes

- Directly observed public storefront scope is broad enough to rebuild comparable commercial logic without copying creative assets.
- URL taxonomy is Shopify-standard: `/collections/{handle}`, `/products/{handle}`, `/pages/{handle}`, `/blogs/blogs/{article-handle}`, `/search?q=...`.
- Navigation prioritizes merchandising by campaign, collection, shape, length, accessories and bundles.
- Help and policy pages cover purchase objections: sizing, shipping, returns, how-to, rewards, customization and delivery protection.
- Complete product/blog URL enumeration exists in sitemaps, but this report intentionally uses representative products/articles to avoid unnecessary scraping and copying.
