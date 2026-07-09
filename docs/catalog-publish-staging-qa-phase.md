# Catalog Publish / Staging QA Phase

Date: 2026-07-05

## Purpose

This phase prepares the imported catalog for controlled staging visibility checks after the `productSet` import phase.

It is intentionally non-mutating by default:

- Does not publish products.
- Does not change product status from `DRAFT` to `ACTIVE`.
- Does not publish themes.
- Does not change checkout, payment, customer data, or existing products outside the imported handle set.

## Commands

```bash
cd tools/catalog-import
npm run import:publish:plan
npm run import:publish:products -- --confirm-publish
npm run import:staging:qa
```

Optional target controls:

```bash
npm run import:publish:plan -- --publication-id gid://shopify/Publication/...
npm run import:publish:plan -- --publication-name "Online Store"
npm run import:publish:plan -- --handle fairy-garden
npm run import:publish:plan -- --limit 10
```

## Required Shopify scopes for publish planning

The publish plan needs:

- `read_publications`
- `write_publications`

`read_publications` is required to resolve the Online Store publication and read current publication state.
`write_publications` is required for the later publish mutation phase, but this preparation phase does not call that mutation.

## Reports

- `data/catalog/manifests/catalog-publish-plan.json`
- `data/catalog/manifests/catalog-staging-qa.json`

## Expected flow

1. Confirm import result is clean:
   - `productset-import.json` has `failedCount: 0`.
   - `productset-import-qa.json` has `matched == total`.
2. Run `npm run import:publish:plan`.
3. If blocked by missing scopes, update the custom app scopes and rotate the Admin token.
4. Re-run `npm run import:publish:plan`.
5. After an explicit publish command is approved and executed in a staging/dev store, run `npm run import:staging:qa`.

## Later publish execution requirements

Actual storefront visibility needs both:

- Product status changed from `DRAFT` to `ACTIVE`.
- Product published to the chosen publication, normally Online Store.

The publish execution command is intentionally guarded by `--confirm-publish` and writes:

- `data/catalog/manifests/catalog-publish.json`
- `data/catalog/manifests/catalog-publish-failures.json`

Do not run the publish execution command against production unless the store owner has explicitly approved product visibility for the full imported catalog.
