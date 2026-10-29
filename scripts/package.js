// Small dependency-free ZIP writer: deflate data plus CRC-32 and central directory.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
const {version}=JSON.parse(readFileSync('dist/manifest.json','utf8'));
const filename=`more-youtube-upload-dates-${version}.zip`;
const table=Uint32Array.from({length:256},(_,i)=>{
 let value=i;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;
});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=(value>>>8)^table[(value^byte)&255];return (value^0xffffffff)>>>0;}
function files(dir,prefix=''){
 return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>entry.isDirectory()?files(`${dir}/${entry.name}`,`${prefix}${entry.name}/`):[{path:`${dir}/${entry.name}`,name:prefix+entry.name}]);
}
const localParts=[],centralParts=[];let offset=0;
const entries=[...files('dist'),{path:'README.md',name:'README.md'}];
for(const entry of entries){
 const name=Buffer.from(entry.name),data=readFileSync(entry.path),compressed=deflateRawSync(data),crc=crc32(data);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);
 local.writeUInt16LE((2026-1980)<<9|1<<5|1,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);
 central.writeUInt16LE((2026-1980)<<9|1<<5|1,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
 localParts.push(local,name,compressed);centralParts.push(central,name);offset+=local.length+name.length+compressed.length;
}
const directory=Buffer.concat(centralParts),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
writeFileSync(filename,Buffer.concat([...localParts,directory,end]));
console.log(`Created ${filename}; extract it and Load unpacked from its root.`);
