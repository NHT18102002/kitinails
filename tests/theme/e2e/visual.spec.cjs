const { test, expect } = require('@playwright/test');
const fixtures = require('../storefront-fixtures.cjs');

async function disableDynamicRendering(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
}

const visualRoutes = [
  ['home', fixtures.home],
  ['collection', fixtures.collection],
  ['product', fixtures.productMultiVariant],
  ['search-empty', fixtures.searchEmpty],
  ['cart-empty', fixtures.cart],
];

for (const [name, path] of visualRoutes) {
  test(`${name} visual baseline`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium is the canonical visual snapshot engine');
    await page.goto(path, { waitUntil: 'networkidle' });
    await disableDynamicRendering(page);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      mask: [page.locator('iframe, [data-dynamic-content], .shopify-challenge__container')],
    });
  });
}

test('cart-filled visual baseline', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium is the canonical visual snapshot engine');
  await page.goto(fixtures.productMultiVariant, { waitUntil: 'domcontentloaded' });
  const variantId = await page
    .locator('form[action*="/cart/add"]:has(button[name="add"]):visible input[name="id"]')
    .first()
    .inputValue();
  await page.evaluate(async (id) => {
    await fetch('/cart/clear.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await fetch('/cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), quantity: 1 }),
    });
  }, variantId);
  await page.goto(fixtures.cart, { waitUntil: 'networkidle' });
  await disableDynamicRendering(page);
  await expect(page).toHaveScreenshot('cart-filled.png', {
    fullPage: true,
    mask: [page.locator('iframe, [data-dynamic-content], .shopify-challenge__container')],
  });
});
