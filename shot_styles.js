const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);

  // Click Styles rail icon
  await p.click('button[title="Styles"]');
  await p.waitForTimeout(600);

  // Default — Text section expanded
  await p.screenshot({ path: 'sc_styles_text.png', clip: { x: 64, y: 48, width: 306, height: 852 } });

  // Expand Shapes section
  await p.getByText('Shapes').first().click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'sc_styles_shapes.png', clip: { x: 64, y: 48, width: 306, height: 852 } });

  // Expand Annotations section (collapse Text first)
  await p.getByText('Text').first().click(); // collapse text
  await p.waitForTimeout(200);
  await p.getByText('Annotations').first().click(); // expand annotations
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'sc_styles_annotations.png', clip: { x: 64, y: 48, width: 306, height: 852 } });

  // Full editor view with styles panel
  await p.screenshot({ path: 'sc_styles_full.png' });

  await b.close();
  console.log('DONE');
})().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
