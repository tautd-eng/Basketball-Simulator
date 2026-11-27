import json, numpy as np
G={l.split()[0]:int(l.split()[1]) for f in ['g1.txt','g2.txt','g3.txt','g4.txt','g5.txt','g6.txt'] for l in open(f) if l.strip()}
C=json.load(open('combine.json')); P=json.load(open('proxy.json'))
H=json.load(open('/home/claude/nba-sim/data/history.json'))['players']
ps=np.array([o['a'] for o in P.values()]); psd=ps.std()
out={}
for pid in H:
    p=P.get(pid); px=(p['a']/psd) if p else 0.0   # proxy, unit sd
    if pid in G:
        g=(G[pid]-5)/2.0
        if pid in C: v=0.65*g+0.2*C[pid]+0.15*px*0.5
        else: v=0.8*g+0.2*px*0.5
    else:
        k=0.55
        v=(0.5*C[pid]+0.5*px*k) if pid in C else px*k
    out[pid]=round(float(v),2)
v=np.array(list(out.values())); print('n',len(out),'mean',v.mean().round(3),'sd',v.std().round(3))
cur=np.array([out[p] for p in G if p in out]); print('curated mean/sd',cur.mean().round(2),cur.std().round(2))
# centre on the league (curated players carry most minutes)
m=cur.mean()
out={k:round(x-m,2) for k,x in out.items()}
json.dump(out,open('/home/claude/nba-sim/data/ath.json','w'),separators=(',',':'))
for n in ['jamesle01','westbru01','jokicni01','rosede01','nashst01','wembavi01','curryst01','antetgi01','doncilu01','birdla01']: print(n,out.get(n))
