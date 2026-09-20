import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Keep discovery pending and never contact the live API from the preview.
  await page.route('**/api/nansen/**',route=>new Promise(()=>{}));
  await page.goto('http://127.0.0.1:5173');
  await page.locator('.match-search').waitFor();
  for (const theme of ['light','dark']) {
    await page.locator('.app-frame').evaluate((el,t)=>el.setAttribute('data-theme',t),theme);
    const geometry=await page.locator('.match-search').evaluate(el=>{
      const card=el.getBoundingClientRect(),heart=el.querySelector('.loading-heart').getBoundingClientRect(),label=el.querySelector('p').getBoundingClientRect();
      return {cardCenter:{x:card.x+card.width/2,y:card.y+card.height/2},groupCenter:{x:heart.x+heart.width/2,y:(heart.top+label.bottom)/2},placeholderCount:el.querySelectorAll('.skeleton').length,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.ok(Math.abs(geometry.cardCenter.x-geometry.groupCenter.x)<1);
    assert.ok(Math.abs(geometry.cardCenter.y-geometry.groupCenter.y)<1);
    assert.equal(geometry.placeholderCount,0);
    assert.equal(geometry.overflow,false);
    await page.screenshot({path:`artifacts/audit-2026-09-20/loading-${theme}.png`});
    console.log(JSON.stringify({theme,...geometry}));
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
