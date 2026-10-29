(() => {
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  let lastURL='';
  function navigate(bounds,feedback){
    try{
      const url=UploadDateSearch.build(location.href,bounds);
      feedback.textContent='Opening YouTube search…';
      // Full native navigation lets YouTube own results, previews and pagination.
      // No persisted choice, API result cards, hidden native items or SPA internals.
      location.assign(url.href);
    }catch(error){feedback.textContent=error.message;}
  }
  function updateControls(){
    const terms=UploadDateSearch.dateOperators(new URL(location.href).searchParams.get('search_query')||'');
    document.querySelectorAll('.ud-current').forEach(n=>{const text=terms.length?`Current search: ${terms.map(x=>x.text).join(' ')}`:'';if(n.textContent!==text)n.textContent=text;n.hidden=!terms.length;});
    document.querySelectorAll('.ud-clear').forEach(n=>{n.hidden=!terms.length;});
  }
  const nativeIds=new Map([['today','Today'],['week','This week'],['month','This month'],['year','This year']]);
  const nativeCodes=new Map([['EgIIAg==','today'],['EgIIAw==','week'],['EgIIBA==','month'],['EgIIBQ==','year']]);
  function nativeId(row){
    const label=row.textContent.trim().toLowerCase();
    for(const [id,text] of nativeIds)if(label===text.toLowerCase())return id;
    try{return nativeCodes.get(new URL(row.querySelector('a[href]')?.href).searchParams.get('sp'));}catch{return undefined;}
  }
  function createControls(group){
    const root=el('div',null,'ud-control');
    const feedback=el('p',null,'ud-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const current=el('p',null,'ud-current');
    const form=el('form',null,'ud-custom');form.hidden=true;
    const startLabel=el('label','Start date'),endLabel=el('label','End date');
    const start=el('input'),end=el('input');
    start.type=end.type='date';start.required=end.required=true;
    start.max=end.max=UploadDates.format(new Date());
    startLabel.append(start);endLabel.append(end);
    const apply=el('button','Apply date range');apply.type='submit';form.append(startLabel,endLabel,apply);
    form.addEventListener('submit',event=>{event.preventDefault();
      try{navigate(UploadDates.range('custom',new Date(),{start:start.value,end:end.value}),feedback);}catch(error){feedback.textContent=error.message;}
    });
    const clear=el('button','Clear date operators','ud-clear');clear.type='button';clear.onclick=()=>navigate(null,feedback);
    root.append(form,current,clear,feedback);
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!form.hidden){
        form.hidden=true;const custom=group.querySelector('[data-interval="custom"]');custom.setAttribute('aria-expanded','false');custom.focus();
      }
    });
    return root;
  }
  function inject(){
    if(location.pathname!=='/results')return;
    document.querySelectorAll('ytd-search-filter-group-renderer').forEach(group=>{
      const rows=[...group.querySelectorAll('ytd-search-filter-renderer')];
      const heading=group.querySelector('#title, yt-formatted-string')?.textContent?.trim();
      const isUpload=heading?.toLowerCase()==='upload date'||rows.some(row=>nativeId(row));
      if(!isUpload||!rows.length)return;
      const parent=rows[0].parentElement;
      // Keep native elements, links, selected state and listeners. Only the obsolete
      // Last hour entry is hidden; no other filter column or result node is touched.
      const natives=new Map();
      for(const row of rows){const id=nativeId(row);if(id&&!natives.has(id))natives.set(id,row);}
      if(![...nativeIds.keys()].every(id=>natives.has(id)))return;
      for(const row of rows){
        if(!nativeId(row)&&row.textContent.trim().toLowerCase()==='last hour')row.setAttribute('data-ud-hidden-native','');
      }
      let root=group.querySelector('.ud-control');
      if(!root)root=createControls(group);
      const sample=[...natives.values()].find(row=>!row.hasAttribute('selected')&&!row.querySelector('[aria-selected="true"]'))||natives.get('today');
      const link=sample.querySelector('a')||sample;
      const text=link.querySelector('yt-formatted-string')||link;
      const type=getComputedStyle(text),spacing=getComputedStyle(link),rowStyle=getComputedStyle(sample);
      // Read the site's actual typography and row spacing instead of changing the
      // column dimensions or imposing screenshot pixel sizes on another viewport.
      const ordered=[];
      for(const item of UploadDates.intervals){
        if(natives.has(item.id)){ordered.push(natives.get(item.id));continue;}
        let row=group.querySelector(`[data-ud-row="${item.id}"]`);
        if(!row){
          row=el('div',null,'ud-row');row.dataset.udRow=item.id;
          const button=el('button',item.label,'ud-option');button.type='button';button.dataset.interval=item.id;
          button.title='Native date search is experimental. Verify upload dates in the results.';
          if(item.id==='custom')button.setAttribute('aria-expanded','false');
          button.onclick=()=>{
            const controls=group.querySelector('.ud-control');
            const feedback=controls.querySelector('.ud-feedback');feedback.textContent='';
            if(item.id==='custom'){
              const form=controls.querySelector('.ud-custom');form.hidden=!form.hidden;button.setAttribute('aria-expanded',String(!form.hidden));
              if(!form.hidden){form.querySelectorAll('input').forEach(input=>input.max=UploadDates.format(new Date()));form.querySelector('input').focus();}
              return;
            }
            try{navigate(UploadDates.range(item.id),feedback);}catch(error){feedback.textContent=error.message;}
          };
          row.append(button);
        }
        const button=row.firstElementChild;
        for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'])button.style[key]=type[key];
        for(const key of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])button.style[key]=spacing[key];
        for(const key of ['marginTop','marginBottom','paddingTop','paddingBottom'])row.style[key]=rowStyle[key];
        if(item.id==='custom'){
          let divider=group.querySelector('.ud-divider');
          if(!divider){divider=el('div',null,'ud-divider');divider.setAttribute('role','separator');}
          ordered.push(divider);
        }
        ordered.push(row);
      }
      ordered.push(root);
      // Repair partially rebuilt panels without duplicating rows or churning the
      // DOM when it is already in order. Moving native nodes preserves identity.
      for(let i=ordered.length-1;i>=0;i--){
        const next=ordered[i+1]||null;
        if(ordered[i].parentElement!==parent||ordered[i].nextSibling!==next)parent.insertBefore(ordered[i],next);
      }
    });
    updateControls();
  }
  function sync(){
    if(lastURL!==location.href){
      lastURL=location.href;
      // Drop the old API-mode flag without restoring its previous selection.
      const url=new URL(location.href);
      if(url.searchParams.has('upload_interval')){url.searchParams.delete('upload_interval');history.replaceState(history.state,'',url);lastURL=location.href;}
      // Reset only extension controls on a new query; never reapply a selection.
      document.querySelectorAll('.ud-control,.ud-row,.ud-divider').forEach(n=>n.remove());
      document.querySelectorAll('[data-ud-hidden-native]').forEach(n=>n.removeAttribute('data-ud-hidden-native'));
    }
    inject();
  }
  let queued=false;
  new MutationObserver(records=>{
    if(records.every(r=>r.target.closest?.('.ud-control,.ud-row')))return;
    if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
  }).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-finish',sync);window.addEventListener('popstate',sync);sync();
})();
