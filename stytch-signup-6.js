/**
 * Stytch signup v6 - try direct signup URLs and handle cookie modal properly
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const urlsToTry = [
    'https://stytch.com/register',
    'https://dashboard.stytch.com/register',
    'https://app.stytch.com/signup',
    'https://stytch.com/start',
    'https://stytch.com/pricing',
  ];

  for (const url of urlsToTry) {
    try {
      console.log(`\n=== Trying: ${url} ===`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      console.log('Title:', await page.title());
      console.log('URL after redirect:', page.url());

      // Handle cookie consent - look for iframes or shadow DOM
      const frames = page.frames();
      for (const f of frames) {
        const fUrl = f.url();
        if (fUrl.includes('trustarc') || fUrl.includes('consent') || fUrl.includes('cookies')) {
          console.log(`  Found consent frame: ${fUrl.substring(0,80)}`);
          try {
            const btn = f.locator('button:has-text("SUBMIT PREFERENCES"), button:has-text("Accept")').first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await btn.click();
              console.log('  Clicked accept in frame');
              await page.waitForTimeout(2000);
            }
          } catch(e) { console.log(`  Frame error: ${e.message.substring(0,80)}`); }
        }
      }

      // Also try clicking the submit preferences button directly (it's in the main page, not iframe)
      const submitPrefs = page.locator('button:has-text("SUBMIT PREFERENCES")').first();
      if (await submitPrefs.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitPrefs.click({ force: true });
        console.log('  Clicked Submit Preferences');
        await page.waitForTimeout(2000);
      }

      // List all visible buttons and inputs
      const btns = await page.locator('button:visible').all();
      console.log(`  Visible buttons: ${btns.length}`);
      for (const btn of btns) {
        const text = await btn.textContent();
        console.log(`    "${text?.trim()?.substring(0,60)}"`);
      }
      const inputs = await page.locator('input:visible').all();
      console.log(`  Visible inputs: ${inputs.length}`);
      for (const inp of inputs) {
        console.log(`    name=${await inp.getAttribute('name')}, type=${await inp.getAttribute('type')}, placeholder=${await inp.getAttribute('placeholder')}`);
      }

      // Also check for signup/register links
      const links = page.locator('a:visible');
      const linkCount = await links.count();
      for (let i = 0; i < Math.min(linkCount, 20); i++) {
        const text = await links.nth(i).textContent();
        const href = await links.nth(i).getAttribute('href');
        if (text?.toLowerCase().includes('sign') || text?.toLowerCase().includes('register') || href?.toLowerCase().includes('signup')) {
          console.log(`  Link: "${text?.trim().substring(0,40)}" -> ${href}`);
        }
      }

    } catch (err) {
      console.log(`  Error: ${err.message.substring(0,100)}`);
    }
  }

  await browser.close();
  console.log('\nDone.');
})();
