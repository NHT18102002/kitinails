# ProductSet Import Results

Date: 2026-07-05

## Scope

- Shopify Admin GraphQL API version: `2026-07`
- Import method: `productSet` with `identifier.handle`
- Product visibility: `DRAFT`
- Media source: previously uploaded Shopify Files from `data/catalog/manifests/shopify-files.json`

## Commands executed

```bash
cd tools/catalog-import
npm test
npm run import:dry-run
npm run import:preflight
npm run import:verify-admin-prep
npm run import:verify-product-prep
npm run import:products
npm run import:products -- --retry-failed --concurrency 1
npm run import:products:qa
```

## Result summary

- Raw dry-run requests: `591`
- Unique handles imported: `590`
- Created: `589`
- Updated: `1`
- Failed after final retry: `0`
- QA matched: `590 / 590`

## Notes

- The raw dry-run request set contains one duplicate handle: `ersa-cat-eye-seriesⅱ`.
- Import manifests therefore settle on `590` unique handle records.
- Media reuse was stabilized by stripping mutable file fields from `productSet` file inputs and reusing Shopify file IDs only.
- QA compares DRAFT status, source URL, tags, metafields, media count, variants, and demo inventory quantities.

## Inventory ownership

The source crawl exposes only an availability flag, so the initial product creation
uses demo quantities (`50` for an available source variant and `0` for a sold-out
source variant). Once a product exists, inventory is merchant-managed in Shopify
Admin. Product updates now omit `inventoryQuantities`, which prevents a later
catalog import from replacing an Admin-entered Available quantity. Import QA also
skips quantity comparison for update/adopt records while continuing to verify
quantities for newly created products.

To edit stock, open the product in Shopify Admin, activate the variant at the
intended location (for example, `Shop location`), enable quantity tracking, and
edit the `Available` value. Do not use a catalog re-import as an inventory editor.

## Key manifests

- `data/catalog/manifests/productset-import.json`
- `data/catalog/manifests/productset-import-failures.json`
- `data/catalog/manifests/productset-import-qa.json`
