# Footer Visual Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the local footer visual structure so it matches the Ersa Nails reference footer while preserving Shopify native footer menus, newsletter form, localization, payment icons, social links, policies, and Theme Editor configurability.

**Architecture:** Keep Dawn's native footer section as the data source, but restructure the footer into an Ersa-specific layout: a single black full-width footer, a top four-column navigation/newsletter area, and a bottom utility area for social icons, currency selector, copyright/policies, and payment icons. Remove conflicting legacy footer overrides from `assets/custom-theme.css` and move final scoped footer styling into `assets/section-footer.css` so cascade is predictable.

**Tech Stack:** Shopify Online Store 2.0, Liquid, JSON section group settings, Dawn footer/newsletter/localization/payment snippets, CSS, lightweight vanilla JavaScript for mobile accordion only.

---

## Assumption From The Supplied Screenshots

- Reference target is the first screenshot: one continuous black footer with white text, four desktop columns, social icons bottom-left, currency/copyright center, payment icons bottom-right.
- Current local is the second screenshot: beige upper footer plus separate black bottom slab, invisible/low-contrast shop links, missing service links, different newsletter card, and misaligned bottom utilities.

If the screenshot order is reversed, stop before implementation and re-audit the reference/local URLs.

## 1. Reference UX Audit

Desktop reference:
- Footer background is solid black across the full viewport width.
- Main content is inside a wide centered container with generous left/right padding.
- Top row has four columns:
  - `SHOP`: Best Sellers, New Arrivals, Sales, Shop by Collections, Shop by Shape, Shop by Length, Tools & Accessories.
  - `BRAND`: About Us, Contact Us, Blogs.
  - `CUSTOMER SERVICE`: Ersa Rewards, Size Guide, Help Center, Customization Service, Shipping Policy, Return & Exchange Policy, Worry-Free Delivery Service, EU Withdrawal Policy, EU Withdrawal Request.
  - `NEWSLETTER`: heading `NEWSLETTER`, short promotional copy, email input with arrow submit.
- Column headings are uppercase, white, medium-bold, around 18-20px.
- Links are uppercase or title case depending on the column, white/near-white, compact line-height.
- Newsletter input is dark/black with white border, about 375px wide, 60px tall, radius around 8px, arrow icon on the right.
- Bottom area is not a separate color band; it remains black:
  - social icons bottom-left in white square/icon style.
  - optional Shop follow button under social icons if enabled.
  - localization/currency selector centered above copyright.
  - copyright and policies centered.
  - payment icons grouped bottom-right, wrapping to a second line if many methods exist.
- Floating chat/account widget may overlap visually but should not be part of footer implementation.

Mobile expected behavior:
- Footer remains black.
- Columns stack vertically.
- Headings can remain visible with collapsible accordion behavior under 750px.
- Newsletter stays usable with full-width email field.
- Bottom utilities stack: social, currency, copyright/policies, payments.
- No horizontal overflow, no hidden white text on light background.

## 2. Local Issue Audit

Observed from current files:

- `sections/footer.liquid`
  - Current structure is still Dawn-like: top blocks and bottom wrappers are separate, and social icons are rendered inside the newsletter column instead of the bottom-left area.
  - Newsletter copy is hard-coded in Liquid, which is acceptable visually but should become section setting or stay as default text if no new setting is needed.
  - Footer mobile accordion script clones headings and attaches click listeners; this can be kept but should be scoped and made keyboard-friendly if headings become buttons.
  - Bottom area renders localization/payment first, copyright second; reference needs a three-zone utility layout.

- `sections/footer-group.json`
  - `shop_menu` points to `main-menu`, which exposes header navigation rather than the specific footer shop links in the reference.
  - `brand_menu` and `service_menu` are text blocks with inline links; service list is incomplete versus reference.
  - Footer settings enable country and language selectors; reference screenshot shows currency only. Language selector should render only if available, but styling must account for both.

- `assets/section-footer.css`
  - Mostly Dawn default footer layout. It does not express the Ersa black footer layout, 4-column desktop grid, bottom utility zones, or reference newsletter input.
  - Mobile accordion classes exist but visual state and color are Dawn-based.

- `assets/custom-theme.css`
  - Multiple footer overrides conflict:
    - Lines around `2958-3079`: older black footer override.
    - Lines around `5471-5521`: another black footer override with `!important`.
    - Lines around `7540-7668`: newer beige footer and "Phase 5 final footer specificity override" forcing the current local beige look.
  - Because the later beige block uses broad `.footer *` and `!important`, it wins over earlier black reference styling and creates the current mismatch.

