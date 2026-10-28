import './dates.js';
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}));
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id!==chrome.runtime.id) return;
  if (message.type==='options' && sender.tab?.url?.startsWith('https://www.youtube.com/')) {
    chrome.runtime.openOptionsPage(); return;
  }
  if (message.type!=='search' || !sender.tab?.url?.startsWith('https://www.youtube.com/')) return;
  (async()=>{
    const {apiKey}=await chrome.storage.local.get('apiKey');
    if (!apiKey) throw new Error('Configure your YouTube Data API key in extension settings first.');
    const q=String(message.query||'').slice(0,1000);
    if (!q.trim()) throw new Error('Enter a YouTube search query first.');
    const now=message.asOf?new Date(message.asOf):new Date();
    if(!Number.isFinite(now.getTime()) || now.getTime()>Date.now()+60000) throw new Error('Invalid search timestamp');
    const bounds=UploadDates.range(message.interval,now);
    const params=new URLSearchParams({part:'snippet',type:'video',q,maxResults:'25',order:'relevance',...bounds,key:apiKey});
    if (message.pageToken) {
      if(typeof message.pageToken!=='string'||message.pageToken.length>512) throw new Error('Invalid page token');
      params.set('pageToken',message.pageToken);
    }
    const response=await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`,{signal:AbortSignal.timeout(20000),credentials:'omit'});
    const data=await response.json();
    if (!response.ok) {
      const reason=data.error?.errors?.[0]?.reason;
      throw new Error(reason==='quotaExceeded'?'YouTube API quota exceeded. Try again after quota resets.':`YouTube API request failed (${response.status}${reason?`, ${reason}`:''}). Check your key and API restrictions.`);
    }
    return {items:(data.items||[]).filter(x=>/^[\w-]{11}$/.test(x.id?.videoId||'')).map(x=>({id:x.id.videoId,title:x.snippet.title,channel:x.snippet.channelTitle,published:x.snippet.publishedAt,description:x.snippet.description})),nextPageToken:data.nextPageToken||null,bounds};
  })().then(reply,error=>reply({error:error.message.includes('fetch')?'Could not reach YouTube Data API. Check your connection.':error.message}));
  return true;
});
