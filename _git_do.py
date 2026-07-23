import subprocess, os
os.chdir(r"C:\Users\何梓熠\Documents\code\xinglan2012.github.io")

steps = [
    (["git", "add", "-A"], "git add"),
    (["git", "status"], "git status"),
    (["git", "commit", "-m", "feat: index.html动态背景轮播(bg1~bg3)，移除旧渐变背景"], "git commit"),
    (["git", "push"], "git push"),
]
for cmd, label in steps:
    print(f"=== {label} ===")
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = (r.stdout or "").strip()
    err = (r.stderr or "").strip()
    if out:
        print(out)
    if err:
        print(err)
    if r.returncode != 0:
        if "nothing to commit" in err or "Everything up-to-date" in err:
            break
        print(f"⚠ 退出码 {r.returncode}")
        break
print("\n✅ 完成")
