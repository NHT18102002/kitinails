# Ersa Nails Public Feature Matrix

Evidence is limited to public storefront pages and rendered customer-facing behavior. "Likely implementation" is not a claim of private architecture unless marked high-confidence.

| Feature | Page(s) | Customer benefit | Business/conversion purpose | Likely Shopify-native or third-party implementation | Complexity for rebuilding | Priority for original Shopify store | Notes | Evidence/confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Announcement bar / ticker | Homepage and global header | Immediate promo awareness | Campaign traffic, discount clarity, free-shipping incentive | Theme section with announcement/ticker JS | Low to medium | MVP | Multiple announcements observed: campaign, tier discount, free shipping, newsletter | Homepage, High |
| Sticky/header navigation | Global | Fast navigation/search/cart access | Reduce friction to products and cart | Theme header section | Medium | MVP | Header exposes hamburger, search and cart; desktop nav includes hierarchy | Homepage, High |
| Mega menu / hierarchy | Header and mobile overlay | Browse by intent | Route shoppers to high-value collections | Theme navigation/menu settings | Medium | MVP | Shop all, collections, shape, length, tools, bundles, sale | Homepage mobile/desktop DOM, High |
| Search | Header and `/search` | Find specific products | Capture high-intent demand | Shopify search, theme search popdown | Medium | MVP | Search form uses `/search`, `q`, product/article/page scope | Search page, High |
| Product filters | Collection/search | Narrow catalog | Improve discovery and conversion | Shopify Search & Discovery/filtering plus theme UI | Medium | MVP | Color, length, shape, style controls observed; search filters include price/availability in form state | Collection/search pages, High |
| Sorting | Collection/search | Browse by preference | Support price/relevance sorting | Shopify collection/search sort | Low | MVP | Sort by button and `sort_by` field observed | Collection/search pages, High |
| Product cards | Homepage, collections, search, recommendations | Compare product quickly | Product discovery | Theme product-card snippet | Medium | MVP | Image, title, price, sale label, reviews, quick buy | Homepage/collection/search, High |
| Quick add / Quick Buy | Homepage, collection, search, cross-sells | Add/open product quickly | Reduce path to cart | Theme quick form to `/cart/add` | Medium | MVP if reliable | Quick-buy forms observed; must preserve variant selection for products needing choices | Homepage/collection source, High |
| Product gallery | PDP | Inspect product visuals | Confidence and desirability | Theme product media/gallery | Medium | MVP | Many gallery images and lightbox links observed | Product page, High |
| Variant picker | PDP | Choose size | Reduce wrong-fit orders | Shopify variant radios with theme JS | Medium | MVP | XS/S/M/L radios observed for sampled product | Product page, High |
| Size guide | PDP and footer page | Fit confidence | Reduce hesitation and returns | Theme modal/page plus content page/metafield | Medium | MVP | Button and guide page observed; modal semantics need improvement | Product page and guide page, Medium |
| Add to cart | PDP | Commit selected item | Core conversion | Shopify product form with theme JS | Medium | MVP | Add-to-cart opened drawer after one default product add | Product page, High |
| Cart drawer | Global | Review cart without leaving page | Keep shopper in flow | Theme cart drawer | Medium | MVP | Item, size, remove, notes, checkout CTA, free-shipping progress | Cart drawer after add, High |
| Free-shipping progress bar | Cart drawer | Knows how much more to spend | Raise AOV | Theme/cart upsell logic | Medium | MVP | Drawer showed remaining amount toward free shipping | Cart drawer, High |
| Discount messaging | Global, collections, PDP | Understand savings | Promotion conversion | Theme sections, sale prices, possibly discount scripts | Medium | MVP | Tier discounts, sale labels, product percentage badges, newsletter discount | Homepage/collection/PDP, High |
| Bundles | Nav/homepage/collection | Save by buying more | Raise AOV | Shopify collection/products plus possible bundle app | Medium to high | High-value after MVP | Bundle collection and save messaging observed; exact bundle engine not verified | Homepage/nav, Medium |
| Cross-sells | PDP/cart context | Buy tools needed for use | Raise AOV and improve product outcome | Theme recommendations or app/native product recommendations | Medium | MVP for PDP, cart later | PDP cross-sells accessory kits | Product page, High |
| Related products | PDP | Continue discovery | Increase items/session | Shopify recommendations/theme | Medium | MVP | You may also like/recently viewed observed | Product page, High |
| Product reviews | Cards/PDP | Social proof | Trust and conversion | Judge.me app | Medium | MVP | Judge.me scripts and rendered stars/counts observed | Source/PDP, High |
| FAQ accordions | FAQ/PDP | Answer objections | Reduce support and hesitation | Theme accordion/sections | Low | MVP | FAQ topics and PDP accordion buttons observed | FAQ/PDP, High |
| Newsletter | Top bar/footer | Get discount/updates | Email capture and retention | Klaviyo plus Shopify newsletter/contact form | Medium | MVP | Klaviyo link and footer form observed; no submit tested | Homepage, High |
| Footer links | Footer | Support/policies/navigation | Trust and compliance | Theme footer section | Low | MVP | Shop, support, policies, localization, social | Homepage, High |
| UGC/social gallery | Homepage | Social validation | Inspiration and social loop | Tolstoy/Socialwidget/Instafeed | Medium | High-value after MVP | UGC/social scripts and homepage inspiration section observed | Source/homepage, High |
| Localization/currency | Header/footer | Shop in local market/currency | International conversion | Shopify Markets localization form | Medium | MVP if selling internationally | Country/currency selector with many countries observed; localization cookies set | Homepage/headers, High |
| Customer accounts | Header/mobile menu | Account/order access | Retention and support | Shopify customer accounts/customer hub | Medium | High-value after MVP | Login/create account links route to customer hub; login not tested | Header/source, Medium |
| Loyalty/referral | Rewards page | Earn incentives | Retention/referral | Smile.io likely | Medium to high | High-value after MVP | Smile loader and rewards page observed | Source/page, Medium |
| Analytics/tracking | Global | Measurement | Attribution and optimization | Shopify analytics, Clarity, web pixels, possible Meta | Medium | MVP | Shopify Monorail, Clarity, web pixels observed | Source/headers, High for Shopify/Clarity |
| Accessibility support | Global | Usable by keyboard/screen reader | Legal and UX quality | Theme responsibility | Medium | MVP | Skip link, buttons, radios observed; empty headings/repetition risks | Rendered DOM, Medium |
| Mobile menu | Mobile viewport | Browse on phone | Mobile conversion | Theme drawer navigation | Medium | MVP | Hamburger opens overlay with close button and key nav links | Mobile browser, High |
| Mobile product grid | Mobile viewport | Browse compact catalog | Mobile discovery | Responsive theme grid | Medium | MVP | Product cards stack/resize; quick buy remains visible | Mobile browser, Medium |
| Worry-free delivery | PDP/footer page | Reduces shipping anxiety | Add-on/risk reduction | Third-party/service page | Medium | Nice-to-have | PDP mentions protection; service page exists | PDP/footer, Medium |
| Push notifications | Global | Updates and remarketing | Retention | PushOwl | Medium | Defer | Script evidence only; permission flow not tested | Source, High for script |
| Countdown/urgency widget | Global/campaign | Creates urgency | Campaign conversion | GetSiteControl countdown | Medium | Defer | Script evidence; visible state not fully evaluated | Source, Medium |
| Estimated delivery widget | Product/cart context | Delivery expectation | Conversion trust | Delivery Coder app | Medium | High-value after MVP | Script/CSS evidence and delivery setting strings | Source, High |
| Agent/UCP support | Public agent endpoints | Agent shopping interoperability | Future commerce channel | Shopify UCP | Medium | Avoid unless strategic | Public UCP exists; not needed for theme MVP | agents.md/.well-known/ucp, High |

## Rebuild Priority Summary

- Must-have for MVP: header/nav, homepage campaign modules, collection grid/filter/sort, product cards, PDP gallery/variant/size guide/add-to-cart, cart drawer, free-shipping progress, reviews, FAQ/help/policy/footer/newsletter, basic analytics, accessibility foundations.
- High-value after MVP: loyalty, UGC/social gallery, delivery estimates, refined bundles, cart cross-sells, advanced personalization/recently viewed.
- Nice-to-have: push notifications, countdown widgets, shipping protection add-ons, affiliate page.
- Avoid unless proven necessary: heavy app stack duplication, excessive simultaneous promo widgets, agentic checkout/UCP implementation work for the theme project, copied creative/brand-specific campaign concepts.
