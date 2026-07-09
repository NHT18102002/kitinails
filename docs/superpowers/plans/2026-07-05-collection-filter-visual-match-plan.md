# Collection Filter Visual Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/collections/all` match the Ersa Nails reference collection filter experience as closely as practical while preserving Shopify native `collection.filters`, `sort_by`, query-string URL state, AJAX rerender, pagination, and product data.

**Architecture:** Keep Dawn's native `facets.liquid` and `facets.js` request/response contract intact, then reshape the collection page around it. The solution is split into two layers: Shopify Search & Discovery/Admin data setup so the storefront exposes the correct filter groups, and theme-level Liquid/CSS/JavaScript work that restyles and stages those native filters into the Ersa Nails toolbar, desktop panel, and mobile drawer interaction model.

**Tech Stack:** Shopify Online Store 2.0, Liquid, Dawn native facets, vanilla JavaScript, scoped CSS, Shopify Search & Discovery, Shopify Theme Check, browser QA against `https://ersanails.com/collections/all` and `http://127.0.0.1:9292/collections/all`.

---

## Locked Requirements

- Reference page: `https://ersanails.com/collections/all`
- Local target: `http://127.0.0.1:9292/collections/all`
- Keep native Shopify filtering state:
  - `filter.*`
  - `sort_by`
  - `page`
- Keep native AJAX rerender through Dawn facets flow.
- Keep native pagination and product grid data.
- Do not hard-code filter values, product handles, product counts, or custom path-segment routing.
- Mobile filters must use staged state:
  - Selecting values does not update the URL or grid immediately.
  - Apply commits the drawer state.
  - Close, Back, or Escape discards un-applied changes.
  - Clear all preserves current `sort_by`.
- Filter sources must come from Search & Discovery/Admin using existing product metafields, not theme-side fake data.

## Current State Snapshot

- Theme files already in use:
  - `sections/main-collection-product-grid.liquid`
  - `snippets/facets.liquid`
  - `assets/facets.js`
  - `assets/collection-filters.js`
  - `assets/collection-filters.css`
  - `sections/main-collection-banner.liquid`
  - `snippets/breadcrumbs.liquid`
  - `assets/custom-theme-overrides.css`
- Local storefront currently exposes only `Availability` and `Price` filters.
- Store already has suitable product metafields populated for filter taxonomy:
  - `custom.nail_color_values`
  - `custom.nail_length_values`
  - `custom.nail_shape_values`
  - `custom.nail_style_values`
- `assets/collection-filters.js` already contains the correct staged mobile-draft idea and should be extended, not replaced.
- `snippets/breadcrumbs.liquid` still contains inline styles and needs to be normalized as part of matching the reference page.
- `assets/custom-theme-overrides.css` and `assets/collection-filters.css` both contain collection-page overrides, so CSS overlap must be resolved deliberately.

## File Impact Map

- Modify `sections/main-collection-product-grid.liquid`
  - Owns the sticky toolbar shell, product count placeholders, filter panel wrapper, grid container, empty state, and pagination surface.
- Modify `snippets/facets.liquid`
  - Owns native filter markup, active chips, desktop accordion groups, and mobile drawer structure.
- Modify `assets/collection-filters.js`
  - Owns staged mobile behavior, desktop filter/sort panel toggles, AJAX rerender sync, and focus/close rules.
- Modify `assets/collection-filters.css`
  - Primary scoped stylesheet for collection filter visuals and responsive behavior.
- Modify `snippets/breadcrumbs.liquid`
  - Remove inline styles and give the collection page a reusable breadcrumb structure that can be styled to match the reference.
- Modify `sections/main-collection-banner.liquid`
  - Keep breadcrumb placement and top-of-page spacing aligned with the filter toolbar below it.
- Modify `assets/custom-theme-overrides.css` only if needed
  - Remove or trim conflicting collection-specific rules after migrating them into `collection-filters.css`.
- Do not modify `assets/facets.js` unless a verified blocker is found
  - Native Dawn rerender should remain the engine of record.

## Task 1: Lock Search & Discovery Filter Sources

**Files:**
- No theme files yet
- Read-only verification against storefront HTML

- [ ] **Step 1: Confirm the four intended metafield sources are populated on products**

Run:

