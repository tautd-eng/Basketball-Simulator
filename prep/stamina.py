"""Stamina (z) from real minutes: how many minutes a player played compared with players of the same quality in
the same decade (median minutes per bpm bin), averaged over his career by games x minutes and shrunk for short
careers. Writes data/stamina.json and merges it into data/history.json as "sta"."""
import json, numpy as np
from collections import defaultdict
H=json.load(open('data/history.json'))
keys=H['keys']; ow=H['ovr']
bpm=lambda z: ow['_']+sum(ow[k]*z[i] for i,k in enumerate(keys))
rows=[[pid,s[0],s[2],s[3]/s[2],bpm(s[7])] for pid,p in H['players'].items() for s in p['s'] if s[2]>=25 and s[3]>0]
key=lambda r:((r[1]-1980)//10, max(-8,min(8,round(r[4]*2)/2)))
B=defaultdict(list)
for r in rows: B[key(r)].append(r[3])
med={k:np.median(v) for k,v in B.items()}
by=defaultdict(list)
for r in rows: by[r[0]].append((r[3]-med[key(r)], r[2], r[3]))
st={}
for pid,v in by.items():
    g=sum(x[1]*x[2] for x in v); m=sum(x[0]*x[1]*x[2] for x in v)/g; n=sum(x[1] for x in v)
    st[pid]=m*n/(n+150)
sd=np.std(list(st.values()))
st={k:round(v/sd,2) for k,v in st.items()}
json.dump(st,open('data/stamina.json','w'),separators=(',',':'))
for pid,p in H['players'].items():
    if pid in st: p['sta']=st[pid]
json.dump(H,open('data/history.json','w'),ensure_ascii=False,separators=(',',':'))
print('stamina for',len(st))
