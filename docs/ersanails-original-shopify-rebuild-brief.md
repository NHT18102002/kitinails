# Original Shopify Rebuild Brief

This brief translates public storefront findings into an original Shopify Online Store 2.0 plan. It must not reuse Ersa Nails branding, logo, colors, fonts, layouts, product names, product descriptions, imagery, campaign concepts, reviews or creative assets.

## A. Functional Patterns Worth Adopting

- Intent-based navigation: shop all, best sellers, new, sale, collections, shape, length, tools/accessories and bundles.
- Homepage conversion ladder: campaign CTA, trust strip, featured products, taxonomy browsing, education/trust, reviews/social proof, newsletter and footer.
- PDP buy box: gallery, review summary, sale/price, size selector, size guide, add-to-cart, shipping/payment trust and concise accordions.
- Cart drawer: immediate add feedback, line-item detail, free-shipping progress, remove, notes and checkout CTA.
- Product taxonomy: shape, length, color/style and collection-based browsing.
- Support content: sizing, application/removal guide, shipping, returns, FAQ, customization, policies and contact.
- Retention surfaces: newsletter, rewards after MVP, social/UGC after MVP.

## B. Generic Industry Best Practices

- Use Shopify Online Store 2.0 sections and merchant-editable settings.
- Keep page metadata unique and template-specific.
- Use Shopify Search & Discovery for filters, synonyms and recommendations where possible.
- Use accessible components: semantic headings, radios for variants, real buttons, focus traps and labeled dialogs.
- Optimize media: responsive images, lazy loading, fixed aspect ratios and small above-fold payload.
- Use a minimal app stack at launch: analytics, reviews and email only unless a feature has clear ROI.
- Build mobile first: fast header/search/cart, compact collection controls and thumb-friendly PDP controls.

## C. Reference-Specific Creative Elements Not To Copy

- Do not copy the reference brand name, logo, typography, color palette, art direction or visual identity.
- Do not copy product names, collection names, descriptions, review text, image filenames as marketing text, campaign names or slogans.
- Do not reuse or embed product photos, videos, UGC, social posts, icons, press assets or review content.
- Do not duplicate the exact homepage section order, carousel creative, seasonal campaign concept or promotional wording.
- Do not reproduce source code, theme assets, CSS, JavaScript, templates or app configuration.

## D. Original Design Opportunity

Create a premium press-on-nails brand system around clarity, fit confidence and editorial polish.

- UX principles: fast shopping, confident sizing, low-friction add-to-cart, honest trust building, mobile-first browsing.
- Visual direction: original editorial photography, clean product cards, restrained color palette, strong whitespace, tactile close-ups, accessible contrast.
- Content hierarchy: product outcome first, fit and wear details second, creative story third.
- Navigation: Shop All, New, Best Sellers, Sale, Shop by Shape, Shop by Length, Occasion, Essentials, Sets/Bundles, Guides.
- PDP modules: hero gallery, review summary, price, size/shape/length facts, size guide, what's included, how to apply, wear/removal, shipping/returns, compatible accessories, related products.
- Cart strategy: free-shipping progress, one relevant accessory upsell, easy remove/edit, clear shipping/taxes note, checkout CTA.
- Trust modules: real reviews, material/process facts, application guide, shipping/returns, secure checkout, customer support, original press/creator features only when earned.
- Accessibility improvements: meaningful `h1`s, accessible modals/drawers, unique gallery alt text, reduced duplicated carousel text, keyboard-tested filters and cart.
- Performance improvements: fewer global apps, no heavy social embeds above fold, optimized hero media, deferred reviews/UGC widgets, app loading only where needed.

## Recommended Shopify Architecture

| Area | Recommendation |
| --- | --- |
| Theme base | Shopify Online Store 2.0 custom theme or a lean premium base theme customized with original components. |
| Templates | `index`, `collection`, `product`, `page`, `blog`, `article`, `search`, `cart`, policy templates. |
| Sections | Header, announcement bar, hero, featured collection, collection list, shape/length tiles, trust row, review/social proof, newsletter, footer, product main, product accordions, related products, cart drawer, FAQ. |
| Snippets | Product card, price, badges, rating summary, responsive image, variant picker, size guide trigger, free-shipping progress, icon text row, accordion item. |
| Theme settings | Logo, colors, typography, button styles, sale badge, free-shipping threshold, announcement messages, product-card settings, review app toggles, social links. |
| Metafields | Product shape, length, finish/style, what's included, application time, wear duration, reusable flag, size guide group, care instructions, cross-sell products. |
| Metaobjects | Size guide tables, application steps, trust badges, press mentions, FAQ groups, ingredient/material notes, campaign tiles. |
| Shopify Search & Discovery | Configure filters for availability, price, shape, length, color/finish/style and product type; set synonyms for common nail terms; use native recommendations first. |
| Native Shopify priorities | Products, variants, collections, discounts, Shopify Markets/localization, customer accounts, cart drawer, search/filtering, email capture, policies and analytics. |
| App priorities | Reviews and email marketing at launch. Consider loyalty, UGC/video, bundle/free-gift and delivery-estimate apps after MVP if metrics justify them. |
| Postpone | Push notifications, countdown timers, shipping protection, complex referral flows, agentic checkout/UCP work and heavy personalization. |

## Rebuild Priorities

### Must-Have For MVP

- Original visual identity, product media and copy.
- Header/navigation with search, cart and mobile menu.
- Homepage with original hero, trust row, featured products, shape/length browsing and newsletter.
- Collection templates with accessible filters/sort and strong product cards.
- PDP with gallery, variants, size guide, add-to-cart, accordions, reviews and recommendations.
- Cart drawer with free-shipping progress and accessible line-item controls.
- Help/policy pages: FAQ, size guide, how-to, shipping, returns, privacy, terms, contact.
- SEO basics: unique metadata, canonical tags, schema, sitemap and heading hierarchy.
- Performance and accessibility baseline.

### High-Value After MVP

- Loyalty/rewards program.
- Bundles and free-gift logic.
- Delivery-estimate messaging.
- UGC/social gallery with performance controls.
- Advanced recommendations and recently viewed.
- Affiliate/creator program page.

### Nice-To-Have

- Push notifications.
- Countdown banners for limited campaigns.
- Shipping protection add-on.
- Product quiz or guided finder.
- Customization request workflow.

### Avoid Unless Proven Necessary

- Loading many apps globally.
- Multiple simultaneous urgency widgets.
- Indexed filter explosion.
- Complex checkout customization.
- Any reference-specific creative replication.

## Acceptance Criteria For Future Development

- Every template has a meaningful `h1`, canonical, title and meta description.
- PDP variant selection and cart drawer work by keyboard and screen reader.
- App scripts are limited and measured.
- Product and collection content is original.
- No reference images, source code, reviews or copy are used.
- Shopify Search & Discovery filters match product data and do not create uncontrolled index bloat.
