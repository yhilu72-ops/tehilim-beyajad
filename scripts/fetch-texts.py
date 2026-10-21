"""Import only explicitly licensed Hebrew editions; retain provenance in each file."""
import json,html,re,pathlib,urllib.request,urllib.parse,concurrent.futures,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'text-sources';CACHE.mkdir(exist_ok=True)
def get(ref,index=False,version=None):
 key=re.sub('[^a-zA-Z0-9_-]','_',ref)+('_index' if index else '')+('_'+re.sub('[^a-zA-Z0-9]','_',version) if version else '')
 p=CACHE/(key+'.json')
 if p.exists():return json.loads(p.read_text())
 u='https://www.sefaria.org/api/'+('v2/raw/index/' if index else 'texts/')+urllib.parse.quote(ref,safe='')+('' if index else '?context=0&commentary=0')+('&vhe='+urllib.parse.quote(version) if version else '')
 for attempt in range(3):
  try:
   with urllib.request.urlopen(u,timeout=35) as r:d=json.load(r)
   if 'error' in d:raise ValueError(d['error'])
   p.write_text(json.dumps(d,ensure_ascii=False));return d
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def clean(s):return html.unescape(re.sub('<[^>]+>','',s)).strip()
def flat(v):
 if isinstance(v,str):return [clean(v)] if clean(v) else []
 return [s for x in v for s in flat(x)]
def leaves(n,path=[]):
 title=next((t['text'] for t in n.get('titles',[]) if t.get('primary') and t['lang']=='en'),n.get('key',''))
 h=next((t['text'] for t in n.get('titles',[]) if t.get('primary') and t['lang']=='he'),title)
 p=path+([title] if title and not n.get('default') else [])
 if n.get('nodes'):
  for c in n['nodes']:yield from leaves(c,p)
 else:yield ', '.join(p),h
ALLOWED={'Public Domain','CC0','CC-BY','CC-BY-SA'}
# The siddur's copied biblical edition lacks license metadata. Read the
# independently licensed canonical passage instead; do not infer a license.
CANONICAL_SECTIONS={
 'Siddur Ashkenaz, Weekday, Shacharit, Post Service, Ten Commandments':
  ('Exodus 20:2-14','Tanach with Nikkud',13),
}
def canonical_section(ref,label):
 passage,version,expected=CANONICAL_SECTIONS[ref]
 d=get(passage,version=version)
 lines=flat(d.get('he',[]))
 if d.get('heLicense') not in ALLOWED or len(lines)!=expected:
  raise ValueError('Canonical section incomplete or unlicensed: '+passage)
 return {'title':label,'hebrew':lines,
  'source':'https://www.sefaria.org/'+passage.replace(' ','_'),
  'version':d.get('heVersionTitle'),'license':d.get('heLicense'),
  'canonicalRef':passage,'editorialNote':'Biblical verse divisions preserved; HTML removed.'}
def import_sidur(nusach,title):
 index=get(title,True); entries=list(leaves(index['schema']));out={'title':title,'source':'https://www.sefaria.org/'+title.replace(' ','_'),'sections':{}}
 def one(entry):
  ref,label=entry
  if ref in CANONICAL_SECTIONS:return ref,canonical_section(ref,label)
  d=get(ref)
  if not flat(d.get('he',[])):return ref,{'title':label,'hebrew':[]}
  if d.get('heLicense') not in ALLOWED:
   for v in d.get('versions',[]):
    if v.get('language')=='he' and v.get('license') in ALLOWED:
     candidate=get(ref,version=v['versionTitle'])
     if candidate.get('heLicense') in ALLOWED and flat(candidate.get('he',[])):
      d=candidate;break
  if d.get('heLicense') not in ALLOWED:
   print('SECTION NEEDS LICENSE',ref,flush=True)
   return ref,{'title':label,'hebrew':[],'unavailable':True}
  lines=flat(d.get('he',[]))
  return ref,{'title':label,'hebrew':lines,'source':'https://www.sefaria.org/'+ref.replace(' ','_'),'version':d.get('heVersionTitle'),'license':d.get('heLicense')}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
  for ref,data in ex.map(one,entries):
   if data['hebrew']:out['sections'][ref]=data
 (ROOT/'texts'/('sidur_'+nusach+'.json')).write_text(json.dumps(out,ensure_ascii=False))
 print(title,len(out['sections']),'sections imported',flush=True)
if __name__=='__main__':
 (ROOT/'texts').mkdir(exist_ok=True)
 for nusach,title in [('edot_mizrah','Siddur Edot HaMizrach'),('ashkenaz','Siddur Ashkenaz'),('sefarad','Siddur Sefard')]:
  try:import_sidur(nusach,title)
  except Exception as e:print('IMPORT FAILED',title,str(e),flush=True)
