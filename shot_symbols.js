const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  // Click the Symbols rail icon (second icon, title="Symbols")
  await p.click('button[title="Symbols"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'sc_symbols_default.png' });

  // Crop to just the panel
  await p.screenshot({ path: 'sc_symbols_panel.png', clip: { x: 64, y: 48, width: 310, height: 852 } });

  // Click a symbol card to select it
  await p.getByText('Turnout 1:12').first().click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'sc_symbols_selected.png', clip: { x: 64, y: 48, width: 310, height: 852 } });

  await b.close();
  console.log('DONE');
})().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
