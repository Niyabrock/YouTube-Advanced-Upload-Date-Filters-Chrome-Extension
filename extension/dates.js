/* Local calendar boundaries; shared with content scripts and the legacy worker. */
(() => {
  const intervals = [
    {id:'today',label:'Today'},
    {id:'week',label:'This week'},
    {id:'month',label:'This month'},
    {id:'m3',label:'Last 3 months',months:3},
    {id:'m6',label:'Last 6 months',months:6},
    {id:'year',label:'This year'},
    {id:'y2',label:'Last 2 years',months:24},
    {id:'y3',label:'Last 3 years',months:36},
    {id:'y5',label:'Last 5 years',months:60},
    {id:'custom',label:'Custom date range'}
  ];
  const format=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function parse(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Enter valid start and end dates.');
    const [year,month,day]=value.split('-').map(Number);
    const date=new Date(year,month-1,day);
    if(year<1000||format(date)!==value)throw new Error('Enter valid start and end dates.');
    return date;
  }
  function range(id, now=new Date(), custom={}) {
    const item=intervals.find(x=>x.id===id);
    if(!item||!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error('Invalid interval or date.');
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    let start=new Date(today),end=new Date(today);
    if(id==='custom'){
      start=parse(custom.start);end=parse(custom.end);
      if(start>end)throw new Error('Start date must be on or before end date.');
      if(end>today)throw new Error('End date cannot be in the future.');
    }else if(id==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
    else if(id==='month')start.setDate(1);
    else if(id==='year')start.setMonth(0,1);
    else if(item.months){
      const day=start.getDate();start.setDate(1);start.setMonth(start.getMonth()-item.months);
      start.setDate(Math.min(day,new Date(start.getFullYear(),start.getMonth()+1,0).getDate()));
    }
    const exclusive=new Date(end);exclusive.setDate(exclusive.getDate()+1);
    return {start:format(start),end:format(end),before:format(exclusive),publishedAfter:start.toISOString(),publishedBefore:new Date(Math.min(exclusive.getTime(),now.getTime())).toISOString()};
  }
  globalThis.UploadDates={intervals,range,format,parse};
})();
