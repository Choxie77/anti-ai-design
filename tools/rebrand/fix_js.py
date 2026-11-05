import sys, re, os
def fix_code(seg):
    seg = re.sub(r"\?\.anti-design(?![\w-])", "?.['anti-design']", seg)
    seg = re.sub(r"(?<=[\w$)\]])\.anti-design(?![\w-])", "['anti-design']", seg)
    seg = re.sub(r"(?<![\w$.\-])anti-design(?=\s*:(?!:))", "'anti-design'", seg)   # object key
    seg = re.sub(r"(?<![\w$.\-'\"])anti-design(?![\w-])", "antiDesign", seg)
    seg = seg.replace('Anti-Design','AntiDesign') if re.search(r"(?<![\w$.\-'\"])Anti-Design(?![\w-])",seg) and False else re.sub(r"(?<![\w$.\-'\"])Anti-Design(?![\w-])","AntiDesign",seg)
    return seg
def scan(src, i, stop_brace=False):
    """Return (out, i). Process code; stop at unmatched '}' when stop_brace."""
    out=[]; n=len(src); cs=i; depth=0
    def flush(e):
        nonlocal cs
        out.append(fix_code(src[cs:e])); cs=e
    prev=''
    while i<n:
        c=src[i]
        if src.startswith('//',i):
            flush(i); j=src.find('\n',i); j=n if j<0 else j; out.append(src[i:j]); i=cs=j
        elif src.startswith('/*',i):
            flush(i); j=src.find('*/',i+2); j=n if j<0 else j+2; out.append(src[i:j]); i=cs=j
        elif c in '"\'':
            flush(i); j=i+1
            while j<n and src[j]!=c and src[j]!='\n': j+= 2 if src[j]=='\\' else 1
            j=min(n,j+1); out.append(src[i:j]); i=cs=j; prev='x'
        elif c=='`':
            flush(i); out.append('`'); j=i+1
            while j<n and src[j]!='`':
                if src[j]=='\\': out.append(src[j:j+2]); j+=2
                elif src.startswith('${',j):
                    out.append('${'); sub,j2=scan(src,j+2,True); out.append(sub+'}'); j=j2
                else: out.append(src[j]); j+=1
            out.append('`'); i=cs=min(n,j+1); prev='x'
        elif c=='/' and prev in ('','(',',','=',':','[','!','&','|','?','{','}',';','\n','>') :
            # regex literal
            flush(i); j=i+1; incls=False
            while j<n and src[j]!='\n':
                ch=src[j]
                if ch=='\\': j+=2; continue
                if ch=='[': incls=True
                elif ch==']': incls=False
                elif ch=='/' and not incls: break
                j+=1
            if j<n and src[j]=='/':
                j+=1
                while j<n and src[j].isalpha(): j+=1
                out.append(src[i:j]); i=cs=j; prev='x'
            else: i+=1
        elif c=='{' : depth+=1; i+=1; prev=c
        elif c=='}':
            if stop_brace and depth==0:
                flush(i); return ''.join(out), i+1
            depth-=1; i+=1; prev=c
        else:
            if not c.isspace(): prev=c
            i+=1
    flush(n); return ''.join(out), n
changed=0
for root in sys.argv[1:]:
    for r,d,f in os.walk(root):
        if 'node_modules' in r: continue
        for x in f:
            if x.endswith(('.js','.mjs','.cjs','.ts','.mts')):
                p=os.path.join(r,x); s=open(p,encoding='utf-8').read()
                if 'anti-design' not in s and 'Anti-Design' not in s: continue
                t,_=scan(s,0)
                if s!=t: open(p,'w',encoding='utf-8').write(t); changed+=1
print(changed,"js/ts files adjusted")
