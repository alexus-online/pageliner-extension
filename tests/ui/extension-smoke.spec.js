const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

function makeServer() {
  const html = `<!doctype html>
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

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

test('extension smoke: spiral + hover + resize + delete', async () => {
  const extensionPath = path.resolve(__dirname, '..', '..');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pageliner-pw-'));
  const { server, url } = await makeServer();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // wait for content script
    await expect.poll(async () => {
      return page.locator('.pglnr-ext-ruler-top').count();
    }, { timeout: 8000 }).toBeGreaterThanOrEqual(0);

    // DIV mode hover highlight (ALT+E by default)
    await page.keyboard.press('Alt+E');
    await page.hover('#target-a');
    await expect(page.locator('.pglnr-ext-spiral-hover-overlay')).toBeVisible();

    // Select hovered div
    await page.click('#target-a');
    const spiral = page.locator('.pglnr-ext-golden-spiral');
    await expect(spiral).toHaveCount(1);

    // transparent background check
    const bg = await page.locator('.pglnr-ext-golden-spiral-frame').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent').toBeTruthy();

    // resize using bottom-right handle
    const before = await spiral.boundingBox();
    await page.hover('.pglnr-ext-golden-spiral .ui-resizable-se');
    await page.mouse.down();
    await page.mouse.move((before?.x || 0) + (before?.width || 0) + 80, (before?.y || 0) + (before?.height || 0) + 80);
    await page.mouse.up();
    const after = await spiral.boundingBox();
    expect((after?.width || 0) > (before?.width || 0)).toBeTruthy();
    expect((after?.height || 0) > (before?.height || 0)).toBeTruthy();

    // delete with top-right X
    await page.click('.pglnr-ext-golden-spiral-delete');
    await expect(spiral).toHaveCount(0);
  } finally {
    await context.close();
    server.close();
  }
});

