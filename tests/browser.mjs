import {createRequire} from 'node:module';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const profile=await mkdtemp(path.join(tmpdir(),'upload-dates-'));
const extension=path.resolve(process.env.EXTENSION_PATH||'dist');
const realExtension=process.env.REAL_EXTENSION==='1';
const context=await chromium.launchPersistentContext(profile,{
 executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,
 ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox','--enable-unsafe-extension-debugging']
});
try {
 let worker,id,handler;
 if(realExtension){
  const cdp=await context.browser().newBrowserCDPSession();
  const loaded=await cdp.send('Extensions.loadUnpacked',{path:extension});id=loaded.id;
  worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 } else {
  const scope=vm.createContext({URL,URLSearchParams,AbortSignal,Response,Date,Error,TypeError,setTimeout,clearTimeout,console});
  scope.self=scope;scope.globalThis=scope;
  scope.chrome={runtime:{id:'test',onInstalled:{addListener(){}},onMessage:{addListener(h){handler=h;}}},storage:{local:{get:async()=>({apiKey:'test-key-not-a-real-credential'})}}};
  vm.runInContext(await readFile(path.join(extension,'dates.js'),'utf8'),scope);
  vm.runInContext((await readFile(path.join(extension,'background.js'),'utf8')).replace("import './dates.js';",''),scope);
  worker={evaluate:async(fn,arg)=>{scope.argument=arg;const result=await vm.runInContext(`(${fn.toString()})(argument)`,scope);return result===undefined?undefined:JSON.parse(JSON.stringify(result));}};
  await context.exposeBinding('sendExtensionMessage',async(source,message)=>{
   const transport=await worker.evaluate(()=>self.transport);
   if(transport==='disconnect')throw new Error('Could not establish connection. Receiving end does not exist.');
   if(transport==='undefined')return undefined;
   if(transport==='silent'){await new Promise(r=>setTimeout(r,300));return undefined;}
   return new Promise(resolve=>handler(message,{id:'test',tab:{url:source.page.url()}},resolve));
  });
  await context.addInitScript(()=>{window.chrome={runtime:{sendMessage:m=>window.sendExtensionMessage(m)}};const original=setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===25000&&window.shortenExtensionTimeout?100:ms,...args);});
 }
 // Real background module and date code in both modes. The default uses a VM
 // plus an explicit messaging bridge; REAL_EXTENSION=1 uses Chrome's worker.
 // Only the remote API response is simulated after the transport boundary.
 await worker.evaluate(()=>{
  self.requests=[];self.mode='success';self.delay=0;
  self.fetch=async input=>{
   const url=new URL(input),p=url.searchParams;
   self.requests.push({q:p.get('q'),after:p.get('publishedAfter'),before:p.get('publishedBefore'),page:p.get('pageToken'),type:p.get('type')});
   const mode=self.mode,delay=self.delay;
   if(delay)await new Promise(r=>setTimeout(r,delay));
   if(mode==='network')throw new TypeError('Failed to fetch');
   if(mode==='quota')return new Response(JSON.stringify({error:{errors:[{reason:'quotaExceeded'}]}}),{status:403});
   if(mode==='key')return new Response(JSON.stringify({error:{errors:[{reason:'keyInvalid'}]}}),{status:400});
   if(mode==='malformed')return new Response('{not json');
   if(mode==='empty')return Response.json({items:[]});
   const date=new Date((Date.parse(p.get('publishedAfter'))+Date.parse(p.get('publishedBefore')))/2).toISOString();
   return Response.json({items:[{id:{videoId:p.get('pageToken')?'bcdefghijkl':'abcdefghijk'},snippet:{title:`${p.get('q')} <script>`,channelTitle:'Channel',publishedAt:date,description:'API result'}}],nextPageToken:p.get('pageToken')?undefined:'page-two'});
  };
 });
 if(realExtension){
  const options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);
  await options.locator('#key').fill('test-key-not-a-real-credential');await options.getByRole('button',{name:'Save key',exact:true}).click();
  await options.getByRole('status').filter({hasText:'Key saved'}).waitFor();
 }
 const source=realExtension?'':`<script>${await readFile(path.join(extension,'dates.js'),'utf8')}</script><script>${await readFile(path.join(extension,'content.js'),'utf8')}</script>`;
 const css=await readFile(path.join(extension,'styles.css'),'utf8');
 const filter='<ytd-search-filter-group-renderer><div id="title">Upload date</div><ytd-search-filter-renderer><a href="/results?search_query=bees&sp=EgIIAQ%3D%3D">Last hour</a></ytd-search-filter-renderer></ytd-search-filter-group-renderer>';
 const fixture=layout=>`<!doctype html><html><body><ytd-search>${filter}<div id="primary">${layout==='section'?'<ytd-section-list-renderer><div id="contents"><ytd-item-section-renderer>Old native videos</ytd-item-section-renderer><ytd-continuation-item-renderer></ytd-continuation-item-renderer></div></ytd-section-list-renderer>':layout==='rich'?'<ytd-rich-grid-renderer><div id="contents">Old native videos</div></ytd-rich-grid-renderer>':'<div class="unknown-layout">Old native videos</div>'}</div></ytd-search><style>${css}</style>${source}</body></html>`;
 await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(new URL(route.request().url()).searchParams.get('layout')||'section')}));
 const page=await context.newPage();page.setDefaultTimeout(8000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async layout=>{await page.goto(`https://www.youtube.com/results?search_query=bees&layout=${layout}`);await page.locator('.ud-toggle').waitFor();};
 const select=async label=>{if(!await page.locator('.ud-options').isVisible())await page.locator('.ud-toggle').click();await page.locator('[data-interval]').filter({hasText:label}).click();};
 await open('section');
 await select('Last 2 weeks');
 // Regression: original selector requires a nonexistent #contents ANCESTOR of
 // ytd-section-list-renderer, so this times out before any request is sent.
 try{await page.locator('.ud-card').waitFor();}catch(error){console.log('Regression diagnostics:',await worker.evaluate(()=>({apiRequests:self.requests.length})),await page.locator('.ud-results').count(),'result hosts');throw error;}
 console.log(`PASS: click → ${realExtension?'Chrome messaging and worker':'messaging bridge and real background module'} → API response → rendered card`);
 assert.equal(await page.locator('.ud-card script').count(),0);
 assert.equal(await page.getByText('Old native videos',{exact:true}).isVisible(),false);
 const requests=await worker.evaluate(()=>self.requests);
 assert.equal(requests[0].q,'bees');assert.equal(requests[0].type,'video');
 assert.equal(Date.parse(requests[0].before)-Date.parse(requests[0].after),14*86400000);
 await page.getByRole('button',{name:'Load more',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ud-card').length===2);
 const paged=await worker.evaluate(()=>self.requests);assert.equal(paged[1].page,'page-two');assert.equal(paged[1].before,paged[0].before);
 console.log('PASS: fixed bounds and nextPageToken pagination');
 await page.getByRole('button',{name:'Return to native results'}).click();assert.equal(await page.getByText('Old native videos',{exact:true}).isVisible(),true);
 for(const layout of ['rich','unknown']){await open(layout);await select('Last 9 months');await page.locator('.ud-card').waitFor();assert.equal(await page.getByText('Old native videos',{exact:true}).isVisible(),false);}
 console.log('PASS: section, rich-grid and unknown-layout fallback; native restoration');
 const {UploadDates}=await import('../extension/dates.js').then(()=>globalThis);
 for(const interval of UploadDates.intervals){
  await select(interval.label);await page.locator('.ud-card').waitFor();
  const request=await worker.evaluate(()=>self.requests.at(-1));
  assert.equal(request.after,UploadDates.range(interval.id,new Date(request.before)).publishedAfter);
  assert.match(await page.locator('.ud-results h2').innerText(),new RegExp(interval.label));
 }
 console.log('PASS: all 18 intervals retrieve and render with correct bounds');
 await worker.evaluate(()=>{self.delay=300;});await select('Last 2 weeks');
 await page.getByRole('status').filter({hasText:'Searching YouTube'}).waitFor();
 assert.equal(await page.locator('.ud-results').getAttribute('aria-busy'),'true');await page.locator('.ud-card').waitFor();await worker.evaluate(()=>{self.delay=0;});
 for(const [mode,message] of [['quota','quota exceeded'],['key','API key'],['network','reach YouTube'],['malformed','invalid response'],['empty','No videos']]){
  await worker.evaluate(m=>{self.mode=m;},mode);await select('Last 3 months');
  await page.getByRole('status').filter({hasText:message}).waitFor();
  assert.equal(await page.locator('.ud-card').count(),0);assert.equal(await page.getByText('Old native videos',{exact:true}).isVisible(),false);
 }
 await worker.evaluate(()=>{self.mode='success';});
 // Empty state has no retry; a fresh selection starts a new request.
 await select('Last 2 years');await page.locator('.ud-card').waitFor();
 console.log('PASS: loading, quota/key/network/malformed errors, empty state and recovery');
 await page.evaluate(()=>document.querySelector('.ud-results').remove());await page.locator('.ud-card').waitFor();
 await page.evaluate(()=>{const host=document.querySelector('#primary');host.innerHTML='<ytd-section-list-renderer><div id="contents"><ytd-item-section-renderer>New native videos</ytd-item-section-renderer></div></ytd-section-list-renderer>';});
 await page.locator('.ud-card').waitFor();assert.equal(await page.getByText('New native videos',{exact:true}).isVisible(),false);
 const before=await worker.evaluate(()=>self.requests.length);
 await page.evaluate(()=>document.dispatchEvent(new Event('yt-navigate-finish')));
 await page.waitForTimeout(100);assert.equal(await worker.evaluate(()=>self.requests.length),before);
 await page.locator('.ud-toggle').click();assert.equal(await page.locator('[data-interval=y2]').getAttribute('aria-pressed'),'true');
 console.log('PASS: detached-results recovery, native subtree reconstruction, reopening, no duplicate requests');
 await worker.evaluate(()=>{self.mode='quota';});await select('Last 4 weeks');await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
 await worker.evaluate(()=>{self.mode='success';});await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.ud-card').waitFor();
 await page.evaluate(()=>{history.pushState(null,'','/results?search_query=honey&upload_interval=w2');document.dispatchEvent(new Event('yt-navigate-finish'));});
 await page.locator('.ud-title').filter({hasText:'honey'}).waitFor();
 await worker.evaluate(()=>{self.delay=400;});await select('Last 2 years');await select('Last 3 years');await page.locator('.ud-card').waitFor();
 await page.waitForTimeout(500);assert.equal(await page.locator('.ud-card').count(),1);assert.equal(await page.locator('.ud-results h2').innerText(),'Last 3 years');
 await worker.evaluate(()=>{self.delay=0;});await page.reload();await page.locator('.ud-card').waitFor();
 console.log('PASS: retry, query navigation, stale response isolation, refresh');

 if(!realExtension){
  for(const [transport,message] of [['disconnect','Extension connection lost'],['undefined','invalid response'],['silent','did not respond']]){
   await page.evaluate(t=>{window.shortenExtensionTimeout=t==='silent';},transport);await worker.evaluate(m=>{self.transport=m;},transport);await select('Last 3 months');
   await page.getByRole('status').filter({hasText:message}).waitFor();
   assert.equal(await page.locator('.ud-card').count(),0);
  }
  await page.evaluate(()=>{window.shortenExtensionTimeout=false;});await worker.evaluate(()=>{self.transport=undefined;});await select('Last 2 weeks');await page.locator('.ud-card').waitFor();
  console.log('PASS: disconnected messaging, missing reply, response timeout and recovery');
 }
 await open('section');
 await page.evaluate(()=>{
  const contents=document.querySelector('ytd-section-list-renderer #contents');
  contents.innerHTML='<ytd-item-section-renderer><ytd-video-renderer>Nested old native videos</ytd-video-renderer></ytd-item-section-renderer>';
  contents.firstElementChild.prepend(document.querySelector('ytd-search-filter-group-renderer'));
 });
 await select('Last 2 years');await page.locator('.ud-card').waitFor();
 assert.equal(await page.getByText('Nested old native videos',{exact:true}).isVisible(),false);
 assert.equal(await page.locator('.ud-toggle').isVisible(),true);
 await page.getByRole('button',{name:'Return to native results'}).click();
 assert.equal(await page.getByText('Nested old native videos',{exact:true}).isVisible(),true);
 console.log('PASS: filters nested inside result sections stay usable; old videos hidden and restored');
 await page.goto('https://www.youtube.com/results?search_query=bees&layout=section&upload_interval=m9');
 await page.locator('.ud-card').waitFor();
 const calls=await worker.evaluate(()=>self.requests.length);
 await page.evaluate(()=>{const n=document.createElement('ytd-item-section-renderer');n.textContent='Late native results';document.querySelector('#primary').append(n);});
 await page.waitForTimeout(100);assert.equal(await page.getByText('Late native results',{exact:true}).isVisible(),false);
 assert.equal(await worker.evaluate(()=>self.requests.length),calls);
 console.log('PASS: late native result insertion cannot reintroduce unfiltered videos');
 assert.deepEqual(errors,[]);
 console.log(`PASS: no page JavaScript errors (${realExtension?'installed extension':'fixture/VM transport; real Chrome extension registration not tested'})`);
} finally {await context.close();await rm(profile,{recursive:true,force:true});}
