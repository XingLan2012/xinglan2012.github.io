import subprocess, json, sys

# 尝试获取 Agnes API 可用模型列表
cmd = [
    "curl", "-s",
    "https://apihub.agnes-ai.com/v1/models",
    "-H", "Authorization: Bearer sk-f9ErHsuhF4dzN5zHYLnUCn8kEI7T0xPVwzB8HDzLD97RJp1i"
]
try:
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if r.returncode == 0 and r.stdout:
        data = json.loads(r.stdout)
        models = [m["id"] for m in data.get("data", [])]
        print("可用模型:")
        for m in models:
            print(f"  - {m}")
        if not models:
            print("返回数据:", json.dumps(data, indent=2, ensure_ascii=False)[:500])
    else:
        print("错误:", r.stderr[:500])
        print("输出:", r.stdout[:500])
except Exception as e:
    print("异常:", e)
