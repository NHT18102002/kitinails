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

test('main product preserves gallery, pricing and buy-control contracts', async ({ page }) => {
  await page.goto(fixtures.productMultiVariant, { waitUntil: 'domcontentloaded' });

  const productInfo = page.locator('product-info[data-update-url="true"]').first();
  await expect(productInfo).toBeVisible();
  await expect(productInfo.locator('h1').first()).toBeVisible();
  await expect(productInfo.locator('media-gallery').first()).toBeVisible();
  await expect(productInfo.locator('[id^="price-"]').first()).toBeVisible();

  const productForm = productInfo.locator('form[action*="/cart/add"]:has(button[name="add"]):visible').first();
  await expect(productForm).toBeVisible();
  await expect(productForm.locator('input[name="id"]')).toHaveValue(/\d+/);
  await expect(productForm.locator('button[name="add"]')).toHaveAccessibleName(/add to cart|sold out/i);
});

test('variant picker updates the selected variant without a page runtime error', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(fixtures.productMultiVariant, { waitUntil: 'domcontentloaded' });

  const productInfo = page.locator('product-info[data-update-url="true"]').first();
  const selectedVariant = productInfo.locator('form[action*="/cart/add"]:has(button[name="add"]) input[name="id"]').first();
  const initialVariantId = await selectedVariant.inputValue();
  const radioCandidates = productInfo.locator('variant-selects input[type="radio"]:not(:checked):not(:disabled)');
  const selectCandidates = productInfo.locator('variant-selects select');

  if (await radioCandidates.count()) {
    const radio = radioCandidates.first();
    const radioId = await radio.getAttribute('id');
    await productInfo.locator(`label[for="${radioId}"]`).click({ force: true });
  } else if (await selectCandidates.count()) {
    const select = selectCandidates.first();
    const alternative = await select
      .locator('option:not(:checked):not([disabled])')
      .evaluateAll((options) => options.map((option) => option.value).find(Boolean));
    test.skip(!alternative, 'Fixture exposes no alternative selectable variant option');
    await select.selectOption(alternative);
  } else {
    test.skip(true, 'Fixture exposes no variant picker');
  }

  await expect.poll(() => selectedVariant.inputValue()).not.toBe(initialVariantId);
  expect(unexpectedRuntimeErrors(runtimeErrors)).toEqual([]);
});

test('product disclosure remains keyboard operable', async ({ page }) => {
  await page.goto(fixtures.productMultiVariant, { waitUntil: 'domcontentloaded' });
  const disclosure = page.locator('product-info details.product__accordion').first();
  test.skip((await disclosure.count()) === 0, 'Fixture exposes no product disclosure');

  const summary = disclosure.locator('summary').first();
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(disclosure).not.toHaveAttribute('open', '');
});

test('PDP remains idempotent when Shopify reloads its section', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(fixtures.productMultiVariant, { waitUntil: 'domcontentloaded' });

  const section = page.locator('[id^="shopify-section-"]:has(product-info[data-update-url="true"])').first();
  await expect(section).toBeVisible();
  await section.evaluate((element) => {
    document.dispatchEvent(new CustomEvent('shopify:section:load', { detail: { sectionId: element.id } }));
    document.dispatchEvent(new CustomEvent('shopify:section:load', { detail: { sectionId: element.id } }));
  });

  await expect(section.locator('form[action*="/cart/add"]:has(button[name="add"]):visible').first()).toBeVisible();
  expect(unexpectedRuntimeErrors(runtimeErrors)).toEqual([]);
});

test('featured product placeholder preserves its public section contract', async ({ page }) => {
  const response = await page.goto('/?section_id=featured-product', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();

  const section = page.locator('#shopify-section-featured-product');
  await expect(section).toBeVisible();
  await expect(section.locator('product-info[data-update-url="false"]')).toBeVisible();
  await expect(section.locator('.featured-product')).toBeVisible();
  await expect(section.locator('.product__media-wrapper .placeholder-svg')).toBeVisible();
  await expect(section.locator('.product__view-details')).toHaveAttribute('aria-disabled', 'true');
});
