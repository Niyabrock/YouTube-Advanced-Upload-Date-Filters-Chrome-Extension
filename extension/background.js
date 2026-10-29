import './dates.js';
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}));
class SearchError extends Error {}
function apiError(status, reason) {
  if(['quotaExceeded','dailyLimitExceeded'].includes(reason))return 'YouTube API quota exceeded. Try again after quota resets or check your project quota.';
  if(['keyInvalid','API_KEY_INVALID'].includes(reason))return 'The API key was rejected. Replace the key in extension settings and ensure it belongs to the correct project.';
  if(['accessNotConfigured','serviceDisabled'].includes(reason))return 'Enable YouTube Data API v3 in the Google Cloud project that owns this API key.';
  if(['ipRefererBlocked','forbidden'].includes(reason))return 'The API key restrictions blocked this request. Check the key’s API and application restrictions in Google Cloud.';
  return `YouTube API request failed (HTTP ${status}). Check that your API key is valid, YouTube Data API v3 is enabled, and the key restrictions allow extension requests.`;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id!==chrome.runtime.id) return;
  let trusted=false;
  try{trusted=new URL(sender.tab?.url).origin==='https://www.youtube.com';}catch{}
  if(!trusted)return;
  if(message?.type==='options'){chrome.runtime.openOptionsPage().then(()=>reply({ok:true}),()=>reply({error:'Could not open settings. Use the extension’s Options from chrome://extensions.'}));return true;}
  if(message?.type!=='search')return;
  (async()=>{
    const {apiKey}=await chrome.storage.local.get('apiKey');
    if (typeof apiKey!=='string'||!apiKey.trim()) throw new SearchError('Configure your YouTube Data API key in extension settings first. Saving a key does not verify API access.');
    const q=String(message.query||'').slice(0,1000);
    if (!q.trim()) throw new SearchError('Enter a YouTube search query first.');
    const now=message.asOf?new Date(message.asOf):new Date();
    if(!Number.isFinite(now.getTime()) || now.getTime()>Date.now()+60000) throw new SearchError('Invalid search timestamp. Select the interval again.');
    if(!UploadDates.intervals.some(x=>x.id===message.interval))throw new SearchError('Invalid date interval. Reload this YouTube tab.');
    const bounds=UploadDates.range(message.interval,now,message.custom);
    const params=new URLSearchParams({part:'snippet',type:'video',q,maxResults:'25',order:'relevance',...bounds,key:apiKey.trim()});
    if (message.pageToken) {
      if(typeof message.pageToken!=='string'||message.pageToken.length>512) throw new SearchError('Invalid page token. Select the interval again.');
      params.set('pageToken',message.pageToken);
    }
    let response;
    try{response=await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`,{signal:AbortSignal.timeout(20000),credentials:'omit'});}
    catch(error){throw new SearchError(['TimeoutError','AbortError'].includes(error.name)?'YouTube API timed out. Check your connection and retry.':'Could not reach YouTube Data API. Check your connection and retry.');}
    let data;
    try{data=await response.json();}catch{throw new SearchError('YouTube API returned an invalid response. Retry the search.');}
    if(!response.ok)throw new SearchError(apiError(response.status,data?.error?.errors?.[0]?.reason));
    if(!data||!Array.isArray(data.items))throw new SearchError('YouTube API returned an invalid response. Retry the search.');
    const after=Date.parse(bounds.publishedAfter),before=Date.parse(bounds.publishedBefore);
    // API performs the search across its index. Validate returned records too,
    // so malformed or out-of-range records can never appear as eligible videos.
    const items=data.items.filter(x=>/^[\w-]{11}$/.test(x?.id?.videoId||'')&&x.snippet&&typeof x.snippet.title==='string'&&Number.isFinite(Date.parse(x.snippet.publishedAt))&&Date.parse(x.snippet.publishedAt)>=after&&Date.parse(x.snippet.publishedAt)<=before)
      .map(x=>({id:x.id.videoId,title:x.snippet.title,channel:x.snippet.channelTitle||'',published:x.snippet.publishedAt,description:x.snippet.description||''}));
    return {items,nextPageToken:typeof data.nextPageToken==='string'?data.nextPageToken:null,bounds};
  })().then(reply,error=>reply({error:error instanceof SearchError?error.message:'The extension could not complete the search. Reload the extension and this YouTube tab, then retry.'}));
  return true;
});
