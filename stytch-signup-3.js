/**
 * Stytch signup - click "Continue with email" and fill form
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('=== Stytch signup flow ===');
    await page.goto('https://stytch.com/start-now', { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('Page loaded:', await page.title());

    // Click "Continue with email"
    const emailBtn = page.locator('button', { hasText: 'Continue with email' });
    if (await emailBtn.isVisible()) {
      await emailBtn.click();
      console.log('Clicked "Continue with email"');
      await page.waitForTimeout(2000);
      
      // Check for inputs after click
      const inputs = await page.locator('input').all();
      console.log(`Found ${inputs.length} input fields after click`);
      for (const input of inputs) {
        const name = await input.getAttribute('name');
        const type = await input.getAttribute('type');
        const placeholder = await input.getAttribute('placeholder');
        const id = await input.getAttribute('id');
        console.log(`  Input: name=${name}, type=${type}, placeholder=${placeholder}, id=${id}`);
      }

      const buttons = await page.locator('button').all();
      console.log(`Found ${buttons.length} buttons`);
      for (const btn of buttons) {
        const text = await btn.textContent();
        console.log(`  Button: "${text?.trim()?.substring(0, 80)}"`);
      }

      // Try to fill in email
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill('holdquarter@astraintelligence.co');
        console.log('Filled email');
        
        // Look for continue/submit button
        const submitBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Next")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          console.log('Clicked submit');
          await page.waitForTimeout(3000);
          
          // Check what happened
          console.log('New page title:', await page.title());
          const pageContent = await page.content();
          console.log('Page content (first 500 chars):', pageContent.substring(0, 500));
          
          // Check for error or password field
          const inputs2 = await page.locator('input').all();
          console.log(`Inputs after submit: ${inputs2.length}`);
          for (const input of inputs2) {
            const name = await input.getAttribute('name');
            const type = await input.getAttribute('type');
            const placeholder = await input.getAttribute('placeholder');
            console.log(`  Input: name=${name}, type=${type}, placeholder=${placeholder}`);
          }
        }
      }
    }
    
    await page.screenshot({ path: '/home/paperclip/stytch-flow.png', fullPage: true });
    console.log('Screenshot saved.');
    
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/home/paperclip/stytch-error.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
