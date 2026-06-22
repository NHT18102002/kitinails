# Project Purpose

This project is for an original Shopify Online Store 2.0 storefront for a press-on nails brand. The storefront may study publicly visible UX and functional patterns from competitor websites, including Ersa Nails, but must not copy competitor source code, logos, brand names, images, videos, text, reviews, product names, policies, fonts, campaign concepts, or visual identity.

The objective is a functionally comparable but independently designed Shopify storefront with original branding, copy, photography, merchandising, and implementation.

# Technology Stack

- Target platform: Shopify Online Store 2.0, using Liquid, JSON templates, Shopify sections and blocks, snippets, CSS, and lightweight vanilla JavaScript.
- Expected workflow tools: Shopify CLI, Shopify Theme Check, and Git.
- Current repository state: this workspace now uses official Shopify Dawn `v15.5.0` as the technical base, commit `83d5e6b4094d8019820bffafe04b242d0602ffe2`; project documentation is preserved under `docs/`.
- Do not claim or add a Node build pipeline, jQuery, frameworks, app dependencies, or package scripts unless the repository later verifies them.
- Preserve Dawn conventions unless a later approved phase intentionally customizes them for the original press-on nails storefront.

# Repository Map

- `docs/`: English research, rebuild, UX, SEO, accessibility, performance, feature, URL, and technology evidence for the original Shopify rebuild.
- `docs/vietnamese/`: Vietnamese versions of the project research documents.
- `layout/`: Dawn global Shopify theme wrappers such as `theme.liquid` and `password.liquid`.
- `templates/`: Dawn JSON and Liquid templates for index, product, collection, page, blog, article, search, cart, policy, and customer pages.
- `templates/customers/`: customer account templates if the theme uses classic customer accounts.
- `sections/`: Theme Editor-configurable sections and app-block surfaces.
- `snippets/`: reusable Liquid fragments such as product cards, prices, badges, media, accordions, and cart items.
- `assets/`: theme CSS, vanilla JavaScript, icons, and original static assets.
- `config/`: `settings_schema.json` and `settings_data.json`; treat merchant configuration carefully.
- `locales/`: translation JSON files for customer-facing strings.
- `.github/`: Dawn repository automation/configuration files imported with the technical base.
- Package files and Shopify CLI store configuration are not currently present; add or document them only when needed.

# Local Development Workflow

1. Work locally only. Never edit the live Shopify theme directly.
2. Use Shopify CLI local development preview:

   ```bash
   shopify theme dev --store [STORE].myshopify.com --open
   ```

3. Use an unpublished theme for persistent previews:

   ```bash
   shopify theme push --unpublished
   ```

4. Run Theme Check before major milestones or before requesting review:

   ```bash
   shopify theme check
   ```

5. Use Git commits before and after significant work once this workspace is initialized as a Git repository.
6. Never run `shopify theme publish` or `theme publish` unless the user explicitly asks.
7. Shopify development themes may expire or be deleted after inactivity; important work must be committed to Git and pushed to an unpublished theme.
8. There are no verified package scripts in this repo today; use direct Shopify CLI commands unless future scripts are added and documented.

# Shopify Theme Engineering Rules

- Preserve Online Store 2.0 customization through Theme Editor sections, blocks, settings, metafields, and metaobjects where appropriate.
- Make merchant-facing content editable; avoid hard-coded products, prices, collection handles, images, menus, links, and business copy unless clearly marked temporary demo content.
- Use Shopify native objects and Liquid filters before custom data plumbing.
- Use `image_url`, responsive widths, `srcset` or equivalent responsive markup, `sizes`, width and height attributes, and lazy loading where appropriate.
- Keep JavaScript modular, small, and written in vanilla JS unless an existing verified theme dependency requires otherwise.
- Avoid unnecessary external dependencies, paid apps, and globally loaded scripts.
- Keep customer-facing content localizable through `locales/` where appropriate.
- Keep product taxonomy configurable for shape, length, finish, style, size guide group, included items, care instructions, and cross-sells.
- Prefer Shopify Search & Discovery-compatible filters and native product recommendations before app-heavy alternatives.

