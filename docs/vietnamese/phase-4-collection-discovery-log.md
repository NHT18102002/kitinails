# Phase 4 Collection Discovery Log

## 1. Objective

Phase 4 nang cap collection va search discovery experience tren nen Dawn, de storefront co browsing flow ro hon, image-led hon, va an toan hon cho product model press-on nails.

Phase nay giu Dawn-native cho:

- collection grid;
- search page;
- sorting;
- Search & Discovery-compatible filtering;
- native product card sale/sold-out behavior.

Phase nay khong tao Shopify Admin filters, khong tao collections, khong tao products, khong populate metafields, va khong dung competitor assets/copy.

## 2. Files changed

- `assets/custom-theme.css`
- `sections/main-collection-product-grid.liquid`
- `sections/main-search.liquid`
- `snippets/card-product.liquid`
- `templates/collection.json`
- `templates/search.json`
- `docs/vietnamese/phase-4-collection-discovery-log.md`

## 3. Collection improvements

- Collection template default card media ratio duoc doi sang `portrait` de hop hon voi merchandising image-led.
- Collection template default `quick_add` duoc doi sang `standard`, nhung card logic moi se khong ep quick add cho size-dependent nail products.
- Empty collection / zero-result state duoc doi thanh recovery state ro rang hon:
  - giu native empty title;
  - chi hien `Clear all` khi that su dang co filter state;
  - them route quay ve all-products browse path bang CTA `View all`.

## 4. Search improvements

- Search template default card media ratio duoc doi sang `portrait` de giu visual parity voi collection grid.
- Empty search state khong dung paragraph don le nua; no co them recovery CTA `View all`.
- Search zero-result state khi dang co filter state duoc bo sung:
  - `Clear all`;
  - `View all`.

## 5. Filters and sorting

- Dawn facets, sort params, mobile filter drawer va product count van duoc preserve.
- Phase nay khong doi filter source; van phu thuoc Shopify Search & Discovery va merchant-configured filters.
- `Size` van la post-configuration filter, disabled by default theo planning docs.
- Collection page sample preview van hien sort control va mobile filter trigger.
- Search no-result preview khong co filter trigger vi preview hien tai chua co Search & Discovery filters hoac product results de render filter set hop le.

## 6. Product card behavior

### Metadata row

Da them mot metadata row ngan gon, chi render khi du lieu that ton tai:

- uu tien `custom.nail_shape` + `custom.nail_length`;
- neu 2 field tren khong co thi fallback sang `custom.finish_style`.

Rules:

- khong render label rong;
- khong render hon 1 concise metadata row;
- khong dua review/fake badge/claim moi vao card.

### Quick-add safety

Da harden `snippets/card-product.liquid` de tranh quick-add sai cho nail products can chon size:

- Neu product co nhieu variants va co dau hieu la size-dependent (`option` chua tu `size` hoac product type la `Press-on Nail Set`), card se route customer sang PDP bang CTA `Choose options`.
- Neu product an toan de quick-add theo logic Dawn hien co, giu native Dawn quick-add/add-to-cart behavior.
- Sold-out va sale badges cua Dawn van duoc preserve.

## 7. Mobile behavior

- Collection/search van giu 2-column mobile grid.
- Product-card metadata row duoc cho phep wrap tren mobile de tranh bi cat ngang qua muc.
- Empty-state action groups duoc render thanh nut/tap target ro rang.
- Mobile filter drawer Dawn van duoc preserve; phase nay khong them JS moi.

## 8. Styling updates

Cap nhat nho trong `assets/custom-theme.css`:

- card information spacing cho collection/search product cards;
- metadata row styling;
- active facets spacing;
- mobile filter trigger minimum target size;
- empty-state action group layout.

Khong copy competitor spacing values, colors, typography, iconography, hay layout identity.

## 9. Shopify Admin blockers still outside theme scope

Nhung hang muc sau van block full discovery parity du da code-ready:

- Search & Discovery filters chua duoc merchant enable/configure.
- Product metafield values cho `custom.nail_shape`, `custom.nail_length`, `custom.finish_style` chua duoc populate tren catalog that.
- Product types thuc te (`Press-on Nail Set`, `Accessory`, `Bundle`) chua duoc populate day du de quick-add safety heuristic duoc kiem chung tren catalog nail that.
- Collection titles, descriptions, collection images va merchandising rules that chua duoc merchant final.
- Chua co approved accessory/bundle catalog de kiem chung cross-category discovery.

## 10. Validation results

Theme Check:

- Pass
- 170 files inspected
- 8 warnings
- 0 errors
- 8 warnings con lai la warning nen cua Dawn/base theme

Local preview checks da chay:

- Collection preview: `http://127.0.0.1:9293/collections/all`
- Search preview: `http://127.0.0.1:9293/search?q=zzzznotfound`

Desktop collection check:

- `1` main-content `h1`
- sample preview co `13` product cards
- sort control ton tai
- mobile filter trigger hook ton tai trong DOM
- quick-add buttons cua Dawn van render

Mobile collection check (`390x844`):

- `1` main-content `h1`
- product grid van render
- filter trigger ton tai

Desktop search empty-state check:

- `1` main-content `h1`
- no-results copy ton tai
- co recovery CTA `View all`

Mobile search empty-state check (`390x844`):

- `1` main-content `h1`
- no-results copy ton tai
- co recovery CTA `View all`

Console check:

- Khong thay JavaScript error moi do Phase 4 code gay ra.
- Co baseline local preview noise tu Shopify dev environment:
  - CORS error cho `cdn.shopify.com` origin-trials script
  - generic `net::ERR_FAILED`
  - mot `404` resource load trong mot so page loads

## 11. Known limitations

- Chua the xac minh metadata row tren card bang du lieu nail that vi sample catalog hien tai khong co cac metafields `custom.nail_shape`, `custom.nail_length`, `custom.finish_style`.
- Chua the xac minh press-on-nail quick-add redirect-to-PDP tren catalog that cho den khi merchant co products type `Press-on Nail Set` va size variants that.
- Chua the xac minh selected-filter pills va filter-removal flow bang catalog/filter that vi Search & Discovery filters chua duoc cau hinh.
- Search page preview no-result state hien tai khong co sort/filter controls vi khong co ket qua/filter set hop le trong sample preview; day la expected limitation cua du lieu demo hien tai.

## 12. Recommended next step

Phase tiep theo hop ly la Phase 5: product page va fit-confidence flow.
