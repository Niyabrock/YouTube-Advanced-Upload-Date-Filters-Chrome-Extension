import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');await cp('extension','dist',{recursive:true});console.log('Load dist/ as an unpacked Chrome extension.');
