import sys, re, os
def fix_code(seg):
    seg = seg.replace('anti-design', 'anti_design')
    seg = seg.replace('Anti-Design', 'AntiDesign')
    return seg
def process(src):
    out=[]; i=0; n=len(src); code_start=0
    def flush(end):
        nonlocal code_start
        out.append(fix_code(src[code_start:end])); code_start=end
    while i<n:
        c=src[i]
        if src.startswith('//',i):
            flush(i); j=src.find('\n',i); j=n if j<0 else j; out.append(src[i:j]); i=j; code_start=i
        elif src.startswith('/*',i):
            flush(i); depth=1; j=i+2
            while j<n and depth:
                if src.startswith('/*',j): depth+=1; j+=2
                elif src.startswith('*/',j): depth-=1; j+=2
                else: j+=1
            out.append(src[i:j]); i=j; code_start=i
        elif c in 'rbc' and re.match(r'(?:br|cr|r)#*"',src[i:i+40]) and (i==0 or not (src[i-1].isalnum() or src[i-1]=='_')):
            m=re.match(r'(?:br|cr|r)(#*)"',src[i:]); h=m.group(1); end='"'+h
            flush(i); j=src.find(end,i+len(m.group(0)))
            j=n if j<0 else j+len(end); out.append(src[i:j]); i=j; code_start=i
        elif c=='"':
            flush(i); j=i+1
            while j<n and src[j]!='"':
                j+= 2 if src[j]=='\\' else 1
            j=min(n,j+1); out.append(src[i:j]); i=j; code_start=i
        elif c=="'":
            m=re.match(r"'(\\.[^']*|[^\\'])'",src[i:i+12])
            if m:
                flush(i); out.append(m.group(0)); i+=len(m.group(0)); code_start=i
            else: i+=1
        else: i+=1
    flush(n)
    return ''.join(out)
changed=0
for root in sys.argv[1:]:
    for r,d,f in os.walk(root):
        for x in f:
            if x.endswith('.rs'):
                p=os.path.join(r,x); s=open(p,encoding='utf-8').read(); t=process(s)
                if s!=t: open(p,'w',encoding='utf-8').write(t); changed+=1
print(changed,"rust files adjusted")
