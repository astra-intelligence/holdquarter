/**
 * Stytch signup - try the /start-now page
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('=== Trying Stytch /start-now ===');
    await page.goto('https://stytch.com/start-now', { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('Page title:', await page.title());
    
    // Look for all input fields
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input fields`);
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      console.log(`  Input: name=${name}, type=${type}, placeholder=${placeholder}, id=${id}, aria-label=${ariaLabel}`);
    }
    
    // Look for all buttons
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons`);
    for (const btn of buttons) {
      const text = await btn.textContent();
      console.log(`  Button: "${text?.trim()?.substring(0, 80)}"`);
    }

    // Check for forms
    const forms = await page.locator('form').all();
    console.log(`Found ${forms.length} forms`);

    // Take screenshot
    await page.screenshot({ path: '/home/paperclip/stytch-start-now.png', fullPage: false });
    console.log('Screenshot saved.');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
