import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({timezoneId:'Europe/London'});
 // These fixtures test navigation and preservation, not YouTube's date semantics.
 // Date-operator accuracy and actual thumbnail previews require live testing.
 const files=await Promise.all(['dates.js','search.js','content.js','styles.css'].map(n=>readFile(`dist/${n}`,'utf8')));
 const source=files.slice(0,3).map(text=>`<script>${text}</script>`).join('');
 const group='<ytd-search-filter-group-renderer><div id="title">Upload date</div><ytd-search-filter-renderer><a href="/results?search_query=bees&sp=EgIIAQ%3D%3D">Last hour</a></ytd-search-filter-renderer><ytd-search-filter-renderer><a href="/results?search_query=bees&sp=EgIIAg%3D%3D">Today</a></ytd-search-filter-renderer></ytd-search-filter-group-renderer>';
 const fixture=`<!doctype html><html><body><ytd-search>${group}<div id="primary"><ytd-section-list-renderer><div id="contents"><ytd-item-section-renderer><ytd-video-renderer id="native-video"><a href="/watch?v=abcdefghijk" id="thumbnail"><span class="duration">12:34</span></a><h3>Native video title</h3><span>1M views · 4 months ago</span><a href="/@native">Native channel ✓</a><span>4K CC New</span></ytd-video-renderer></ytd-item-section-renderer><ytd-continuation-item-renderer></ytd-continuation-item-renderer></div></ytd-section-list-renderer></div></ytd-search><style>${files[3]}</style>${source}</body></html>`;
 const navigations=[];
 await context.route('https://www.youtube.com/**',route=>{
  navigations.push(route.request().url());return route.fulfill({contentType:'text/html',body:fixture});
 });
 await context.addInitScript(()=>{
  window.chrome={runtime:{sendMessage:()=>{throw Error('Native path must not send background API messages');}}};
  const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem;
  Storage.prototype.getItem=function(key){if(/upload|interval/i.test(key))throw Error('Must not restore filters');return originalGet.call(this,key);};
  Storage.prototype.setItem=function(key,value){if(/upload|interval/i.test(key))throw Error('Must not save filters');return originalSet.call(this,key,value);};
 });
 const page=await context.newPage();page.setDefaultTimeout(8000);
 await page.clock.install({time:new Date('2026-10-29T12:00:00Z')});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async(query='bees',extra='')=>{await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${extra}`);await page.locator('.ud-toggle').waitFor();};
 const expand=async()=>{if(!await page.locator('.ud-options').isVisible())await page.locator('.ud-toggle').click();};
 const select=async(id)=>{await expand();await page.locator(`[data-interval=${id}]`).click();await page.waitForLoadState('load');};
 await open();await expand();
 assert.deepEqual(await page.locator('[data-interval]').allTextContents(),['Today','This week','This month','Last 3 months','Last 6 months','This year','Last 2 years','Last 3 years','Last 5 years','Custom date range']);
 assert.match(await page.locator('.ud-note').first().innerText(),/experimental/);
 await page.evaluate(()=>{window.originalVideo=document.querySelector('#native-video');window.hoverCount=0;document.querySelector('#thumbnail').addEventListener('mouseover',()=>window.hoverCount++);});
 await page.locator('[data-interval=custom]').click();
 assert.equal(await page.evaluate(()=>window.originalVideo===document.querySelector('#native-video')),true);
 await page.locator('#thumbnail').hover();assert.ok(await page.evaluate(()=>window.hoverCount>0));
 assert.equal(await page.locator('[data-upload-dates-hidden],.ud-results,.ud-card').count(),0);
 assert.equal(await page.locator('.duration').innerText(),'12:34');
 console.log('PASS: exact ten options; native node identity, metadata, event handlers retained; no result replacement');
 for(const id of ['today','week','month','m3','m6','year','y2','y3','y5']){
  await open('bees & honey','&sp=EgIQAQ%3D%3D&gl=GB');
  const expected=await page.evaluate(id=>UploadDates.range(id),id);await select(id);
  const url=new URL(page.url());assert.equal(url.searchParams.get('search_query'),`bees & honey after:${expected.start} before:${expected.before}`);
  assert.equal(url.pathname,'/results');assert.equal(url.searchParams.get('sp'),'EgIQAQ==');assert.equal(url.searchParams.get('gl'),'GB');
  assert.equal(await page.locator('ytd-video-renderer').isVisible(),true);
 }
 console.log('PASS: all nine presets perform native navigation with calendar-aware terms; native parameters retained');
 await open();await expand();await page.locator('[data-interval=custom]').click();
 const inputs=page.locator('.ud-custom input');await inputs.nth(0).fill('2024-02-29');await inputs.nth(1).fill('2024-03-31');
 await page.getByRole('button',{name:'Apply date range',exact:true}).click();await page.waitForLoadState('load');
 assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees after:2024-02-29 before:2024-04-01');
 await expand();await page.getByRole('button',{name:'Clear date operators',exact:true}).click();await page.waitForLoadState('load');assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees');
 await page.goBack();await expand();assert.match(await page.locator('.ud-current').innerText(),/after:2024-02-29/);
 await page.goForward();assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees');
 console.log('PASS: custom inclusive-day URL, clear, browser back and forward');
 await expand();await page.locator('[data-interval=custom]').click();
 await page.locator('.ud-custom input').nth(0).fill('2024-03-31');await page.locator('.ud-custom input').nth(1).fill('2024-02-29');
 const count=navigations.length;await page.getByRole('button',{name:'Apply date range',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Start date must'}).waitFor();assert.equal(navigations.length,count);
 console.log('PASS: invalid custom range gives visible error without navigation');
 await page.evaluate(()=>{document.querySelector('.ud-control').remove();const item=document.createElement('ytd-video-renderer');item.textContent='Late native result';document.querySelector('ytd-item-section-renderer').append(item);});
 await page.locator('.ud-toggle').waitFor();assert.equal(await page.getByText('Late native result',{exact:true}).isVisible(),true);
 await page.evaluate(()=>document.dispatchEvent(new Event('yt-navigate-finish')));assert.equal(await page.locator('.ud-control').count(),1);
 await open('flowers');assert.equal(new URL(page.url()).searchParams.get('search_query'),'flowers');await expand();assert.equal(await page.locator('.ud-current').isVisible(),false);assert.equal(await page.locator('.ud-custom').isVisible(),false);
 await page.reload();assert.equal(new URL(page.url()).searchParams.get('search_query'),'flowers');
 await open('bees','&upload_interval=y2');assert.equal(new URL(page.url()).searchParams.has('upload_interval'),false);assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees');
 console.log('PASS: dynamic panel reinjection, infinite-scroll nodes untouched, no duplicate listeners or saved/reapplied filters; old API flag ignored');
 await expand();await page.locator('[data-interval=today]').focus();await page.keyboard.press('End');assert.equal(await page.locator('.ud-options button:visible').last().evaluate(n=>n===document.activeElement),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.ud-options').isVisible(),false);
 await page.evaluate(()=>document.documentElement.setAttribute('dark',''));await expand();await page.locator('[data-interval=custom]').click();assert.equal(await page.locator('.ud-custom input').first().evaluate(n=>getComputedStyle(n).colorScheme),'dark');
 console.log('PASS: keyboard collapse/navigation and inherited dark-mode input styling');
 assert.deepEqual(errors,[]);console.log('PASS: no JavaScript errors; native path makes zero extension API requests');
}finally{await browser.close();}
