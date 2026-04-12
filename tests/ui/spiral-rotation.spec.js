const { test, expect } = require('@playwright/test');
const { makeServer, launchExtensionContext, fireShortcut } = require('./helpers/extension-harness');

const HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PageLiner Rotation Check</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f7f7f7; }
    #box { width: 720px; height: 480px; background: #fff; border: 1px solid #bbb; position: relative; }
    h1 { margin: 16px; font-size: 56px; line-height: 1.05; color: #0d2a3a; }
    p { margin: 16px; font-size: 24px; color: #243745; }
  </style>
</head>
<body>
  <div id="box">
    <h1>Rotation Check</h1>
    <p>PageLiner spiral bounds test</p>
  </div>
</body>
</html>`;

function isPathInsideWrap(wrap, path, eps = 2) {
  return (
    path.left >= wrap.left - eps &&
    path.top >= wrap.top - eps &&
    path.right <= wrap.right + eps &&
    path.bottom <= wrap.bottom + eps
  );
}

test('golden spiral stays inside same box for 0/90/180/270', async () => {
  const { server, url } = await makeServer(HTML);
  const context = await launchExtensionContext();

  try {
    for (const p of context.pages()) {
      await p.close();
    }
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await fireShortcut(page, 'ALT+E');
    await page.hover('#box');
    await page.click('#box');
    await page.waitForTimeout(350);

    const spiralWrap = page.locator('.pglnr-ext-golden-spiral');
    const spiralPath = page.locator('.pglnr-ext-golden-spiral-path');
    const rotateBtn = page.locator('.pglnr-ext-golden-spiral-rotate');
    const hint = page.locator('.pglnr-ext-golden-spiral-hint');

    await expect(spiralWrap).toHaveCount(1);
    await expect(spiralPath).toHaveCount(1);

    const states = [];
    for (let i = 0; i < 4; i += 1) {
      const wrapRect = await spiralWrap.boundingBox();
      const pathRect = await spiralPath.boundingBox();

      expect(wrapRect).not.toBeNull();
      expect(pathRect).not.toBeNull();
      expect(isPathInsideWrap(wrapRect, pathRect)).toBeTruthy();

      const text = await hint.textContent();
      states.push({ rotation: text || '', wrapRect, pathRect });

      if (i < 3) {
        await rotateBtn.click();
        await page.waitForTimeout(220);
      }
    }

    expect(states[0].rotation.includes('0°')).toBeTruthy();
    expect(states[1].rotation.includes('90°')).toBeTruthy();
    expect(states[2].rotation.includes('180°')).toBeTruthy();
    expect(states[3].rotation.includes('270°')).toBeTruthy();
  } finally {
    await context.close();
    server.close();
  }
});
