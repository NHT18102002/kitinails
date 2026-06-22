# Ersa Nails Technology Stack Evidence

This document records only publicly observable evidence. Each claim is marked as directly observed or inferred and includes a confidence level.

## Platform And Hosting

| Claim | What was observed | Where observed | Evidence type | Confidence | Verified or inferred |
| --- | --- | --- | --- | --- | --- |
| Shopify storefront | Response header `Powered-By: Shopify`; Shopify cookies; Shopify CDN links; `shopify-section` markup; `Shopify.routes`; public `agents.md` states platform | https://ersanails.com/, https://ersanails.com/agents.md | HTTP headers, HTML/source strings, public agent file | High | Verified |
| Shopify Online Store theme | Theme asset paths under `/cdn/shop/t/49/assets/`, section CSS/JS, `shopify-section` occurrences, theme ID in `Server-Timing` | https://ersanails.com/ | Public HTML and response headers | High | Verified as Shopify theme; exact theme name not verified |
| Shopify OS 2.0 style section architecture | Many section-specific assets and `shopify-section` markup | Homepage, collection and product pages | HTML/source structure | Medium | Inferred from Shopify section architecture |
| Cloudflare edge in front of storefront | `Server: cloudflare`, `CF-RAY`, `Cf-Cache-Status`, `Alt-Svc` | HEAD https://ersanails.com/ | Response headers | High | Verified |
| Shopify/GCP serving region visible | `X-Dc: gcp-asia-southeast1...` and `Server-Timing` edge/country fields | HEAD https://ersanails.com/ | Response headers | High | Verified as observed header signals |
| HTTPS enforced and canonical host | `http://ersanails.com`, `https://www.ersanails.com`, and `http://www.ersanails.com` resolved to `https://ersanails.com/` | Head requests to those URLs | Redirect/final URI observation | High | Verified |
| Security headers | CSP blocks mixed content and frames; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; HSTS present | HEAD https://ersanails.com/ | Response headers | High | Verified |
| Consent platform | No dedicated cookie-consent banner was confirmed during inspection | Rendered homepage and source scan | Browser observation/source review | Low | Not verified |
| UCP support | Public `/.well-known/ucp` returned merchant profile and `agents.md` describes UCP | https://ersanails.com/.well-known/ucp and https://ersanails.com/agents.md | Public JSON/text | High | Verified, but not used for transactional research |

## Front-End Implementation

| Claim | What was observed | Where observed | Evidence type | Confidence | Verified or inferred |
| --- | --- | --- | --- | --- | --- |
| Core assets are theme-bundled JS/CSS | `vendor.js`, `theme.js`, `product-info.js`, `theme.css`, `dialogs.css`, `cart-drawer.css`, section CSS/JS | Homepage source | Asset URLs | High | Verified |
| Predictive/search popdown exists | Search buttons, search forms, `predictive-search` string occurrences, search form action `/search` | Homepage/search page | DOM/source | Medium | Inferred from theme strings and search UI |
| Search is Shopify storefront search | `/search?q=almond`; form includes `q`, `type=product,article,page`, and prefix options; results page title showed result count | https://ersanails.com/search?q=almond | Rendered DOM and metadata | High | Verified |
| Cart drawer is custom/theme layer over Shopify cart | Cart drawer CSS, rendered cart drawer, `/cart/add` forms, drawer opened after add-to-cart | Product page and homepage forms | Rendered behavior and form actions | High | Verified |
| Product variant selection uses radios | PDP group for `SIZE` with XS/S/M/L radio controls | https://ersanails.com/products/seafoam | Rendered DOM | High | Verified |
| Product recommendations exist | PDP sections for related/recently viewed recommendations and query parameters with recommendation metadata | https://ersanails.com/products/seafoam | Rendered DOM | High | Verified as visible behavior; exact algorithm not verified |
| Responsive images and Shopify image CDN sizing | Image URLs include width/height transformations; many images have eager/lazy loading attributes | Homepage, collection page, product page | Rendered DOM and asset URLs | High | Verified |
| Font loading uses Shopify CDN fonts | Preloaded Nunito and Playfair WOFF2 assets from Shopify CDN | Homepage source/rendered DOM | Link/preload tags | High | Verified |
| Mobile navigation uses overlay menu | On 390px viewport, hamburger opened an overlay with close button, shop links, account and search entries | Homepage rendered mobile viewport | Browser interaction | High | Verified |
| Collection filtering is button-driven | Collection page displayed sort plus color, length, shape and style filter controls | https://ersanails.com/collections/all | Rendered DOM | High | Verified |
| Collection URL filtering may use tag-style paths | Opened filter panel showed links such as `/collections/all/length_long/?sort_by=` | Collection rendered DOM | Rendered DOM | Medium | Inferred from one panel state |
| Web components/custom elements | Shopify accelerated checkout/cart components and theme custom behaviors are referenced | Homepage source | Script/CSS strings | Medium | Inferred; not exhaustively mapped |