```bash
cd D:/work/shopify/ersanails
@'
const fs = require('node:fs');
const products = JSON.parse(fs.readFileSync('data/catalog/normalized/products.json', 'utf8'));
const keys = ['color', 'length', 'shape', 'style'];
const counts = { color: 0, length: 0, shape: 0, style: 0 };
for (const product of products) {
  const taxonomy = product.taxonomy || {};
  if ((taxonomy.color || []).length) counts.color += 1;
  if ((taxonomy.length || []).length) counts.length += 1;
  if ((taxonomy.shape || []).length) counts.shape += 1;
  if ((taxonomy.style || []).length) counts.style += 1;
}
console.log(JSON.stringify(counts, null, 2));
'@ | node -
```

Expected:
- Each target taxonomy has non-zero coverage.
- Any weak coverage is recorded before theme work begins.

- [ ] **Step 2: Configure Search & Discovery filter sources in Shopify Admin**

In Shopify Admin:

1. Open `Apps > Search & Discovery > Filters`.
2. Add or enable these product filters in this exact order:
   - `custom.nail_color_values` → rename display label to `Color`
   - `custom.nail_length_values` → rename display label to `Length`
   - `custom.nail_shape_values` → rename display label to `Shape`
   - `custom.nail_style_values` → rename display label to `Style`
3. Remove or hide:
   - `Availability`
   - `Price`
4. Save.

Expected:
- Storefront filter schema is data-driven from metafields.
- No theme code is used to fake missing filters.

- [ ] **Step 3: Verify storefront HTML exposes only the intended filter groups**

Run:

```bash
Invoke-WebRequest 'http://127.0.0.1:9292/collections/all' -UseBasicParsing |
  Select-Object -ExpandProperty Content |
  Set-Content "$env:TEMP\\ersa-local-collection-after-filter-config.html"

@'
const fs = require('node:fs');
const html = fs.readFileSync(process.env.TEMP + '/ersa-local-collection-after-filter-config.html', 'utf8');
const labels = [...html.matchAll(/facets__summary-label">\s*([^<]+)\s*/g)].map((m) => m[1].trim());
console.log(labels);
'@ | node -
```

Expected:
- Labels contain `Color`, `Length`, `Shape`, `Style`.
- Labels do not contain `Availability`.
- If `Price` still appears as a filter group, stop and fix Search & Discovery before theme changes.

## Task 2: Normalize Breadcrumb And Collection Toolbar Structure

**Files:**
- Modify: `snippets/breadcrumbs.liquid`
- Modify: `sections/main-collection-banner.liquid`
- Modify: `sections/main-collection-product-grid.liquid`

- [ ] **Step 1: Replace inline breadcrumb styles with semantic markup**

Update `snippets/breadcrumbs.liquid` from inline-style markup to a class-based structure:

```liquid
<nav class="breadcrumbs" aria-label="Breadcrumbs">
  <ol class="breadcrumbs__list" role="list">
    <li class="breadcrumbs__item">
      <a class="breadcrumbs__link" href="{{ routes.root_url }}">Home</a>
    </li>
    {%- if template contains 'collection' -%}
      <li class="breadcrumbs__separator" aria-hidden="true">›</li>
      <li class="breadcrumbs__item">
        <a class="breadcrumbs__link" href="{{ routes.collections_url }}">Collections</a>
      </li>
      <li class="breadcrumbs__separator" aria-hidden="true">›</li>
      <li class="breadcrumbs__item">
        <a class="breadcrumbs__link is-current" href="{{ collection.url }}" aria-current="page">
          {{ collection.title }}
        </a>
      </li>
    {%- endif -%}
  </ol>
</nav>
```

Expected:
- Breadcrumbs become fully styleable from CSS.
- Inline styles are removed from the collection page path.

- [ ] **Step 2: Keep breadcrumbs in the collection hero and align spacing with the sticky toolbar**

Retain the breadcrumb render in `sections/main-collection-banner.liquid` and ensure the toolbar below reads like the reference's sticky follow-up bar instead of a disconnected Dawn section.

Implementation note:

```liquid
<div class="collection-hero__inner page-width ...">
  {% render 'breadcrumbs' %}
  <div class="collection-hero__text-wrapper">
    ...
  </div>
</div>
```

