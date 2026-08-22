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
    await expect(card).toBeVisible();
    await expect(card.locator('.card__heading a[href]:visible').first()).toBeVisible();
    await expect(card.locator('.card__media img').first()).toBeVisible();
    await expect(card.locator('.price').first()).toBeVisible();
  });
}

test('collection cards preserve single and multi-variant quick-add eligibility', async ({ page }) => {
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });

  const directAdd = page.locator('product-component product-form button[name="add"]:visible:not([disabled])').first();
  const chooseOptions = page.locator('product-component a.quick-add__submit[href]:visible').first();
  await expect(directAdd).toBeVisible();
  await expect(directAdd).toHaveAccessibleName(/add to cart/i);
  await expect(chooseOptions).toBeVisible();
  await expect(chooseOptions).toHaveAccessibleName(/choose options/i);

  await directAdd.focus();
  await expect(directAdd).toBeFocused();
  await chooseOptions.focus();
  await expect(chooseOptions).toBeFocused();
});

test('collection cards preserve percentage-sale badges', async ({ page }) => {
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });
  const saleBadge = page.locator('product-component .card__badge .badge:visible').filter({ hasText: /-\d+%/ }).first();
  await expect(saleBadge).toBeVisible();
});

test('sold-out cards remain disabled when the fixture contains one', async ({ page }) => {
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });
  const soldOutCard = page
    .locator('product-component .product-card-wrapper')
    .filter({ has: page.locator('.card__badge .badge', { hasText: /sold out/i }) })
    .first();
  test.skip((await soldOutCard.count()) === 0, 'Collection fixture has no sold-out card');

  await expect(soldOutCard.locator('button[name="add"]')).toBeDisabled();
});