- Global snippets/assets:
  - `snippets/social-icons.liquid`, `snippets/country-localization.liquid`, `snippets/language-localization.liquid`, and payment SVG rendering are native Dawn/Shopify and should be reused.
  - `component-newsletter.css`, `component-list-payment.css`, and `component-list-social.css` can remain loaded but need footer-specific overrides.

## 3. Visual Gap Table

| Area | Reference | Local | Fix | Files |
|---|---|---|---|---|
| Footer background | One continuous black footer | Beige top + black bottom slab | Remove beige final override; make footer group black end-to-end | `assets/custom-theme.css`, `assets/section-footer.css` |
| Top layout | 4 columns across desktop | 4 columns but spacing/content/colors wrong | Define Ersa footer grid and column widths | `sections/footer.liquid`, `assets/section-footer.css` |
| Shop links | Footer-specific shop list | Uses `main-menu`, some links are wrong/invisible | Update footer group to footer-specific links/menu or text block | `sections/footer-group.json` |
| Brand links | About Us, Contact Us, Blogs | Mostly present | Normalize capitalization, spacing, color | `sections/footer-group.json`, `assets/section-footer.css` |
| Customer service | Long service list | Only 3 links | Add missing footer service links through settings JSON | `sections/footer-group.json` |
| Newsletter | Simple black input with white border | Light card style from local | Restyle newsletter column and input | `sections/footer.liquid`, `assets/section-footer.css` |
| Social icons | Bottom-left | Currently inside newsletter/top or missing alignment | Move/render social in bottom utility zone | `sections/footer.liquid`, `assets/section-footer.css` |
| Localization | Centered `USD$`/country selector | Left inside black slab | Create centered utility column | `sections/footer.liquid`, `assets/section-footer.css` |
| Copyright/policies | Centered, compact | Centered but separated from reference layout | Keep native policies, style/order like reference | `sections/footer.liquid`, `assets/section-footer.css` |
| Payment icons | Bottom-right, wraps cleanly | Right in separate slab | Style payment list in same black footer utility row | `assets/section-footer.css` |
| Mobile | Black stacked footer, accordions usable | Beige/black split, contrast issues | Scope responsive accordion and stacked utility layout | `sections/footer.liquid`, `assets/section-footer.css` |

## 4. Implementation Milestones

### Phase 1: CSS Foundation And Conflict Cleanup

**Goal:** Make footer styling deterministic by removing or neutralizing conflicting footer overrides in `assets/custom-theme.css`.

**Files:**
- Modify: `assets/custom-theme.css`
- Modify: `assets/section-footer.css`

**Steps:**
- [ ] Identify all footer override blocks in `assets/custom-theme.css`:
  - `/* Informational pages and footer */`
  - `/* Footer black theme override */`
  - the beige footer block starting around `.footer { background: #f7f4f1 !important; }`
  - `/* Phase 5 final footer specificity override */`
- [ ] Keep non-footer informational page rules intact.
- [ ] Remove or narrow only footer-specific broad rules from `assets/custom-theme.css`, especially `.footer`, `.footer *`, `.shopify-section-group-footer-group .footer *`, and newsletter/footer input overrides.
- [ ] Add the final Ersa footer base styles to `assets/section-footer.css`:
  - black background `#050505` or `#000`.
  - white text.
  - no border-top.
  - max content width around `1760px`.
  - desktop padding similar to reference.

**Risks:**
- Broad `!important` rules may still override `section-footer.css`.
- Removing too much from `custom-theme.css` may affect non-footer newsletter/contact inputs.

**Check:**
- Run `rg -n "\\.footer|shopify-section-group-footer-group|footer-block|newsletter-form__field-wrapper" assets/custom-theme.css assets/section-footer.css`.
- Confirm no late beige `.footer` override remains after the final footer CSS.

**Exit Criteria:**
- Footer background is black end-to-end.
- No beige footer background remains.
- Contact/search/product pages are not affected by footer cleanup.

### Phase 2: Footer Markup Structure

**Goal:** Rework `sections/footer.liquid` into a reference-like top grid plus bottom utility layout while preserving Shopify native forms and objects.

**Files:**
- Modify: `sections/footer.liquid`

**Steps:**
- [ ] Add footer wrapper classes:
  - `.footer--ersa`
  - `.footer__inner`
  - `.footer__nav-grid`
  - `.footer__utility`
  - `.footer__utility-social`
  - `.footer__utility-center`
  - `.footer__utility-payments`
