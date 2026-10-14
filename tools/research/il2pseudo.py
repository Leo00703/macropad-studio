"""Convertitore IL testuale (output di IlDump.cs) -> pseudo-codice via simulazione dello stack.
Uso: python -I il2pseudo.py <file_il_pulito> <regex_tipo> <regex_metodo>
"""
import re
import sys

def split_params(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '[<':
            depth += 1
        elif ch in ']>':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out

def short(s):
    s = s.replace('HIDTester.FormMain+KeyParam', 'KP').replace('HIDTester.FormMain', 'Form')
    s = s.replace('HIDTester.', '').replace('HidLibrary.', '').replace('System.', '')
    s = s.replace('HID.', '')
    return s

def load(path):
    methods, cur_type, cur = [], None, None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        m = re.match(r'^=== TYPE (.+?) : ', line)
        if m:
            cur_type = m.group(1)
            continue
        m = re.match(r'^  (METHOD|CTOR) (.*)$', line)
        if m:
            cur = {'type': cur_type, 'header': m.group(2), 'il': [], 'locals': {}}
            methods.append(cur)
            continue
        m = re.match(r'^    \.local (\d+) : (.*)$', line)
        if m and cur is not None:
            cur['locals'][int(m.group(1))] = m.group(2)
            continue
        m = re.match(r'^    (IL_[0-9A-F]{4}): (\S+) ?(.*)$', line)
        if m and cur is not None:
            cur['il'].append((m.group(1), m.group(2), m.group(3).strip()))
    return methods

def fmt_int(v):
    v = int(v)
    return str(v) if -1 <= v < 10 else hex(v)

CMP = {'beq': '==', 'bne.un': '!=', 'bge': '>=', 'bge.un': '>=', 'bgt': '>', 'bgt.un': '>',
       'ble': '<=', 'ble.un': '<=', 'blt': '<', 'blt.un': '<'}
BIN = {'add': '+', 'sub': '-', 'mul': '*', 'div': '/', 'div.un': '/', 'rem': '%', 'rem.un': '%',
       'and': '&', 'or': '|', 'xor': '^', 'shl': '<<', 'shr': '>>', 'shr.un': '>>',
       'add.ovf': '+', 'sub.ovf': '-', 'mul.ovf': '*', 'add.ovf.un': '+', 'sub.ovf.un': '-', 'mul.ovf.un': '*'}
CONV = {'conv.u1': 'byte', 'conv.i1': 'sbyte', 'conv.u2': 'ushort', 'conv.i2': 'short', 'conv.i4': 'int',
        'conv.u4': 'uint', 'conv.i8': 'long', 'conv.u8': 'ulong', 'conv.r4': 'float', 'conv.r8': 'double',
        'conv.i': 'nint', 'conv.u': 'nuint', 'conv.r.un': 'double'}

def decompile(meth):
    il = meth['il']
    targets = set()
    for _, op, arg in il:
        if op.startswith('br') or op in ('leave', 'leave.s') or op in CMP or op.rstrip('.s') in CMP:
            if arg.startswith('IL_'):
                targets.add(arg)
        if op == 'switch':
            targets.update(re.findall(r'IL_[0-9A-F]{4}', arg))
    snaps = {}
    stack, out = [], []
    dead = False

    def pop():
        return stack.pop() if stack else '?'

    def emit(s, ind=1):
        out.append('    ' * ind + s)

    for lab, op, arg in il:
        if lab in targets:
            if dead:
                stack = list(snaps.get(lab, []))
                dead = False
            else:
                snaps.setdefault(lab, list(stack))
            out.append(f'  {lab}:')
        base = op[:-2] if op.endswith('.s') and op not in ('ldc.i4.s',) else op
        # --- loads
        if op.startswith('ldarg'):
            n = op.split('.')[-1] if '.' in op else arg
            stack.append('this' if n == '0' else f'arg{n}')
        elif op in ('ldloc.0', 'ldloc.1', 'ldloc.2', 'ldloc.3'):
            stack.append('loc' + op[-1])
        elif op in ('ldloc.s', 'ldloc'):
            stack.append('loc' + arg)
        elif op in ('ldloca.s', 'ldloca'):
            stack.append('&loc' + arg)
        elif op in ('stloc.0', 'stloc.1', 'stloc.2', 'stloc.3'):
            emit(f'loc{op[-1]} = {pop()};')
        elif op in ('stloc.s', 'stloc'):
            emit(f'loc{arg} = {pop()};')
        elif op.startswith('ldc.i4.m1'):
            stack.append('-1')
        elif op.startswith('ldc.i4.') and op not in ('ldc.i4.s',):
            stack.append(op.split('.')[-1])
        elif op in ('ldc.i4.s', 'ldc.i4'):
            stack.append(fmt_int(arg.split(' ')[0]))
        elif op in ('ldc.i8', 'ldc.r4', 'ldc.r8'):
            stack.append(arg)
        elif op == 'ldstr':
            stack.append(arg)
        elif op == 'ldnull':
            stack.append('null')
        elif op == 'ldsfld':
            t, f = arg.rsplit('::', 1)
            stack.append(f'{short(t)}.{f}')
        elif op == 'ldsflda':
            t, f = arg.rsplit('::', 1)
            stack.append(f'&{short(t)}.{f}')
        elif op in ('ldfld', 'ldflda'):
            t, f = arg.rsplit('::', 1)
            o = pop()
            stack.append(f'{o}.{f}')
        elif op == 'stsfld':
            t, f = arg.rsplit('::', 1)
            emit(f'{short(t)}.{f} = {pop()};')
        elif op == 'stfld':
            t, f = arg.rsplit('::', 1)
            v = pop()
            o = pop()
            emit(f'{o}.{f} = {v};')
        elif op.startswith('ldelem'):
            i = pop()
            a = pop()
            stack.append(f'{a}[{i}]')
        elif op.startswith('stelem'):
            v = pop()
            i = pop()
            a = pop()
            emit(f'{a}[{i}] = {v};')
        elif op == 'ldlen':
            stack.append(f'{pop()}.Length')
        elif op == 'newarr':
            stack.append(f'new {short(arg)}[{pop()}]')
        elif op in ('call', 'callvirt', 'newobj'):
            kind, ret, sig = (arg.split(';', 2) + ['', ''])[:3] if ';' in arg else ('?', 'Void', arg)
            mm = re.match(r'^(.*)::([^:(]+)\((.*)\)$', sig)
            if not mm:
                emit(f'// ? {arg}')
                continue
            tname, mname, params = mm.group(1), mm.group(2), split_params(mm.group(3))
            args = [pop() for _ in params][::-1]
            if op == 'newobj':
                stack.append(f'new {short(tname)}({", ".join(args)})')
            else:
                recv = None
                if kind == 'instance':
                    recv = pop()
                full = None
                if mname.startswith('get_') and not args and recv is not None:
                    full = f'{recv}.{mname[4:]}'
                elif mname.startswith('set_') and len(args) == 1 and recv is not None:
                    emit(f'{recv}.{mname[4:]} = {args[0]};')
                    continue
                else:
                    owner = recv if recv is not None else short(tname)
                    full = f'{owner}.{mname}({", ".join(args)})'
                if ret == 'Void' or ret == 'System.Void':
                    emit(full + ';')
                else:
                    stack.append(full)
        elif op == 'pop':
            e = pop()
            if '(' in e:
                emit(e + ';')
        elif op == 'dup':
            stack.append(stack[-1] if stack else '?')
        elif op in BIN:
            b = pop()
            a = pop()
            stack.append(f'({a} {BIN[op]} {b})')
        elif op == 'neg':
            stack.append(f'-{pop()}')
        elif op == 'not':
            stack.append(f'~{pop()}')
        elif op in CONV:
            stack.append(f'({CONV[op]}){pop()}')
        elif op == 'ceq':
            b = pop()
            a = pop()
            stack.append(f'({a} == {b})')
        elif op in ('cgt', 'cgt.un'):
            b = pop()
            a = pop()
            stack.append(f'({a} > {b})')
        elif op in ('clt', 'clt.un'):
            b = pop()
            a = pop()
            stack.append(f'({a} < {b})')
        elif op in ('box', 'unbox.any', 'castclass', 'isinst'):
            e = pop()
            stack.append(f'({short(arg)}){e}' if op != 'box' else e)
        elif op in ('ldtoken', 'ldftn'):
            stack.append(f'&{short(arg)}')
        elif op == 'ldvirtftn':
            pop()
            stack.append(f'&{short(arg)}')
        elif op.startswith('ldind'):
            stack.append(f'*{pop()}')
        elif op.startswith('stind'):
            v = pop()
            a = pop()
            emit(f'*{a} = {v};')
        elif op == 'initobj':
            emit(f'{pop()} = default;')
        elif op in ('ldobj',):
            stack.append(f'*{pop()}')
        elif op in ('stobj',):
            v = pop()
            a = pop()
            emit(f'*{a} = {v};')
        # --- control flow
        elif op in ('br', 'br.s'):
            snaps.setdefault(arg, list(stack))
            emit(f'goto {arg};')
            dead = True
        elif op in ('leave', 'leave.s'):
            emit(f'leave {arg};')
            stack = []
            dead = True
        elif op in ('brtrue', 'brtrue.s', 'brfalse', 'brfalse.s'):
            c = pop()
            snaps.setdefault(arg, list(stack))
            emit(f'if ({"!" if "false" in op else ""}{c}) goto {arg};')
        elif base in CMP:
            b = pop()
            a = pop()
            snaps.setdefault(arg, list(stack))
            emit(f'if ({a} {CMP[base]} {b}) goto {arg};')
        elif op == 'switch':
            x = pop()
            for t in re.findall(r'IL_[0-9A-F]{4}', arg):
                snaps.setdefault(t, list(stack))
            emit(f'switch ({x}) -> {arg}')
        elif op == 'ret':
            emit(f'return {pop()};' if stack else 'return;')
            dead = True
        elif op == 'throw':
            emit(f'throw {pop()};')
            dead = True
        elif op == 'endfinally':
            emit('endfinally;')
            dead = True
        elif op == 'nop' or op.endswith('.') or op in ('constrained.', 'volatile.', 'tail.', 'unaligned.'):
            pass
        else:
            emit(f'// unhandled {op} {arg}')
    return out

def main():
    path, trx, mrx = sys.argv[1], sys.argv[2], sys.argv[3]
    fout = open(sys.argv[4], 'w', encoding='utf-8') if len(sys.argv) > 4 else sys.stdout
    for m in load(path):
        if re.search(trx, m['type'] or '') and re.search(mrx, m['header']):
            print('\n#### ' + short(m['type']) + ' :: ' + short(m['header']), file=fout)
            for i, t in sorted(m['locals'].items()):
                print(f'    // loc{i}: {short(t)}', file=fout)
            for l in decompile(m):
                print(l, file=fout)

if __name__ == '__main__':
    main()
