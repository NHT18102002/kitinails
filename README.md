# Ersa Nails Shopify Theme

Shopify Online Store 2.0 theme for the authorized Ersa Nails storefront rebuild. The theme remains rooted at this repository and uses Shopify Dawn `v15.5.0` as its technical foundation.

## Stack

- Liquid, JSON templates, sections, blocks, and snippets.
- CSS with explicit Foundation, Shell, Component, Feature, and Page owners.
- Lightweight vanilla JavaScript and Dawn-compatible Web Components.
- Shopify CLI and Shopify Theme Check.
- Node's built-in test runner and Playwright as test tooling only; there is no storefront build pipeline.

## Architecture

- `layout/`: global Shopify document wrappers.
- `templates/`: Online Store 2.0 JSON and Liquid template entrypoints.
- `sections/`: public Theme Editor sections and page orchestrators.
- `snippets/`: reusable Liquid primitives with explicit arguments.
- `assets/`: feature-owned CSS, JavaScript, icons, fonts, and media.
- `config/`: Theme Editor schema and merchant settings data.
- `locales/`: customer-facing translations.
- `docs/`: architecture decisions, ownership, research, and validation evidence.
- `tests/`: unit, contract, interaction, accessibility smoke, and visual regression tests.

Canonical architecture references:

- `docs/theme-architecture.md`
- `docs/theme-feature-ownership.md`
- `docs/theme-refactor-log.md`
- `tests/theme/storefront-fixtures.cjs`

The ordered `brand-NN-*` CSS assets are feature-owned cascade slices. Their numeric order is a compatibility contract that preserves the former interleaved brand cascade without retaining a global catch-all stylesheet. Do not reorder or merge them without running the complete visual suite.

## Quality commands

```bash
npm test
npm run check:theme
npm run check:theme:all
npm run test:theme:e2e
npm run report:theme:assets
```

Current architecture checkpoint:

- Theme Check: 0 offenses.
- Unit/contract tests: 13 passing.
- Full Playwright matrix: 162 passing, 78 intentionally skipped by viewport/browser applicability, 0 failing.
- Chromium visual snapshots: 1440, 1024, 768, and 390 px.
- Browser interaction matrix: Chromium and WebKit.

## Local development

```bash
shopify theme dev --store [STORE].myshopify.com
```

For a persistent review URL, push to an unpublished theme only:

```bash
shopify theme push --unpublished --store [STORE].myshopify.com
```

Never run `shopify theme publish` unless the project owner explicitly requests and approves a production rollout.

## Change boundaries

- Preserve public section filenames, setting IDs, block types, template section IDs, URLs, storefront behavior, and merchant configuration unless a migration is explicitly approved.
- Keep Shopify AJAX payloads, cart section IDs, `PUB_SUB_EVENTS.cartUpdate`, and checkout entry flow compatible.
- Do not introduce frontend frameworks, jQuery, paid apps, or a storefront build pipeline without a verified requirement.
- Do not commit `.env`, credentials, customer data, payment data, private exports, or store secrets.
- `tools/product-publisher`, `tools/catalog-import`, catalog data, and Shopify Admin business logic are separate from the root theme architecture.
- Develop and review on local, development, or unpublished themes; do not publish production from routine engineering work.
