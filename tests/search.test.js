import test from 'node:test';import assert from 'node:assert/strict';
import '../extension/dates.js';import '../extension/search.js';
const {build,strip,dateOperators}=UploadDateSearch;
test('compose normal results URL with calendar date terms and preserve native parameters',()=>{
 const result=build('https://www.youtube.com/results?search_query=bees+%26+honey&sp=EgIQAQ%3D%3D&gl=GB&upload_interval=y2',{start:'2026-01-01',before:'2026-10-30'});
 assert.equal(result.pathname,'/results');assert.equal(result.searchParams.get('search_query'),'bees & honey after:2026-01-01 before:2026-10-30');assert.equal(result.searchParams.get('sp'),'EgIQAQ==');assert.equal(result.searchParams.get('gl'),'GB');assert.equal(result.searchParams.has('upload_interval'),false);
});
test('new selection replaces existing date terms instead of intersecting old ranges',()=>{
 const result=build('https://www.youtube.com/results?search_query=bees+after:2025-01-01+before:2025-02-01',{start:'2026-01-01',before:'2026-02-01'});
 assert.equal(dateOperators(result.searchParams.get('search_query')).length,2);
 assert.ok(!result.searchParams.get('search_query').includes('2025-'));
});
test('clear dates preserves ordinary query and quoted literal date terms',()=>{
 const query='bees "after:2025-01-01 before:2025-02-01" after:2026-01-01 before:2026-02-01';
 const result=build(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
 assert.equal(result.searchParams.get('search_query'),'bees "after:2025-01-01 before:2025-02-01"');
 assert.equal(dateOperators(result.searchParams.get('search_query')).length,0);
});
test('preserve words, quoted phrases, escaped quotes, accents and literal fragments',()=>{
 for(const text of ['蜂蜜 bees 🐝','bees "spring flowers"','bees prefixafter:2025-01-01','"a \\"after:2025-01-01"','bees after:unknown','"before:2020-01-01"'])assert.equal(strip(text),text);
 assert.equal(strip('bees AFTER:2025-01-01 before:2025-02-01'),'bees');
});
test('new ordinary search cannot inherit any previous date range',()=>{
 build('https://www.youtube.com/results?search_query=bees',{start:'2024-01-01',before:'2025-01-01'});
 assert.equal(build('https://www.youtube.com/results?search_query=flowers').searchParams.get('search_query'),'flowers');
 assert.equal(dateOperators('flowers').length,0);
});
test('reject other sites, missing query and invalid boundaries',()=>{
 assert.throws(()=>build('https://example.com/results?search_query=bees'));assert.throws(()=>build('https://www.youtube.com/watch?v=abcdefghijk'));assert.throws(()=>build('https://www.youtube.com/results?search_query=after:2026-01-01'));
 assert.throws(()=>build('https://www.youtube.com/results?search_query=bees',{start:'bad',before:'2026-01-01'}));
});
