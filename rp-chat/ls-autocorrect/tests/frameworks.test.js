const { chromium } = require('playwright');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, n = 0;
const check = (name, got, want) => { n++; const ok = got === want; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`)); };
(async () => {
  const b = await chromium.launch();
  for (const fw of ['vue', 'react']) {
    const page = await b.newPage();
    await page.goto('file://' + path.resolve(__dirname, fw + '.html')); await sleep(500);
    const input = page.locator('#msg');
    await input.pressSequentially('здраствуйте как дела харашо', { delay: 45 }); await sleep(2500);
    check(`${fw}: в поле исправлено`, await input.inputValue(), 'здравствуйте как дела харашо');
    check(`${fw}: состояние фреймворка видит исправление`, await page.locator('#model').textContent(), 'здравствуйте как дела харашо');
    await page.keyboard.press('Enter'); await sleep(400);
    check(`${fw}: отправлено с исправленным последним словом`, (await page.evaluate(() => window.sent || [])).pop(), 'здравствуйте как дела хорошо');
    await page.close();
  }
  await b.close();
  console.log(`frameworks: ${n} checks, ${fails} failures`);
})().catch((e) => { console.error(e); process.exit(2); });
