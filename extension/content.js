(() => {
  const PARAM='upload_interval';
  let lastRoute='', results=null, state=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const current=()=>new URL(location.href);
  const chosen=()=>UploadDates.intervals.find(x=>x.id===current().searchParams.get(PARAM));
  function setInterval(id) {
    const url=current();if(id)url.searchParams.set(PARAM,id);else url.searchParams.delete(PARAM);
    history.pushState(history.state,'',url);sync(true);
  }
  function restore() {
    results?.remove();results=null;
    document.querySelectorAll('[data-upload-dates-hidden]').forEach(n=>n.removeAttribute('data-upload-dates-hidden'));
  }
  function openSettings(){
    chrome.runtime.sendMessage({type:'options'}).catch(()=>{
      if(state){state.error='Extension connection lost. Reload this YouTube tab and try again.';render();}
    });
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
      const settings=el('button','API key settings');settings.type='button';settings.onclick=openSettings;box.append(settings);
      root.append(toggle,box);group.append(root);updateControls();
    });
  }
  function updateControls(){const item=chosen();document.querySelectorAll('.ud-toggle').forEach(n=>n.textContent=item?`${item.label} ▾`:'More upload dates ▾');document.querySelectorAll('[data-interval]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.interval===item?.id)));}
  function connectionMessage(error) {
    if(/context invalidated|receiving end|message port|could not establish connection/i.test(error?.message||''))
      return 'Extension connection lost. Reload this YouTube tab after reloading the extension, then try again.';
    return error?.message||'The search failed. Retry or clear the custom filter.';
  }
  async function request(message) {
    let timer;
    try {
      return await Promise.race([
        chrome.runtime.sendMessage(message),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The extension did not respond within 25 seconds. Reload this YouTube tab and retry.')),25000);})
      ]);
    } finally {clearTimeout(timer);}
  }
  async function search(session, pageToken) {
    if(session!==state||session.busy)return;
    session.busy=true;session.error='';render();
    try {
      const data=await request({type:'search',query:session.query,interval:session.item.id,pageToken,asOf:session.asOf});
      if(session!==state)return;
      if(data?.error)throw new Error(data.error);
      if(!data||!Array.isArray(data.items)||!data.bounds)throw new Error('The extension returned an invalid response. Reload the extension and this tab, then retry.');
      session.items.push(...data.items);session.bounds=data.bounds;session.next=data.nextPageToken;
      session.retryPage=undefined;
    } catch(error) {
      if(session!==state)return;
      session.error=connectionMessage(error);session.retryPage=pageToken;
    } finally {
      if(session===state){session.busy=false;render();}
    }
  }
  function hideNative(host) {
    // Keep the native panel and search header alive. Hide results at the renderer
    // boundary, so newly appended continuations cannot reintroduce old videos.
    const candidates=new Set([...host.children,...host.querySelectorAll('ytd-section-list-renderer, ytd-rich-grid-renderer, ytd-item-section-renderer, ytd-continuation-item-renderer, ytd-video-renderer, ytd-channel-renderer, ytd-playlist-renderer, ytd-shelf-renderer, ytd-rich-item-renderer, yt-lockup-view-model')]);
    for(const node of candidates){
      if(node===results||results?.contains(node)||node.contains(results)||node.matches('ytd-search-sub-menu-renderer, ytd-search-filter-group-renderer')||node.querySelector('ytd-search-filter-group-renderer, ytd-search-sub-menu-renderer'))continue;
      if(!node.hasAttribute('data-upload-dates-hidden'))node.setAttribute('data-upload-dates-hidden','');
    }
  }
  function mount(){
    if(!state)return;
    if(results?.isConnected){hideNative(results.parentElement);return;}
    results=null;
    const searchRoot=[...document.querySelectorAll('ytd-search')].find(n=>!n.hidden);
    const host=searchRoot?.querySelector('ytd-two-column-search-results-renderer #primary, #primary')||searchRoot||document.querySelector('ytd-page-manager, main, [role=main]');
    if(!host){
      for(const control of document.querySelectorAll('.ud-control')){
        let feedback=control.querySelector('.ud-feedback');
        if(!feedback){feedback=el('p',null,'ud-feedback');feedback.setAttribute('role','status');control.append(feedback);}
        feedback.textContent=state.error||'Unable to locate YouTube’s results area. Reload this tab or clear the custom filter.';
      }
      return;
    }
    document.querySelectorAll('.ud-feedback').forEach(n=>n.remove());
    results=el('section',null,'ud-results');results.setAttribute('aria-label','Upload date search results');
    const clear=el('button','Return to native results');clear.type='button';clear.onclick=()=>setInterval(null);
    const settings=el('button','API key settings');settings.type='button';settings.onclick=openSettings;
    const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    results.append(el('h2',state.item.label),el('p','YouTube Data API results · Videos only · Native filters and sorting are not applied in this mode. Clear to return to native results.'),clear,settings,status,el('div',null,'ud-list'),el('div',null,'ud-actions'));
    host.prepend(results);hideNative(host);
    // A YouTube rerender remounts cached state, without another API/quota request.
    paint();
  }
  function paint(){
    if(!state||!results?.isConnected)return;
    results.setAttribute('aria-busy',String(state.busy));
    const status=results.querySelector('[role=status]');
    status.textContent=state.error||(state.busy?`Searching YouTube… ${state.item.label}`:state.items.length?`${state.items.length} videos loaded. Range: ${state.bounds.publishedAfter} to ${state.bounds.publishedBefore} (UTC).`:'No videos found in this range. Try another interval or clear the custom filter.');
    status.classList.toggle('ud-loading',state.busy);
    const list=results.querySelector('.ud-list');list.replaceChildren();
    for(const item of state.items){
      const card=el('article',null,'ud-card');const a=el('a');a.href=`/watch?v=${item.id}`;
      const img=el('img');img.src=`https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`;img.alt='';img.loading='lazy';a.append(img);
      const body=el('div');const title=el('a',item.title,'ud-title');title.href=a.href;
      body.append(title,el('p',`${item.channel} · ${new Date(item.published).toLocaleDateString()}`),el('p',item.description));card.append(a,body);list.append(card);
    }
    const actions=results.querySelector('.ud-actions');actions.replaceChildren();
    if(state.error||state.next){
      const button=el('button',state.error?'Retry':'Load more');button.type='button';button.disabled=state.busy;
      button.onclick=()=>search(state,state.error?state.retryPage:state.next);actions.append(button);
    }
  }
  function render(){mount();paint();}
  function sync(force=false){
    if(force||lastRoute!==location.href){
      lastRoute=location.href;restore();
      document.querySelectorAll('.ud-feedback').forEach(n=>n.remove());
      const item=chosen();state=location.pathname==='/results'&&item?{item,query:current().searchParams.get('search_query')||'',asOf:new Date().toISOString(),items:[],next:null,busy:false,error:''}:null;
      updateControls();inject();
      if(state){render();search(state);}
    } else {inject();mount();}
  }
  document.addEventListener('click',e=>{
    const link=e.target.closest?.('ytd-search-filter-renderer a');
    if(link&&chosen()){
      const url=current();url.searchParams.delete(PARAM);history.replaceState(history.state,'',url);sync(true);
    }
  },true);
  let queued=false;
  new MutationObserver(records=>{
    if(records.every(r=>r.target.closest?.('.ud-control,.ud-results')))return;
    if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
  }).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-finish',()=>sync());window.addEventListener('popstate',()=>sync());sync();
})();
