/**
 * Stytch signup v7 - block cookie/consent scripts to bypass TrustArc
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    // Block 3rd party cookies and storage
    permissions: []
  });
  
  // Route: block TrustArc and cookie consent scripts
  const page = await context.newPage();
  await page.route('**/*trustarc*', route => route.abort());
  await page.route('**/*consent*', route => route.abort());
  await page.route('**/*cookie*', route => route.abort());
  await page.route('**/*cmp*', route => route.abort());
  await page.route('**/*one-trust*', route => route.abort());

  await page.goto('https://stytch.com/dashboard/start-now', { 
    waitUntil: 'domcontentloaded', 
    timeout: 20000 
  });
  await page.waitForTimeout(3000);
  console.log('Page after blocking:', await page.title());
  console.log('URL:', page.url());

  // Check if cookie modal is gone
  const submitPrefs = page.locator('button:has-text("SUBMIT PREFERENCES")');
  console.log('Cookie modal visible?', await submitPrefs.isVisible().catch(() => false));

  // List all visible buttons
  const btns = await page.locator('button:visible').all();
  console.log(`Buttons: ${btns.length}`);
  for (const btn of btns) {
    console.log(`  "${(await btn.textContent())?.trim()?.substring(0,60)}"`);
  }

  // Click "Continue with email"
  const emailBtn = page.locator('button:has-text("Continue with email")');
  if (await emailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailBtn.click();
    console.log('Clicked Continue with email');
    await page.waitForTimeout(2000);
  } else {
    console.log('Continue with email button not visible');
  }

  // Fill and submit
  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill('holdquarter@astraintelligence.co');
    console.log('Filled email');
    await emailInput.press('Enter');
    await page.waitForTimeout(4000);
    console.log('After submit URL:', page.url());
    console.log('After submit title:', await page.title());
    
    // Check for password/name fields now
    const newInputs = await page.locator('input').all();
    console.log(`Inputs after submit: ${newInputs.length}`);
    for (const input of newInputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const autoComplete = await input.getAttribute('autocomplete');
      console.log(`  Input: name=${name}, type=${type}, placeholder=${placeholder}, autocomplete=${autoComplete}`);
    }
    
    const body = await page.locator('body').textContent();
    console.log('Body:', body?.substring(0, 1000).replace(/\s+/g, ' '));
    
    await page.screenshot({ path: '/home/paperclip/stytch-flow-7.png', fullPage: true });
    console.log('Screenshot saved.');
  } else {
    console.log('Email input not found');
    await page.screenshot({ path: '/home/paperclip/stytch-flow-7-noinput.png', fullPage: true });
  }

  await browser.close();
  console.log('\nDone.');
})();
