/**
 * Stytch signup - use full Chrome binary, not headless shell
 */
const { chromium } = require('playwright');
const path = require('path');

const chromePath = path.join(
  process.env.HOME,
  '.cache/ms-playwright/chromium-1223/chrome-linux/chrome'
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('=== Stytch signup flow ===');
    console.log('Navigating to stytch.com/start-now...');

    // Route: block cookie/consent scripts
    await page.route('**/*trustarc*', route => route.abort());
    await page.route('**/*consent*', route => route.abort());
    await page.route('**/*cookie*', route => route.abort());
    await page.route('**/*one-trust*', route => route.abort());

    await page.goto('https://stytch.com/start-now', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('Page loaded:', await page.title());
    console.log('URL:', page.url());

    // Look for all visible buttons
    const btns = await page.locator('button:visible').all();
    console.log(`Visible buttons: ${btns.length}`);
    for (const btn of btns) {
      console.log(`  "${(await btn.textContent())?.trim()?.substring(0,60)}"`);
    }

    // Look for input fields
    const inputs = await page.locator('input:visible').all();
    console.log(`Visible inputs: ${inputs.length}`);
    for (const inp of inputs) {
      console.log(`  name=${await inp.getAttribute('name')}, type=${await inp.getAttribute('type')}, placeholder=${await inp.getAttribute('placeholder')}`);
    }

    // Look for links
    const links = await page.locator('a:visible').all();
    console.log(`Visible links: ${links.length}`);
    for (let i = 0; i < Math.min(links.length, 15); i++) {
      const text = await links.nth(i).textContent();
      const href = await links.nth(i).getAttribute('href');
      console.log(`  "${text?.trim()?.substring(0,40)}" -> ${href?.substring(0,80)}`);
    }

    // Try clicking "Continue with email" if present
    const emailBtn = page.locator('button:has-text("Continue with email")').first();
    if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBtn.click();
      console.log('Clicked Continue with email');
      await page.waitForTimeout(2000);
    } else {
      console.log('No "Continue with email" button found');
    }

    // Fill email field if visible
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill('holdquarter@astraintelligence.co');
      console.log('Filled email');
      await emailInput.press('Enter');
      console.log('Pressed Enter');
      await page.waitForTimeout(3000);
      console.log('After submit URL:', page.url());
      console.log('Title:', await page.title());
      
      // Wait for next page
      await page.waitForTimeout(2000);
      const inputs2 = await page.locator('input:visible').all();
      console.log(`Inputs after submit: ${inputs2.length}`);
      for (const inp of inputs2) {
        console.log(`  name=${await inp.getAttribute('name')}, type=${await inp.getAttribute('type')}`);
      }
    } else {
      console.log('No email field visible');
      // Try direct signup URL
      console.log('Trying direct signup URL...');
      await page.goto('https://dashboard.stytch.com/register', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      console.log('dashboard register URL:', page.url());
    }

  } catch (err) {
    console.log('Error:', err.message.substring(0,200));
  }

  await browser.close();
  console.log('\nDone.');
})();
