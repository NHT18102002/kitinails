# Phase 1A Design Foundation Log

## 1. Objective

Phase 1A tao mot lop visual foundation rieng, nhe va de bao tri tren Shopify Dawn. Muc tieu la lam storefront trong gon gang, cao cap va de mo rong hon baseline Dawn, nhung chua tao brand identity cuoi cung.

Pham vi thuc hien chi gom theme foundation CSS va cach load CSS. Khong thay doi Shopify Admin data, product logic, variant logic, cart logic, template JSON, section schema, filter, market, checkout, payment, shipping hoac theme settings data.

## 2. Files changed

- `layout/theme.liquid`: load `custom-theme.css` mot lan sau Dawn core CSS.
- `assets/custom-theme.css`: tao lop CSS foundation rieng cho Phase 1A.
- `docs/vietnamese/phase-1a-design-foundation-log.md`: log thuc thi va validation cua Phase 1A.

## 3. Exact visual rules introduced

- Foundation: page gutter rieng cho main/footer, section scroll margin, vertical rhythm giua cac section, nen rat nhe dua tren Dawn color variables.
- Typography: line-height de doc hon, heading hierarchy gon hon, heading/title co `text-wrap: balance`, body/RTE/PDP description co do dai dong doc duoc.
- Buttons and controls: button min-height 48px, font weight ro hon, transition nhe, hover va focus-visible co shadow/raise tuong duong, form fields/select/quantity co radius va border consistency.
- Cards and media: product/collection/article cards co border subtle, radius 8px, shadow nhe, media framing trung tinh, hover va focus-within co border/shadow ro hon.
- Accessibility and focus: focus-visible ring ro cho link, button, summary, input, select, textarea, Dawn button class, localization select va quantity controls.
- Responsive adjustments: mobile title width gon hon, button padding nho hon, card info spacing nhe hon; desktop page gutter va section rhythm thoang hon.
- Reduced motion: tat animation/transition dai khi user bat `prefers-reduced-motion: reduce`.

## 4. Dawn files intentionally preserved

- Khong rewrite `assets/base.css`.
- Khong sua Dawn component CSS, section CSS, snippets, templates, product/cart/variant JavaScript, locale strings, hoac theme settings.
- Khong import font ngoai, khong them dependency, khong them fake content, fake review, fake claim, fake urgency badge.

## 5. Accessibility checks performed

- Desktop viewport inspection: `1440x900`.
- Mobile viewport inspection: `390x844`.
- Keyboard/focus validation: scoped visible footer localization control duoc focus bang browser automation va co computed focus ring ro rang: outline solid, outline offset, va box-shadow ring.
- Hover/focus parity: button va card hover states cung co focus-visible/focus-within equivalent.
- Reduced-motion CSS block da co trong custom foundation file.

## 6. Theme Check result

Command: `shopify theme check`

Result: pass with existing Dawn warnings only.

- 169 files inspected.
- 8 total offenses.
- 8 warnings.
- 0 errors.

Warnings observed are existing Dawn baseline items in `layout/password.liquid`, `layout/theme.liquid`, `sections/main-article.liquid`, `sections/main-list-collections.liquid`, `sections/main-product.liquid`, `sections/main-search.liquid`, and `snippets/quick-order-product-row.liquid`.

## 7. Local preview status

Local preview validated through existing Shopify CLI development server at `http://127.0.0.1:9292`.

Checks performed:

- Dawn homepage rendered with `#MainContent`.
- `custom-theme.css` loaded exactly once.
- Desktop and mobile breakpoints rendered.
- Product cards showed the new 8px card radius and soft shadow.
- Buttons showed the new 48px minimum height.
- Form controls showed the new 50px minimum height where applicable.
- Browser console errors caused by this phase: none observed.

Note: port `9292` was already in use by an existing `shopify theme dev --store develop-store-5y6bipog.myshopify.com --open` process, so validation reused that active preview.

## 8. Known limitations due to missing brand assets

- Final brand name, logo, palette, typography, imagery and campaign direction are still not approved.
- Current visual system intentionally stays neutral and Dawn-variable-based.
- No original product photography, lifestyle imagery, PDP guide UI, collection merchandising UI, or global shell redesign was introduced in this phase.
- Some final polish depends on future Theme Editor settings and approved brand assets.

## 9. Recommended next coding task

Recommended next coding task: Phase 2 global storefront shell.

Phase 2 should build on this foundation by planning and implementing the approved global header/footer/storefront shell without changing product, cart, checkout, payment, market, or Admin data outside the approved scope.
