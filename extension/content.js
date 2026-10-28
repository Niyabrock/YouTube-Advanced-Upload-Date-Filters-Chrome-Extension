(() => {
  const PARAM='upload_interval';
  let generation=0, lastRoute='', results=null, pending=false, asOf=new Date().toISOString();
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const current=()=>new URL(location.href);
  const chosen=()=>UploadDates.intervals.find(x=>x.id===current().searchParams.get(PARAM));
  function setInterval(id) {
    const url=current();if(id)url.searchParams.set(PARAM,id);else url.searchParams.delete(PARAM);
    history.pushState(null,'',url);sync(true);
  }
  function restore() {
    results?.remove();results=null;
    document.querySelectorAll('[data-upload-dates-hidden]').forEach(n=>{n.hidden=false;n.removeAttribute('data-upload-dates-hidden');});
  }
  function inject() {
    if(location.pathname!=='/results') return;
    // Use renderer identity first, English heading only as a guarded fallback.
    document.querySelectorAll('ytd-search-filter-group-renderer').forEach(group=>{
      if(group.querySelector('.ud-control')) return;
      const links=[...group.querySelectorAll('a[href]')];
      const heading=group.querySelector('#title, yt-formatted-string')?.textContent?.trim();
      const isUpload=heading?.toLowerCase()==='upload date'||links.some(a=>{
        try {const sp=new URL(a.href).searchParams.get('sp');return ['EgIIAQ==','EgIIAg==','EgIIAw==','EgIIBA==','EgIIBQ=='].includes(sp);}catch{return false;}
      });
      if(!isUpload) return;
      const root=el('div',null,'ud-control');
      const toggle=el('button','More upload dates ▾','ud-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');
      const box=el('div',null,'ud-options');box.hidden=true;
      toggle.onclick=()=>{box.hidden=!box.hidden;toggle.setAttribute('aria-expanded',String(!box.hidden));};
      box.addEventListener('keydown',e=>{
        const buttons=[...box.querySelectorAll('button')];let index=buttons.indexOf(document.activeElement);
        if(e.key==='Escape'){box.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}
        if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();index=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[index]?.focus();}
      });
      for(const unit of ['weeks','months','years']) {
        box.append(el('div',unit[0].toUpperCase()+unit.slice(1),'ud-heading'));
        for(const item of UploadDates.intervals.filter(x=>x.unit===unit)) {
          const b=el('button',item.label);b.type='button';b.dataset.interval=item.id;
          b.onclick=()=>{box.hidden=true;toggle.setAttribute('aria-expanded','false');setInterval(item.id);};box.append(b);
        }
      }
      const clear=el('button','Clear extra date filter');clear.type='button';clear.onclick=()=>setInterval(null);box.append(clear);
      const settings=el('button','API key settings');settings.type='button';settings.onclick=()=>chrome.runtime.sendMessage({type:'options'});box.append(settings);
      root.append(toggle,box);group.append(root);updateControls();
    });
  }
  function updateControls(){const item=chosen();document.querySelectorAll('.ud-toggle').forEach(n=>n.textContent=item?`${item.label} ▾`:'More upload dates ▾');document.querySelectorAll('[data-interval]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.interval===item?.id)));}
  async function search(pageToken, token) {
    if(pending)return;pending=true;
    const status=results.querySelector('[role=status]');status.textContent='Searching YouTube…';
    const more=results.querySelector('.ud-more');if(more)more.disabled=true;
    try {
      const data=await chrome.runtime.sendMessage({type:'search',query:current().searchParams.get('search_query'),interval:chosen().id,pageToken,asOf});
      if(token!==generation)return;
      if(data?.error)throw new Error(data.error);
      const list=results.querySelector('.ud-list');
      for(const item of data.items){
        const card=el('article',null,'ud-card');const a=el('a');a.href=`/watch?v=${item.id}`;
        const img=el('img');img.src=`https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`;img.alt='';img.loading='lazy';a.append(img);
        const body=el('div');const title=el('a',item.title,'ud-title');title.href=a.href;
        body.append(title,el('p',`${item.channel} · ${new Date(item.published).toLocaleDateString()}`),el('p',item.description));card.append(a,body);list.append(card);
      }
      status.textContent=list.children.length?`${list.children.length} videos loaded. Range: ${data.bounds.publishedAfter} to ${data.bounds.publishedBefore} (UTC).`:'No videos found in this range.';
      more?.remove();if(data.nextPageToken){const b=el('button','Load more','ud-more');b.onclick=()=>search(data.nextPageToken,token);results.append(b);}
    } catch(error){if(token===generation){status.textContent=error.message;const b=el('button','Retry');b.onclick=()=>{b.remove();search(pageToken,token);};status.append(b);}}
    finally {if(token===generation)pending=false;}
  }
  function mount(){
    if(results||!chosen()||location.pathname!=='/results')return;
    const native=document.querySelector('ytd-search #contents ytd-section-list-renderer #contents');
    if(!native)return;
    results=el('section',null,'ud-results');results.setAttribute('aria-label','Upload date search results');
    results.append(el('h2',chosen().label),el('p','YouTube Data API results · Videos only · Native filters and sorting are not applied in this mode. Clear to return to native results.'));
    const clear=el('button','Return to native results');clear.onclick=()=>setInterval(null);
    const settings=el('button','API key settings');settings.onclick=()=>chrome.runtime.sendMessage({type:'options'});
    const status=el('p');status.setAttribute('role','status');results.append(clear,settings,status,el('div',null,'ud-list'));
    // Only hide result item sections; retain the native filter panel and all its listeners.
    for(const child of native.children)if(!child.hidden&&child.matches('ytd-item-section-renderer, ytd-continuation-item-renderer')){child.hidden=true;child.setAttribute('data-upload-dates-hidden','');}
    native.prepend(results);search(null,generation);
  }
  function sync(force=false){
    if(force||lastRoute!==location.href){lastRoute=location.href;generation++;pending=false;asOf=new Date().toISOString();restore();updateControls();}
    inject();mount();
  }
  document.addEventListener('click',e=>{
    const link=e.target.closest?.('ytd-search-filter-renderer a');
    if(link&&chosen()) {const url=current();url.searchParams.delete(PARAM);history.replaceState(null,'',url);generation++;pending=false;asOf=new Date().toISOString();restore();updateControls();}
  },true);
  let queued=false;
  new MutationObserver(records=>{if(records.every(r=>r.target.closest?.('.ud-control,.ud-results')))return;if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-finish',()=>sync());window.addEventListener('popstate',()=>sync());sync();
})();