Expected:
- Breadcrumbs remain above the collection title.
- Toolbar below can focus on filter/sort/count, matching the public reference flow.

- [ ] **Step 3: Reshape the desktop toolbar shell in `main-collection-product-grid.liquid`**

Keep native product count IDs and sort radios, but tighten the structure around them:

```liquid
<div class="collection-toolbar page-width small-hide" data-collection-toolbar>
  <div class="collection-toolbar__inner">
    <div class="collection-toolbar__cluster collection-toolbar__cluster--leading">
      <button ... data-collection-filter-toggle>...</button>
      <div class="product-count-vertical light collection-toolbar__count" role="status">
        ...
      </div>
    </div>

    <facet-filters-form class="collection-toolbar__sort sorting caption">
      <form class="collection-toolbar__sort-form" id="FacetSortForm">
        ...
      </form>
    </facet-filters-form>
  </div>
</div>
```

Expected:
- Desktop top bar matches the reference's control density and ordering.
- Native IDs `ProductCount` and `ProductCountDesktop` remain intact for AJAX refresh.

- [ ] **Step 4: Run a local render sanity check**

Run:

```bash
shopify theme check
```

Expected:
- No Liquid syntax errors from breadcrumb/toolbar normalization.

## Task 3: Refactor Desktop Facet Markup To Match Reference

**Files:**
- Modify: `snippets/facets.liquid`

- [ ] **Step 1: Add filter-group ordering and collection-only visibility rules**

Inside the vertical filter loop, sort or gate the rendered filters so collection pages prioritize:
- `Color`
- `Length`
- `Shape`
- `Style`

Keep native objects and skip non-target groups when the template is `collection` and the reference match requires it.

Implementation sketch:

```liquid
{%- liquid
  assign desired_filter_labels = 'Color|Length|Shape|Style' | split: '|'
-%}
{%- for desired_label in desired_filter_labels -%}
  {%- for filter in results.filters -%}
    {%- if filter.label == desired_label -%}
      {%- render 'collection-filter-group', filter: filter, ... -%}
    {%- endif -%}
  {%- endfor -%}
{%- endfor -%}
```

If extracting a helper snippet is overkill, keep the rendering inline but preserve this order exactly.

Expected:
- Collection filters appear in the same conceptual order as the reference.
- No filter values are hard-coded.

- [ ] **Step 2: Restyle filter group headings as open desktop accordions**

Preserve native `<details>` behavior and keep groups open by default on collection pages:

```liquid
<details
  id="Details-{{ filter.param_name | escape }}-{{ section.id }}"
  class="facets__disclosure-vertical js-filter"
  data-index="{{ forloop.index }}"
  open
>
  <summary class="facets__summary caption-large focus-offset" ...>
    ...
  </summary>
  <div class="facets__display-vertical">
    ...
  </div>
</details>
```

Expected:
- Desktop filter panel looks like a collapsed/expandable filter matrix rather than generic Dawn checkboxes.

- [ ] **Step 3: Convert filter values into pill-like selectable rows**

Keep native checkbox inputs but wrap them in value rows that visually read like links/chips:

```liquid
<label for="{{ input_id }}" class="facets__value-pill{% if value.active %} is-active{% endif %}{% if is_disabled %} is-disabled{% endif %}">
  <input
    type="checkbox"
    name="{{ value.param_name }}"
    value="{{ value.value }}"
    id="{{ input_id }}"
    {% if value.active %}checked{% endif %}
    {% if is_disabled %}disabled{% endif %}
  >
  <span class="facets__value-pill-label">{{ value.label | escape }}</span>
  <span class="facets__value-pill-count">{{ value.count }}</span>
</label>
```

Expected:
- UI matches the reference feel while keeping Dawn-compatible form submission.

- [ ] **Step 4: Keep active chips and Clear all native**

Ensure active chips continue to use:
- `value.url_to_remove`
- `filter.url_to_remove`
- `results_url`

Expected:
- Clearing a chip or clearing all respects native query state and keeps current `sort_by`.

- [ ] **Step 5: Verify the rendered form still contains native filter param names**

Run:

