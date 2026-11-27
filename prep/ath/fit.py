import csv, json, math, unicodedata, re
import numpy as np
from collections import defaultdict
rows=json.load(open('rows.json'))
norm=lambda s: re.sub(r'[^a-z]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace(' jr','').replace(' iii','').replace(' ii',''))
F=['blk','stl','orb','ftr','dunk','rim','drb']
byp=defaultdict(list)
for r in rows: byp[r['pid']].append(r)
def feats(rs, maxage=26):
    rs=[r for r in rs if r['age']<=maxage] or rs
    out={}
    for f in F:
        v=[(r['r'+f],r['mp']) for r in rs if 'r'+f in r]
        if v: w=sum(m for _,m in v); out[f]=sum(a*m for a,m in v)/w
    out['mp']=sum(r['mp'] for r in rs); return out
pf={p:feats(rs) for p,rs in byp.items()}
names={}
for p,rs in byp.items(): names.setdefault(norm(rs[0]['name']),p)
C=list(csv.DictReader(open('comb/nba_draft_combine_all_years.csv')))
n=lambda v: float(v) if v not in ('',None) else None
cm=[]
for c in C:
    v=n(c['Vertical (Max)']); vs=n(c['Vertical (No Step)']); sp=n(c['Sprint']); ag=n(c['Agility']); h=n(c['Height (No Shoes)']); w=n(c['Weight'])
    if None in (v,vs,sp,ag,h,w): continue
    cm.append(dict(name=c['Player'],v=v,vs=vs,sp=sp,ag=ag,h=h,w=w))
# size-adjusted combine composite
X=np.array([[1,c['h'],c['w']] for c in cm])
comp=np.zeros(len(cm))
for k,sg in (('v',1),('vs',1),('sp',-1),('ag',-1)):
    y=np.array([c[k] for c in cm]); b,*_=np.linalg.lstsq(X,y,rcond=None); res=(y-X@b); comp+=sg*res/res.std()
comp/=comp.std()
for c,v in zip(cm,comp): c['comp']=v
M=[(c, pf[names[norm(c['name'])]]) for c in cm if norm(c['name']) in names]
M=[(c,f) for c,f in M if f['mp']>=1500 and all(k in f for k in F)]
print('matched',len(M))
Y=np.array([c['comp'] for c,_ in M]); Xf=np.array([[1]+[f[k] for k in F] for _,f in M])
for k in F: print(k, round(np.corrcoef([f[k] for _,f in M],Y)[0,1],3))
b,*_=np.linalg.lstsq(Xf,Y,rcond=None); pred=Xf@b
print('weights',dict(zip(['c']+F,np.round(b,3))),'r',round(np.corrcoef(pred,Y)[0,1],3))
json.dump({'w':dict(zip(F,b[1:].tolist()))},open('w.json','w'))
# a model without shooting-location data (before 1997)
F2=['blk','stl','orb','ftr','drb']
X2=np.array([[1]+[f[k] for k in F2] for _,f in M]); b2,*_=np.linalg.lstsq(X2,Y,rcond=None)
print('pre-97 weights',dict(zip(['c']+F2,np.round(b2,3))),'r',round(np.corrcoef(X2@b2,Y)[0,1],3))
W1=dict(zip(F,b[1:])); W2=dict(zip(F2,b2[1:]))
# per season proxy and per-player peak level
for r in rows:
    if 'rdunk' in r and 'rrim' in r: r['ap']=sum(W1[k]*r.get('r'+k,0) for k in F); r['src']=1
    else: r['ap']=sum(W2[k]*r.get('r'+k,0) for k in F2); r['src']=2
out={}
for p,rs in byp.items():
    young=[r for r in rs if r['age']<=27] or rs
    mp=sum(r['mp'] for r in young); a=sum(r['ap']*r['mp'] for r in young)/mp
    # how reliable: the location data model is roughly twice as informative
    rel=0.5 if all(r['src']==1 for r in young) else 0.25
    k=mp/(mp+2500)
    out[p]=dict(name=rs[0]['name'],raw=a,a=a*k*(1/0.515 if rel==0.5 else 1/0.3)*0.5,mp=mp,first=min(r['s'] for r in rs),last=max(r['s'] for r in rs),ht=rs[0]['ht'],wt=rs[0]['wt'],
                dunk36=None)
# standardise the shrunk estimate to sd ~ the reliability share of 1
v=np.array([o['a'] for o in out.values()]); print('proxy sd',v.std())
json.dump(out,open('proxy.json','w'))
# combine where measured overrides most
cmb={names[norm(c['name'])]:c['comp'] for c in cm if norm(c['name']) in names}
json.dump(cmb,open('combine.json','w')); print('combine players',len(cmb))
