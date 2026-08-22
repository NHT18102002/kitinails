const { test, expect } = require('@playwright/test');
const fixtures = require('../storefront-fixtures.cjs');

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
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      mask: [page.locator('iframe, [data-dynamic-content], .shopify-challenge__container')],
    });
  });
}
