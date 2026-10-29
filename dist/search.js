/* Only compose normal YouTube search URLs. Never synthesize native renderers. */
(() => {
  function dateOperators(query) {
    const found=[];let quoted=false;
    for(let i=0;i<query.length;i++){
      if(query[i]==='\\'){i++;continue;}
      if(query[i]==='"'){quoted=!quoted;continue;}
      if(!quoted&&(i===0||/\s/.test(query[i-1]))){
        const match=/^(after|before):\d{4}-\d{2}-\d{2}(?=\s|$)/i.exec(query.slice(i));
        if(match){found.push({index:i,length:match[0].length,text:match[0]});i+=match[0].length-1;}
      }
    }
    return found;
  }
  function strip(query){
    let output=query;
    for(const match of dateOperators(query).reverse())output=output.slice(0,match.index)+output.slice(match.index+match.length);
    return output.trim();
  }
  function build(href,bounds){
    const url=new URL(href);
    if(url.origin!=='https://www.youtube.com'||url.pathname!=='/results')throw new Error('Open a YouTube search page first.');
    const query=strip(url.searchParams.get('search_query')||'');
    if(!query)throw new Error('Enter a search query before applying a date range.');
    if(bounds){UploadDates.parse(bounds.start);UploadDates.parse(bounds.before);}
    url.searchParams.set('search_query',bounds?`${query} after:${bounds.start} before:${bounds.before}`:query);
    url.searchParams.delete('upload_interval'); // migrate old API-mode URLs without reapplying them
    return url;
  }
  globalThis.UploadDateSearch={dateOperators,strip,build};
})();
