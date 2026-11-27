import csv, math, json, unicodedata, re
import numpy as np
from collections import defaultdict
D='src/Data/'
R=lambda n: list(csv.DictReader(open(D+n)))
def num(v):
    try: x=float(v); return x if math.isfinite(x) else None
    except: return None
info={r['player_id']:r for r in R('Player Career Info.csv')}
TOT=('TOT','2TM','3TM','4TM','5TM')
def pick(rows):
    out={}
    for r in rows:
        if r['lg']!='NBA': continue
        k=(r['player_id'],int(r['season']))
        if k not in out or r['team'] in TOT: out[k]=r
    return out
adv=pick(R('Advanced.csv')); tot=pick(R('Player Totals.csv')); sh=pick(R('Player Shooting.csv'))
rows=[]
for k,a in adv.items():
    pid,s=k
    if s<1980: continue
    mp=num(a['mp']); i=info.get(pid); t=tot.get(k)
    if not mp or mp<250 or not i or not t: continue
    ht=num(i['ht_in_in']); wt=num(i['wt'])
    if not ht or not wt: continue
    h=sh.get(k)
    fga=num(t['fga']) or 0
    r=dict(pid=pid,name=a['player'],s=s,mp=mp,ht=ht,wt=wt,age=num(a['age']) or 25,
       blk=num(a['blk_percent']) or 0, stl=num(a['stl_percent']) or 0, orb=num(a['orb_percent']) or 0, drb=num(a['drb_percent']) or 0,
       ftr=num(a['f_tr']) or 0, usg=num(a['usg_percent']) or 15, ast=num(a['ast_percent']) or 10, tpar=num(a['x3p_ar']) or 0,
       dunk=None, rim=None)
    if h and s>=1997:
        d=num(h['num_of_dunks']); rr=num(h['percent_fga_from_x0_3_range'])
        if d is not None: r['dunk']=math.log(d/mp*36+0.15)
        if rr is not None: r['rim']=rr
    rows.append(r)
print('rows',len(rows))
F=['blk','stl','orb','ftr','dunk','rim','drb']
# per-season standardization (minutes-weighted)
bys=defaultdict(list)
for r in rows: bys[r['s']].append(r)
for s,rs in bys.items():
    for f in F+['usg','ast','tpar']:
        v=[(r[f],r['mp']) for r in rs if r[f] is not None]
        if not v: continue
        w=np.array([m for _,m in v]); x=np.array([q for q,_ in v])
        mu=(x*w).sum()/w.sum(); sd=math.sqrt(((x-mu)**2*w).sum()/w.sum())
        if not sd or not math.isfinite(sd): sd=1
        for r in rs:
            if r[f] is not None: r['z'+f]=(r[f]-mu)/sd
# residualize each feature on size and role
ZF={}
for f in F:
    rs=[r for r in rows if 'z'+f in r and all(k in r for k in ('zusg','zast','ztpar'))]
    X=np.array([[1,(r['ht']-79)/3.5,(r['wt']-220)/25,((r['ht']-79)/3.5)**2,r['zusg'],r['zast'],r['ztpar']] for r in rs])
    y=np.array([r['z'+f] for r in rs]); w=np.array([r['mp'] for r in rs])
    W=np.sqrt(w)
    b,*_=np.linalg.lstsq(X*W[:,None],y*W,rcond=None)
    res=y-X@b; sd=math.sqrt((res**2*w).sum()/w.sum())
    for r,e in zip(rs,res): r['r'+f]=e/sd
    print(f, 'coef', np.round(b,2))
json.dump([{k:v for k,v in r.items()} for r in rows], open('rows.json','w'))
