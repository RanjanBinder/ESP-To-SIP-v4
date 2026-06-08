const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  // Crop to right panel bottom area
  const clip = { x: 1080, y: 700, width: 360, height: 200 };

  // Default state — strip closed
  await p.screenshot({ path: 'sc_scale_closed.png', clip });

  // Open the dropdown by clicking the scale ruler
  await p.click('text=41123 cm');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'sc_scale_open.png', clip: { x: 1080, y: 400, width: 360, height: 500 } });

  // Full right panel screenshot
  await p.screenshot({ path: 'sc_right_full.png', clip: { x: 1080, y: 48, width: 360, height: 852 } });

  await b.close();
  console.log('DONE');
})().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
