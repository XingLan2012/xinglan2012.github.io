import subprocess, os
os.chdir(r"C:\Users\何梓熠\Documents\code\xinglan2012.github.io")
subprocess.run(["git", "add", "-A"])
r = subprocess.run(["git", "status"], capture_output=True, text=True)
print(r.stdout)
r2 = subprocess.run(["git", "commit", "-m", "refactor: welcome.html纯黑背景，index.html进入正页后还原为dark主题默认bg逻辑"], capture_output=True, text=True)
print(r2.stdout or r2.stderr)
r3 = subprocess.run(["git", "push"], capture_output=True, text=True)
print(r3.stdout or r3.stderr)
