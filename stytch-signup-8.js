/**
 * Stytch signup v8 - try GitHub OAuth route
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    permissions: []
  });
  
  const page = await context.newPage();
  await page.route('**/*trustarc*', route => route.abort());
  await page.route('**/*consent*', route => route.abort());
  await page.route('**/*cookie*', route => route.abort());
  await page.route('**/*one-trust*', route => route.abort());

  await page.goto('https://stytch.com/dashboard/start-now', { 
    waitUntil: 'domcontentloaded', 
    timeout: 20000 
  });
  await page.waitForTimeout(2000);
  
  // Try "Continue with GitHub"
  const githubBtn = page.locator('button:has-text("Continue with GitHub")');
  if (await githubBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('GitHub button visible. Clicking...');
    // Don't actually click - will need GitHub auth
    // Instead, let's try the direct admin URL
    console.log('Not clicking - needs browser session. Trying alternative.');
  }
  
  // Try the direct dashboard URL
  await page.goto('https://dashboard.stytch.com', { 
    waitUntil: 'domcontentloaded', 
    timeout: 15000 
  });
  await page.waitForTimeout(3000);
  console.log('dashboard.stytch.com ->', page.url());
  console.log('Title:', await page.title());
  
  const btns = await page.locator('button:visible').all();
  console.log(`Buttons: ${btns.length}`);
  for (const btn of btns) {
    console.log(`  "${(await btn.textContent())?.trim()?.substring(0,60)}"`);
  }
  
  // Check for actual login form
  const allInputs = await page.locator('input').all();
  console.log(`Inputs: ${allInputs.length}`);
  for (const inp of allInputs) {
    console.log(`  name=${await inp.getAttribute('name')}, type=${await inp.getAttribute('type')}, placeholder=${await inp.getAttribute('placeholder')}`);
  }

  await browser.close();
  console.log('\nDone.');
})();
