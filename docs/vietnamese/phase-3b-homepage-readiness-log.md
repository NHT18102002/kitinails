# Phase 3B Homepage Readiness Log

## 1. Objective

Phase 3B chot readiness cho homepage sau Phase 3A va Phase 3A.1, de merchant co the populate homepage sau nay ma khong bi placeholder commerce sai ngu canh, khong bi fake product cards, va khong can sua theme code them cho cac buoc populate co ban.

Phase nay khong tao Shopify products, collections, menus, media uploads, Shopify Admin data, hay Theme Editor content trong store. Muc tieu chi la:

- xac nhan module nao da code-ready;
- lam module collection-led an toan hon khi collection chua duoc chon hoac dang rong;
- giu homepage merchant-editable;
- ghi ro cac dependency con thieu truoc khi bat tung module.

## 2. Files changed

- `sections/featured-collection.liquid`
- `docs/vietnamese/phase-3b-homepage-readiness-log.md`

Khong can sua:

- `templates/index.json`
- `sections/browse-collections.liquid`
- `sections/image-banner.liquid`
- `sections/multicolumn.liquid`
- `sections/newsletter.liquid`

## 3. What changed in code

### `sections/featured-collection.liquid`

Da bo hanh vi Dawn onboarding placeholder cards tren storefront thuong khi:

- collection chua duoc chon; hoac
- collection da duoc chon nhung chua co product.

Behavior moi:

- Neu co collection va collection co product that: section render binh thuong.
- Neu section dang o Theme Editor nhung collection chua duoc chon hoac collection dang rong: section hien note huong dan merchant cau hinh, khong hien fake product cards.
- Neu storefront thuong gap section blank/empty: section tu an, khong render misleading placeholders.

Patch nay giup homepage an toan hon ngay ca khi merchant bat section som hon luc du lieu that san sang.

## 4. Code-ready homepage modules

| Module | Trang thai code-ready | Safe khi data chua co? | Merchant can cau hinh sau trong Theme Editor? | Ghi chu |
| --- | --- | --- | --- | --- |
| Hero | Yes | Yes | Yes | Dang active voi copy trung tinh; cho media, heading va CTA goc. |
| Featured products | Yes | Yes | Yes | Dang `disabled` trong `templates/index.json`; neu merchant bat som khi collection blank/empty thi section nay gio se tu an tren storefront. |
| Browse by shape | Yes | Yes | Yes | Chi nen bat sau khi da gan 2-6 collection tiles hop le. |
| Browse by length | Yes | Yes | Yes | Chi nen bat sau khi da gan 2-6 collection tiles hop le. |
| Trust / education | Yes | Yes | Yes | Dang `disabled`; baseline copy trung tinh, khong co claim gia. |
| Accessories / curated bundles | Yes | Yes | Yes | Dang `disabled`; can collection that va inventory that truoc khi bat. |
| Newsletter | Yes | Yes | Yes | Dang active, form Dawn native, copy trung tinh. |

## 5. Merchant configuration dependencies by module

### Hero

Can merchant cung cap:

- anh hero goc co quyen su dung;
- heading goc;
- supporting copy goc;
- CTA direction ro rang.

### Featured products

Can merchant cung cap:

- mot Shopify collection that co product that;
- title section cuoi cung neu muon doi;
- quyet dinh co hien `View all` hay khong.

Khong nen enable section neu collection chua duoc chon.

### Browse by shape

Can merchant cung cap:

- 2-6 shape collections that;
- ten tile cuoi cung neu muon override;
- tile media goc, hoac chap nhan dung collection image;
- short supporting text neu can.

Khong nen bat section voi it hon 2 tiles hop le.

### Browse by length

Can merchant cung cap:

- 2-6 length collections that;
- ten tile cuoi cung neu muon override;
- tile media goc, hoac chap nhan dung collection image;
- short supporting text neu can.

Khong nen bat section voi it hon 2 tiles hop le.

### Trust / education

Can merchant cung cap:

