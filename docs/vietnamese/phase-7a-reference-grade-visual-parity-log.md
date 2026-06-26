# Phase 7A Reference-Grade Visual Parity Log

## 1. Viewports reviewed

Phase 7A duoc review tren cac viewport sau:

- Desktop: `1440x900`
- Laptop: `1024x768`
- Tablet: `768x1024`
- Mobile: `390x844`

Surface da duoc kiem tra tren local preview:

- homepage
- collection
- search results
- empty search
- product page
- cart page
- desktop search modal
- mobile drawer
- mobile filter trigger

## 2. Screenshot reference review

Nguon clean-room duoc dung trong phase nay:

- `public/image-website/screencapture-ersanails-homepage.png`
- `public/image-website/screencapture-ersanails-collections-classy-nails.png`
- `image-4.png` cho homepage merchandising rhythm
- `image-3.png` cho collection density va filter placement
- `image-5.png` cho PDP buy-box grouping va media-led hierarchy
- `image-6.png` cho cart drawer hierarchy va checkout emphasis

Tat ca reference chi duoc dung de hoc:

- hierarchy
- density
- component placement
- CTA priority
- image-to-copy balance
- collection/search/filter rhythm
- PDP buy sequence
- cart summary emphasis

Khong copy text, media, colors, exact spacing, reviews, claims, hay brand identity.

## 3. UI issues found before correction

Truoc Phase 7A pass, storefront van con mot so dau hieu Dawn-default:

- header va utility bar qua nhe, chua du compact commerce shell;
- homepage hero va ben duoi hero chua cho cam giac merchandised;
- collection/search dung filter bar ngang va spacing rong, chua giong primary shopping destination;
- product cards chua du image-led va chua du tight o collection/search;
- collection hero chua dung duoc product-led image fallback khi collection image trong;
- PDP van con vendor block va dynamic checkout lam loang decision flow;
- cart shell chua nhan manh checkout summary du muc;
- mot so focus/open-close checks can duoc verify lai bang browser automation thay vi chi suy tu code.

## 4. Files changed

- `.gitignore`
- `assets/custom-theme.css`
- `sections/image-banner.liquid`
- `sections/main-collection-banner.liquid`
- `snippets/card-product.liquid`
- `snippets/facets.liquid`
- `templates/collection.json`
- `templates/index.json`
- `templates/product.json`
- `templates/search.json`
- `docs/vietnamese/phase-7a-reference-grade-visual-parity-log.md`

## 5. Global visual changes

- Utility bar duoc chuyen sang shell toi hon va compact hon de tach ro utility layer voi header.
- Header shell duoc lam gon, logo area hop ly hon, localization pill ro hon, icon cluster sach hon.
- Border, radius, shadow va spacing duoc dong bo bang `custom-theme.css` thay vi copy Dawn styles.
- Footer duoc giu dark shell, newsletter card va payment row ro hon tren desktop va mobile.
- Focus foundation van giu tu Phase 1A, va duoc verify lai tren CTA/home va card link.

## 6. Header and navigation changes

- An search/cart label thua tren icon desktop de shell sach hon.
- Localization control duoc style lai thanh utility pill.
- Drawer spacing, utility links va close/open rhythm duoc giu gon.
- Search modal van dung Dawn mechanics; QA da xac nhan mo duoc va dong bang `Escape`.
- Mobile drawer van dung Dawn mechanics; QA da xac nhan mo duoc va dong bang `Escape`.

## 7. Homepage changes

- Hero giu text-box ro rang, CTA contrast cao, va hero crop image-led hon tren catalog hien tai.
- `featured_products` duoc bat lai tren homepage de trang khong con qua trong va co browse path som hon.
- `education` duoc bat lai voi neutral support copy de homepage co mid-page confidence layer ma van khong invent claim.
- Hero fallback markup trong `sections/image-banner.liquid` duoc mo rong de ho tro product-collage fallback khi homepage khong co hero image duoc cau hinh.
- Homepage shell hien tai cho cam giac commerce-led hon va bot "landing page trong" hon Dawn goc.

## 8. Collection and search changes

- Collection va search duoc chuyen sang `filter_type: vertical`.
- Collection banner bat lai collection image, va neu collection image trong thi fallback sang featured media cua product dau tien.
- Collection hero text duoc bo sung fallback mo ta trung tinh khi merchant chua co description.
- Search va collection giam top padding de vao grid nhanh hon.
- Product count mobile duplicate trong vertical/drawer flow duoc bo bot o `snippets/facets.liquid`.
- Empty search state giu `View all` recovery CTA va spacing ro hon.

## 9. Product-card changes

- Quick add duoc giu `none` tren collection/search/home merchandising surfaces de tranh short-cut sai voi nail-buy flow.
- Card media va card info duoc siet gap, title/price hierarchy ro hon, spacing gon hon.
- Metadata separator duoc doi ve ASCII ` / ` thay cho ky tu khong can thiet.
- Collection/search/home card grid duoc siet row-gap va column-gap de tang shopping density.

## 10. Product-page changes

- Product template bo vendor text block de buy box sach hon.
- Dynamic checkout duoc tat trong `templates/product.json` de giu 1 primary CTA ro rang.
- Buy box duoc dong bo radius/border/shadow voi collection/cart shell.
- Price, quantity, ATC va product facts giu mot stack ro rang hon.
- Gallery va supporting media giu media-first hierarchy, phu hop hon voi nail catalog hien tai.

## 11. Cart changes

- Cart summary shell duoc nhan manh hon voi boxed totals area va checkout CTA noi bat.
- Cart line-item shell duoc lam sach hon voi image frame va spacing ro hon.
- Mobile cart summary van dat checkout CTA trong first purchase zone.
- Cart page van giu Dawn cart mechanics; Phase 7A khong sua endpoint hay checkout route.