- [ ] Keep `{% form 'customer' %}` for newsletter; do not replace with custom JS.
- [ ] Render top blocks in `.footer__nav-grid`.
- [ ] Render social icons in bottom-left utility area using existing `{%- render 'social-icons', class: 'footer__list-social' -%}` when enabled.
- [ ] Render localization forms in bottom-center utility area using existing `country-localization` and `language-localization`.
- [ ] Render copyright/policies below localization in bottom-center utility area.
- [ ] Render payment icons in bottom-right utility area using `shop.enabled_payment_types`.

**Risks:**
- Moving social icons may duplicate them if newsletter column still renders social.
- Localization forms need labels and focus behavior retained.

**Check:**
- Inspect rendered DOM for only one social icon list inside footer.
- Submit newsletter with invalid email and verify native error appears.
- Open country selector and verify dropdown appears above/below without clipping.

**Exit Criteria:**
- DOM has one top navigation grid and one bottom utility row.
- Native newsletter, localization, payment, and policy rendering still work.

### Phase 3: Footer Content Configuration

**Goal:** Align footer menu content with reference without hard-coding all links inside Liquid.

**Files:**
- Modify: `sections/footer-group.json`

**Steps:**
- [ ] Replace `shop_menu` from `main-menu` with a footer-specific text block or footer menu handle.
- [ ] If using text block, set `SHOP` content to:
  - Best Sellers: `/collections/best-sellers`
  - New Arrivals: `/collections/new-arrivals`
  - Sales: `/collections/sale`
  - Shop by Collections: `/collections/all`
  - Shop by Shape: `/collections/almond`
  - Shop by Length: `/collections/long`
  - Tools & Accessories: `/collections/tools-accessories`
- [ ] Set `BRAND` content to:
  - About Us: `/pages/about-us`
  - Contact Us: `/pages/contact`
  - Blogs: `/blogs/news`
- [ ] Set `CUSTOMER SERVICE` content to:
  - Ersa Rewards: `/pages/ersa-rewards` if page exists, otherwise `/pages/rewards`
  - Size Guide: `/pages/size-guide`
  - Help Center: `/pages/contact`
  - Customization Service: `/pages/customization-service`
  - Shipping Policy: `/policies/shipping-policy`
  - Return & Exchange Policy: `/policies/refund-policy`
  - Worry-Free Delivery Service: `/pages/worry-free-delivery-service`
  - EU Withdrawal Policy: `/policies/refund-policy`
  - EU Withdrawal Request: `/pages/eu-withdrawal-request`
- [ ] Keep these as editable Theme Editor text/menu settings, not Liquid hard-code.

**Risks:**
- Some target pages/collection handles may not exist in the development store.
- Shopify will still render valid links, but non-existing pages may 404 until merchant creates them.

**Check:**
- Click each footer link in preview.
- Confirm no product/cart/checkout behavior changes.

**Exit Criteria:**
- Footer columns visually and textually match the reference list.
- Links are controlled through footer settings JSON or navigation menus.

### Phase 4: Desktop Visual Styling

**Goal:** Match reference desktop spacing, typography, newsletter input, social icons, localization, copyright, and payment icons.

**Files:**
- Modify: `assets/section-footer.css`

**Steps:**
- [ ] Top grid:
  - `display: grid`.
  - `grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.8fr) minmax(300px, 1.1fr) minmax(360px, 1.1fr)`.
  - large column gap around `72px`.
- [ ] Headings:
  - uppercase.
  - `font-size: 18px` desktop.
  - `font-weight: 600-700`.
  - letter spacing close to `0`.
- [ ] Links/copy:
  - white/near-white.
  - `font-size: 17-18px`.
  - `line-height: 1.75`.
  - no underline until hover.
- [ ] Newsletter:
  - max width around `380px`.
  - input height around `60px`.
  - black background.
  - white border.
  - radius around `8px`.
  - arrow submit right aligned.
- [ ] Bottom utility:
  - grid with `1fr auto 1fr`.
  - social left, center text, payments right.
  - payment icons wrapped with small gap and no distortion.

**Risks:**
- Payment SVG list differs by enabled payment methods, so exact icon count may differ from reference.
- Store social settings determine which icons appear.

**Check:**
- Desktop 1440 screenshot comparison.
- Desktop 1920 screenshot comparison if available.
- Confirm no horizontal overflow.

**Exit Criteria:**
- Footer matches black reference visually at desktop.
- Bottom utility zones align like reference.

### Phase 5: Mobile And Tablet Responsive Styling

**Goal:** Preserve reference hierarchy on 1024, 768, and 390 while keeping links/forms accessible.

