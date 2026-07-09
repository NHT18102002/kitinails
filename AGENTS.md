# Project Purpose

This project is an authorized Shopify Online Store 2.0 rebuild of the Ersa Nails storefront experience.

The project owner confirms that they have full authorization to use, reproduce, adapt, modify, store, and deploy the publicly available visual design, branding, source-level frontend patterns, copy, assets, merchandising structure, user experience, and functional behavior from:

`https://ersanails.com`

The agent may therefore reproduce the public storefront as closely as technically practical, including:

* Layouts and page structure
* Visual identity, colors, typography, spacing, component hierarchy, and animation
* Logos, brand names, product names, collection names, headings, marketing copy, policies, and reviews
* Publicly available images, videos, icons, graphics, banners, and other media
* Public CSS, Liquid-like frontend structures, JavaScript interaction patterns, DOM patterns, and visual component behavior
* Product card design, product page design, collection page design, cart patterns, navigation, footer, newsletter, FAQ, and informational pages
* Campaign concepts, trust badges, promotional messages, product merchandising, and page-level content structure

The goal is not merely to create an inspired storefront. The goal is to achieve the closest practical visual and functional reproduction of the authorized reference storefront while preserving Shopify Online Store 2.0 compatibility.

Authorization applies specifically to the Ersa Nails reference website and project-related assets. Do not treat this authorization as permission to access private systems, private customer data, payment information, hidden admin routes, protected APIs, credentials, or non-public internal resources.

# Design and Implementation Authority

The agent has full technical and design authority to make the changes necessary to achieve the project objective.

The agent may independently:

* Inspect the existing theme structure and technical architecture
* Create, modify, move, rename, replace, refactor, or remove theme files when necessary
* Redesign sections, templates, snippets, CSS, JavaScript, Liquid, JSON templates, theme settings, and page architecture
* Rebuild existing Dawn components when they do not match the authorized reference experience
* Add new reusable components, sections, snippets, settings, blocks, and JavaScript modules
* Replace generic Dawn styling with the authorized Ersa Nails visual system
* Reorganize CSS and JavaScript for maintainability and performance
* Rebuild navigation, mega menus, mobile drawers, announcement bars, cart experiences, product layouts, collection layouts, and homepage modules
* Reuse publicly accessible reference-site assets, copy, layout patterns, CSS patterns, and interaction behavior when needed
* Use the connected browser to inspect public pages, rendered DOM, computed CSS, public scripts, layout dimensions, interactions, and responsive behavior
* Configure content through Shopify Theme Editor, metafields, metaobjects, product data, collections, menus, and Shopify Admin when the authenticated store session permits it

The agent does not need to request confirmation before ordinary design or implementation decisions.

Before deleting or replacing large portions of the theme, inspect dependencies and preserve required Shopify functionality such as product forms, variant logic, cart, search, collection filtering, customer account entry points, and checkout entry flow.

# Technology Stack

* Target platform: Shopify Online Store 2.0
* Core technologies: Liquid, JSON templates, Shopify sections and blocks, snippets, CSS, and lightweight vanilla JavaScript
* Expected workflow tools: Shopify CLI, Shopify Theme Check, Chrome browser inspection, and Git
* Current repository state: this workspace uses official Shopify Dawn `v15.5.0` as the technical base, commit `83d5e6b4094d8019820bffafe04b242d0602ffe2`
* Project documentation is preserved under `docs/`
* Do not claim or add a Node build pipeline, jQuery, frameworks, app dependencies, or package scripts unless the repository later verifies them
* Dawn is the technical base only; the agent may substantially redesign or replace its visual components to match the authorized reference storefront

# Repository Map

* `docs/`: English research, rebuild, UX, SEO, accessibility, performance, feature, URL, and technology evidence
* `docs/vietnamese/`: Vietnamese versions of project research documents
* `layout/`: global Shopify theme wrappers such as `theme.liquid` and `password.liquid`
* `templates/`: JSON and Liquid templates for index, product, collection, page, blog, article, search, cart, policy, and customer pages
* `templates/customers/`: customer account templates if the theme uses classic customer accounts
* `sections/`: Theme Editor-configurable sections and app-block surfaces
* `snippets/`: reusable Liquid fragments such as product cards, prices, badges, media, accordions, and cart items
* `assets/`: theme CSS, vanilla JavaScript, icons, fonts, images, videos, and static assets
* `public/`: project-provided media assets when present
* `config/`: `settings_schema.json` and `settings_data.json`
* `locales/`: translation JSON files for customer-facing strings
* `.github/`: Dawn repository automation and configuration files imported with the technical base

