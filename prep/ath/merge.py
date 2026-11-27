"""Writes each player's athleticism (peak level, z; see final.py) into data/history.json as "a"."""
import json
H=json.load(open('data/history.json')); A=json.load(open('data/ath.json'))
for pid,p in H['players'].items(): p['a']=A.get(pid,0.0)
json.dump(H,open('data/history.json','w'),ensure_ascii=False,separators=(',',':'))
print('merged',len(A))
