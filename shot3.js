const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);

  // List all chevron buttons to verify titles
  const chevrons = await p.$$('button[title]');
  for (const c of chevrons) {
    const t = await c.getAttribute('title');
    console.log('chevron title:', t);
  }

  // Click Railway Elements dropdown
  await p.click('button[title="Railway Elements"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'sc_railway.png' });

  // Click Editing tools dropdown (closes Railway first via toggle logic)
  await p.click('button[title="Editing tools"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'sc_editing.png' });

  await b.close();
  console.log('DONE');
})().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