# Authorized Reference Materials

The agent may inspect and reuse publicly accessible content from the authorized reference website, including:

* Public HTML structure
* Public CSS rules and computed styles
* Public JavaScript behavior and interaction patterns
* Publicly loaded images, videos, fonts, icons, logos, graphics, and media
* Public page copy, product descriptions, promotional content, policy copy, reviews, and navigation labels
* Public responsive behavior at desktop, tablet, and mobile breakpoints
* Public cart, search, collection, product, and menu behavior

When reproducing assets or content from the reference website:

* Preserve the visual and functional result as closely as practical
* Prefer downloading or storing authorized assets locally in `assets/` or `public/` when appropriate
* Use Shopify image pickers, product pickers, collection pickers, blocks, metafields, or metaobjects where merchant editing is useful
* Do not rely on fragile remote hotlinks when a local authorized asset can be stored in the project
* Do not use screenshots as a substitute for real HTML, Liquid, CSS, JavaScript, or responsive components unless a screenshot itself is intentionally used as an approved image asset

# Local Development Workflow

1. Work locally first whenever practical.

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

5. Use Git commits before and after significant work once the workspace is initialized as a Git repository.

6. Never run `shopify theme publish` or `theme publish` unless the user explicitly asks.

7. Shopify development themes may expire or be deleted after inactivity; important work must be committed to Git and pushed to an unpublished theme.

8. There are no verified package scripts in this repository today; use direct Shopify CLI commands unless future scripts are added and documented.

9. Use browser inspection against both the reference site and the local preview for visual QA.

10. For each major page, compare at minimum:

* 1440px desktop
* 1024px laptop
* 768px tablet
* 390px mobile

# Shopify Theme Engineering Rules

* Preserve Online Store 2.0 customization through Theme Editor sections, blocks, settings, metafields, and metaobjects where appropriate.
* Reproduce authorized reference content and design faithfully when that is the project requirement.
* Use Shopify native objects and Liquid filters before introducing custom data plumbing.
* Use `image_url`, responsive widths, `srcset` or equivalent responsive markup, `sizes`, width and height attributes, and lazy loading where appropriate.
* Keep JavaScript modular, small, and written in vanilla JavaScript unless an existing verified theme dependency requires otherwise.
* Avoid unnecessary external dependencies, paid apps, and globally loaded scripts.
* Keep customer-facing content localizable through `locales/` where appropriate.
* Keep product taxonomy configurable for shape, length, finish, style, size guide group, included items, care instructions, and cross-sells.
* Prefer Shopify Search & Discovery-compatible filters and native product recommendations before app-heavy alternatives.
* Reuse existing Dawn components when they can be adapted efficiently; replace them when they prevent close visual or functional matching.

# Required Storefront Capabilities

Implement the following in a configurable Shopify-native way whenever practical:

* Announcement bar, responsive header, mobile menu, mega menu, search, responsive footer
* Homepage hero sections, featured collections, and shop-by-shape or shop-by-length modules
* Product cards with sale and sold-out states
* Collection filters and sorting compatible with Shopify Search & Discovery
* Product gallery, variant and size selection, size guide modal or linked page, add to cart, AJAX cart drawer, and free-shipping progress messaging
* Related products, complementary-product support, FAQ accordions, newsletter form, and mobile-first UX
* Sticky header, collection toolbar, mobile filter drawer, product accordions, responsive product gallery, and cart interactions matching the authorized reference where applicable
* Any additional public feature observed on the authorized reference storefront that improves visual or functional fidelity

# Accessibility and Performance

