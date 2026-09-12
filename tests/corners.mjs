import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('test-results', {recursive:true});
const page = await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});
await page.goto('http://127.0.0.1:5173/');
await page.screenshot({path:'test-results/desktop-closed.png',fullPage:true});
for (const fold of ['0','4','15','50','100']) {
 await page.locator('#fold').fill(fold);
 await page.waitForTimeout(800);
 await page.locator('.device-stage').screenshot({path:'test-results/corners-'+fold+'.png'});
}
console.log(JSON.stringify({errors}));
await browser.close();
