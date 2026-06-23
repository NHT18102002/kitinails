# Phase 2 Global Shell Log

## 1. Objective

Phase 2 trien khai lop global storefront shell goc tren Dawn cho storefront press-on nails, dua tren clean-room UX map cua Phase 1B. Muc tieu la lam header, navigation, search, cart access, mobile drawer, announcement bar va footer ro hon, de browse hon, van giu Dawn-native, Theme Editor friendly, responsive va accessible.

Phase nay khong sua product form logic, cart AJAX logic, product templates, collection templates, homepage templates, Shopify Admin data, Markets, shipping, payment hoac app configuration.

## 2. Files changed

- `assets/custom-theme.css`
- `sections/announcement-bar.liquid`
- `sections/header.liquid`
- `sections/cart-icon-bubble.liquid`
- `snippets/header-mega-menu.liquid`
- `snippets/header-dropdown-menu.liquid`
- `snippets/header-drawer.liquid`
- `snippets/header-search.liquid`
- `docs/vietnamese/phase-2-global-shell-log.md`

Khong can sua:

- `sections/footer.liquid`
- `sections/predictive-search.liquid`
- locale files

Footer va predictive search van duoc reuse nguyen markup Dawn; phase nay chinh chu yeu bang Liquid shell updates o header/menu/drawer va CSS trong `custom-theme.css`.

## 3. Dawn components reused

- `sections/announcement-bar.liquid` lam nen cho utility/announcement layer.
- `sections/header.liquid` lam header shell, logo, account, localization, search/cart hooks.
- `snippets/header-mega-menu.liquid` va `snippets/header-dropdown-menu.liquid` lam desktop navigation surface.
- `snippets/header-drawer.liquid` lam mobile drawer va nested navigation behavior.
- `snippets/header-search.liquid` va `sections/predictive-search.liquid` cho search modal va predictive search.
- `sections/cart-icon-bubble.liquid` va Dawn cart route/count behavior cho cart access.
- `sections/footer.liquid` cho footer, newsletter, support/policy surfaces va localization hooks.
- Dawn JS co san trong `assets/global.js`, `assets/cart-drawer.js`, `assets/search-form.js`, `assets/details-disclosure.js` duoc giu nguyen.

## 4. Dawn components extended

- Announcement bar: bo multi-slide/ticker style rendering, giu 1 announcement ro rang tai mot thoi diem.
- Announcement bar schema: gioi han 1 block va bo carousel auto-rotate controls khong con phu hop voi Phase 2 scope.
- Header: them shell wrappers va utility labels ro hon cho search/cart tren desktop.
- Mega menu/dropdown: bo sung parent landing link ben trong expanded menu de browse path ro hon ma van dung Shopify Navigation.
- Mobile drawer: bo sung search/cart utility links, parent landing links trong submenu, va localization condition theo section settings.
- Localization defaults: doi schema defaults cua header/footer country-language selector ve `false` de storefront moi khong tu dong hien selector khi merchant chua san sang Markets.
- Cart icon bubble: bo sung visible cart label tren desktop de tang clarity.
- `assets/custom-theme.css`: them shell styling cho announcement/header/menu/search/drawer/footer, nhung van dua tren Dawn variables va color schemes.

## 5. Theme Editor controls preserved or added

Theme Editor controls duoc giu nguyen:

- Header logo position, mobile logo position, sticky header, menu source, menu type, color scheme, localization toggles, customer avatar.
- Announcement bar text/link block, social toggle, localization toggles.
- Footer newsletter toggle, newsletter heading, social toggle, localization toggles, payment toggle, policy toggle, spacing controls.

Dieu chinh co chu dich:

- Bo announcement carousel controls cu (`auto_rotate`, `change_slides_speed`) vi shell moi chi ho tro 1 clear announcement tai mot thoi diem.
- Header/footer localization toggles van duoc giu, nhung default moi la `false` de tranh force visibility trong stores chua ready cho Markets.

Khong them setting moi, khong doi `settings_data.json`, khong doi global settings schema.

## 6. Desktop behavior implemented

- Announcement bar hien thi 1 thong diep ro rang, merchant-editable, khong auto-rotate, khong ticker.
- Header shell trong gon hon, utility icons ro hon va co text label cho search/cart tren desktop.
- Desktop nav duoc bo sung parent landing link ben trong dropdown/mega menu khi menu item co child links.
- Search modal van reuse Dawn behavior, nhung shell va predictive container duoc polish bang custom CSS.
- Cart access van di den native cart route/count behavior; visual hierarchy ro hon.
- Footer giu newsletter, policy va localization handoff cua Dawn nhung co rhythm va spacing ro hon qua custom CSS.

