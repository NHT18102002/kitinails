# Ersa Nails Research Summary

## 1. Executive summary

Ersa Nails is a Shopify storefront for premium handmade press-on nails. Public evidence strongly supports Shopify as the platform, Cloudflare/Shopify CDN delivery, a section-based Shopify theme, and a conversion stack built around campaign messaging, product taxonomy, reviews, quick buy, PDP cross-sells, cart drawer and free-shipping progress.

The store is commercially mature and app-heavy. Confirmed or strongly evidenced public integrations include Judge.me, Klaviyo, Smile, AVADA free gift/upsell, PushOwl, Tolstoy, Socialwidget/Instafeed, GetSiteControl, Delivery Coder, Shopify analytics/Monorail and Microsoft Clarity.

For an original Shopify rebuild, the most valuable patterns to adopt are the commercial logic and customer journey, not the creative expression. The future store should use original branding, photography, product names, page copy, colors, typography and campaign concepts.

## 2. Website purpose and customer journey

The storefront sells press-on nail sets, tools/accessories, bundles and related services. The public journey is:

1. Land on a campaign-led homepage.
2. Navigate by collection, shape, length, best seller, new, sale, tools or bundles.
3. Browse product cards with sale/review/quick-buy cues.
4. Use search or filters when intent is specific.
5. Open a PDP to inspect gallery, reviews, size, guide content, cross-sells and shipping/payment reassurance.
6. Add to cart and see a cart drawer with free-shipping progress.
7. Continue to checkout, which was intentionally not inspected.

Evidence: https://ersanails.com/, https://ersanails.com/collections/all, https://ersanails.com/products/seafoam, https://ersanails.com/search?q=almond.

## 3. Confirmed technology stack

- Shopify storefront and theme architecture: `Powered-By: Shopify`, Shopify cookies, Shopify CDN assets, `shopify-section`, public `agents.md`.
- Cloudflare edge/CDN fronting: `Server: cloudflare`, `CF-RAY`, `Cf-Cache-Status`.
- Shopify image/font/theme CDN: `/cdn/shop/...`, Shopify font preloads, width-transformed images.
- Shopify analytics/Monorail/web pixels.
- Judge.me review app evidence.
- Klaviyo onsite/email signup evidence.
- Microsoft Clarity script.
- Shopify Markets/localization forms and localization/cart currency cookies.
- Public UCP discovery support, not used for transactions.

## 4. Probable technology stack

- Shopify Online Store 2.0 or similar section-based theme architecture, inferred from section assets and markup.
- Smile.io loyalty, inferred from Smile loader and rewards page.
- AVADA free gift/upsell, PushOwl, Tolstoy, Socialwidget/Instafeed, GetSiteControl and Delivery Coder, based on public extension assets and source strings.
- Meta/social pixel activity is possible through Shopify web pixels, but standalone Meta/TikTok/Pinterest tracking was not conclusively isolated. TikTok/Pinterest/YouTube social links are confirmed.

## 5. Navigation and information architecture

Navigation is built around shopping intent:

- Shop all, best sellers, new arrivals and sale.
- Campaign/thematic collections.
- Shape: almond, coffin, oval, squoval, square.
- Length: long, medium, short.
- Tools/accessories and bundles.
- Footer support: about, contact, blog, rewards, size guide, FAQ, customization, shipping, returns, delivery protection, privacy and terms.

Evidence: homepage header/footer and public sitemaps.

## 6. Homepage structure

Homepage modules include:

- Announcement and promo ticker.
- Campaign hero carousel with category CTAs.
- Trust/value strip.
- Featured best sellers and campaign collections.
- Shape browsing.
- Press/social proof and UGC/social inspiration.
- Tools/accessories feature.
- Newsletter and footer.

Risk: the homepage is script/media/widget heavy and has repeated carousel/ticker content in the DOM.

## 7. Collection-page structure

Collection pages include campaign/hero content, breadcrumbs, product count, sort, filter controls, product cards, review ratings, sale badges and quick-buy actions. The all-products page showed visible controls for color, length, shape and style filters.

SEO/accessibility risk: rendered collection DOM showed an empty `h1`; some taxonomy pages use generic meta descriptions.

Evidence: https://ersanails.com/collections/all, https://ersanails.com/collections/almond, https://ersanails.com/collections/long.

## 8. Product-page structure

The sampled PDP includes:

- Large media gallery and lightbox links.
- Review rating and review count.
- Product title, sale price and savings.
- Trust bullets.
- Size radios and size chart trigger.
- Quantity and add-to-cart.
- Shipping/payment reassurance.
- Accessory cross-sells.
- Customization CTA.
- Accordions for product, tools, use, ingredients, shipping and returns.
- Benefits, related products and recently viewed modules.

