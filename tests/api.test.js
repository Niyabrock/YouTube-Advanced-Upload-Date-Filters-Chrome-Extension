import test from 'node:test';
import assert from 'node:assert/strict';
let handler,key='local-key',requested,fetchCount=0,fetchError;
const success=items=>({ok:true,status:200,json:async()=>({items,nextPageToken:'next'})});
let response=success([]);
globalThis.chrome={runtime:{id:'test',onInstalled:{addListener(){}},onMessage:{addListener(h){handler=h;}},openOptionsPage:async()=>{}},storage:{local:{get:async()=>({apiKey:key})}}};
globalThis.fetch=async(url,options)=>{fetchCount++;requested=new URL(url);assert.ok(options.signal);assert.equal(options.credentials,'omit');if(fetchError)throw fetchError;return response;};
await import('../extension/background.js');
const sender={id:'test',tab:{url:'https://www.youtube.com/results?search_query=bees'}};
const call=m=>new Promise(resolve=>assert.equal(handler({type:'search',query:'bees',interval:'y3',asOf:'2024-10-28T12:00:00Z',...m},sender,resolve),true));
const fail=(status,reason)=>{response={ok:false,status,json:async()=>({error:{errors:[{reason}]}})};};
test('documented query, calendar bounds, video type and pagination timestamp',async()=>{
 const result=await call({pageToken:'token'});assert.equal(result.nextPageToken,'next');
 assert.equal(requested.origin,'https://www.googleapis.com');assert.equal(requested.pathname,'/youtube/v3/search');
 for(const [name,value] of Object.entries({publishedAfter:'2021-10-28T12:00:00.000Z',publishedBefore:'2024-10-28T12:00:00.000Z',q:'bees',pageToken:'token',type:'video',part:'snippet',order:'relevance',maxResults:'25',key:'local-key'}))assert.equal(requested.searchParams.get(name),value,name);
});
test('all 18 intervals execute an API search with correct bounds',async()=>{
 for(const item of UploadDates.intervals){const result=await call({interval:item.id});assert.equal(result.error,undefined);assert.equal(requested.searchParams.get('publishedAfter'),UploadDates.range(item.id,new Date('2024-10-28T12:00:00Z')).publishedAfter);}
});
test('missing key produces visible guidance without making an API request',async()=>{key='';const before=fetchCount;assert.match((await call()).error,/Configure/);assert.equal(fetchCount,before);key='local-key';});
test('invalid interval, query, time and page token are rejected',async()=>{
 for(const input of [{interval:'bad'},{query:' '},{asOf:'bad'},{asOf:'9999-01-01'},{pageToken:123},{pageToken:'a'.repeat(513)}])assert.ok((await call(input)).error);
});
for(const [reason,pattern] of [['quotaExceeded',/quota exceeded/],['dailyLimitExceeded',/quota exceeded/],['keyInvalid',/API key was rejected/],['accessNotConfigured',/Enable YouTube Data API/],['ipRefererBlocked',/restrictions blocked/],['forbidden',/restrictions blocked/]])test(`Google ${reason} error is actionable`,async()=>{fail(403,reason);assert.match((await call()).error,pattern);});
test('untrusted API error text cannot echo the key',async()=>{fail(400,'local-key');const data=await call();assert.match(data.error,/HTTP 400/);assert.ok(!data.error.includes('local-key'));});
test('network and timeout failures produce distinct errors without exposing URLs',async()=>{
 fetchError=new TypeError('fetch https://example.com/?key=local-key failed');assert.match((await call()).error,/Could not reach/);assert.ok(!(await call()).error.includes('local-key'));
 fetchError=Object.assign(new Error('timeout'),{name:'TimeoutError'});assert.match((await call()).error,/timed out/);fetchError=null;
});
test('non-JSON and malformed success responses are errors',async()=>{
 response={ok:true,json:async()=>{throw new Error('bad json');}};assert.match((await call()).error,/invalid response/);
 for(const value of [null,{}, {items:{}}]){response={ok:true,json:async()=>value};assert.match((await call()).error,/invalid response/);}
});
test('empty response remains empty and returns its bounds',async()=>{response=success([]);const data=await call();assert.deepEqual(data.items,[]);assert.ok(data.bounds.publishedAfter);});
test('valid records are mapped; old, future, malformed and nonvideo records cannot render',async()=>{
 const video=(id,date)=>({id:{videoId:id},snippet:{title:'Bees',channelTitle:'Hive',publishedAt:date,description:'A video'}});
 response=success([video('abcdefghijk','2023-05-01T12:00:00Z'),video('bcdefghijkl','2010-01-01T00:00:00Z'),video('cdefghijklm','2030-01-01T00:00:00Z'),video('defghijklmn','invalid'),video('bad','2023-01-01'),null,{}, {id:{channelId:'abcdefghijk'}}]);
 const data=await call();assert.equal(data.items.length,1);assert.deepEqual(data.items[0],{id:'abcdefghijk',title:'Bees',channel:'Hive',published:'2023-05-01T12:00:00Z',description:'A video'});
});
test('options response is acknowledged',async()=>{const data=await new Promise(resolve=>assert.equal(handler({type:'options'},sender,resolve),true));assert.equal(data.ok,true);});
test('other origins, lookalike hosts, extension ids and unknown messages are ignored',()=>{
 for(const stranger of [{id:'other',tab:sender.tab},{id:'test',tab:{url:'https://www.youtube.com.evil.invalid/'}},{id:'test',tab:{url:'https://example.com/'}},{id:'test'}])assert.equal(handler({type:'search'},stranger,()=>assert.fail('must not reply')),undefined);
 assert.equal(handler({type:'unknown'},sender,()=>assert.fail('must not reply')),undefined);
});
