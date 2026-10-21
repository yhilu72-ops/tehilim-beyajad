import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
test('Every Psalm and Song chapter has nonempty aligned Hebrew and English verses',async()=>{for(const [file,n,total]of [['tehilim.json',150,2527],['shir_hashirim.json',8,117]]){const d=await json(file);assert.deepEqual(Object.keys(d.chapters),Array.from({length:n},(_,i)=>String(i+1)));let count=0;for(const ch of Object.values(d.chapters)){assert.ok(ch.hebrew.every(v=>typeof v==='string'&&v.trim()));assert.ok(ch.english.every(v=>typeof v==='string'&&v.trim()));assert.equal(ch.hebrew.length,ch.english.length);count+=ch.hebrew.length;}assert.equal(count,total);assert.equal(d.license,'Public Domain');}});
test('All included sidur sections have explicit reusable licenses and nonempty text',async()=>{for(const name of ['edot_mizrah','ashkenaz','sefarad']){const d=await json('texts/sidur_'+name+'.json');assert.ok(Object.keys(d.sections).length>100);for(const s of Object.values(d.sections)){assert.ok(['Public Domain','CC0','CC-BY','CC-BY-SA'].includes(s.license));assert.ok(s.source&&s.version);assert.ok(s.hebrew.length&&s.hebrew.every(x=>x.trim()));}}});
test('Perek Shira includes all six chapters',async()=>{const d=await json('perek_shira.json');for(let i=1;i<=6;i++)assert.ok(d.sections['perek_'+i].hebrew.length);});
test('Ashkenaz Ten Commandments retains the licensed canonical Exodus passage',async()=>{
 const d=await json('texts/sidur_ashkenaz.json');
 const s=d.sections['Siddur Ashkenaz, Weekday, Shacharit, Post Service, Ten Commandments'];
 assert.equal(s.canonicalRef,'Exodus 20:2-14');
 assert.equal(s.license,'Public Domain');
 assert.equal(s.version,'Tanach with Nikkud');
 assert.equal(s.hebrew.length,13);
 // Digest of the fetched, HTML-cleaned canonical passage: prevents accidental
 // verse loss, reordering or edits during later imports and cleanup.
 assert.equal(createHash('sha256').update(s.hebrew.join('\n')).digest('hex'),'35402d38aa1435ea6a15e7e35d8a8c18c3488af6348846abe46fe631411cc991');
});
