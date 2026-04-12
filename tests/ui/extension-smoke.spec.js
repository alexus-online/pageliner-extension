const { test, expect } = require('@playwright/test');
const { makeServer, launchExtensionContext, fireShortcut } = require('./helpers/extension-harness');

const HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PageLiner UI Smoke</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; min-height: 1400px; }
    #target-a { width: 380px; height: 220px; background: #e8eef8; border: 1px solid #9ab0d1; margin-bottom: 24px; }
    #target-b { width: 520px; height: 300px; background: #f5ece0; border: 1px solid #c9a274; }
  </style>
</head>
<body>
  <h1>PageLiner smoke page</h1>
  <div id="target-a"><div id="inner-a" style="width:70%;height:70%;margin:20px;background:#dce6f7">inner</div></div>
  <div id="target-b"></div>
</body>
</html>`;

test('extension smoke: spiral + hover + delete', async () => {
  const { server, url } = await makeServer(HTML);
  const context = await launchExtensionContext();

  try {
    for (const p of context.pages()) {
      await p.close();
    }
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    // DIV mode hover highlight (ALT+E by default)
    await fireShortcut(page, 'ALT+E');
    await page.hover('#target-a');
    await expect(page.locator('.pglnr-ext-spiral-hover-overlay')).toBeVisible({ timeout: 6000 });

    // Select hovered div
    await page.click('#target-a');
    const spiral = page.locator('.pglnr-ext-golden-spiral');
    await expect(spiral).toHaveCount(1);

    // transparent background check
    const bg = await page.locator('.pglnr-ext-golden-spiral-frame').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent').toBeTruthy();

    // delete
    await fireShortcut(page, 'ALT+X');
    await expect(spiral).toHaveCount(0);
  } finally {
    await context.close();
    server.close();
  }
});
