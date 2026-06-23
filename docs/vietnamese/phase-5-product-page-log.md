# Phase 5 Product Page Log

## 1. Objective

Phase 5 nang cap product page theo huong fit-confidence cho storefront press-on nails, nhung van giu Dawn-native cho:

- media gallery;
- variant picker;
- quantity;
- add-to-cart behavior;
- AJAX integration;
- related products.

Phase nay khong invent product claims, khong populate metafields, khong tao Shopify Admin data, va khong thay doi checkout/payment/shipping logic.

## 2. Files changed

- `assets/custom-theme.css`
- `locales/en.default.json`
- `sections/main-product.liquid`
- `templates/product.json`
- `snippets/product-facts.liquid`
- `snippets/product-size-guide.liquid`
- `snippets/product-support-accordions.liquid`
- `snippets/product-cross-sells.liquid`
- `docs/vietnamese/phase-5-product-page-log.md`

## 3. Purchase hierarchy improvements

Da bo sung hoac clarify cac lop sau tren PDP:

1. Product title van la native `h1`.
2. Review slot an toan duoc dua vao template qua block `rating`, nhung chi render khi provider/data that ton tai.
3. Price, sale state va native payment terms cua Dawn van duoc preserve.
4. Product facts co dieu kien duoc render ngay sau price khi co du lieu that.
5. Variant picker size van la native Dawn.
6. Size-guide trigger duoc render sat variant picker khi `custom.size_guide_group` co valid reference.
7. Quantity va buy buttons van giu native Dawn.
8. Support accordions va accessory cross-sells chi render khi du lieu that ton tai.

## 4. Product facts

Them snippet:

- `snippets/product-facts.liquid`

Behavior:

- chi render khi co it nhat mot trong cac field:
  - `custom.nail_shape`
  - `custom.nail_length`
  - `custom.finish_style`
- render duoi dang facts list gon;
- khong render facts rong;
- khong hien review/claim/badge gia.

## 5. Size guide experience

Them snippet:

- `snippets/product-size-guide.liquid`

Behavior:

- doc `custom.size_guide_group`;
- neu co valid `size_guide` reference:
  - render trigger `Size guide`;
  - mo modal dua tren Dawn `modal-opener` / `modal-dialog`;
  - modal render title, measurement unit, rich text content, va measuring instructions khi co;
  - Escape va focus handling dua tren Dawn modal behavior.
- neu khong co valid reference:
  - khong render trigger;
  - khong render modal rong.

## 6. Support accordions

Them snippet:

- `snippets/product-support-accordions.liquid`

Behavior:

- `custom.whats_included`:
  - render accordion `What's included`;
  - moi item la mot bullet item.
- `custom.application_instructions`:
  - render accordion theo metaobject `application_guide`;
  - support `method_label`, `steps`, `timing_notes`, `safety_notes`.
- `custom.care_instructions`:
  - render accordion theo metaobject `care_guide`;
  - support `care_steps`, `removal_steps`, `storage_reuse_notes`, `warning_notes`.

Rules:

- khong render accordion rong;
- khong hard-code policy/support claims;
- dung Dawn `details/summary` accordion pattern.

## 7. Cross-sell accessories

Them snippet:

- `snippets/product-cross-sells.liquid`

Behavior:

- chi render khi `custom.cross_sell_accessories` co valid product references;
- gioi han toi da 4 accessory cards;
- reuse `card-product`;
- quick-add safety van dua tren card logic da them o Phase 4.

Neu khong co product references hop le, module khong render.

## 8. Related products

- Native `sections/related-products.liquid` van duoc preserve.
- `templates/product.json` doi related-products image ratio sang `portrait` de dong bo hon voi discovery surfaces.

## 9. Locale additions

Da them locale keys moi trong `locales/en.default.json` cho:

- `products.product.product_facts`
- `products.product.shape`
- `products.product.length`
- `products.product.finish`
- `products.product.size_guide`
- `products.product.whats_included`
- `products.product.application`
- `products.product.care_and_removal`
- `products.product.recommended_accessories`

## 10. Validation results

Theme Check:

- Pass
- 174 files inspected
- 8 warnings
- 0 errors
- 8 warnings con lai la warning nen cua Dawn/base theme

Local preview checked:

- PDP sample: `http://127.0.0.1:9293/products/gift-card`

Desktop PDP check:

- `1` main-content `h1`
- review slot hien tai render `0` item vi sample product khong co provider/data that
- product facts render `0` item vi sample product khong co approved custom metafields
- size-guide trigger render `0` item vi sample product khong co `custom.size_guide_group`
- support accordions render `0` item vi sample product khong co approved metafield/metaobject references
- cross-sell accessory cards render `0` item vi sample product khong co `custom.cross_sell_accessories`
- native buy button van render
- related products section van render

Mobile PDP check (`390x844`):

- `1` main-content `h1`
- khong co section rong tu snippets moi
- khong co cross-sell/facts/guide shells rong

Console check:

- Khong thay JavaScript error moi do Phase 5 code gay ra.
- Co baseline preview noise:
  - CORS error cho `cdn.shopify.com` origin-trials script
  - generic `net::ERR_FAILED`
  - mot `404` resource load trong mot so page loads

## 11. Merchant-data blockers for full Phase 5 proof

- Chua co products `Press-on Nail Set` that tren preview de verify size-first purchase flow.
- Chua co `custom.nail_shape`, `custom.nail_length`, `custom.finish_style` values that de verify product facts.
- Chua co `custom.size_guide_group` reference va `size_guide` entries that de verify modal content.
- Chua co `custom.whats_included` list values that de verify bullet rendering.
- Chua co `application_guide` / `care_guide` entries that de verify accordion content.
- Chua co `custom.cross_sell_accessories` refs that de verify accessory strip.
- Chua co review provider/data that de verify rating slot behavior.

## 12. Recommended next step

Phase tiep theo hop ly la Phase 6: cart va conversion flow.
