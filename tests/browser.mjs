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
 const nativeRows=['Today','This week','This month','This year'].map((label,index)=>`<ytd-search-filter-renderer><a href="/results?search_query=bees&sp=${encodeURIComponent(['EgIIAg==','EgIIAw==','EgIIBA==','EgIIBQ=='][index])}"><yt-formatted-string>${label}</yt-formatted-string></a></ytd-search-filter-renderer>`).join('');
 const column=(title,rows)=>`<ytd-search-filter-group-renderer><div id="title">${title}</div><div id="filters">${rows}</div></ytd-search-filter-group-renderer>`;
 const otherRows=labels=>labels.map(label=>`<ytd-search-filter-renderer><a href="/results?search_query=bees">${label}</a></ytd-search-filter-renderer>`).join('');
 const group=column('TYPE',otherRows(['Videos','Shorts','Channels','Playlists','Movies']))+column('DURATION',otherRows(['Under 3 minutes','3 - 20 minutes','Over 20 minutes']))+column('UPLOAD DATE',nativeRows)+column('FEATURES',otherRows(['Live','4K','HD','Subtitles/CC','Creative Commons','360°','VR180','3D','HDR','Location','Purchased']))+column('PRIORITIZE',otherRows(['Relevance','Popularity']));
 const nativeCSS=`html{font-size:10px;--yt-spec-text-primary:#0f0f0f;--yt-spec-text-secondary:#606060;--yt-spec-10-percent-layer:rgba(0,0,0,.15);--yt-spec-base-background:#fff}html[dark]{--yt-spec-text-primary:#f1f1f1;--yt-spec-text-secondary:#aaa;--yt-spec-10-percent-layer:rgba(255,255,255,.15);--yt-spec-base-background:#212121}body{margin:32px;background:var(--yt-spec-base-background);color:var(--yt-spec-text-primary);font-family:Arial,sans-serif}h1{font-size:28px;font-weight:400;margin:0 0 44px}.columns{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:32px}ytd-search-filter-group-renderer{display:block;min-width:0}#title{font-size:16px;border-bottom:1px solid var(--yt-spec-10-percent-layer);padding-bottom:18px;margin-bottom:16px}ytd-search-filter-renderer{display:block;padding:0;margin:0}ytd-search-filter-renderer a{display:block;padding:12px 0;font-size:20px;line-height:26px;font-weight:400;color:var(--yt-spec-text-secondary);text-decoration:none}ytd-search-filter-renderer a:hover{color:var(--yt-spec-text-primary)}ytd-search-filter-renderer[selected] a{color:var(--yt-spec-text-primary);font-weight:500}`;
 const fixture=`<!doctype html><html><meta charset="utf-8"><body><h1>Search filters</h1><ytd-search><div class="columns">${group}</div><div id="primary"><ytd-section-list-renderer><div id="contents"><ytd-item-section-renderer><ytd-video-renderer id="native-video"><a href="/watch?v=abcdefghijk" id="thumbnail"><span class="duration">12:34</span></a><h3>Native video title</h3><span>1M views · 4 months ago</span><a href="/@native">Native channel ✓</a><span>4K CC New</span></ytd-video-renderer></ytd-item-section-renderer><ytd-continuation-item-renderer></ytd-continuation-item-renderer></div></ytd-section-list-renderer></div></ytd-search><style>${nativeCSS}${files[3]}</style><script>window.nativeRows=[...document.querySelectorAll('.columns ytd-search-filter-group-renderer:nth-child(3) ytd-search-filter-renderer')];window.otherColumns=[...document.querySelectorAll('.columns ytd-search-filter-group-renderer')].filter((_,i)=>i!==2).map(n=>[n,n.innerHTML]);window.nativeClicks=0;window.nativeRows.forEach(row=>row.querySelector('a').addEventListener('click',()=>window.nativeClicks++));</script>${source}</body></html>`;
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
 const open=async(query='bees',extra='')=>{await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${extra}`);await page.locator('[data-interval=custom]').waitFor();};
 const select=async(id)=>{await page.locator(`[data-interval=${id}]`).click();await page.waitForLoadState('load');};
 await open();
 assert.deepEqual(await page.locator('.columns ytd-search-filter-group-renderer:nth-child(3) #filters > ytd-search-filter-renderer,.columns ytd-search-filter-group-renderer:nth-child(3) #filters > .ud-row').allTextContents(),['Today','This week','This month','Last 3 months','Last 6 months','This year','Last 2 years','Last 3 years','Last 5 years','Custom date range']);
 assert.equal(await page.locator('.ud-toggle,.ud-options').count(),0);
 assert.equal(await page.locator('.ud-divider').count(),1);
 assert.deepEqual(await page.locator('.ud-divider').evaluate(n=>[n.previousElementSibling.textContent,n.nextElementSibling.textContent]),['Last 5 years','Custom date range']);
 assert.equal(await page.locator('[data-interval=custom]').evaluate(n=>getComputedStyle(n).whiteSpace),'normal');
 assert.equal(await page.evaluate(()=>window.nativeRows.every(n=>n.isConnected)),true);
 assert.equal(await page.evaluate(()=>window.otherColumns.every(([n,html])=>n.innerHTML===html)),true);
 for(const label of ['Today','This week','This month','This year']){
  assert.equal(await page.evaluate(()=>window.nativeRows.every(n=>n.isConnected)),true);
  await page.getByText(label,{exact:true}).click();await page.waitForLoadState('load');
  assert.ok(new URL(page.url()).searchParams.has('sp'));
 }
 await open();
 await page.evaluate(()=>{
  window.nativeRows[0].setAttribute('selected','');
  let mutations=0;window.panelObserver=new MutationObserver(records=>mutations+=records.length);
  window.panelObserver.observe(document.querySelector('.columns'),{childList:true,subtree:true});
  window.panelMutationCount=()=>mutations;
  document.dispatchEvent(new Event('yt-navigate-finish'));
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.evaluate(()=>window.panelMutationCount()),0,'Stable panels must not churn their DOM');
 assert.equal(await page.evaluate(()=>window.nativeRows[0].hasAttribute('selected')),true);
 console.log('PASS: nine integrated presets, divider and custom row; four original native links navigate; five columns preserved; no dropdown');
 await page.evaluate(()=>{window.originalVideo=document.querySelector('#native-video');window.hoverCount=0;document.querySelector('#thumbnail').addEventListener('mouseover',()=>window.hoverCount++);});
 await page.locator('[data-interval=custom]').click();
 assert.equal(await page.evaluate(()=>window.originalVideo===document.querySelector('#native-video')),true);
 await page.locator('#thumbnail').hover();assert.ok(await page.evaluate(()=>window.hoverCount>0));
 assert.equal(await page.locator('[data-upload-dates-hidden],.ud-results,.ud-card').count(),0);
 assert.equal(await page.locator('.duration').innerText(),'12:34');
 console.log('PASS: exact ten options; native node identity, metadata, event handlers retained; no result replacement');
 for(const id of ['m3','m6','y2','y3','y5']){
  await open('bees & honey','&sp=EgIQAQ%3D%3D&gl=GB');
  const expected=await page.evaluate(id=>UploadDates.range(id),id);await select(id);
  const url=new URL(page.url());assert.equal(url.searchParams.get('search_query'),`bees & honey after:${expected.start} before:${expected.before}`);
  assert.equal(url.pathname,'/results');assert.equal(url.searchParams.get('sp'),'EgIQAQ==');assert.equal(url.searchParams.get('gl'),'GB');
  assert.equal(await page.locator('ytd-video-renderer').isVisible(),true);
 }
 console.log('PASS: all five extension presets perform native navigation with calendar-aware terms; native parameters retained');
 await open();await page.locator('[data-interval=custom]').click();
 const inputs=page.locator('.ud-custom input');await inputs.nth(0).fill('2024-02-29');await inputs.nth(1).fill('2024-03-31');
 await page.getByRole('button',{name:'Apply date range',exact:true}).click();await page.waitForLoadState('load');
 assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees after:2024-02-29 before:2024-04-01');
 await page.getByRole('button',{name:'Clear date operators',exact:true}).click();await page.waitForLoadState('load');assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees');
 await page.goBack();assert.match(await page.locator('.ud-current').innerText(),/after:2024-02-29/);
 await page.goForward();assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees');
 console.log('PASS: custom inclusive-day URL, clear, browser back and forward');
 await page.locator('[data-interval=custom]').click();
 await page.locator('.ud-custom input').nth(0).fill('2024-03-31');await page.locator('.ud-custom input').nth(1).fill('2024-02-29');
 const count=navigations.length;await page.getByRole('button',{name:'Apply date range',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Start date must'}).waitFor();assert.equal(navigations.length,count);
 console.log('PASS: invalid custom range gives visible error without navigation');
 await page.evaluate(()=>{document.querySelector('.ud-control').remove();const item=document.createElement('ytd-video-renderer');item.textContent='Late native result';document.querySelector('ytd-item-section-renderer').append(item);});
 await page.locator('[data-interval=custom]').waitFor();assert.equal(await page.getByText('Late native result',{exact:true}).isVisible(),true);
 await page.evaluate(()=>document.dispatchEvent(new Event('yt-navigate-finish')));assert.equal(await page.locator('.ud-control').count(),1);
 await open('flowers');assert.equal(new URL(page.url()).searchParams.get('search_query'),'flowers');assert.equal(await page.locator('.ud-current').isVisible(),false);assert.equal(await page.locator('.ud-custom').isVisible(),false);
 await page.reload();assert.equal(new URL(page.url()).searchParams.get('search_query'),'flowers');
 await open('bees','&upload_interval=y2');assert.equal(new URL(page.url()).searchParams.has('upload_interval'),false);assert.equal(new URL(page.url()).searchParams.get('search_query'),'bees');
 console.log('PASS: dynamic panel reinjection, infinite-scroll nodes untouched, no duplicate listeners or saved/reapplied filters; old API flag ignored');
 // Reopen/rebuild the panel repeatedly, including a partial native-list replacement.
 for(let i=0;i<3;i++){
  await page.evaluate(()=>{const column=document.querySelector('.columns ytd-search-filter-group-renderer:nth-child(3)');column.hidden=true;column.hidden=false;document.dispatchEvent(new Event('yt-navigate-finish'));});
  assert.equal(await page.locator('.ud-row').count(),6);
  assert.equal(await page.locator('.ud-divider').count(),1);
 }
 await page.evaluate(()=>{const column=document.querySelector('.columns ytd-search-filter-group-renderer:nth-child(3)');const list=column.querySelector('#filters');list.innerHTML=window.nativeRows.map(n=>n.outerHTML).join('');});
 await page.locator('[data-interval=custom]').waitFor();
 assert.equal(await page.locator('.ud-row').count(),6);
 await page.evaluate(()=>{
  const list=document.querySelector('.columns ytd-search-filter-group-renderer:nth-child(3) #filters');
  const lastHour=document.createElement('ytd-search-filter-renderer');lastHour.textContent='Last hour';list.prepend(lastHour);
 });
 await page.locator('[data-ud-hidden-native]').waitFor({state:'attached'});
 assert.equal(await page.getByText('Last hour',{exact:true}).isVisible(),false);
 // Native listeners and element identity survive insertion and later repair.
 await page.evaluate(()=>{
  window.nativeClickNode=document.querySelector('.columns ytd-search-filter-group-renderer:nth-child(3) a');
  window.retainedClicks=0;window.nativeClickNode.addEventListener('click',event=>{event.preventDefault();window.retainedClicks++;});
  document.dispatchEvent(new Event('yt-navigate-finish'));
 });
 await page.getByText('Today',{exact:true}).click();
 assert.equal(await page.evaluate(()=>window.retainedClicks),1);
 assert.equal(await page.evaluate(()=>window.nativeClickNode===document.querySelector('.columns ytd-search-filter-group-renderer:nth-child(3) a')),true);
 for(const dark of [false,true]){
  await page.mouse.move(0,0);
  await page.evaluate(dark=>document.documentElement.toggleAttribute('dark',dark),dark);
  const styles=await page.locator('[data-interval=m3]').evaluate(button=>{
   const native=document.querySelector('.columns ytd-search-filter-group-renderer:nth-child(3) ytd-search-filter-renderer:not([selected]) a');
   return [button,native].map(n=>{const s=getComputedStyle(n);return [s.fontSize,s.lineHeight,s.padding,s.color,n.getBoundingClientRect().height];});
  });
  assert.deepEqual(styles[0],styles[1]);
  await page.locator('[data-interval=custom]').click();
  assert.equal(await page.locator('.ud-custom input').first().evaluate(n=>getComputedStyle(n).colorScheme),dark?'dark':'light');
  await page.keyboard.press('Escape');assert.equal(await page.locator('.ud-custom').isVisible(),false);
  assert.equal(await page.locator('[data-interval=custom]').evaluate(n=>n===document.activeElement),true);
 }
 if(process.env.SCREENSHOT_DIR){
  for(const dark of [false,true]){
   await page.evaluate(dark=>{document.activeElement.blur();document.documentElement.toggleAttribute('dark',dark);document.querySelector('#primary').hidden=true;},dark);
   await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/filters-${dark?'dark':'light'}.png`,fullPage:true});
  }
 }
 console.log('PASS: repeated panel reopening and partial reconstruction produce no duplicates; native typography/spacing match in both themes; custom Escape/focus works');
 assert.deepEqual(errors,[]);console.log('PASS: no JavaScript errors; native path makes zero extension API requests');
}finally{await browser.close();}
