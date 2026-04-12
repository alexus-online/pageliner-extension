const { chromium } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

async function makeServer(html) {
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

function makeUserDataDir(prefix = 'pageliner-pw-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function launchExtensionContext() {
  const extensionPath = path.resolve(__dirname, '..', '..', '..');
  const userDataDir = makeUserDataDir();
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
}

async function fireShortcut(page, combo) {
  await page.evaluate((shortcut) => {
    const parts = shortcut.toUpperCase().split('+');
    const key = parts[parts.length - 1];
    const ev = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      altKey: parts.includes('ALT'),
      ctrlKey: parts.includes('CTRL'),
      shiftKey: parts.includes('SHIFT'),
      metaKey: parts.includes('META')
    });
    window.dispatchEvent(ev);
  }, combo);
}

module.exports = {
  makeServer,
  launchExtensionContext,
  fireShortcut
};