## Third-Party And Shopify App Evidence

| Service or app | What was observed | Where observed | Evidence type | Confidence | Verified or inferred |
| --- | --- | --- | --- | --- | --- |
| Judge.me reviews | `api.judge.me`, `cdn.judge.me`, Judge.me extension assets, `jdgm` settings, review stars and counts on product/cards | Homepage and product page | Script domains, extension assets, rendered reviews | High | Verified |
| Klaviyo | `static.klaviyo.com/onsite/js/WT5Cy3/klaviyo.js`; external top-bar signup to `manage.kmail-lists.com` | Homepage source and rendered header | Script URL and link | High | Verified |
| Smile.io loyalty | Shopify extension asset `smile-loader.js`; rewards page exists | Homepage source, https://ersanails.com/pages/ersa-rewards | Script asset and page | Medium | Verified script, inferred loyalty implementation |
| AVADA Free Gift/Upsell | Shopify extension asset `avada-free-gift.js`; inline `AVADA_FREE_GIFTS` strings observed | Homepage/collection source | Script asset/source string | High | Verified app presence; exact active offer logic not fully verified |
| PushOwl | Shopify extension asset `pushowl-shopify.js`; PushOwl settings strings | Homepage source | Script asset/source string | High | Verified |
| Tolstoy video/UGC | `widget.gotolstoy.com` and `play.gotolstoy.com` widget scripts | Homepage source | Script URLs | High | Verified |
| Socialwidget/Instafeed | `socialwidget-instafeed` extension asset and visible social/UGC section heading | Homepage source/rendered DOM | Script asset/rendered content | High | Verified |
| GetSiteControl countdown/banner | `getsitecontrol-countdown-timer` extension asset | Homepage source | Script asset | Medium | Verified asset, inferred active countdown/banner behavior |
| Delivery Coder estimated delivery | `delivery_coder` JS/CSS and delivery settings strings | Homepage source | Script/CSS asset and inline settings | High | Verified app presence |
| Worry-Free Delivery | PDP text and footer page link for protection service | Product page and footer | Rendered DOM/footer link | High | Verified visible offer; provider not fully identified |
| Microsoft Clarity | Script source pattern `https://www.clarity.ms/tag/...` | Homepage source | Inline analytics script | High | Verified |
| Shopify analytics/Monorail | `monorail-edge.shopifysvc.com`, Shopify analytics cookies and web pixels manager | Homepage source/headers | Domain/script/cookies | High | Verified |
| Meta/Facebook | Facebook domain verification meta and Shopify web-pixels manager context; no standalone `fbq` pixel conclusively isolated | Homepage source | Meta/source strings | Medium | Inferred tracking possibility; verification meta is direct |
| TikTok | Public social link to TikTok profile; no standalone TikTok pixel conclusively isolated | Footer/social source | Social link | Low | Verified social presence only |
| Pinterest | Public social link to Pinterest profile; no standalone Pinterest tracking conclusively isolated | Footer/social source | Social link | Low | Verified social presence only |
| YouTube | Public social link to YouTube profile | Footer/social source | Social link | High for social presence | Verified |
| Shopify Shop app / Shop Pay | Shop app preload and checkout preload scripts; `shop.app` script URL; public agent file recommends Shop skill for purchases | Homepage source, agents.md | Script URL/public text | High | Verified presence; no checkout tested |
| Google Tag Manager | The exact `gtm` string appeared only in unrelated account token text during grep; no GTM container was confirmed | Homepage source scan | String scan | Low | Not verified |

## Public Robots And Agent Instructions

| Claim | Observation | Evidence | Confidence |
| --- | --- | --- | --- |
| Storefront browsing is allowed | `User-agent: *` with `Allow: /` and sitemap declaration | https://ersanails.com/robots.txt | High |
| Checkout and private routes are restricted | Disallow rules for `/admin`, `/checkout`, `/checkouts/`, `/orders`, `/account`, `/cart.js`, `/recommendations/products`, internal services and some filter/sort crawl traps | https://ersanails.com/robots.txt | High |
| AI training is not allowed by content signal | `Content-Signal: search=yes,ai-train=no` | https://ersanails.com/robots.txt | High |
| Agents are instructed to require buyer approval for checkout/payment | Public `agents.md` describes no automatic payment completion and UCP/Shop skill guidance | https://ersanails.com/agents.md | High |

## Technical Architecture Summary

- The storefront is a Shopify theme served through Cloudflare/Shopify infrastructure.
- The implementation appears app-heavy: reviews, email, loyalty, UGC/video, push notifications, free gifts/upsell, countdown and delivery-estimate tools all have public script evidence.
- Conversion logic is largely storefront/UI based: announcement bar discounts, collection filters, quick buy, PDP variant radios, cart drawer, free-shipping progress and accessory cross-sells.
- The exact Shopify theme name, merchant app configuration, analytics event setup and private backend logic are not verifiable from public evidence.
