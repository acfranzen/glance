import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ 
  headless: true,
  defaultViewport: { width: 2560, height: 1440, deviceScaleFactor: 2 }
});
const page = await browser.newPage();
await page.goto('http://localhost:3333/dashboard', { waitUntil: 'networkidle0', timeout: 30000 });
// Wait a bit for widgets to render
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: 'public/glance.png', type: 'png' });
await browser.close();
console.log('Done - saved to public/glance.png');
