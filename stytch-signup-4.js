/**
 * Stytch signup - handle cookie consent, fill email, press Enter
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('=== Stytch signup flow v2 ===');
    await page.goto('https://stytch.com/start-now', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000); // wait for overlays
    console.log('Page loaded:', await page.title());

    // Try to dismiss cookie consent if present
    const cookieFrames = page.frameLocator('#pop-frame06966058979966723, iframe[name="trustarc_cm"], iframe[id*="trustarc"], iframe[id*="pop-frame"]');
    const cookieAcceptBtn = page.locator('button:has-text("Accept"), button:has-text("Accept All"), button:has-text("I Accept"), a:has-text("Accept")').first();
    if (await cookieAcceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cookieAcceptBtn.click();
      console.log('Dismissed cookie consent');
      await page.waitForTimeout(1000);
    }

    // Click "Continue with email"  
    const emailBtn = page.locator('button', { hasText: 'Continue with email' }).first();
    if (await emailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailBtn.click({ force: true });
      console.log('Clicked "Continue with email"');
      await page.waitForTimeout(2000);
    }

    // Fill email
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('holdquarter@astraintelligence.co');
      console.log('Filled email');
      // Press Enter to submit
      await emailInput.press('Enter');
      console.log('Pressed Enter');
      await page.waitForTimeout(3000);
      
      console.log('New page title:', await page.title());
      const inputs = await page.locator('input').all();
      console.log(`Found ${inputs.length} inputs`);
      for (const input of inputs) {
        const name = await input.getAttribute('name');
        const type = await input.getAttribute('type');
        const placeholder = await input.getAttribute('placeholder');
        console.log(`  Input: name=${name}, type=${type}, placeholder=${placeholder}`);
      }
      
      // Check page text for status
      const body = await page.locator('body').textContent();
      console.log('Body text (first 800):', body?.substring(0, 800));
    } else {
      console.log('Email input not found');
      // Try clicking the page somewhere to dismiss overlays
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(1000);
      
      // Check again
      const allInputs = await page.locator('input').all();
      console.log(`All inputs: ${allInputs.length}`);
      for (const inp of allInputs) {
        console.log(`  name=${await inp.getAttribute('name')}, type=${await inp.getAttribute('type')}`);
      }
    }

    await page.screenshot({ path: '/home/paperclip/stytch-flow-2.png', fullPage: true });
    console.log('Screenshot saved.');
    
  } catch (err) {
    console.error('Error:', err.message);
    try { await page.screenshot({ path: '/home/paperclip/stytch-error-2.png', fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }
})();