- approved content cho size, application, care, support;
- links that neu co route support/page that;
- xac nhan claim nao duoc phep hien thi.

### Accessories / curated bundles

Can merchant cung cap:

- accessory hoac curated bundle collection that;
- product records, SKU, inventory va pricing that;
- title/copy section cuoi cung.

### Newsletter

Can merchant cung cap neu muon tinh chinh:

- final newsletter heading;
- final supporting copy;
- any approved incentive copy, neu co.

## 6. Exact next setup steps inside Theme Editor

Thu tu an toan de populate homepage:

1. Mo homepage trong Theme Editor.
2. Cap nhat hero:
   - chon media goc;
   - cap nhat heading;
   - cap nhat supporting text;
   - cap nhat CTA.
3. Featured products:
   - chon collection that truoc;
   - kiem tra collection da co product that;
   - sau do moi enable section.
4. Browse by shape:
   - them 2-6 blocks;
   - gan collection cho tung block;
   - them image/title/text override neu can;
   - sau do moi enable section.
5. Browse by length:
   - them 2-6 blocks;
   - gan collection cho tung block;
   - them image/title/text override neu can;
   - sau do moi enable section.
6. Trust / education:
   - thay baseline text bang approved content;
   - them links that neu co;
   - sau do moi enable section.
7. Accessories / curated bundles:
   - chon collection that truoc;
   - xac nhan products trong collection da san sang;
   - sau do moi enable section.
8. Newsletter:
   - giu nguyen hoac tinh chinh heading/copy;
   - verify form layout tren desktop va mobile.

## 7. Validation completed for Phase 3B

Da verify qua code:

- `templates/index.json` van giu cac section data-dependent o trang thai `disabled` mac dinh.
- `sections/browse-collections.liquid` van chi render storefront binh thuong khi co tu 2 tile hop le tro len, va schema van gioi han toi da 6 blocks.
- `sections/featured-collection.liquid` da duoc harden de khong hien fake product cards khi collection blank/empty.

Validation command da chay cho phase nay:

```powershell
shopify theme check
```

Theme Check result:

- Pass
- 170 files inspected
- 8 warnings
- 0 errors
- 8 warnings con lai la warning nen da ton tai tu Dawn/base theme, khong phai regression moi cua Phase 3B

Preview/local checks muc tieu cho phase nay:

- homepage van render;
- hero va newsletter van la 2 module active an toan;
- featured collection module khong con phat placeholder cards tren storefront neu collection blank/empty;
- browse modules van la collection-led va merchant-editable;
- khong thay competitor assets, copied copy, hay hard-coded catalog du lieu.

Local preview verification:

- `http://127.0.0.1:9293/` tra ve HTTP `200`.
- Homepage HTML hien tai co dung `1` the `h1`.
- Hero heading van render dung trong main content.
- Homepage HTML hien tai khong chua `product-apparel-` placeholder string.

Headless browser spot-check:

- Desktop: `1` `h1`, `0` `header h1`, co hero CTA, co header logo link.
- Mobile `390x844`: van co `1` `h1`, menu trigger ton tai, hero CTA ton tai.

Console check:

- Khong thay JavaScript error moi do patch Phase 3B gay ra.
- Co 2 noise baseline cua local preview environment: mot CORS error tu `cdn.shopify.com` origin-trials script va mot `404` resource load, can xem la preview/dev noise cho den khi co bang chung khac.

## 8. Known limitations still blocked by merchant data

- Chua co final brand media, logo, palette, typography va hero image goc.
- Chua co featured products collection that de bat module featured products.
- Chua co shape collections that va length collections that de bat 2 browse modules.
- Chua co approved education/trust copy cuoi cung.
- Chua co accessories hoac curated bundle collection that.
- Chua co final newsletter positioning/copy neu merchant muon chuyen doi cao hon.

## 9. Recommended next coding task

Phase tiep theo hop ly la Phase 4: collection, search, sorting, filters, va product-card discovery experience.
