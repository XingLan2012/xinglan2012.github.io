import os, glob

# 使用相对路径，不含用户信息
temp_patterns = [
    "git_*.bat", "run_*.bat",
    "_*.py", "cleanup_temp.py"
]

for pattern in temp_patterns:
    for f in glob.glob(pattern):
        try:
            os.remove(f)
            print(f"已删除: {f}")
        except:
            pass

print("清理完成")
