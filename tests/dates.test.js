import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import '../extension/dates.js';
const {range,intervals}=UploadDates;
const local=(year,month,day,hour=14)=>new Date(year,month-1,day,hour,30);
test('exact requested order, with custom last',()=>assert.deepEqual(intervals.map(x=>x.label),['Today','This week','This month','Last 3 months','Last 6 months','This year','Last 2 years','Last 3 years','Last 5 years','Custom date range']));
test('local calendar periods ending today, Monday week start',()=>{
 const now=local(2026,10,29);
 for(const [id,start] of [['today','2026-10-29'],['week','2026-10-26'],['month','2026-10-01'],['year','2026-01-01']]){
  const result=range(id,now);assert.equal(result.start,start);assert.equal(result.end,'2026-10-29');assert.equal(result.before,'2026-10-30');assert.equal(result.publishedBefore,now.toISOString());
 }
 assert.equal(range('week',local(2026,11,1)).start,'2026-10-26');
 assert.equal(range('week',local(2026,11,2)).start,'2026-11-02');
});
for(const [id,year,month,day,expected] of [['m3',2026,5,31,'2026-02-28'],['m3',2024,5,31,'2024-02-29'],['m6',2026,8,31,'2026-02-28'],['m6',2024,8,31,'2024-02-29'],['y2',2024,2,29,'2022-02-28'],['y3',2024,2,29,'2021-02-28'],['y5',2024,2,29,'2019-02-28'],['m3',2026,1,1,'2025-10-01']])test(`${id} clamps ${year}-${month}-${day}`,()=>assert.equal(range(id,local(year,month,day)).start,expected));
test('custom dates include both selected calendar days',()=>{
 const result=range('custom',local(2026,10,29),{start:'2024-02-29',end:'2024-03-31'});
 assert.equal(result.start,'2024-02-29');assert.equal(result.end,'2024-03-31');assert.equal(result.before,'2024-04-01');
 assert.equal(new Date(result.publishedAfter).getHours(),0);assert.equal(new Date(result.publishedBefore).getHours(),0);
 const same=range('custom',local(2026,10,29),{start:'2026-10-29',end:'2026-10-29'});assert.equal(same.before,'2026-10-30');
});
test('invalid dates, reversed ranges, future ranges and removed presets are rejected',()=>{
 for(const custom of [{start:'2025-02-29',end:'2025-03-01'},{start:'2026-11-01',end:'2026-10-29'},{start:'2026-10-01',end:'2026-10-30'},{start:'bad',end:'2026-01-01'},{start:'2026-13-01',end:'2026-01-01'}])assert.throws(()=>range('custom',local(2026,10,29),custom));
 assert.throws(()=>range('w2'));assert.throws(()=>range('today',new Date('bad')));assert.throws(()=>range('custom'));
});
test('local midnight, DST transitions and opposite UTC offsets',()=>{
 const script=`import './extension/dates.js';
 const now=new Date(2026,2,8,18);
 const today=UploadDates.range('today',now);
 if(today.start!=='2026-03-08'||new Date(today.publishedAfter).getHours()!==0)throw Error('local start');
 const r=UploadDates.range('custom',now,{start:'2026-03-08',end:'2026-03-08'});
 if(r.before!=='2026-03-09')throw Error('next local day');
 const hours=(new Date(2026,2,9)-new Date(2026,2,8))/3600000;
 if(process.env.TZ==='America/New_York'&&hours!==23)throw Error('DST day');
 const fall=UploadDates.range('custom',new Date(2026,10,2,12),{start:'2026-11-01',end:'2026-11-01'});
 if(fall.before!=='2026-11-02')throw Error('fall next day');
 if(process.env.TZ==='America/New_York'&&(Date.parse(fall.publishedBefore)-Date.parse(fall.publishedAfter))/3600000!==25)throw Error('fall DST');
 if(UploadDates.range('today',new Date(2026,0,1,0,1)).start!=='2026-01-01')throw Error('local year');`;
 for(const zone of ['America/New_York','Europe/London','Pacific/Kiritimati','Pacific/Honolulu']){
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:zone},encoding:'utf8'});assert.equal(result.status,0,`${zone}: ${result.stderr}`);
 }
});
