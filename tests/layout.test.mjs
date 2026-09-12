import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base = 'http://127.0.0.1:5173/';
// Sizes the piece must hold in a single screen.
const oneScreen = [[1920,1080],[1440,900],[1440,800],[1366,768],[1280,720],[1024,768],[900,700],[768,1024],[430,932],[390,844],[375,812],[375,667],[320,640]];
// iPhone Duo unfolded: 164.6 x 117.8 mm. The body is this shape at every size.
const DEVICE_RATIO = 164.6 / 117.8;

async function settle(page, value) {
  await page.locator('#fold').fill(String(value));
  await page.waitForFunction(v => Math.abs(parseFloat(document.querySelector('#phone').style.getPropertyValue('--fold-angle')) - (180 * (1 - Number(v) / 100))) < .05, String(value));
}

test('the whole piece holds one screen, controls included', async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const [width, height] of oneScreen) {
      const context = await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600,deviceScaleFactor:2});
      const page = await context.newPage();
      await page.goto(base);
      const closed = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      assert.ok(closed <= 0, `closed overflows by ${closed}px at ${width}x${height}`);
      await settle(page, 100);
      const open = await page.evaluate(() => ({
        over: document.documentElement.scrollHeight - innerHeight,
        controls: Math.round(document.querySelector('#reader-controls').getBoundingClientRect().bottom),
        wide: document.documentElement.scrollWidth > innerWidth,
        fits: (card => card.scrollHeight <= card.clientHeight + 1)(document.querySelector('.message-flat .message-card')),
      }));
      assert.ok(open.over <= 0, `open overflows by ${open.over}px at ${width}x${height}`);
      assert.equal(open.wide, false, `horizontal overflow at ${width}x${height}`);
      assert.ok(open.controls <= height, `reader controls fall below the fold at ${width}x${height}`);
      assert.ok(open.fits, `card overflows at ${width}x${height}`);
      await context.close();
    }
  } finally { await browser.close(); }
});

test('the body keeps the real device ratio at every size', async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const [width, height] of oneScreen) {
      const context = await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
      const page = await context.newPage();
      await page.goto(base);
      for (const fold of [0, 100]) {
        await settle(page, fold);
        const body = await page.evaluate(() => {
          const style = getComputedStyle(document.querySelector('#phone'));
          return {width: parseFloat(style.width), height: parseFloat(style.height)};
        });
        const ratio = body.width / body.height;
        assert.ok(Math.abs(ratio - DEVICE_RATIO) < .01,
          `body is ${ratio.toFixed(3)}:1 at ${width}x${height} (fold ${fold}), expected ${DEVICE_RATIO.toFixed(3)}:1`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
});

test('the lock-screen cue opens the phone and clears the brand', async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const [width, height] of [[1440,820],[390,844],[375,812]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
      const page = await context.newPage();
      await page.goto(base);
      const clearance = await page.evaluate(() =>
        document.querySelector('.lock-cue').getBoundingClientRect().top -
        document.querySelector('.lock-brand').getBoundingClientRect().bottom);
      assert.ok(clearance > 0, `cue overlaps the brand by ${Math.round(-clearance)}px at ${width}x${height}`);
      // The visible glyph is proportional to the device; what has to clear 44px
      // is the area a finger can actually land on.
      const reach = await page.evaluate(() => {
        const box = document.querySelector('#lock-open').getBoundingClientRect();
        const x = box.left + box.width / 2, y = box.top + box.height / 2;
        const hits = d => !!document.elementFromPoint(x, y + d)?.closest('#lock-open');
        let up = 0, down = 0;
        while (up < 40 && hits(-(up + 1))) up++;
        while (down < 40 && hits(down + 1)) down++;
        return {vertical: up + down, horizontal: box.width};
      });
      assert.ok(reach.vertical >= 44, `cue reaches only ${reach.vertical}px vertically at ${width}x${height}`);
      await page.locator('#lock-open').click();
      await page.waitForFunction(() => document.querySelector('#phone').classList.contains('readable'), null, {timeout: 4000});
      assert.equal(await page.locator('#fold').inputValue(), '100');
      // Turned away, the cue must not stay reachable by keyboard.
      assert.equal(await page.evaluate(() => document.querySelector('.cover').inert), true);
      await context.close();
    }
  } finally { await browser.close(); }
});

test('the message sits centred between the two rules', async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:820}});
    await page.goto(base);
    await settle(page, 100);
    const gaps = await page.evaluate(() => {
      const card = document.querySelector('.message-flat .message-card');
      const rect = selector => card.querySelector(selector).getBoundingClientRect();
      return {above: rect('.card-copy').top - rect('.paper-heading').bottom,
              below: rect('.paper-foot').top - rect('.card-copy').bottom};
    });
    assert.ok(Math.abs(gaps.above - gaps.below) < 6,
      `copy is off centre: ${Math.round(gaps.above)}px above, ${Math.round(gaps.below)}px below`);
  } finally { await browser.close(); }
});
