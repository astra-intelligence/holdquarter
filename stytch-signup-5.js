/**
 * Stytch signup - handle cookie consent properly, fill email, press Enter
 * Enhanced version 5 - try to handle the TrustArc cookie frame
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('=== Stytch signup flow v5 ===');
    await page.goto('https://stytch.com/start-now', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);
    console.log('Page loaded:', await page.title());

    // Check all iframes
    const frames = page.frames();
    console.log(`Total frames: ${frames.length}`);
    for (const f of frames) {
      const url = f.url();
      if (url && !url.startsWith('about:blank')) {
        console.log(`  Frame: ${url.substring(0, 100)}`);
      }
    }

    // Try to find and handle the cookie consent iframe
    for (const f of frames) {
      if (f.url().includes('trustarc') || f.url().includes('cookies') || f.url().includes('consent')) {
        console.log(`Found consent frame: ${f.url()}`);
        try {
          const acceptBtn = f.locator('button:has-text("Accept"), button:has-text("Submit"), a:has-text("Accept")').first();
          if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await acceptBtn.click();
            console.log('Clicked accept in frame');
            await page.waitForTimeout(2000);
          }
        } catch (e) { console.log('Frame interaction failed:', e.message.substring(0,100)); }
      }
    }

    // Try clicking 'Submit Preferences' directly if cookie modal is visible
    const submitPrefs = page.locator('button:has-text("SUBMIT PREFERENCES"), button:has-text("Submit Preferences"), button:has-text("Accept All")').first();
    if (await submitPrefs.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitPrefs.click({ force: true });
      console.log('Clicked submit preferences');
      await page.waitForTimeout(2000);
    }

    // Try to click "Continue with email"
    const emailBtn = page.locator('button:has-text("Continue with email"), a:has-text("Continue with email")').first();
    if (await emailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailBtn.click({ force: true });
      console.log('Clicked "Continue with email"');
      await page.waitForTimeout(2000);
    } else {
      console.log('Continue with email button not visible - checking page state');
      const body = await page.locator('body').textContent();
      console.log('Body text (first 500):', body?.substring(0, 500).replace(/\s+/g, ' '));
    }

    // Fill email if visible
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('holdquarter@astraintelligence.co');
      console.log('Filled email');
      await emailInput.press('Enter');
      console.log('Pressed Enter');
      await page.waitForTimeout(3000);
      console.log('New page title:', await page.title());
      
      const inputs = await page.locator('input').all();
      console.log(`Found ${inputs.length} inputs after submit`);
      for (const input of inputs) {
        console.log(`  Input: name=${await input.getAttribute('name')}, type=${await input.getAttribute('type')}, placeholder=${await input.getAttribute('placeholder')}`);
      }
      
      const body = await page.locator('body').textContent();
      console.log('Body text (first 800):', body?.substring(0, 800).replace(/\s+/g, ' '));
    } else {
      console.log('Email input not found');
      // Look for any visible inputs
      const allInputs = await page.locator('input:visible').all();
      console.log(`Visible inputs: ${allInputs.length}`);
      for (const inp of allInputs) {
        console.log(`  Input: name=${await inp.getAttribute('name')}, type=${await inp.getAttribute('type')}`);
      }
      // Check buttons
      const btns = await page.locator('button:visible').all();
      console.log(`Visible buttons: ${btns.length}`);
      for (const btn of btns) {
        console.log(`  Button: "${(await btn.textContent())?.trim()?.substring(0, 80)}"`);
      }
    }

    await page.screenshot({ path: '/home/paperclip/stytch-flow-5.png', fullPage: true });
    console.log('Screenshot saved.');
    
  } catch (err) {
    console.error('Error:', err.message);
    try { await page.screenshot({ path: '/home/paperclip/stytch-error-5.png', fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }
})();
