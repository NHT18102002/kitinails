const { test, expect } = require('@playwright/test');
const fixtures = require('../storefront-fixtures.cjs');
const baseline = require('../runtime-baseline.cjs');

function unexpectedRuntimeErrors(messages) {
  return messages.filter(
    (message) =>
      !baseline.allowedPageErrors.includes(message) &&
      !baseline.allowedPageErrorPatterns.some((pattern) => pattern.test(message))
  );
}

const canonicalDesktopMenuIds = [
  'HeaderMenu-shop-all',
  'HeaderMenu-best-seller',
  'HeaderMenu-accessories',
  'HeaderMenu-custom-orders',
  'HeaderMenu-about-us',
];

test('canonical desktop header renders the same navigation on standard storefront pages', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('1440'), 'Desktop shell parity');
  test.setTimeout(120_000);

  const routes = [fixtures.home, fixtures.collection, fixtures.productMultiVariant, fixtures.searchResults, fixtures.cart, fixtures.informationPage];

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });

    const header = page.locator('.shopify-section-group-header-group.section-header');
    await expect(header).toHaveCount(1);
    await expect(header.locator('.header__desktop-nav [id^="HeaderMenu-"]')).toHaveCount(canonicalDesktopMenuIds.length);
    await expect
      .poll(() => header.locator('.header__desktop-nav [id^="HeaderMenu-"]').evaluateAll((items) => items.map((item) => item.id)))
      .toEqual(canonicalDesktopMenuIds);

    for (const id of canonicalDesktopMenuIds) {
      await expect(header.locator(`#${id}`)).toBeVisible();
    }
  }
});

test('collection navigation exposes one readable current destination', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('1440'), 'Desktop active navigation');

  const routes = [
    { path: fixtures.collection, id: 'HeaderMenu-shop-all' },
    { path: '/collections/tools-accessories', id: 'HeaderMenu-accessories' },
    { path: '/collections', id: 'HeaderMenu-custom-orders' },
  ];

  for (const { path, id } of routes) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    const header = page.locator('.shopify-section-group-header-group.section-header');
    const currentItem = header.locator('.header__desktop-nav [aria-current="page"]');
    await expect(currentItem).toHaveCount(1);
    await expect(currentItem).toHaveAttribute('id', id);
    await expect(currentItem.locator('.header__active-menu-item')).toHaveCSS('color', 'rgb(17, 17, 17)');
  }

  await expect(page.locator('#HeaderMenu-accessories')).toHaveAttribute('href', '/collections/tools-accessories');
});

test('canonical desktop collection menu remains keyboard operable', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('1440'), 'Desktop shell interaction');
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });

  const menu = page.locator('#Details-HeaderMenu-shop-all');
  const summary = menu.locator('summary');
  await expect(summary).toBeVisible();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  await expect(menu.locator('.header-collection-dropdown__link').first()).toBeVisible();
  await expect(menu.locator('.header-collection-dropdown__media').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
});

test('predictive search remains accessible from the canonical header', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('1440'), 'Desktop shell interaction');
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });

  const searchModal = page.locator('header details-modal.header__search:visible').first();
  await searchModal.locator('summary').click();
  const input = searchModal.locator('input[type="search"]');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill('nails');
  await expect(searchModal.locator('[data-predictive-search]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(searchModal.locator('details')).not.toHaveAttribute('open', '');
});

test('sticky header lifecycle updates scroll state without duplicate runtime errors', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });

  const stickyHeader = page.locator('sticky-header');
  await expect(stickyHeader).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'))))
    .toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(stickyHeader.locator('xpath=..')).toHaveClass(/header-is-scrolled/);
  expect(unexpectedRuntimeErrors(runtimeErrors)).toEqual([]);
});

test('mobile footer accordion stays idempotent across repeated Theme Editor loads', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('390'), 'Mobile shell interaction');
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });

  const footerSection = page.locator('.shopify-section:has(footer.footer)').first();
  await footerSection.evaluate((section) => {
    document.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true, detail: { sectionId: section.id } }));
    document.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true, detail: { sectionId: section.id } }));
  });

  const heading = footerSection.locator('.footer-title__button').first();
  const content = heading.locator('xpath=following-sibling::*[1]');
  await heading.scrollIntoViewIfNeeded();
  await heading.focus();
  await page.keyboard.press('Enter');
  await expect(heading).toHaveAttribute('aria-expanded', 'true');
  await expect(content).toHaveCSS('max-height', /\d+px/);
  await page.keyboard.press('Enter');
  await expect(heading).toHaveAttribute('aria-expanded', 'false');
  expect(unexpectedRuntimeErrors(runtimeErrors)).toEqual([]);
});
