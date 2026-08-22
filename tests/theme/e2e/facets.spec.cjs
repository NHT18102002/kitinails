const { test, expect } = require('@playwright/test');
const fixtures = require('../storefront-fixtures.cjs');

const waitForParam = async (page, name, expected) => {
  await expect.poll(() => new URL(page.url()).searchParams.getAll(name)).toContain(expected);
};

test('collection filter, clear, back and forward preserve the query contract', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('390'), 'Desktop facets scenario');
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });

  const checkbox = page.locator('#FacetFiltersForm input[type="checkbox"]:visible:not(:disabled)').first();
  test.skip((await checkbox.count()) === 0, 'Collection fixture has no checkbox filter');

  const name = await checkbox.getAttribute('name');
  const value = await checkbox.getAttribute('value');
  test.skip(!name || !value, 'Collection filter is missing its query contract');

  const initialUrl = page.url();
  await checkbox.evaluate((input) => input.click());
  await waitForParam(page, name, value);
  const filteredUrl = page.url();
  expect(filteredUrl).not.toBe(initialUrl);

  await page.evaluate(() => history.back());
  await expect.poll(() => page.url()).toBe(initialUrl);
  await page.evaluate(() => history.forward());
  await expect.poll(() => page.url()).toBe(filteredUrl);

  const clearControl = page.locator('.active-facets-desktop facet-remove a.active-facets__button:visible').first();
  await expect(clearControl).toBeVisible();
  await clearControl.click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll(name)).not.toContain(value);
});

test('mobile collection facets defer changes until Apply', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('390'), 'Mobile facets scenario');
  await page.goto(fixtures.collection, { waitUntil: 'domcontentloaded' });

  const disclosure = page.locator('[data-mobile-facets-disclosure]').first();
  const summary = disclosure.locator(':scope > summary').first();
  test.skip((await summary.count()) === 0, 'Collection fixture has no mobile facets drawer');
  await summary.click({ force: true });
  await expect(disclosure).toHaveAttribute('open', '');

  const checkbox = disclosure.locator('#FacetFiltersFormMobile input[type="checkbox"]:not(:disabled)').first();
  test.skip((await checkbox.count()) === 0, 'Collection fixture has no mobile checkbox filter');
  const name = await checkbox.getAttribute('name');
  const value = await checkbox.getAttribute('value');
  test.skip(!name || !value, 'Mobile filter is missing its query contract');

  const urlBeforeDraft = page.url();
  await checkbox.evaluate((input) => input.click());
  await page.waitForTimeout(900);
  expect(page.url()).toBe(urlBeforeDraft);

  const apply = disclosure.locator('#FacetFiltersFormMobile > .mobile-facets__inner [data-mobile-apply]:visible').last();
  await expect(apply).toBeVisible();
  await apply.click();
  await waitForParam(page, name, value);
});

test('search sorting preserves the canonical product query', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('390'), 'Desktop search sort scenario');
  await page.goto(fixtures.searchResults, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => new URL(page.url()).searchParams.has('display_q')).toBeTruthy();

  const sort = page.locator("main[data-template='search'] select[name='sort_by']:visible").first();
  test.skip((await sort.count()) === 0, 'Search fixture has no sort control');
  const values = await sort.locator('option').evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
  test.skip(values.length < 2, 'Search fixture has fewer than two sort options');

  const queryBeforeSort = new URL(page.url()).searchParams.get('q');
  await sort.selectOption(values[1]);
  await waitForParam(page, 'sort_by', values[1]);
  expect(new URL(page.url()).searchParams.get('q')).toBe(queryBeforeSort);
});
