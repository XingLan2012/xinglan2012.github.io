"""执行 git add / commit / push"""
import subprocess, sys, os
os.chdir(r"C:\Users\何梓熠\Documents\code\xinglan2012.github.io")

steps = [
    ("git", "add", "-A"),
    ("git", "commit", "-m", "refactor: welcome.html纯黑背景，index.html进入正页后还原为dark主题默认bg逻辑"),
    ("git", "push"),
]
for cmd in steps:
    label = cmd[1]
    print(f"\n=== git {label} ===")
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = (r.stdout or "").strip()
    err = (r.stderr or "").strip()
    if out:
        print(out)
    if err:
        print(err)
    if r.returncode != 0 and "nothing to commit" not in err and "Everything up-to-date" not in err:
        print(f"⚠ 返回码 {r.returncode}", file=sys.stderr)
        break
print("\n✅ 完成")
