/* Shared with content scripts and imported by the worker/tests. UTC calendar arithmetic. */
(() => {
  const intervals = [2,3,4].map(n => ({id:`w${n}`,n,unit:'weeks',label:`Last ${n} weeks`}))
    .concat(Array.from({length:11},(_,i)=>({id:`m${i+2}`,n:i+2,unit:'months',label:`Last ${i+2} months`})),
      [2,3,4,5].map(n=>({id:`y${n}`,n,unit:'years',label:`Last ${n} years`})));
  function range(id, now = new Date()) {
    const item = intervals.find(x=>x.id===id);
    if (!item || !Number.isFinite(now.getTime())) throw new Error('Invalid interval or date');
    const start = new Date(now);
    if (item.unit==='weeks') start.setUTCDate(start.getUTCDate()-item.n*7);
    else {
      const day=start.getUTCDate(); start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth()-(item.unit==='years'?12:1)*item.n);
      const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
      start.setUTCDate(Math.min(day,last));
    }
    return {publishedAfter:start.toISOString(),publishedBefore:now.toISOString()};
  }
  globalThis.UploadDates = {intervals,range};
})();
