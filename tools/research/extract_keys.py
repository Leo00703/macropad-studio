import re
import sys

src, out = sys.argv[1], sys.argv[2]
cur = None
rows = []
code = None
label = None
for line in open(src, encoding='utf-8'):
    m = re.match(r'^#### BasicKeys :: Void BasicKeys::(\w+)_Click', line)
    if m:
        cur = m.group(1)
        code = label = None
        continue
    if cur is None:
        continue
    m = re.search(r'KP\.Data_Send_Buff\[KP\.KEY_Char_Num\] = (0x[0-9a-f]+|\d+);', line)
    if m:
        code = int(m.group(1), 0)
    m = re.search(r'KP\.KeyChar\[\(KP\.KEY_Char_Num - 5\)\] = (".*?");', line)
    if m:
        label = m.group(1)
    if line.startswith('    return;') and code is not None:
        rows.append((cur, code, label))
        cur = None
with open(out, 'w', encoding='utf-8') as f:
    for name, c, lab in rows:
        f.write(f'{name}\t0x{c:02X}\t{lab}\n')
print(len(rows), 'entries')
