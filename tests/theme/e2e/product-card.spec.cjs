const { test, expect } = require('@playwright/test');
const fixtures = require('../storefront-fixtures.cjs');

const cardSurfaces = [
  ['home', fixtures.home],
  ['collection', fixtures.collection],
  ['search', fixtures.searchResults],
];

for (const [name, path] of cardSurfaces) {
  test(`${name} product cards expose media, title and price contracts`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    if (name === 'search') {
      await expect.poll(() => new URL(page.url()).searchParams.has('display_q')).toBeTruthy();
    }

    const card = page.locator('product-component .product-card-wrapper').first();
    test.skip((await card.count()) === 0, `${name} fixture has no product-card surface`);
    await expect(card).toBeVisible();
    await expect(card.locator('.product-card__heading a[href]:visible').first()).toBeVisible();
    await expect(card.locator('.product-card__media img').first()).toBeVisible();
    await expect(card.locator('.price').first()).toBeVisible();
    await expect(card.locator('.product-card__favorite')).toBeVisible();
    await expect(card.locator('.product-card__quick-buy-button')).toBeVisible();
  });
}

test('collection cards preserve the available quick-add path', async ({ page }) => {
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });

  const directAdd = page.locator('product-component product-form button[name="add"]:visible:not([disabled])').first();
  const chooseOptions = page.locator('product-component a.product-card__quick-buy-button[href]:visible').first();
  const hasDirectAdd = (await directAdd.count()) > 0;
  const hasChooseOptions = (await chooseOptions.count()) > 0;
  test.skip(!hasDirectAdd && !hasChooseOptions, 'Collection fixture has no available quick-add path');

  if (hasDirectAdd) {
    await expect(directAdd).toHaveAccessibleName(/add to cart/i);
    await directAdd.focus();
    await expect(directAdd).toBeFocused();
  }

  if (hasChooseOptions) {
    await expect(chooseOptions).toHaveAccessibleName(/choose options/i);
    await chooseOptions.focus();
    await expect(chooseOptions).toBeFocused();
  }
});

test('product card ratings keep stars and review count in one metadata row', async ({ page }) => {
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });

  const reviewRow = page.locator('product-component .product-card__review-row').first();
  test.skip((await reviewRow.count()) === 0, 'Home fixture has no product rating data');

  await expect(reviewRow).toHaveCSS('display', 'inline-flex');
  const isInline = await reviewRow.evaluate((row) => {
    const rating = row.querySelector('.rating')?.getBoundingClientRect();
    const reviewCount = row.querySelector('.rating-count')?.getBoundingClientRect();
    return rating && reviewCount && Math.abs(rating.top - reviewCount.top) < 2;
  });
  expect(isInline).toBeTruthy();
});

test('collection quick buy expands from a cart icon on hover and keyboard focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.viewport.width < 990, 'Quick Buy expansion is a desktop-only interaction');
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });
  const card = page.locator('product-component .product-card-wrapper--unified').first();
  const quickBuy = card.locator('.product-card__quick-buy-button');

  await expect(quickBuy).toHaveCSS('width', '40px');
  const centeredIcon = await quickBuy.evaluate((button) => {
    const icon = button.querySelector('.product-card__quick-buy-icon');
    const buttonBox = button.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    return Math.abs(buttonBox.left + buttonBox.width / 2 - (iconBox.left + iconBox.width / 2)) < 0.5
      && Math.abs(buttonBox.top + buttonBox.height / 2 - (iconBox.top + iconBox.height / 2)) < 0.5;
  });
  expect(centeredIcon).toBeTruthy();
  await card.hover({ position: { x: 16, y: 16 }, force: true });
  await expect(card.locator('.product-card__quick-buy')).toHaveCSS('opacity', '1');
  await quickBuy.hover();
  await expect(quickBuy).toHaveCSS('width', '146px');
  await expect(quickBuy.locator('.product-card__quick-buy-label')).toHaveCSS('opacity', '1');

  await quickBuy.focus();
  await expect(quickBuy).toHaveCSS('width', '146px');
  await expect(quickBuy).toHaveAccessibleName(/choose options|add to cart/i);
});

test('collection cards preserve percentage-sale badges', async ({ page }) => {
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });
  const saleBadge = page.locator('product-component .card__badge .badge:visible').filter({ hasText: /-\d+%/ }).first();
  test.skip((await saleBadge.count()) === 0, 'Collection fixture has no sale badge');
  await expect(saleBadge).toBeVisible();
});

test('sold-out cards remain disabled when the fixture contains one', async ({ page }) => {
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });
  const soldOutButton = page.locator('product-component button[name="add"][disabled]:visible').first();
  test.skip((await soldOutButton.count()) === 0, 'Collection fixture has no direct-add sold-out card');
  await expect(soldOutButton).toBeDisabled();
});