Evidence: https://ersanails.com/products/seafoam.

## 9. Cart and conversion strategy

After adding a default product selection through the public UI, the cart drawer displayed one item, selected size, sale price, quantity, remove link, order-notes button, free-shipping progress and checkout CTA. Checkout was not clicked.

Conversion strategy centers on:

- Tiered buy-more discounts.
- Sale labels and crossed-out pricing.
- Free-shipping threshold and progress bar.
- Reviews and trust claims.
- Accessory cross-sells.
- Newsletter discount.
- Rewards/social retention.

## 10. Third-party integration signals

High-confidence public signals:

- Judge.me reviews.
- Klaviyo email.
- Microsoft Clarity.
- Shopify analytics/Monorail/web pixels.
- AVADA free gift/upsell.
- PushOwl.
- Tolstoy.
- Socialwidget/Instafeed.
- Delivery Coder.

Medium-confidence:

- Smile loyalty.
- GetSiteControl countdown/banner.
- Worry-free delivery/protection service.

Low-confidence:

- Standalone Google Tag Manager, TikTok Pixel, Pinterest Pixel or Meta Pixel were not conclusively confirmed beyond verification/social/web-pixel context.

## 11. SEO observations

- Homepage, product, collection, page and search pages use canonical tags.
- Homepage includes Organization and WebSite/SearchAction JSON-LD.
- Product page includes ProductGroup/Product/Offer JSON-LD.
- Sitemap index exposes product, collection, page, blog and agentic discovery sitemaps.
- Robots controls checkout/account/cart API/internal endpoints and filter/sort crawl traps.
- Some taxonomy collections appear to use generic descriptions.
- Rendered homepage/collection/search templates showed empty `h1` patterns.

## 12. Performance observations

- The storefront is CDN-backed and uses responsive Shopify image URLs.
- Homepage is media-heavy and app-heavy: many images, many script tags and many stylesheet links were observed in the rendered DOM.
- Fonts are loaded from Shopify CDN.
- Several app scripts load globally, increasing performance risk.
- Browser resource timing and Lighthouse were unavailable, so no lab score is reported.

## 13. Accessibility observations

Positive:

- Skip link exists.
- Product size options are radios.
- Header/menu/search/cart controls are exposed as buttons/links.
- Search input and newsletter input have accessible labeling signals.

Risks:

- Empty `h1` on key templates.
- Repeated carousel/ticker text.
- Many gallery links with repeated accessible names.
- Cart drawer/menu/size chart need full focus-trap and Escape-key validation.
- Many images have empty alt values; some are probably decorative, but meaningful imagery needs an alt audit.

## 14. Features recommended for our Shopify MVP

- Original brand system and media.
- Header/nav with mobile menu, search and cart.
- Announcement bar with simple campaign messaging.
- Collection grid with filters, sort and quick product discovery.
- Product cards with badges, reviews and quick buy only where variant-safe.
- PDP gallery, variant picker, size guide, add-to-cart, trust badges, accordions and recommendations.
- Cart drawer with free-shipping progress.
- Reviews, newsletter, policies, FAQ, size/how-to guides, footer and analytics.
- Unique SEO metadata, schema and accessible headings.

## 15. Features to defer

- Loyalty/rewards.
- Push notifications.
- Countdown timers.
- UGC/video embeds.
- Advanced bundles/free gifts.
- Delivery-estimate app.
- Shipping protection.
- Affiliate program.
- Product quiz or customization workflow.

## 16. Features not to copy due to branding/IP concerns

- Brand name, logo, colors, fonts and art direction.
- Product names, collection names, product descriptions and campaign language.
- Product photography, videos, UGC, review content, press graphics and social assets.
- Theme code, CSS, JavaScript, app configurations and exact layouts.
- Seasonal campaign concepts and creative presentation.

## 17. Open questions and unknowns

- Exact Shopify theme name.
- Private app configurations and discount logic.
- Logged-in account/customer hub experience.
- Checkout behavior and payment methods beyond public preload signals.
- Exact review schema output and validation status.
- Lighthouse/Core Web Vitals scores.
- Full keyboard/focus behavior for every drawer/modal/filter.
- Whether all third-party scripts are actively used or simply installed.

## 18. Recommended next steps before development

1. Define original brand positioning, art direction and product taxonomy.
2. Build a lean Shopify OS 2.0 architecture with native features first.
3. Configure product metafields for shape, length, finish, size guide and included tools.
4. Implement accessible homepage, collection, PDP and cart drawer templates.
5. Install only MVP apps: reviews, email and analytics.
6. Add original guides for sizing, application, removal, care, shipping and returns.
7. Validate SEO metadata/schema and accessibility before launch.
8. Measure performance before adding loyalty, UGC, push, countdown or bundle apps.
