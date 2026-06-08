const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click the chevron toggle button (title="Editing tools")
  await page.click('button[title="Editing tools"]');
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'screen4.png' });
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
