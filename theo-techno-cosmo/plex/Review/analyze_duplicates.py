import os
import json
import re
import glob
from collections import Counter

base = r"c:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign\theo-techno-cosmo\plex\Review\preference_pairs_output_qc"
files = sorted(glob.glob(os.path.join(base, '*.jsonl')))
files = [f for f in files if 'ALL' not in os.path.basename(f)]

rows = []
for path in files:
    with open(path, 'r', encoding='utf-8') as fh:
        for line in fh:
            if line.strip():
                obj = json.loads(line)
                rows.append((os.path.basename(path), obj))

norm = lambda s: re.sub(r'\s+', ' ', s.strip().lower())

# exact duplicates
by_prompt = {}
for source, obj in rows:
    p = norm(obj.get('prompt', ''))
    by_prompt.setdefault(p, []).append((source, obj))

exact_groups = [(p, items) for p, items in by_prompt.items() if len(items) > 1]
print(f'exact duplicate prompt groups: {len(exact_groups)}')
for prompt, items in exact_groups[:20]:
    print('---')
    print(prompt)
    for source, obj in items:
        print(source, obj.get('pair_id'))

# near duplicates by token Jaccard on non-stopword tokens
stop = {'the','a','an','and','or','of','to','for','with','in','on','is','are','be','this','that','it','as','from','into','when','what','how','why','who','can','should','would','could','do','does','did','your','you','our','we','my','i','be','been','being','will','shall','must','may','might','if','then','than','but','not','no','yes'}

def tokenize(text):
    toks = re.findall(r"[a-z0-9']+", norm(text))
    return [t for t in toks if t not in stop]

seen = set()
near = []
for i in range(len(rows)):
    for j in range(i + 1, len(rows)):
        p1 = rows[i][1].get('prompt', '')
        p2 = rows[j][1].get('prompt', '')
        t1 = set(tokenize(p1))
        t2 = set(tokenize(p2))
        if not t1 or not t2:
            continue
        jac = len(t1 & t2) / len(t1 | t2)
        if jac >= 0.7:
            key = tuple(sorted([rows[i][1].get('pair_id', ''), rows[j][1].get('pair_id', '')]))
            if key not in seen:
                seen.add(key)
                near.append((jac, rows[i][1].get('pair_id'), rows[j][1].get('pair_id'), p1[:180], p2[:180]))

print(f'near duplicate prompt pairs: {len(near)}')
for item in near[:20]:
    print(item[0], item[1], item[2])
    print('  ', item[3])
    print('  ', item[4])
