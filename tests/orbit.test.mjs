import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

test('360° inspection, seamless paper and separated lock artwork', async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    await page.goto('http://127.0.0.1:5173/');
    await page.emulateMedia({reducedMotion:'reduce'});
    const phone=page.locator('#phone');
    await phone.focus();
    for(let i=0;i<30;i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(60);
    assert.ok(parseFloat(await phone.evaluate(e=>e.style.getPropertyValue('--phone-rotation')))>360);
    for(let i=0;i<30;i++) await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(60);
    assert.ok(parseFloat(await phone.evaluate(e=>e.style.getPropertyValue('--phone-tilt')))>360);
    await page.screenshot({path:'test-results/full-orbit.png'});
    await page.keyboard.press('Home');
    await page.locator('#fold').fill('100');
    await page.waitForTimeout(80);
    await page.locator('#inspect').click();
    const box=await page.locator('.message-left').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+70,{steps:10});
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.ok(Math.abs(parseFloat(await phone.evaluate(e=>e.style.getPropertyValue('--phone-tilt'))))>30);
    assert.match(await page.locator('#card-count').textContent(),/^01/);
    await page.locator('#view-front').click();
    assert.equal(await page.locator('#inspect').getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('.message-left').evaluate(e=>getComputedStyle(e,'::after').display),'none');
    await page.locator('#next').click();
    assert.match(await page.locator('#card-count').textContent(),/^02/);
    for(const width of [320,375,390,430,1280]){
      await page.setViewportSize({width,height:1000});
      await page.locator('#fold').fill('0');
      await page.waitForTimeout(100);
      assert.ok(await page.locator('.lock-screen').evaluate(screen=>{
        const art=screen.querySelector('.lock-art'),brand=screen.querySelector('.lock-brand');
        return art.offsetTop+art.offsetHeight < brand.offsetTop;
      }), `no Saturn / text overlap at ${width}px`);
      assert.match(await page.locator('.lock-year').evaluate(e=>getComputedStyle(e).color),/0\.57/);
    }
  } finally{await browser.close();}
});
