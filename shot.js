const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screen.png', fullPage: false });
  console.log('SCREENSHOT_SAVED');
  console.log('CONSOLE_ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none');
  await browser.close();
})().catch(e => { console.error('DRIVER_ERROR', e); process.exit(1); });