## 12. Footer changes

- Footer dark shell duoc giu va polish them newsletter, localization, va payment badge treatment.
- Footer columns de doc hon tren mobile va it "dang bi bo ngo" hon Dawn goc.
- Footer van giu role handoff cho support/newsletter/localization ma khong hard-code policy copy moi.

## 13. Mobile-specific changes

- Hero mobile giu CTA trong vung nhin som.
- Collection/search mobile giu 2-column card flow, filter trigger ro, tap target sach.
- Product mobile giu media truoc, buy box sat sau, va CTA contrast cao.
- Cart mobile giu checkout card ro rang sau line item.
- Mobile drawer utility links va localization hooks van render dung theo Dawn conditions.

## 14. Accessibility improvements

- Desktop search modal: mo duoc va dong bang `Escape`.
- Mobile drawer: mo duoc va dong bang `Escape`.
- Mobile filter trigger: mo duoc, overlay state render dung, va close state khong gay overflow.
- Hero CTA focus-visible da duoc verify bang keyboard; outline hien ro.
- Product-card keyboard focus da duoc verify tren mobile collection, focus ring hien duoc quanh card link.
- Khong co horizontal overflow o cac viewport da test.

## 15. Remaining issues blocked by merchant data or Shopify Admin configuration

- `browse_shape`, `browse_length`, va `featured_accessories` van dung trang thai data-dependent; can collections/menu/catalog that de bat len dung ngu canh.
- Search & Discovery filters ngoai availability/price van phu thuoc merchant/Admin configuration.
- Size-guide, application, care, accessory cross-sell, va FAQ content van phu thuoc metafield/metaobject population that.
- Local preview console van co preview-noise tu Shopify scripts (`origin_trials`, `event_observer_reporter`, hot-reload reconnect). Day khong phai error do theme code moi gay ra.
- Cart page van con 2 `h1` trong DOM (`Your cart` va `Your cart is empty`) theo Dawn cart structure hien tai; day la semantic hardening item cho Phase 7B, khong phai visual regression cua Phase 7A.

## 16. Validation results

Local preview dung de QA:

- `http://127.0.0.1:9294`

Kiem tra da thuc hien:

- Theme Check
- local preview review tren `1440x900`, `1024x768`, `768x1024`, `390x844`
- screenshot review cho homepage, collection, search, empty search, PDP, cart
- keyboard focus review
- `Escape` review cho search modal va mobile drawer
- mobile filter trigger review
- overflow check tren homepage, collection, search, PDP, cart

Ket qua tong hop:

- homepage: `1` meaningful `h1`, khong overflow
- collection: `1` meaningful `h1`, khong overflow
- search results: `1` meaningful `h1`, khong overflow
- empty search: `1` meaningful `h1`, khong overflow
- PDP: `1` meaningful `h1`, khong overflow
- cart: shell visual on dinh, khong overflow, checkout CTA noi bat
- desktop search modal: open = true, `Escape` close = true
- mobile drawer: open = true, `Escape` close = true
- mobile product-card focus ring: visible

Console review:

- Khong thay theme JavaScript error moi do Phase 7A tao ra.
- Con lai chi la preview noise tu Shopify local dev shell:
  - `origin_trials` CORS block tren `cdn.shopify.com`
  - `event_observer_reporter` fetch failures
  - hot-reload reconnect messages

Theme Check cuoi phase nay:

- pass
- `177 files inspected`
- `8 warnings`
- `0 errors`

8 warnings con lai la baseline Dawn warnings da ton tai truoc Phase 7A.

## Reference comparison table

| Surface | Screenshot or UX reference | Local gap found | Original correction applied | Result |
| ------- | -------------------------- | --------------- | --------------------------- | ------ |
| Homepage hero | `image-4.png`, `public/image-website/screencapture-ersanails-homepage.png` | Hero va ben duoi hero chua du image-led, chua co early browse density | Bat featured collection, bat education layer, polish hero shell, them product-collage fallback trong `image-banner` | Homepage co browse path som hon va bot trong rong |
| Header / utility bar | `image-4.png` | Shell qua nhe, utility/localization chua ro | Utility bar toi hon, header compact hon, localization pill polish, icon labels duoc lam gon | Header trong va premium hon |
| Collection hero | `image-3.png`, `public/image-website/screencapture-ersanails-collections-classy-nails.png` | Collection context area qua mac dinh, image khong co fallback | Bat collection image, fallback sang first product media, them fallback description | Collection vao browse nhanh hon va co image context ro hon |
| Collection / filters | `image-3.png` | Filter ngang va page spacing qua Dawn-default | Chuyen sang vertical filters, giam top padding, polish facets shell | Collection tro thanh browsing surface ro rang hon |
| Search results / empty search | `image-3.png` va `phase-1b-reference-ui-map.md` | Search chua du parity voi collection, empty state recovery con yeu | Vertical filter layout, search field shell polish, giu `View all` CTA | Search results va empty search de recover hon |
| Product cards | `image-3.png`, `image-4.png` | Card spacing rong, hierarchy chua gon, quick-add de lam loang flow | Tighten gaps, giu image-led ratio, tat quick add o merch surfaces, polish title/price rhythm | Card doc nhanh hon va fit collection/search/home tot hon |
| Product page | `image-5.png` | Buy box con loang vi vendor/dynamic checkout, shell chua du ro | Bo vendor, tat dynamic checkout, polish media + buy box shell | PDP buy flow ro va sach hon |
| Cart page | `image-6.png` | Totals area va checkout emphasis chua du | Boxed cart summary, checkout CTA strong, line-item shell polish | Cart route co checkout emphasis ro hon |
