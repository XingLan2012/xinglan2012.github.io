import subprocess, os
os.chdir(r"C:\Users\何梓熠\Documents\code\xinglan2012.github.io")
for cmd, label in [
    (["git", "add", "-A"], "add"),
    (["git", "commit", "-m", "feat: 全局bg1~bg3动态背景轮播，welcome.html半透明衬底，index.html隐藏轮播保留星空"], "commit"),
    (["git", "push"], "push"),
]:
    print(f"=== git {label} ===")
    r = subprocess.run(cmd, capture_output=True, text=True)
    o = (r.stdout or "").strip()
    e = (r.stderr or "").strip()
    if o: print(o)
    if e: print(e)
    if r.returncode != 0 and "nothing to commit" not in e:
        break
print("\n✅ 完成")
