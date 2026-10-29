const key=document.querySelector('#key'), status=document.querySelector('#status');
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
chrome.storage.local.get('apiKey').then(v=>{status.textContent=v.apiKey?'A key is saved. Enter a new key to replace it.':'No key saved.';});
document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();await chrome.storage.local.set({apiKey:key.value.trim()});key.value='';status.textContent='Key saved locally. Native date searches do not use this key.';});
document.querySelector('#remove').onclick=async()=>{await chrome.storage.local.remove('apiKey');key.value='';status.textContent='Key removed.';};