## 7. Mobile behavior implemented

- Mobile header giu menu/search/cart triggers ro rang, nhung khong lo text label desktop ra mobile.
- Mobile drawer van dung Dawn drawer mechanics, nested submenu va Escape behavior.
- Drawer bo sung utility links cho Search va Cart, giup khong phu thuoc vao icon-only access.
- Drawer submenu co them parent landing link khi menu item co child links.
- Localization trong mobile drawer chi hien thi khi section settings cho phep va Shopify localization thuc su co hon 1 option.

## 8. Accessibility validation

Da verify truc tiep tren local preview:

- Search modal mo duoc va dong bang `Escape` tren local preview.
- Mobile drawer mo duoc va dong bang `Escape` tren local preview.
- Search/cart labels tren desktop ton tai va bi an tren mobile dung breakpoint.
- Dawn focus-visible foundation tu Phase 1A van duoc giu cho link, button, summary, input, select, quantity va localization controls.
- Footer policy links, desktop nav links, mobile drawer utility links va cart route van ton tai va resolve dung URL.

Da verify gian tiep qua code path va unchanged Dawn behavior:

- Header, mega menu, dropdown va mobile drawer van dung Dawn disclosure/drawer JavaScript goc; phase nay khong thay JS behavior, chi them Liquid structure va CSS shell.
- Footer empty-tolerant behavior van dua tren Dawn conditionals co san vi `sections/footer.liquid` khong bi sua.

Keyboard-only validation gap con lai:

- Preview hien tai chi co menu don gian `Home / Catalog / Contact`, nen khong the xac minh bang live keyboard mot nested mega-menu/dropdown thuc su cho den khi merchant/Admin co menu co child links.
- Announcement bar hien tai khong co link, nen khong the xac minh keyboard activation cho announcement link cho den khi merchant them URL.
- Browser automation tren local preview khong kich hoat on dinh `Enter`/`Space` cho mot so Dawn shell controls, nen desktop keyboard proof duoc bo sung bang click + state verification va `Escape` close verification.

## 9. Theme Check result

Command:

```powershell
shopify theme check
```

Ket qua:

- Pass.
- 169 files inspected.
- 8 warnings.
- 0 errors.

Tat ca warnings con lai la Dawn baseline da ton tai truoc phase nay, khong phai regression moi cua Phase 2.

## 10. Local preview result

Preview duoc kiem tra tren local Shopify dev server:

- `http://127.0.0.1:9292`

Desktop/local shell checks:

- `custom-theme.css` van chi load 1 lan.
- Header, nav, search, cart va footer deu render.
- Search modal mo duoc va dong bang `Escape`.
- Catalog nav link, cart link va footer privacy-policy link deu resolve dung route local.
- Console error do phase nay gay ra: khong thay.

Mobile/local shell checks:

- Menu trigger, search trigger va cart access deu ton tai.
- Drawer mo duoc, utility links `Search` va `Cart` hien thi.
- Drawer dong bang `Escape`.
- Text label desktop cho search/cart duoc an dung tren mobile.
- Console error do phase nay gay ra: khong thay.

## 11. Known limitations caused by missing logo, menus, markets, policies, or product data

- Final brand name, logo, palette va typography chua duoc merchant chot, nen shell van o huong neutral.
- Preview hien tai chua co nested navigation structure thuc su, nen mega-menu/dropdown live QA con bi gioi han boi du lieu menu demo.
- Announcement link chua duoc merchant cau hinh trong preview hien tai.
- Footer support IA day du con phu thuoc merchant menus, policy pages va guide pages.
- Localization hooks van hien thi vi preview store da co localization data; viec enable Markets thuc su van bi block cho den khi merchant chot enabled countries/regions va readiness.
- Product data, taxonomy collections, accessory SKUs va bundle catalog chua duoc populate, nen shell phase nay chi kiem tra duong vao browse, khong kiem tra merchandising sau.

## 12. Recommended next step: Phase 3 homepage composition

Recommended next step la Phase 3 homepage composition.

Phase 3 nen dung shell moi nay lam khung, roi trien khai:

- hero goc cho category,
- featured collection blocks,
- shop-by-shape,
- shop-by-length,
- trust/support modules,
- accessory/bundle merchandising chi khi catalog du lieu da san sang.
