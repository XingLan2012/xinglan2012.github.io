import subprocess, os
os.chdir(r"C:\Users\何梓熠\Documents\code\xinglan2012.github.io")
# 删除临时文件
for f in ['git_commit.bat', 'git_cmds.bat', 'run_git.bat', '_git_run.py', '_git_do.py']:
    try:
        os.remove(f)
        print(f"已删除 {f}")
    except:
        pass
