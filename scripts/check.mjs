import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile('index.html','utf8');let n=0;
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(attrs.includes('src=')||!body.trim())continue;new vm.Script(body,{filename:`inline-${++n}.js`});}
for(const file of (await readdir('assets')).filter(x=>x.endsWith('.js')))new vm.Script(await readFile('assets/'+file,'utf8'));
const data=JSON.parse(await readFile('tehilim.json'));if(Object.keys(data.chapters).length!==150||data.total_verses!==2527)throw Error('Incomplete Psalms');
for(const [number,ch]of Object.entries(data.chapters)){if(!ch.hebrew.length||ch.hebrew.length!==ch.english.length)throw Error('Verse alignment '+number);}
for(const file of ['tehilim.json','shir_hashirim.json','tikun_klali.json','perek_shira.json',...(await readdir('texts')).map(x=>'texts/'+x)]){const s=await readFile(file,'utf8');JSON.parse(s);if(/pending_text|Texto local pendiente/.test(s))throw Error('Placeholder '+file);}
console.log(`${n} inline scripts parsed; release script parsed; 150 chapters / 2527 verses aligned; JSON readings valid`);
