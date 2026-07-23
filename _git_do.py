import subprocess, os
os.chdir(r"C:\Users\何梓熠\Documents\code\xinglan2012.github.io")
for cmd, lbl in [
    (["git", "add", "-A"], "add"),
    (["git", "commit", "-m", "refactor: 冰晶吊坠→碎星之列，金色碎星SVG图标+金色主题"], "commit"),
    (["git", "push"], "push"),
]:
    print(f"=== {lbl} ===")
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(r.stdout or r.stderr or "ok")
print("✅ 完成")