**Files:**
- Modify: `sections/footer.liquid`
- Modify: `assets/section-footer.css`

**Steps:**
- [ ] At `max-width: 989px`, reduce top grid to 2 columns.
- [ ] At `max-width: 749px`, stack columns in 1 column.
- [ ] Use mobile accordion only below 750px:
  - headings must be keyboard operable.
  - `aria-expanded` must update.
  - accordion content must be visible when JavaScript is unavailable or degrade acceptably.
- [ ] Newsletter field full width on mobile.
- [ ] Bottom utility stacks in this order:
  - social icons.
  - localization.
  - copyright/policies.
  - payments.
- [ ] Ensure payment icons wrap inside viewport.

**Risks:**
- Current footer heading is `h2`, not button; clickable heading may not be ideal for keyboard.
- Cloned heading script can remove event state after Theme Editor reload.

**Check:**
- Test at 1024, 768, 390.
- Keyboard tab through footer links, newsletter input, submit arrow, country selector, social links.

**Exit Criteria:**
- Mobile footer is black, readable, stacked, and no overflow.
- Accordion/focus behavior works.

### Phase 6: QA And Publish Preview Flow

**Goal:** Verify footer matches reference and does not regress global Shopify behavior.

**Files:**
- No new file changes unless QA exposes a bug.

**Commands:**
- `shopify theme dev --store develop-store-5y6bipog.myshopify.com`
- `shopify theme check`
- `git diff --check`
- `shopify theme push --store develop-store-5y6bipog.myshopify.com --theme 151645159575`

**Manual QA:**
- Compare reference and local/preview at:
  - 1440px
  - 1024px
  - 768px
  - 390px
- Test footer on:
  - homepage
  - collection page
  - product page
  - search page
  - cart page
- Test:
  - newsletter invalid email state.
  - newsletter valid email success state if safe.
  - social links.
  - footer navigation links.
  - country/currency selector.
  - policy links.
  - payment icon wrapping.

**Exit Criteria:**
- `shopify theme check` has no new footer-related errors.
- Footer visually matches reference within observable limits.
- No regressions to cart, checkout entry, product forms, search, or collection filtering.

## 5. File Impact Map

Modify:
- `sections/footer.liquid`
- `sections/footer-group.json`
- `assets/section-footer.css`
- `assets/custom-theme.css`

Possibly modify:
- `snippets/social-icons.liquid` only if icon sizing cannot be solved with CSS.
- `locales/en.default.json` only if new footer setting labels are added.

Do not modify:
- `assets/base.css`
- `assets/global.js`
- `assets/facets.js`
- `assets/collection-filters.css`
- `assets/search-page.css`
- `snippets/cart-drawer.liquid`
- product, cart, checkout, import tooling, `.env`, product data, metafields, inventory.

No new files by default.

## 6. Decisions Needed Before Code

- Confirm the first black screenshot is the target reference and the second beige/black screenshot is current local.
- Decide whether footer links should be managed by Shopify navigation menus or by footer text blocks in `sections/footer-group.json`.
- Confirm whether to include all reference customer service links even if some destination pages may not exist yet.
- Confirm whether mobile footer should be accordion or always-expanded stacked links.
- Confirm whether `Powered by Shopify` should remain visible. Current reference shows `Shopify.` in copyright, so default can remain unless merchant wants it hidden.
- Confirm whether language selector should stay enabled if the store has only one language. The reference appears to show only currency/country.

## 7. Acceptance Criteria

1440px:
- Footer is one continuous black section.
- Four columns align like reference.
- Newsletter column has black input with white border and arrow.
- Social icons sit bottom-left.
- Currency/copyright/policies sit centered.
- Payment icons sit bottom-right and wrap cleanly.
- No beige footer area remains.

1024px:
- Footer remains black.
- Columns fit without clipping.
- Payment icons do not overflow.
- Bottom utility layout remains readable.

768px:
- Footer columns reduce cleanly.
- Links are readable.
- Newsletter input fits.
- No horizontal scroll.

390px:
- Footer stacks vertically.
- Newsletter input fits within viewport.
- Mobile accordion or stacked links are keyboard accessible.
- Social, localization, copyright, policies, and payment icons are readable and not clipped.

Native behavior:
- Newsletter form still uses Shopify customer form.
- Country/language selector still uses Shopify localization form.
- Payment icons still use `shop.enabled_payment_types`.
- Policy links still use `shop.policies`.
- Theme Editor footer blocks/settings still work.

Chờ duyệt plan trước khi sửa code.
