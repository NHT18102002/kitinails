const { test, expect } = require('@playwright/test');
const fixtures = require('../storefront-fixtures.cjs');
const baseline = require('../runtime-baseline.cjs');

test.beforeEach(({}, testInfo) => {
  test.skip(
    !['chromium-1440', 'webkit-390'].includes(testInfo.project.name),
    'Cart interaction matrix uses desktop Chromium and mobile WebKit'
  );
});

async function seedCart(page, quantity = 1) {
  await page.goto(fixtures.productMultiVariant, { waitUntil: 'domcontentloaded' });
  const variantId = await page
    .locator('form[action*="/cart/add"]:has(button[name="add"]):visible input[name="id"]')
    .first()
    .inputValue();

  const result = await page.evaluate(
    async ({ id, lineQuantity }) => {
      await fetch('/cart/clear.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity: lineQuantity }),
      });
      return { ok: response.ok, status: response.status };
    },
    { id: Number(variantId), lineQuantity: quantity }
  );

  expect(result, 'Expected the fixture variant to seed an anonymous cart').toEqual({ ok: true, status: 200 });
  return variantId;
}

function unexpectedRuntimeErrors(messages) {
  return messages.filter(
    (message) =>
      !baseline.allowedPageErrors.includes(message) &&
      !baseline.allowedPageErrorPatterns.some((pattern) => pattern.test(message))
  );
}

test('filled cart page preserves shared line, totals, progress and checkout contracts', async ({ page }) => {
  await seedCart(page);
  await page.goto(fixtures.cart, { waitUntil: 'domcontentloaded' });

  const line = page.locator('cart-items .cart-item').first();
  await expect(line).toBeVisible();
  await expect(line.locator('.cart-item__name')).toBeVisible();
  await expect(line.locator('.cart-item__details .product-option').first()).toBeVisible();
  await expect(line.locator('.cart-item__totals:visible .price').first()).toBeVisible();
  await expect(line.locator('input[name="updates[]"]')).toHaveValue('1');
  await expect(page.locator('#checkout')).toBeEnabled();

  const progress = page.locator('#main-cart-footer .cart-progress');
  if (await progress.count()) {
    await expect(progress).toHaveAttribute('role', 'status');
    await expect(progress.locator('.cart-progress__fill')).toHaveAttribute('style', /width:/);
  }
});

test('cart drawer preserves focus, Escape and checkout contracts', async ({ page }) => {
  await seedCart(page);
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });

  const trigger = page.locator('#cart-icon-bubble');
  const drawer = page.locator('cart-drawer');
  await trigger.click();
  await expect(drawer).toHaveClass(/active/);
  await expect(drawer.locator('.cart-item').first()).toBeVisible();
  await expect(drawer.locator('#CartDrawer-Checkout')).toBeEnabled();
  await drawer.locator('.drawer__close:visible').focus();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveClass(/active/);
  await expect(trigger).toBeFocused();
});

test('cart page quantity update keeps the AJAX payload and rendered line in sync', async ({ page }) => {
  await seedCart(page);
  await page.goto(fixtures.cart, { waitUntil: 'domcontentloaded' });

  const quantity = page.locator('#Quantity-1');
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/cart/change') && response.request().method() === 'POST'
  );
  await quantity.evaluate((input) => {
    input.value = '2';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  await expect(page.locator('#Quantity-1')).toHaveValue('2');
  await expect(page.locator('.cart-count-bubble span[aria-hidden="true"]')).toHaveText('2');
});

test('cart drawer quantity update keeps one AJAX owner', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await seedCart(page);
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });
  await page.locator('#cart-icon-bubble').click();

  const quantity = page.locator('#Drawer-quantity-1');
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/cart/change') && response.request().method() === 'POST'
  );
  await quantity.selectOption('2');
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  await expect(page.locator('#Drawer-quantity-1')).toHaveValue('2');
  expect(unexpectedRuntimeErrors(runtimeErrors)).toEqual([]);
});

test('cart remove uses the existing section IDs and reaches the empty state', async ({ page }) => {
  await seedCart(page);
  await page.goto(fixtures.cart, { waitUntil: 'domcontentloaded' });

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/cart/change') && response.request().method() === 'POST'
  );
  await page.locator('cart-items cart-remove-button').first().click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  await expect(page.locator('cart-items')).toHaveClass(/is-empty/);
  await expect(page.locator('cart-items .cart__empty-text')).toBeVisible();
});

test('cart AJAX errors restore quantity and announce the server message', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await seedCart(page);
  await page.goto(fixtures.cart, { waitUntil: 'domcontentloaded' });

  await page.route('**/cart/change*', async (route) => {
    await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ errors: 'Fixture error' }) });
  });
  const quantity = page.locator('#Quantity-1');
  await quantity.evaluate((input) => {
    input.value = '2';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.locator('#Line-item-error-1 .cart-item__error-text')).toHaveText('Fixture error');
  await expect(quantity).toHaveValue('1');
  expect(unexpectedRuntimeErrors(runtimeErrors)).toEqual([]);
});