```bash
Invoke-WebRequest 'http://127.0.0.1:9292/collections/all' -UseBasicParsing |
  Select-Object -ExpandProperty Content |
  Set-Content "$env:TEMP\\ersa-local-collection-facets-check.html"

rg -n "filter\\.v\\.|filter\\.p\\.|sort_by" "$env:TEMP\\ersa-local-collection-facets-check.html"
```

Expected:
- HTML still contains native `filter.*` inputs and `sort_by`.
- No custom route-segment logic appears.

## Task 4: Finish Mobile Drawer Staged Behavior

**Files:**
- Modify: `snippets/facets.liquid`
- Modify: `assets/collection-filters.js`

- [ ] **Step 1: Keep the drawer shell in `facets.liquid`, but align labels and actions with the reference**

The mobile drawer should have:
- title `Filters`
- close button
- per-group clear
- submenu back button
- sticky footer with `Clear all` and `Apply`

Keep the existing mobile structure and strengthen only the semantic hooks:

```liquid
<details class="mobile-facets__disclosure disclosure-has-popup medium-hide large-up-hide" data-mobile-facets-disclosure>
  <summary class="mobile-facets__open-wrapper focus-offset">
    <span class="mobile-facets__open">
      ...
    </span>
  </summary>
  <facet-filters-form>
    <form id="FacetFiltersFormMobile" class="mobile-facets">
      ...
    </form>
  </facet-filters-form>
</details>
```

Expected:
- The existing JS hooks remain stable while the drawer is reshaped visually.

- [ ] **Step 2: Preserve staged state and explicitly document the rules in `collection-filters.js`**

Retain and refine:

```js
const state = {
  mobileApplying: false,
  mobileDirty: false,
};
```

Required behavior:
- mobile input change => mark `mobileDirty = true`
- mobile Apply on root drawer => serialize form and call `FacetFiltersForm.renderPage(...)`
- drawer close without Apply => `form.reset()`
- group-level Apply => close submenu only, not commit page state yet
- group Clear => clear only that group's params
- Clear all => preserve current `sort_by`

Expected:
- Mobile drawer matches the reference interaction model while still honoring the previously approved staged-state behavior.

- [ ] **Step 3: Add focus and close safety**

Ensure JS covers:
- click outside desktop sort/filter popovers closes them
- `Escape` closes/reset mobile draft when appropriate
- close after Apply does not reset the just-applied state

Implementation anchor already exists:

```js
document.addEventListener('keyup', (event) => {
  if (event.code !== 'Escape') return;
  ...
});
```

Expected:
- Keyboard behavior is predictable and accessible.

- [ ] **Step 4: Test staged behavior manually on mobile viewport**

Manual browser checks:

1. Open mobile drawer.
2. Select one `Color`.
3. Confirm grid and URL do not change yet.
4. Tap `Apply`.
5. Confirm URL and grid update.
6. Reopen drawer, change another filter, then close with close button or Escape.
7. Confirm previous live state remains unchanged.

Expected:
- All staged-state rules pass exactly.

## Task 5: Scope And Consolidate Collection Filter CSS

**Files:**
- Modify: `assets/collection-filters.css`
- Modify: `assets/custom-theme-overrides.css` only if conflict removal is required

- [ ] **Step 1: Make `collection-filters.css` the source of truth for collection filter visuals**

Keep the main scope:

```css
main[data-template='collection'] ...
```

Move or duplicate only the collection-filter-specific rules needed from `custom-theme-overrides.css` into `collection-filters.css` so the page is controlled from one place.

Expected:
- The collection filter page no longer depends on scattered competing overrides.

- [ ] **Step 2: Style desktop toolbar, panel, and pills to match reference**

Target the existing selectors already present:

```css
main[data-template='collection'] .collection-toolbar__inner { ... }
main[data-template='collection'] .collection-toolbar__button { ... }
main[data-template='collection'] .collection-toolbar__panel--sort { ... }
main[data-template='collection'] .collection-filters-panel { ... }
main[data-template='collection'] .facets__value-pill { ... }
main[data-template='collection'] .active-facets__button { ... }
```

Required outcomes:
- light borders
- tight vertical rhythm
- reference-like typography scale
- active state visibly stronger than idle
- disabled values readable but muted

- [ ] **Step 3: Style full-screen mobile drawer and sticky footer**

Keep the current drawer takeover behavior and align it visually:

