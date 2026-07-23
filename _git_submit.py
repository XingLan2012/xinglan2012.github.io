import subprocess, os, sys
os.chdir(r"C:\Users\何梓熠\Documents\code\xinglan2012.github.io")
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

r1 = subprocess.run(["git", "add", "-A"], capture_output=True, text=True)
print("add:", r1.stderr or "ok")

r2 = subprocess.run(["git", "commit", "-m", "feat: 冰晶吊坠+下拉导航面板，全局左上角冰晶图标"], capture_output=True, text=True)
print("commit:", r2.stdout or r2.stderr)

r3 = subprocess.run(["git", "push"], capture_output=True, text=True)
print("push:", r3.stdout or r3.stderr)

print("\n✅ 完成")
