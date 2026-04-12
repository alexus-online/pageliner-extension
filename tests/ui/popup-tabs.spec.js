const { test, expect } = require('@playwright/test');
const { launchExtensionContext } = require('./helpers/extension-harness');

async function openPopupPage(context) {
  let [serviceWorker] = context.serviceWorkers();

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = serviceWorker.url().split('/')[2];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/page_action/page_action.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  return page;
}

test('popup hero chips switch real tab panels', async () => {
  const context = await launchExtensionContext();

  try {
    for (const existingPage of context.pages()) {
      await existingPage.close();
    }

    const page = await openPopupPage(context);

    await expect(page.locator('#grid-section')).toBeVisible();
    await expect(page.locator('#spiral-section')).toBeHidden();
    await expect(page.locator('#guides-section')).toBeHidden();
    await expect(page.locator('#presets-section')).toBeHidden();

    await page.click('#tab-spiral-section');
    await expect(page.locator('#spiral-section')).toBeVisible();
    await expect(page.locator('#grid-section')).toBeHidden();

    await page.click('#tab-guides-section');
    await expect(page.locator('#guides-section')).toBeVisible();
    await expect(page.locator('#grid-section')).toBeHidden();
    await expect(page.locator('#spiral-section')).toBeHidden();

    await page.click('#tab-presets-section');
    await expect(page.locator('#presets-section')).toBeVisible();
    await expect(page.locator('#settings-toggle')).toBeVisible();
    await expect(page.locator('#btn-export')).toBeVisible();
    await expect(page.locator('#grid-section')).toBeHidden();
  } finally {
    await context.close();
  }
});