# Required Storefront Capabilities

Implement features in a configurable way through Shopify Theme Editor whenever practical:

- Announcement bar; responsive header, mobile menu, mega menu, search, and responsive footer.
- Homepage hero sections, featured collections, and shop by shape or shop by length modules.
- Product cards with sale and sold-out states; collection filters and sorting compatible with Shopify Search & Discovery.
- Product gallery, variant and size selection, size guide modal or linked page, add to cart, AJAX cart drawer, and free-shipping progress messaging.
- Related products, complementary-product support, FAQ accordions, newsletter form, and mobile-first UX.

# Accessibility and Performance

- Use semantic HTML and one logical `h1` per page.
- Make menus, drawers, modals, variant pickers, accordions, filters, and cart controls keyboard navigable.
- Provide visible focus states and correct labels for forms, buttons, and icon-only controls.
- Give merchants clear alt-text guidance for uploaded product and story images; decorative images may use empty alt text.
- Do not autoplay audio.
- Support reduced motion where animation exists.
- Avoid layout shifts by reserving dimensions for media, drawers, bars, and app blocks.
- Optimize mobile images, defer non-critical JavaScript, and avoid globally loading app scripts unless necessary.
- Avoid fake urgency, fake stock levels, fake reviews, misleading discounts, or deceptive marketing claims.

# E-commerce Safety and Payments

- The theme must not process card data, payment tokens, private payment API keys, or checkout secrets.
- Payment methods must be configured through Shopify Admin and approved payment providers.
- COD, bank transfer, QR payments, gateways, taxes, shipping, inventory, discounts, checkout behavior, and customer accounts belong to Shopify settings or approved apps.
- Never hard-code API secrets, store passwords, customer data, webhooks, payment credentials, or access tokens.
- Use `.env.example` only if an external development tool genuinely requires environment variables.
- Never commit `.env`, tokens, customer data, credentials, private exports, or store backups.

# Change Boundaries

- Avoid unrelated refactors and preserve the existing architecture unless a change is necessary.
- Do not modify `config/settings_data.json` casually because it may contain merchant configuration.
- Do not overwrite theme customizations pulled from Shopify without checking first.
- Do not delete templates, sections, snippets, translations, or assets unless verified unused.
- Do not modify checkout, payments, customer data, or store settings.
- Do not publish themes, install paid apps, or enable third-party services without explicit user approval.
- Do not access private endpoints, admin routes, customer accounts, checkout payment steps, or bypass website security controls.
- Never save copied competitor screenshots, source code, images, videos, product descriptions, reviews, or branded material in this repository.

# Validation Checklist

Before finalizing any task:

1. Inspect relevant existing code or docs before editing.
2. Make the smallest coherent change.
3. Test affected templates and sections in `shopify theme dev` when theme files exist.
4. Run `shopify theme check` when theme files exist.
5. Check desktop and mobile layouts for visual regressions.
6. Test keyboard behavior for any changed interactive component.
7. Test variant selection, add-to-cart, cart drawer, and error states if related.
8. Review the final diff.
9. Confirm no competitor assets, copied text, or external copyrighted URLs were introduced.
10. Report changed files, commands run, validation result, and remaining limitations.

# Documentation Rules

- Major features must include or update relevant documentation in `docs/`.
- Research into competitor functionality must document the public URL inspected, direct observation versus inference, confidence level, functional takeaway, and original implementation decision.
- Do not store copied product descriptions, screenshots, source code, images, videos, reviews, or branded competitor material.
- Keep documentation clear about what was publicly observed, what was inferred, and what remains unknown.

# Agent Response Expectations

Future agents must state what changed, why it changed, files changed, validation performed, known limitations, and assumptions that still need merchant confirmation.
