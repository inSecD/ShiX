import io
import os
import sys

root = r'C:\Users\insec\Downloads\ShiX\src'
bad = []
for dirpath, _, files in os.walk(root):
    for f in files:
        if not f.endswith(('.ts', '.tsx', '.css')):
            continue
        p = os.path.join(dirpath, f)
        s = io.open(p, encoding='utf-8').read()
        for i, l in enumerate(s.split('\n')):
            if any(0x4E00 <= ord(c) <= 0x9FFF for c in l):
                bad.append((p, i + 1, ascii(l)))
print('files scanned. CJK leftovers:', len(bad))
for b in bad:
    print(b[0].split('ShiX')[1], b[1], b[2])