```css
main[data-template='collection'] [data-mobile-facets-disclosure][open] .mobile-facets__inner { ... }
main[data-template='collection'] .mobile-facets__footer { ... }
main[data-template='collection'] .mobile-facets__submenu .mobile-facets__footer { ... }
```

Required outcomes:
- full-screen white drawer
- sticky footer action bar
- back/close affordances like the reference
- no layout shift under safe-area insets

- [ ] **Step 4: Remove or neutralize conflicting rules from `custom-theme-overrides.css`**

After confirming the collection page still matches:
- delete or narrow duplicate selectors for `.facets-vertical.page-width`
- duplicate mobile drawer open button rules
- duplicate breadcrumb spacing rules that now belong to collection filters

Expected:
- One clear cascade path for collection filters.

## Task 6: Functional QA, Responsive QA, And Theme Safety

**Files:**
- No new source files required
- Optional doc update if QA findings need to be preserved

- [ ] **Step 1: Desktop functional QA**

Check at `1440px` and `1024px`:

1. Filter by one `Color`.
2. Add a second `Color` and confirm same-group OR behavior.
3. Add `Shape` and confirm cross-group AND behavior.
4. Remove a single chip.
5. Use `Clear all`.
6. Change `Sort by`.
7. Move to next pagination page.

Expected:
- Product count, grid, and URL stay synchronized after every action.

- [ ] **Step 2: Mobile functional QA**

Check at `390px` and `768px`:

1. Open drawer.
2. Make draft changes without applying.
3. Confirm no grid change.
4. Apply and confirm change.
5. Reopen, make another draft, close without applying.
6. Confirm live state did not change.
7. Use `Clear all` and confirm `sort_by` remains.

Expected:
- Mobile behavior matches the approved staged-state rules exactly.

- [ ] **Step 3: Empty-state QA**

Apply combinations that produce no results.

Expected:
- Empty collection state appears cleanly.
- `Clear all` or "use fewer filters" path recovers the grid.

- [ ] **Step 4: Console and keyboard QA**

In browser:
- verify no JS errors during filter/sort actions
- tab through toolbar and drawer controls
- use `Enter`/`Space` on toggles
- use `Escape` to close

Expected:
- No console errors from `collection-filters.js`
- Focus order remains usable on desktop and mobile

- [ ] **Step 5: Theme validation**

Run:

```bash
cd D:/work/shopify/ersanails
shopify theme check
```

Expected:
- No new Theme Check errors.
- Any unrelated pre-existing warnings are recorded separately.

- [ ] **Step 6: Regression smoke test**

Check these surfaces after the collection filter work:
- homepage featured products
- product card hover / image swap
- header and announcement bar
- cart drawer

Expected:
- No visual or JS regression outside the collection page.

## Acceptance Criteria

- `/collections/all` exposes `Color`, `Length`, `Shape`, and `Style` from Search & Discovery metafield filters.
- Desktop collection page has an Ersa-like sticky filter/sort/count toolbar.
- Desktop filter panel uses native filter inputs with reference-like styling and open accordion groups.
- Mobile filter drawer uses staged state and only commits on Apply.
- URL state remains native Shopify query params.
- AJAX rerender, product count refresh, pagination, and active chip removal continue to work.
- Breadcrumb markup is semantic and no longer inline-styled.
- CSS is scoped to `main[data-template='collection']` and does not regress unrelated pages.

## Known Risks To Watch During Execution

- Search & Discovery filter configuration is the true prerequisite; theme work alone cannot make `Color / Length / Shape / Style` appear if Admin is not configured.
- `assets/custom-theme-overrides.css` contains repeated collection selectors that can silently override new work if not cleaned up.
- `snippets/facets.liquid` is large and shared with search/drawer patterns, so collection-only conditions must be scoped carefully to avoid breaking non-collection flows.
- If a filter group has sparse or messy data, the UI may match the reference visually but still feel incomplete; that is a data-quality issue, not a theme engine bug.

## Execution Order Recommendation

1. Admin/Search & Discovery filter-source setup
2. Breadcrumb + toolbar markup normalization
3. Desktop facets markup refactor
4. Mobile drawer staged-behavior refinement
5. CSS consolidation and responsive polish
6. Full QA and Theme Check
