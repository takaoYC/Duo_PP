import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const response=await p.goto('https://www.apple.com/tw/iphone-duo/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
const slider=p.locator('input[type="range"]').first();
await slider.scrollIntoViewIfNeeded();
await p.waitForTimeout(1500);
console.log(JSON.stringify({visible:await slider.isVisible(),count:await slider.count(),box:await slider.boundingBox()}));
for(const value of ['0','0.5','1']) {
 await slider.fill(value);
 await p.waitForTimeout(1200);
 await p.screenshot({path:'test-results/reference-fold-'+value+'.png'});
}
await b.close();