* Use semantic HTML and one logical `h1` per page.
* Make menus, drawers, modals, variant pickers, accordions, filters, and cart controls keyboard navigable.
* Provide visible focus states and correct labels for forms, buttons, and icon-only controls.
* Give merchants clear alt-text guidance for uploaded product and story images; decorative images may use empty alt text.
* Do not autoplay audio.
* Support reduced motion where animation exists.
* Avoid layout shifts by reserving dimensions for media, drawers, bars, and app blocks.
* Optimize mobile images, defer non-critical JavaScript, and avoid globally loading app scripts unless necessary.
* Preserve the authorized reference visual style while avoiding deceptive behavior such as fake stock levels, fake urgency, or fabricated reviews not supplied through approved store content.

# E-commerce Safety and Payments

* The theme must not process card data, payment tokens, private payment API keys, or checkout secrets.
* Payment methods must be configured through Shopify Admin and approved payment providers.
* COD, bank transfer, QR payments, gateways, taxes, shipping, inventory, discounts, checkout behavior, and customer accounts belong to Shopify settings or approved apps.
* Never hard-code API secrets, store passwords, customer data, webhooks, payment credentials, or access tokens.
* Use `.env.example` only if an external development tool genuinely requires environment variables.
* Never commit `.env`, tokens, customer data, credentials, private exports, or store backups.
* Never bypass Shopify security controls, payment protections, customer authentication, or checkout restrictions.

# Change Boundaries

* The agent may make broad design and implementation changes when needed to match the authorized reference storefront.

* The agent may modify `layout/`, `sections/`, `snippets/`, `templates/`, `assets/`, `config/`, and `locales/` when required.

* The agent may modify `config/settings_data.json` when necessary for preview configuration, but must inspect and preserve merchant-specific settings where possible.

* The agent may redesign or replace Dawn components that do not meet the project objective.

* Do not delete templates, sections, snippets, translations, or assets unless they are verified unused or replaced by a working equivalent.

* Do not modify checkout internals, payment configuration, customer data, store credentials, or private store settings.

* Do not publish themes, install paid apps, or enable third-party services unless the user explicitly asks.

* Do not access private endpoints, private customer accounts, payment steps, protected admin resources without an authenticated and authorized store session, or bypass website security controls.

* Do not run destructive Git commands that can erase uncommitted user changes, including:

  ```bash
  git reset
  git restore
  git checkout --
  ```

* If unrelated changes are discovered, report them before modifying or removing them.

# Validation Checklist

Before finalizing any task:

1. Inspect relevant existing code and docs before editing.
2. Make the smallest coherent change that achieves the required visual or functional result, unless a larger refactor is necessary.
3. Test affected templates and sections in `shopify theme dev` when theme files exist.
4. Run `shopify theme check` when theme files exist.
5. Compare the local result with the authorized reference website at desktop and mobile breakpoints.
6. Test keyboard behavior for any changed interactive component.
7. Test variant selection, add-to-cart, cart drawer, cart errors, and sold-out states if related.
8. Review the final diff.
9. Confirm that no credentials, customer data, payment data, or private Shopify information were introduced.
10. Confirm that reproduced reference assets or content are within the project owner's stated authorization.
11. Report changed files, commands run, validation result, known limitations, and remaining assumptions.

# Documentation Rules

* Major features must include or update relevant documentation in `docs/`.
* Research into the authorized reference storefront must document:

  * Public URL inspected
  * Direct observation versus inference
  * Responsive viewport checked
  * Confidence level
  * Functional takeaway
  * Implementation decision
* Authorized reference screenshots, source excerpts, assets, copy, images, videos, reviews, and branded material may be stored in the repository when needed for the authorized rebuild.
* Do not store credentials, customer data, payment data, private exports, private APIs, hidden admin content, or security-sensitive information.
* Keep documentation clear about what was publicly observed, what was inferred, and what remains unknown.

# Agent Response Expectations

Future agents must clearly state:

* What changed
* Why it changed
* Which reference page or behavior was used
* Files created, modified, moved, or removed
* Assets copied or reused under authorization
* Validation performed
* Responsive viewports checked
* Functional tests performed
* Known limitations
* Assumptions that still need merchant confirmation

The agent should proceed autonomously through implementation milestones and only pause when blocked by missing access, unavailable store data, missing assets, or an issue that requires explicit merchant approval.
