const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fixtures = require('../storefront-fixtures.cjs');
const baseline = require('../runtime-baseline.cjs');

const criticalRoutes = [
  ['home', fixtures.home],
  ['collection', fixtures.collection],
  ['product', fixtures.productMultiVariant],
  ['search-empty', fixtures.searchEmpty],
  ['cart', fixtures.cart],
  ['information-page', fixtures.informationPage],
];

for (const [name, path] of criticalRoutes) {
  test(`${name} renders without runtime or critical accessibility errors`, async ({ page }) => {
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `Expected ${path} to return a successful response`).toBeTruthy();
    await expect(page.locator('main').first()).toBeVisible();

    const accessibility = await new AxeBuilder({ page }).analyze();
    const allowedRules = baseline.allowedCriticalAccessibilityRules[name] || [];
    const criticalViolations = accessibility.violations.filter(
      (violation) => violation.impact === 'critical' && !allowedRules.includes(violation.id)
    );
    const unexpectedRuntimeErrors = runtimeErrors.filter(
      (message) =>
        !baseline.allowedPageErrors.includes(message) &&
        !baseline.allowedPageErrorPatterns.some((pattern) => pattern.test(message))
    );

    expect(criticalViolations).toEqual([]);
    expect(unexpectedRuntimeErrors).toEqual([]);
  });
}

test('collection controls preserve query-string navigation', async ({ page }) => {
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });
  const sort = page.locator('select[name="sort_by"]:visible').first();
  test.skip((await sort.count()) === 0, 'Collection fixture has no sort control');

  const values = await sort.locator('option').evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
  test.skip(values.length < 2, 'Collection fixture has fewer than two sort options');
  await sort.selectOption(values[1]);
  await expect.poll(() => new URL(page.url()).searchParams.get('sort_by')).toBe(values[1]);
});

test('product page exposes a usable product form', async ({ page }) => {
  await page.goto(fixtures.productMultiVariant, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1').first()).toBeVisible();
  const productForm = page.locator('form[action*="/cart/add"]:has([name="add"]):visible').first();
  await expect(productForm).toBeVisible();
  await expect(productForm.locator('[name="add"]')).toBeVisible();
});

test('mobile navigation can open and close with Escape', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('390'), 'Mobile-only interaction');
  await page.goto(fixtures.home, { waitUntil: 'domcontentloaded' });

  const summary = page.locator('header-drawer summary, menu-drawer summary').first();
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
});
