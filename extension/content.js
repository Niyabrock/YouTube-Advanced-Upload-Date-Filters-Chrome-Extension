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
    document.querySelectorAll('.ud-current').forEach(n=>{n.textContent=terms.length?`Current search: ${terms.map(x=>x.text).join(' ')}`:'';n.hidden=!terms.length;});
    document.querySelectorAll('.ud-clear').forEach(n=>{n.hidden=!terms.length;});
  }
  function inject(){
    if(location.pathname!=='/results')return;
    document.querySelectorAll('ytd-search-filter-group-renderer').forEach(group=>{
      if(group.querySelector('.ud-control'))return;
      const heading=group.querySelector('#title, yt-formatted-string')?.textContent?.trim();
      const isUpload=heading?.toLowerCase()==='upload date'||[...group.querySelectorAll('a[href]')].some(a=>{
        try{return ['EgIIAQ==','EgIIAg==','EgIIAw==','EgIIBA==','EgIIBQ=='].includes(new URL(a.href).searchParams.get('sp'));}catch{return false;}
      });
      if(!isUpload)return;
      const root=el('div',null,'ud-control');
      const toggle=el('button','More upload dates ▾','ud-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');
      const box=el('div',null,'ud-options');box.hidden=true;
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
      toggle.onclick=()=>{start.max=end.max=UploadDates.format(new Date());box.hidden=!box.hidden;toggle.setAttribute('aria-expanded',String(!box.hidden));};
      box.addEventListener('keydown',event=>{
        if(event.key==='Escape'){box.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();return;}
        if(event.target.tagName!=='BUTTON')return;
        const buttons=[...box.querySelectorAll('button')].filter(n=>!n.hidden&&!n.closest('[hidden]'));
        let index=buttons.indexOf(document.activeElement);
        if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
          event.preventDefault();index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[index]?.focus();
        }
      });
      box.append(el('p','Native date search is experimental. Verify upload dates in the results.','ud-note'));
      // Exact requested preset order; native options above remain untouched.
      for(const item of UploadDates.intervals){
        const button=el('button',item.label);button.type='button';button.dataset.interval=item.id;
        if(item.id==='custom')button.setAttribute('aria-expanded','false');
        button.onclick=()=>{
          feedback.textContent='';
          if(item.id==='custom'){form.hidden=!form.hidden;button.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)start.focus();return;}
          try{navigate(UploadDates.range(item.id),feedback);}catch(error){feedback.textContent=error.message;}
        };
        box.append(button);
      }
      box.append(form,current);
      const clear=el('button','Clear date operators','ud-clear');clear.type='button';clear.onclick=()=>navigate(null,feedback);box.append(clear);
      const note=el('p','Other YouTube filters remain active and may narrow this date range.','ud-note');box.append(note);
      root.append(toggle,box,feedback);group.append(root);
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
      document.querySelectorAll('.ud-control').forEach(n=>n.remove());
    }
    inject();
  }
  let queued=false;
  new MutationObserver(records=>{
    if(records.every(r=>r.target.closest?.('.ud-control')))return;
    if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
  }).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-finish',sync);window.addEventListener('popstate',sync);sync();
})();
