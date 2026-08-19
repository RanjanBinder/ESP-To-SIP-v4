const { chromium } = require('playwright-core');
const out = process.argv[2];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out, fullPage: false });
  const rootHtmlLen = await page.evaluate(() => document.getElementById('root').innerHTML.length);
  console.log('TITLE:', await page.title());
  console.log('ROOT_HTML_LENGTH:', rootHtmlLen);
  console.log('CONSOLE_ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 10), null, 2) : 'none');
  await browser.close();
})().catch(e => { console.error('DRIVER_ERROR', e); process.exit(1); });
