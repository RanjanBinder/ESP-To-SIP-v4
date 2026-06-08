const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  // Default state — layers panel open
  await p.screenshot({ path: 'sc_layers_default.png' });

  // Click the Turnouts layer to activate it
  const rows = await p.$$('div[style*="cursor: pointer"]');
  // Click the "Turnouts" text in any layer row
  await p.getByText('Turnouts').first().click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'sc_layers_selected.png' });

  // Click Tracks chevron to collapse it
  await p.getByText('Tracks').first().click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'sc_layers_active.png' });

  await b.close();
  console.log('DONE');
})().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
