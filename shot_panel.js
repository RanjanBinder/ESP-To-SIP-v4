const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  // Default: nothing selected — canvas settings
  await p.screenshot({ path: 'sc_panel_canvas.png' });

  // Select a layer → layer properties
  await p.getByText('Turnouts').first().click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'sc_panel_layer.png' });

  // Screenshot just the right panel area
  const panel = await p.$('aside[style*="right: 0"]');
  if (panel) {
    await panel.screenshot({ path: 'sc_panel_crop.png' });
  }

  await b.close();
  console.log('DONE');
})().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
