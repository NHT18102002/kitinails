# Phase 6 Cart and Conversion Log

## 1. Objective

Phase 6 bo sung lop ho tro conversion cho cart trong pham vi an toan tren Dawn:

- giu nguyen cart mechanics cua Dawn;
- them free-shipping progress co the tat mac dinh;
- them cart accessory cross-sell chi khi co du lieu hop le;
- giu cart page fallback hoat dong sach khi JavaScript drawer khong phai la cart mode hien tai.

Phase nay khong sua Shopify Admin data, khong doi `config/settings_data.json`, khong can thiep checkout, payment, shipping rules, Markets, discounts hay app setup.

## 2. Files changed

- `config/settings_schema.json`
- `locales/en.default.json`
- `sections/main-cart-footer.liquid`
- `snippets/cart-drawer.liquid`
- `snippets/free-shipping-progress.liquid`
- `snippets/cart-cross-sells.liquid`
- `assets/custom-theme.css`
- `docs/vietnamese/phase-6-cart-conversion-log.md`

## 3. Dawn behavior intentionally preserved

- Khong rewrite `assets/cart.js`, `assets/cart-drawer.js`, `assets/product-form.js`.
- Khong doi AJAX cart endpoints, quantity update plumbing, remove logic, live regions, checkout button hay checkout route.
- Khong doi `config/settings_data.json`; local preview van giu `cart_type: "notification"`.
- Khong them app, dependency hay custom cart framework.

## 4. Exact implementation introduced

### Optional free-shipping progress

- Them setting `free_shipping_threshold` vao cart settings.
- Setting nay mac dinh `0`, nghia la disabled.
- Range da duoc gioi han `0 -> 500`, step `5`, de tuan thu gioi han Shopify theme schema toi da 101 moc gia tri.
- Snippet `snippets/free-shipping-progress.liquid` chi render khi:
  - threshold > 0;
  - cart dang o cung currency voi `shop.currency`.
- Neu khong dat dieu kien, module an hoan toan.

### Cart accessory cross-sell

- Tao `snippets/cart-cross-sells.liquid`.
- Snippet nay tim dong cart dau tien co `custom.cross_sell_accessories`.
- Chi render toi da 3 product references.
- Neu cart khong co mapping hop le, module an hoan toan.
- Khong hard-code product, khong fake recommendation, khong dung app.

### Cart page and drawer integration

- `sections/main-cart-footer.liquid` render:
  - `free-shipping-progress`
  - `cart-cross-sells`
- `snippets/cart-drawer.liquid` render cung hai snippet tren trong drawer footer cho truong hop merchant chuyen sang drawer mode sau nay.

### Styling

- `assets/custom-theme.css` bo sung style rieng cho:
  - progress block;
  - progress bar;
  - cross-sell card list;
  - image, title, price hierarchy cho accessory links.

## 5. Root-cause correction during this phase

Trong luc bat dau Phase 6, local preview tra `500` cho ca homepage va `/cart`.

Nguyen nhan goc da duoc xac minh:

- `config/settings_schema.json`
- setting `free_shipping_threshold`
- schema `range` ban dau: `min 0`, `max 1000`, `step 5`
- Shopify preview tu choi upload vi range nay co qua 101 steps.

Exact preview error:

`Section 22: setting with id="free_shipping_threshold" step invalid. Range settings must have at most 101 steps`

Fix da ap dung:

- doi `max` tu `1000` thanh `500`
- giu `step: 5`
- preview tro lai `200` ngay sau khi sua schema

## 6. Validation performed

### Theme Check

Command:

```powershell
shopify theme check
```

Result:

- Pass
- `176 files inspected`
- `8 warnings`
- `0 errors`

8 warnings con lai la baseline warnings cua Dawn.

### Local preview recovery

HTTP checks sau khi fix schema:

- `http://127.0.0.1:9293/` -> `200`
- `http://127.0.0.1:9293/cart` -> `200`

### Cart page QA

Da test voi sample product `Selling Plans Ski Wax`:

- add-to-cart thanh cong;
- cart page render 1 line item;
- quantity update `1 -> 2` thanh cong;
- remove line item thanh cong;
- empty cart state quay lai dung;
- `free-shipping-progress` khong render khi threshold mac dinh = `0`;
- `cart-cross-sells` khong render khi cart khong co approved accessory mapping;
- checkout button van ton tai trong DOM.

### Mobile QA

Viewport da test:

- `390x844`

Ket qua:

- cart page render line item dung;
- quantity input ton tai;
- remove control ton tai;
- free-shipping va cross-sell blocks van an khi chua co du lieu;
- checkout button van ton tai trong DOM, du khong nam trong first viewport.

### Console check

Khong thay console error moi do Phase 6 gay ra.

Console noise con lai la preview-environment noise da gap tu cac phase truoc:

- CDN origin-trial CORS error tu `cdn.shopify.com`
- 404 resource trong preview shell
- hot-reload reconnect logs

## 7. Known limitations

- Local preview hien tai dang dung `cart_type: "notification"` trong `config/settings_data.json`, nen cart drawer khong the live-verify bang add-to-cart trong session nay ma khong doi merchant configuration. Drawer snippet da duoc cap nhat, nhung live drawer QA van bi gioi han boi setting hien co.
- Phase nay chu dong khong sua `config/settings_data.json`, de tranh can thiep merchant theme configuration.
- Cart page cua Dawn hien tai van co 2 the `h1` trong DOM (`Your cart` va `Your cart is empty`). Day la van de semantic can xu ly o Phase 7 hardening, khong phai regression moi cua Phase 6.
- Cross-sell se tiep tuc trong cho den khi merchant co accessory product records, SKU, inventory va approved mapping cho `custom.cross_sell_accessories`.
- Free-shipping progress se tiep tuc an cho den khi merchant nhap threshold thuc te khop voi shipping rules trong Shopify Admin.

## 8. Recommended next task

Recommended next task: Phase 7 SEO, accessibility, performance, and UX hardening.

Phase 7 nen uu tien:

- sua cac page-type con h1 semantics chua sach, bao gom cart page;
- audit keyboard/focus tren header, collection filters, PDP va cart surfaces;
- review duplicate CSS/JS va image-loading priorities;
- ghi ro remaining merchant launch blockers cho QA phase cuoi.
