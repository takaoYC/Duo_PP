import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';

const base = 'http://127.0.0.1:5173/';
async function open(page, value = '100') {
  await page.locator('#fold').fill(value);
  await page.waitForFunction(v => Math.abs(parseFloat(document.querySelector('#phone').style.getPropertyValue('--fold-angle')) - (180 * (1-Number(v)/100))) < .05, value);
}
async function front(page) {
  await page.locator('#view-front').click();
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('#phone').style.getPropertyValue('--phone-rotation'))) < .05);
}
async function swipe(page, x, y, dx) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();
}

test('Chrome: fold, mouse rotation, navigation, storage, keyboard and reduced motion', async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    const errors=[], remote=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});
    page.on('request',r=>{if(!r.url().startsWith(base) && !r.url().startsWith('data:')) remote.push(r.url())});
    await page.goto(base);
    assert.equal(await page.locator('#fold').inputValue(),'4');
    assert.equal(await page.locator('.lock-year').textContent(),'2014');
    const stage=page.locator('.device-stage');
    const initial=await page.locator('#phone').evaluate(e=>e.style.getPropertyValue('--phone-rotation'));
    const box=await page.locator('.cover').boundingBox();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.5+170,box.y+box.height*.5,{steps:12});
    await page.mouse.up();
    await page.waitForTimeout(500);
    assert.notEqual(await page.locator('#phone').evaluate(e=>e.style.getPropertyValue('--phone-rotation')),initial);
    await page.locator('#view-back').click();
    await page.waitForTimeout(700);
    assert.ok(Math.abs(parseFloat(await page.locator('#phone').evaluate(e=>e.style.getPropertyValue('--phone-rotation'))) - 180)<.1);
    const back=await page.locator('.half-right .back').boundingBox(), bounds=await stage.boundingBox();
    assert.ok(Math.abs(back.x+back.width/2-(bounds.x+bounds.width/2))<25,'closed back remains centred');
    assert.equal(await page.locator('.back').first().evaluate(e=>getComputedStyle(e).backfaceVisibility),'hidden');
    await front(page);
    for(const value of ['0','25','50','75','90','100']) await open(page,value);
    assert.equal(await page.locator('#reader-controls').evaluate(e=>e.inert),false);
    await page.locator('#previous').click();
    assert.match(await page.locator('#card-count').textContent(),/^57/);
    await page.locator('#next').click();
    assert.match(await page.locator('#card-count').textContent(),/^01/);
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('#card-count').textContent(),/^02/);
    await page.keyboard.press('ArrowLeft');
    assert.match(await page.locator('#card-count').textContent(),/^01/);
    await page.locator('#fold').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#fold').inputValue(),'99');
    assert.match(await page.locator('#card-count').textContent(),/^01/);
    await open(page);
    await page.locator('button[data-theme="dark"]').click();
    await page.locator('button[data-font="large"]').click();
    assert.equal(await page.locator('#message-card').getAttribute('data-theme'),'dark');
    await page.reload();await front(page);await open(page);
    assert.equal(await page.locator('#message-card').getAttribute('data-theme'),'dark');
    assert.equal(await page.locator('#message-card').getAttribute('data-font'),'large');
    const {cards}=await page.evaluate(async()=>({cards:(await import('/src/data/cards.ts')).cards}));
    assert.equal(cards.length,57);
    assert.ok(cards.every(c=>[...c.message].length<=100));
    await page.emulateMedia({reducedMotion:'reduce'});
    await open(page,'50');
    assert.equal(await page.locator('#phone').evaluate(e=>e.style.getPropertyValue('--fold-angle')),'90deg');
    await open(page);
    await page.locator('#next').click();
    assert.equal(await page.locator('#card-copy').evaluate(e=>e.getAnimations().length),0);
    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
  } finally {await browser.close();}
});

test('Chrome touch: 320–430px, swipe separation, long cards and persisted themes', async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const width of [320,375,390,430,768]) {
      const context=await browser.newContext({viewport:{width,height:1000},isMobile:true,hasTouch:true,deviceScaleFactor:2});
      const page=await context.newPage();
      await page.goto(base);await front(page);
      const box=await page.locator('.cover').boundingBox();
      await swipe(page,box.x+box.width*.5,box.y+box.height*.5,90);
      await page.waitForTimeout(500);
      assert.ok(parseFloat(await page.locator('#phone').evaluate(e=>e.style.getPropertyValue('--phone-rotation')))>20,'touch rotates body');
      assert.match(await page.locator('#card-count').textContent(),/^01/);
      await front(page);await open(page);
      await page.locator('button[data-font="large"]').click();
      await page.locator('#phone').scrollIntoViewIfNeeded();
      const cardBox=await page.locator('.message-right').boundingBox();
      const rotation=await page.locator('#phone').evaluate(e=>e.style.getPropertyValue('--phone-rotation'));
      await swipe(page,cardBox.x+cardBox.width*.8,cardBox.y+cardBox.height*.5,-70);
      assert.match(await page.locator('#card-count').textContent(),/^02/);
      assert.equal(await page.locator('#phone').evaluate(e=>e.style.getPropertyValue('--phone-rotation')),rotation,'card swipe does not rotate phone');
      await swipe(page,cardBox.x+cardBox.width*.2,cardBox.y+cardBox.height*.5,70);
      assert.match(await page.locator('#card-count').textContent(),/^01/);
      const geometry=await page.evaluate(()=>{
        const card=document.querySelector('#message-card'),copy=document.querySelector('#card-copy');
        return {overflow:document.documentElement.scrollWidth>innerWidth,content:copy.scrollHeight,height:card.clientHeight};
      });
      assert.equal(geometry.overflow,false,`horizontal overflow at ${width}`);
      for(let index=0;index<57;index++){
        const fits=await page.locator('#message-card').evaluate(card=>{
          const signature=card.querySelector('.signature').getBoundingClientRect();
          const foot=card.querySelector('.paper-foot').getBoundingClientRect();
          return signature.bottom<=foot.top && card.scrollHeight<=card.clientHeight+1;
        });
        assert.ok(fits,`card ${index+1} fits large at ${width}`);
        await page.locator('#next').click();
      }
      // Boundary fixture: exactly 100 full-width Chinese characters.
      await page.evaluate(async()=>{
        const {cards}=await import('/src/data/cards.ts');
        cards[1].message='星'.repeat(100);
      });
      await page.locator('#next').click();
      assert.ok(await page.locator('#message-card').evaluate(card=>card.scrollHeight<=card.clientHeight+1),`100-character large card fits at ${width}`);
      await context.close();
    }
  } finally {await browser.close();}
});

test('WebKit: desktop and iPhone-sized layout, fold and reader controls', {skip: process.env.DUO_WEBKIT !== '1' ? 'Optional WebKit run: DUO_WEBKIT=1; installed engine crashes on this macOS host.' : false}, async () => {
  const browser=await webkit.launch({headless:true});
  try {
    for(const width of [1440,320,375,390,430]) {
      const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width<500,isMobile:width<500});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base);await front(page);await open(page);
      await page.locator('#next').click();
      assert.match(await page.locator('#card-count').textContent(),/^02/);
      await page.locator('button[data-theme="dark"]').click();
      await page.locator('button[data-font="large"]').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`test-results/webkit-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally {await browser.close();}
});
