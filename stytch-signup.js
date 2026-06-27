/**
 * Automated Stytch account signup attempt.
 * Try different signup URLs.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const urlsToTry = [
    'https://stytch.com/start',
    'https://dashboard.stytch.com/register',
    'https://stytch.com/contact/sales',
  ];

  for (const url of urlsToTry) {
    try {
      console.log(`\n=== Trying: ${url} ===`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log('Page title:', await page.title());
      
      // Look for form elements
      const inputs = await page.locator('input').all();
      console.log(`Found ${inputs.length} input fields`);
      for (const input of inputs) {
        const name = await input.getAttribute('name');
        const type = await input.getAttribute('type');
        const placeholder = await input.getAttribute('placeholder');
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        if (name || type || placeholder || id || ariaLabel) {
          console.log(`  Input: name=${name}, type=${type}, placeholder=${placeholder}, id=${id}, aria-label=${ariaLabel}`);
        }
      }
      
      // Look for buttons
      const buttons = await page.locator('button').all();
      console.log(`Found ${buttons.length} buttons`);
      for (const btn of buttons) {
        const text = await btn.textContent();
        console.log(`  Button: "${text?.trim()?.substring(0, 60)}"`);
      }

      // Look for links with signup/register
      const links = await page.locator('a').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        if (href && (href.includes('signup') || href.includes('register') || href.includes('start'))) {
          console.log(`  Link: "${text?.trim()?.substring(0, 50)}" -> ${href}`);
        }
      }

      // Take screenshot
      await page.screenshot({ path: `/home/paperclip/stytch-${urlsToTry.indexOf(url)}.png`, fullPage: false });
      
    } catch (err) {
      console.log(`  Failed: ${err.message?.substring(0, 100)}`);
    }
  }

  await browser.close();
  console.log('\nDone.');
})();
